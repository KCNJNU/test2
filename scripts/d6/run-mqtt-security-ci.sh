#!/usr/bin/env bash
set -euo pipefail

: "${EMQX_IMAGE:?EMQX_IMAGE must be the reviewed EMQX 6.1.4 digest}"
[[ "$EMQX_IMAGE" =~ ^emqx/emqx@sha256:[0-9a-f]{64}$ ]] || { echo 'EMQX_IMAGE must be digest-only' >&2; exit 1; }

pki_dir=$(mktemp -d "${RUNNER_TEMP:-/tmp}/d6-mqtt.XXXXXX")
container="d6-emqx-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
crl_server_pid=''
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  if [[ -n "$crl_server_pid" ]]; then kill "$crl_server_pid" >/dev/null 2>&1 || true; fi
  if [[ -d "$pki_dir" && "$pki_dir" == "${RUNNER_TEMP:-/tmp}"/* ]]; then rm -rf -- "$pki_dir"; fi
}
trap cleanup EXIT

mkdir -p "$pki_dir/newcerts"
: > "$pki_dir/index.txt"
printf '1000\n' > "$pki_dir/serial"
printf '1000\n' > "$pki_dir/crlnumber"
export PKI_DIR="$pki_dir"
cat > "$pki_dir/openssl.cnf" <<'EOF'
[ req ]
distinguished_name = request_dn
[ request_dn ]
[ ca ]
default_ca = platform_ca
[ platform_ca ]
dir = $ENV::PKI_DIR
database = $dir/index.txt
new_certs_dir = $dir/newcerts
certificate = $dir/ca.pem
private_key = $dir/ca-key.pem
serial = $dir/serial
crlnumber = $dir/crlnumber
default_md = sha256
default_days = 30
default_crl_days = 1
policy = supplied_cn
unique_subject = no
copy_extensions = copy
crl_extensions = crl_ext
[ supplied_cn ]
commonName = supplied
[ v3_ca ]
basicConstraints = critical,CA:true
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always
[ server_ext ]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = DNS:localhost
[ client_ext ]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = clientAuth
crlDistributionPoints = URI:http://host.docker.internal:18080/ca.crl
[ crl_ext ]
authorityKeyIdentifier = keyid:always
issuingDistributionPoint = critical,@issuing_dp
[ issuing_dp ]
fullname = URI:http://host.docker.internal:18080/ca.crl
onlyuser = TRUE
EOF

openssl_checked() {
  if ! openssl "$@" > /dev/null 2> "$pki_dir/openssl-error.log"; then
    sed 's/^/openssl: /' "$pki_dir/openssl-error.log" >&2
    return 1
  fi
}

openssl_checked req -new -x509 -newkey rsa:2048 -nodes -days 30 -config "$pki_dir/openssl.cnf" -extensions v3_ca -subj '/CN=D6 CI Root CA' -keyout "$pki_dir/ca-key.pem" -out "$pki_dir/ca.pem"
issue() {
  local name=$1 cn=$2 extension=$3
  openssl_checked req -new -newkey rsa:2048 -nodes -subj "/CN=$cn" -keyout "$pki_dir/$name-key.pem" -out "$pki_dir/$name.csr"
  openssl_checked ca -batch -config "$pki_dir/openssl.cnf" -extensions "$extension" -in "$pki_dir/$name.csr" -out "$pki_dir/$name.pem"
}

robot_a='11111111-1111-4111-8111-111111111111'
robot_b='22222222-2222-4222-8222-222222222222'
issue server localhost server_ext
issue robot-a "$robot_a" client_ext
issue robot-b "$robot_b" client_ext
issue gateway device-gateway client_ext
openssl_checked ca -gencrl -config "$pki_dir/openssl.cnf" -out "$pki_dir/ca.crl"
chmod 0444 "$pki_dir"/*.pem "$pki_dir"/*-key.pem "$pki_dir/ca.crl"

python3 -m http.server 18080 --bind 0.0.0.0 --directory "$pki_dir" > "$pki_dir/crl-http.log" 2>&1 &
crl_server_pid=$!

docker run --detach --name "$container" --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  --add-host host.docker.internal:host-gateway -p 127.0.0.1:8883:8883 \
  -e EMQX_NODE_COOKIE=d6-ci-cookie -e EMQX_CRL_CACHE__REFRESH_INTERVAL=5s \
  -v "$PWD/deploy/emqx/emqx.conf:/opt/emqx/etc/emqx.conf:ro" \
  -v "$PWD/deploy/emqx/acl.conf:/opt/emqx/etc/acl.conf:ro" \
  -v "$pki_dir:/opt/emqx/etc/certs:ro" "$EMQX_IMAGE" >/dev/null

healthy=false
for _ in {1..45}; do
  if docker exec "$container" /opt/emqx/bin/emqx ctl status >/dev/null 2>&1; then healthy=true; break; fi
  sleep 2
done
if [[ "$healthy" != true ]]; then docker logs "$container"; exit 1; fi

node - "$pki_dir" "$robot_a" "$robot_b" <<'NODE'
const fs = require('node:fs');
const [dir, robotA, robotB] = process.argv.slice(2);
const identity = (id, name) => ({ id, certFile: `${dir}/${name}.pem`, keyFile: `${dir}/${name}-key.pem` });
fs.writeFileSync(`${dir}/manifest.json`, JSON.stringify({
  broker: 'mqtts://localhost:8883', caFile: `${dir}/ca.pem`, serverName: 'localhost',
  identities: [identity(robotA, 'robot-a'), identity(robotB, 'robot-b'), identity('device-gateway', 'gateway')],
}));
NODE

node scripts/d6/mqtt-security-acceptance.mjs "$pki_dir/manifest.json"
node scripts/d6/assert-certificate-status.mjs "$pki_dir/manifest.json"
chmod 0600 "$pki_dir/ca-key.pem"
openssl_checked ca -config "$pki_dir/openssl.cnf" -revoke "$pki_dir/robot-b.pem"
openssl_checked ca -gencrl -config "$pki_dir/openssl.cnf" -out "$pki_dir/ca.crl"
chmod 0444 "$pki_dir/ca.crl"
sleep 8
EXPECT_REVOKED=true node scripts/d6/assert-certificate-status.mjs "$pki_dir/manifest.json"
