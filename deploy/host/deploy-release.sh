#!/usr/bin/env bash
set -Eeuo pipefail

MANIFEST=${1:?usage: deploy-release.sh MANIFEST ACTOR}
ACTOR=${2:?deployment actor is required}
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
PACKAGE_ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd)
CONFIG_FILE=${DEPLOYMENT_CONFIG_FILE:-/opt/robot-platform/config/deployment.env}

[[ $ACTOR =~ ^[A-Za-z0-9._@-]{1,128}$ ]] || { echo 'Deployment actor is invalid' >&2; exit 1; }
[[ -f $CONFIG_FILE ]] || { echo "Deployment configuration is missing" >&2; exit 1; }
# shellcheck disable=SC1090
source "$CONFIG_FILE"
: "${DEPLOY_ROOT:?}" "${RUNTIME_ENV_FILE:?}" "${DVC_REPOSITORY_PATH:?}" "${PLATFORM_RUNTIME_NETWORK:?}" "${PLATFORM_EDGE_NETWORK:?}" "${DEPLOYMENT_ENVIRONMENT:?}" "${EDGE_IMAGE:?}"
[[ $EDGE_IMAGE =~ ^[a-z0-9./_-]+@sha256:[0-9a-f]{64}$ ]] || { echo 'EDGE_IMAGE must be an immutable digest reference' >&2; exit 1; }
if [[ $DEPLOYMENT_ENVIRONMENT == PRODUCTION ]]; then
  : "${EMQX_IMAGE:?}" "${TLS_CERT_DIR:?}" "${EDGE_SERVER_NAME:?}" "${EDGE_CA_FILE:?}"
  [[ ${EDGE_PORT:-} == 80 ]] || { echo 'Production EDGE_PORT must be 80 so HTTP is redirect-only' >&2; exit 1; }
  [[ $EMQX_IMAGE =~ ^emqx/emqx@sha256:[0-9a-f]{64}$ ]] || { echo 'EMQX_IMAGE must be the approved EMQX 6.1.4 digest' >&2; exit 1; }
  [[ -d $TLS_CERT_DIR && -f $EDGE_CA_FILE ]] || { echo 'Vault-rendered production TLS material is missing' >&2; exit 1; }
fi

for command in docker jq curl flock; do command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 1; }; done
[[ -f $RUNTIME_ENV_FILE ]] || { echo 'Runtime environment file is missing' >&2; exit 1; }
runtime_mode=$(stat -c '%a' "$RUNTIME_ENV_FILE")
[[ $runtime_mode == 600 || $runtime_mode == 400 ]] || { echo 'Runtime environment file must have mode 0600 or 0400' >&2; exit 1; }
[[ -d $DVC_REPOSITORY_PATH/.git ]] || { echo 'DVC repository must be a pre-provisioned Git worktree' >&2; exit 1; }

version=$(jq -er '.version' "$MANIFEST")
commit=$(jq -er '.gitCommit' "$MANIFEST")
build_time=$(jq -er '.buildTime' "$MANIFEST")
[[ $version =~ ^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || { echo 'Manifest version is invalid' >&2; exit 1; }
[[ $commit =~ ^[0-9a-f]{40}$ ]] || { echo 'Manifest commit is invalid' >&2; exit 1; }
[[ $(jq '.images | length' "$MANIFEST") -eq 5 ]] || { echo 'Manifest must contain five images' >&2; exit 1; }

image_ref() {
  local name=$1 repository digest
  repository=$(jq -er --arg name "$name" '.images[] | select(.name == $name) | .repository' "$MANIFEST")
  digest=$(jq -er --arg name "$name" '.images[] | select(.name == $name) | .digest' "$MANIFEST")
  [[ $repository =~ ^ghcr\.io/[a-z0-9._/-]+$ && $digest =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "Immutable image reference for $name is invalid" >&2; exit 1; }
  printf '%s@%s' "$repository" "$digest"
}

mkdir -p "$DEPLOY_ROOT/releases" "$DEPLOY_ROOT/audit" "$DEPLOY_ROOT/edge" "$DEPLOY_ROOT/state"
exec 9>"$DEPLOY_ROOT/state/deploy.lock"
flock -n 9 || { echo 'Another deployment or rollback is active' >&2; exit 1; }

release_dir="$DEPLOY_ROOT/releases/$version"
mkdir -p "$release_dir"
if [[ -f $release_dir/manifest.json ]] && ! cmp -s "$MANIFEST" "$release_dir/manifest.json"; then
  echo 'The version already exists with different release metadata' >&2
  exit 1
fi
install -m 0444 "$MANIFEST" "$release_dir/manifest.json"

old_slot=$(cat "$DEPLOY_ROOT/state/active-slot" 2>/dev/null || true)
old_release=$(cat "$DEPLOY_ROOT/state/active-release" 2>/dev/null || true)
if [[ $old_slot == blue ]]; then target_slot=green; else target_slot=blue; fi

release_env="$release_dir/release.env"
umask 022
{
  printf 'RELEASE_VERSION=%s\n' "$version"
  printf 'RELEASE_GIT_COMMIT=%s\n' "$commit"
  printf 'RELEASE_BUILD_TIME=%s\n' "$build_time"
  printf 'DEPLOYMENT_ENVIRONMENT=%s\n' "$DEPLOYMENT_ENVIRONMENT"
  printf 'SLOT=%s\n' "$target_slot"
  printf 'DEPLOY_ROOT=%s\n' "$DEPLOY_ROOT"
  printf 'RUNTIME_ENV_FILE=%s\n' "$RUNTIME_ENV_FILE"
  printf 'DVC_REPOSITORY_PATH=%s\n' "$DVC_REPOSITORY_PATH"
  printf 'PLATFORM_RUNTIME_NETWORK=%s\n' "$PLATFORM_RUNTIME_NETWORK"
  printf 'PLATFORM_EDGE_NETWORK=%s\n' "$PLATFORM_EDGE_NETWORK"
  printf 'EDGE_BIND_ADDRESS=%s\n' "${EDGE_BIND_ADDRESS:-127.0.0.1}"
  printf 'EDGE_PORT=%s\n' "${EDGE_PORT:-8080}"
  printf 'GATEWAY_METRICS_PORT=%s\n' "${GATEWAY_METRICS_PORT:-9464}"
  printf 'EDGE_IMAGE=%s\n' "$EDGE_IMAGE"
  printf 'EMQX_IMAGE=%s\n' "${EMQX_IMAGE:-}"
  printf 'TLS_CERT_DIR=%s\n' "${TLS_CERT_DIR:-}"
  printf 'MQTT_BIND_ADDRESS=%s\n' "${MQTT_BIND_ADDRESS:-0.0.0.0}"
  printf 'EMQX_DASHBOARD_BIND_ADDRESS=%s\n' "${EMQX_DASHBOARD_BIND_ADDRESS:-127.0.0.1}"
  printf 'EDGE_SERVER_NAME=%s\n' "${EDGE_SERVER_NAME:-}"
  printf 'EDGE_CA_FILE=%s\n' "${EDGE_CA_FILE:-}"
  printf 'JAVA_IMAGE=%s\n' "$(image_ref java-api)"
  printf 'NEST_IMAGE=%s\n' "$(image_ref nest)"
  printf 'WEB_IMAGE=%s\n' "$(image_ref web)"
  printf 'WORKER_IMAGE=%s\n' "$(image_ref worker)"
  printf 'MIGRATION_IMAGE=%s\n' "$(image_ref migration)"
} > "$release_env"
chmod 0444 "$release_env"
printf '%s\n' "$target_slot" > "$release_dir/slot"

switched=0
audit_result() {
  local result=$1 rollback_of=${2:-} deploy_time record_file
  deploy_time=$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)
  record_file="$release_dir/deployment-${deploy_time//:/-}-$result.json"
  jq -c --arg environment "$DEPLOYMENT_ENVIRONMENT" --arg actor "$ACTOR" --arg deployTime "$deploy_time" --arg result "$result" --arg rollbackOf "$rollback_of" \
    '. + {environment:$environment,actor:$actor,deployTime:$deployTime,result:$result} + (if $rollbackOf == "" then {} else {rollbackOf:$rollbackOf} end)' "$MANIFEST" \
    | tee "$record_file" >> "$DEPLOY_ROOT/audit/deployments.jsonl"
  chmod 0600 "$DEPLOY_ROOT/audit/deployments.jsonl"
}
activate_slot() {
  local slot=$1
  printf 'upstream active_web {\n  server robot-platform-%s-web:8080;\n}\n' "$slot" > "$DEPLOY_ROOT/edge/active-upstream.conf"
  docker exec robot-platform-edge nginx -s reload >/dev/null
}
rollback_on_error() {
  local line=$1
  set +e
  echo "Deployment failed at line $line" >&2
  if [[ $switched -eq 1 && -n $old_slot ]]; then
    activate_slot "$old_slot"
    if [[ -n $old_release && -f $DEPLOY_ROOT/releases/$old_release/release.env ]]; then
      rollback_singletons=(-f "$PACKAGE_ROOT/deploy/compose/singletons.yml")
      [[ $DEPLOYMENT_ENVIRONMENT == PRODUCTION ]] && rollback_singletons+=(-f "$PACKAGE_ROOT/deploy/compose/production-singletons.yml")
      docker compose --env-file "$DEPLOY_ROOT/releases/$old_release/release.env" "${rollback_singletons[@]}" -p robot-platform-singletons up -d --force-recreate
    fi
  fi
  audit_result failed "$old_release"
}
trap 'rollback_on_error $LINENO' ERR

docker network inspect "$PLATFORM_RUNTIME_NETWORK" >/dev/null
docker network inspect "$PLATFORM_EDGE_NETWORK" >/dev/null
if [[ $DEPLOYMENT_ENVIRONMENT == PRODUCTION ]]; then
  install -d -m 0755 "$DEPLOY_ROOT/emqx" "$DEPLOY_ROOT/edge"
  install -m 0444 "$PACKAGE_ROOT/deploy/emqx/emqx.conf" "$DEPLOY_ROOT/emqx/emqx.conf"
  install -m 0444 "$PACKAGE_ROOT/deploy/emqx/acl.conf" "$DEPLOY_ROOT/emqx/acl.conf"
  install -m 0444 "$PACKAGE_ROOT/deploy/edge/production.conf" "$DEPLOY_ROOT/edge/production.conf"
  docker compose --env-file "$release_env" -f "$PACKAGE_ROOT/deploy/compose/production-infrastructure.yml" -p robot-platform-infrastructure up -d
  for _ in $(seq 1 30); do [[ $(docker inspect --format '{{.State.Health.Status}}' robot-platform-production-emqx 2>/dev/null) == healthy ]] && break; sleep 2; done
  [[ $(docker inspect --format '{{.State.Health.Status}}' robot-platform-production-emqx) == healthy ]] || { echo 'Production EMQX did not become healthy' >&2; false; }
fi
docker compose --env-file "$release_env" -f "$PACKAGE_ROOT/deploy/compose/migration.yml" -p robot-platform-migration run --rm migration
slot_files=(-f "$PACKAGE_ROOT/deploy/compose/slot.yml")
[[ $DEPLOYMENT_ENVIRONMENT == PRODUCTION ]] && slot_files+=(-f "$PACKAGE_ROOT/deploy/compose/production-slot.yml")
docker compose --env-file "$release_env" "${slot_files[@]}" -p "robot-platform-$target_slot" pull
docker compose --env-file "$release_env" "${slot_files[@]}" -p "robot-platform-$target_slot" up -d --remove-orphans

for container in "robot-platform-$target_slot-java-api" "robot-platform-$target_slot-nest-api" "robot-platform-$target_slot-web"; do
  for _ in $(seq 1 30); do
    [[ $(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null) == healthy ]] && break
    sleep 2
  done
  [[ $(docker inspect --format '{{.State.Health.Status}}' "$container") == healthy ]] || { echo "$container did not become healthy" >&2; false; }
done

docker exec "robot-platform-$target_slot-nest-api" node -e "fetch('http://127.0.0.1:3000/version').then(r=>r.json()).then(v=>process.exit(v.gitCommit==='${commit}'?0:1)).catch(()=>process.exit(1))"
docker exec "robot-platform-$target_slot-java-api" curl --fail --silent http://127.0.0.1:3100/version | jq -e --arg commit "$commit" '.gitCommit == $commit' >/dev/null
docker exec "robot-platform-$target_slot-web" wget -qO- http://127.0.0.1:8080/version.json | jq -e --arg commit "$commit" '.gitCommit == $commit' >/dev/null

if [[ $DEPLOYMENT_ENVIRONMENT == PRODUCTION ]]; then install -m 0444 "$PACKAGE_ROOT/deploy/edge/production.conf" "$DEPLOY_ROOT/edge/production.conf"; else install -m 0444 "$PACKAGE_ROOT/deploy/edge/default.conf" "$DEPLOY_ROOT/edge/default.conf"; fi
if [[ ! -f $DEPLOY_ROOT/edge/active-upstream.conf ]]; then printf 'upstream active_web { server robot-platform-%s-web:8080; }\n' "$target_slot" > "$DEPLOY_ROOT/edge/active-upstream.conf"; fi
if [[ $DEPLOYMENT_ENVIRONMENT == PRODUCTION ]]; then
  docker compose --env-file "$release_env" -f "$PACKAGE_ROOT/deploy/compose/edge.yml" -f "$PACKAGE_ROOT/deploy/compose/production-edge.yml" -p robot-platform-edge up -d
else
  docker compose --env-file "$release_env" -f "$PACKAGE_ROOT/deploy/compose/edge.yml" -p robot-platform-edge up -d
fi
activate_slot "$target_slot"
switched=1
if [[ $DEPLOYMENT_ENVIRONMENT == PRODUCTION ]]; then
  edge_url="https://$EDGE_SERVER_NAME"; curl_tls=(--cacert "$EDGE_CA_FILE" --resolve "$EDGE_SERVER_NAME:443:${EDGE_BIND_ADDRESS:-127.0.0.1}")
else
  edge_url="http://${EDGE_BIND_ADDRESS:-127.0.0.1}:${EDGE_PORT:-8080}"; curl_tls=()
fi
curl --fail --silent "${curl_tls[@]}" "$edge_url/version.json" | jq -e --arg commit "$commit" '.gitCommit == $commit' >/dev/null
curl --fail --silent "${curl_tls[@]}" "$edge_url/healthz" >/dev/null
curl --fail --silent "${curl_tls[@]}" "$edge_url/api/health" | jq -e '.status == "healthy"' >/dev/null
curl --fail --silent "${curl_tls[@]}" "$edge_url/nest/health" | jq -e '.status == "healthy" or .status == "degraded"' >/dev/null
metrics=$(curl --fail --silent "${curl_tls[@]}" "$edge_url/nest/metrics")
grep -q '^# HELP ' <<< "$metrics"

singleton_files=(-f "$PACKAGE_ROOT/deploy/compose/singletons.yml")
[[ $DEPLOYMENT_ENVIRONMENT == PRODUCTION ]] && singleton_files+=(-f "$PACKAGE_ROOT/deploy/compose/production-singletons.yml")
docker compose --env-file "$release_env" "${singleton_files[@]}" -p robot-platform-singletons pull
docker compose --env-file "$release_env" "${singleton_files[@]}" -p robot-platform-singletons up -d --force-recreate --remove-orphans
for _ in $(seq 1 30); do
  gateway=$(curl --silent "http://127.0.0.1:${GATEWAY_METRICS_PORT:-9464}/metrics" 2>/dev/null || true)
  grep -q 'platform_device_gateway_connected{service="device-gateway"} 1' <<< "$gateway" && break
  sleep 2
done
grep -q 'platform_device_gateway_connected{service="device-gateway"} 1' <<< "$gateway" || { echo 'Device Gateway did not connect to MQTT' >&2; false; }
for _ in $(seq 1 30); do
  health=$(curl --silent "${curl_tls[@]}" "$edge_url/nest/health" 2>/dev/null || true)
  [[ $(jq -r '.services.worker.status // empty' <<< "$health" 2>/dev/null) == healthy ]] && break
  sleep 2
done
[[ $(jq -r '.services.worker.status // empty' <<< "$health") == healthy ]] || { echo 'Worker heartbeat did not become healthy' >&2; false; }

if [[ -n $old_release ]]; then printf '%s\n' "$old_release" > "$DEPLOY_ROOT/state/previous-release"; fi
printf '%s\n' "$target_slot" > "$DEPLOY_ROOT/state/active-slot"
printf '%s\n' "$version" > "$DEPLOY_ROOT/state/active-release"
audit_result succeeded
trap - ERR
echo "Release $version is active in $DEPLOYMENT_ENVIRONMENT on slot $target_slot"
