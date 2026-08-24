#!/usr/bin/env bash
set -Eeuo pipefail

TARGET=${1:?usage: rollback-release.sh PREVIOUS_VERSION ACTOR}
ACTOR=${2:?rollback actor is required}
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
PACKAGE_ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd)
CONFIG_FILE=${DEPLOYMENT_CONFIG_FILE:-/opt/robot-platform/config/deployment.env}
[[ -f $CONFIG_FILE ]] || { echo 'Deployment configuration is missing' >&2; exit 1; }
# shellcheck disable=SC1090
source "$CONFIG_FILE"
: "${DEPLOY_ROOT:?}" "${PLATFORM_EDGE_NETWORK:?}"
[[ $ACTOR =~ ^[A-Za-z0-9._@-]{1,128}$ ]] || { echo 'Rollback actor is invalid' >&2; exit 1; }
[[ $TARGET =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || { echo 'Rollback version is invalid' >&2; exit 1; }
for command in docker jq curl flock; do command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 1; }; done

exec 9>"$DEPLOY_ROOT/state/deploy.lock"
flock -n 9 || { echo 'Another deployment or rollback is active' >&2; exit 1; }
previous=$(cat "$DEPLOY_ROOT/state/previous-release" 2>/dev/null || true)
current=$(cat "$DEPLOY_ROOT/state/active-release" 2>/dev/null || true)
current_slot=$(cat "$DEPLOY_ROOT/state/active-slot" 2>/dev/null || true)
[[ -n $previous && $TARGET == "$previous" ]] || { echo 'Rollback target must be the recorded previous stable release' >&2; exit 1; }
release_dir="$DEPLOY_ROOT/releases/$TARGET"
release_env="$release_dir/release.env"
manifest="$release_dir/manifest.json"
[[ -f $release_env && -f $manifest && -f $release_dir/slot ]] || { echo 'Previous release evidence is incomplete' >&2; exit 1; }
slot=$(cat "$release_dir/slot")
[[ $slot == blue || $slot == green ]] || { echo 'Previous release slot is invalid' >&2; exit 1; }
commit=$(jq -er '.gitCommit' "$manifest")
if [[ $DEPLOYMENT_ENVIRONMENT == PRODUCTION ]]; then
  : "${EDGE_SERVER_NAME:?}" "${EDGE_CA_FILE:?}"; edge_url="https://$EDGE_SERVER_NAME"; curl_tls=(--cacert "$EDGE_CA_FILE" --resolve "$EDGE_SERVER_NAME:443:${EDGE_BIND_ADDRESS:-127.0.0.1}")
  singleton_files=(-f "$PACKAGE_ROOT/deploy/compose/singletons.yml" -f "$PACKAGE_ROOT/deploy/compose/production-singletons.yml")
  slot_files=(-f "$PACKAGE_ROOT/deploy/compose/slot.yml" -f "$PACKAGE_ROOT/deploy/compose/production-slot.yml")
else
  edge_url="http://${EDGE_BIND_ADDRESS:-127.0.0.1}:${EDGE_PORT:-8080}"; curl_tls=(); singleton_files=(-f "$PACKAGE_ROOT/deploy/compose/singletons.yml"); slot_files=(-f "$PACKAGE_ROOT/deploy/compose/slot.yml")
fi

verify_singletons() {
  local gateway health
  for _ in $(seq 1 30); do
    gateway=$(curl --silent "http://127.0.0.1:${GATEWAY_METRICS_PORT:-9464}/metrics" 2>/dev/null || true)
    grep -q 'platform_device_gateway_connected{service="device-gateway"} 1' <<< "$gateway" && break
    sleep 2
  done
  grep -q 'platform_device_gateway_connected{service="device-gateway"} 1' <<< "$gateway" || { echo 'Device Gateway did not reconnect after rollback' >&2; return 1; }
  for _ in $(seq 1 30); do
    health=$(curl --silent "${curl_tls[@]}" "$edge_url/nest/health" 2>/dev/null || true)
    [[ $(jq -r '.services.worker.status // empty' <<< "$health" 2>/dev/null) == healthy ]] && break
    sleep 2
  done
  [[ $(jq -r '.services.worker.status // empty' <<< "$health") == healthy ]] || { echo 'Worker heartbeat did not recover after rollback' >&2; return 1; }
}

switched=0
recover_current_on_error() {
  local line=$1 deploy_time record_file
  trap - ERR
  set +e
  echo "Rollback failed at line $line" >&2
  if [[ $switched -eq 1 && $current_slot =~ ^(blue|green)$ ]]; then
    printf 'upstream active_web {\n  server robot-platform-%s-web:8080;\n}\n' "$current_slot" > "$DEPLOY_ROOT/edge/active-upstream.conf"
    docker exec robot-platform-edge nginx -s reload >/dev/null
    if [[ -f $DEPLOY_ROOT/releases/$current/release.env ]]; then
      docker compose --env-file "$DEPLOY_ROOT/releases/$current/release.env" "${singleton_files[@]}" -p robot-platform-singletons up -d --force-recreate --remove-orphans
    fi
  fi
  deploy_time=$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)
  record_file="$release_dir/deployment-${deploy_time//:/-}-rollback_failed.json"
  jq -c --arg environment "$DEPLOYMENT_ENVIRONMENT" --arg actor "$ACTOR" --arg deployTime "$deploy_time" --arg rollbackOf "$current" \
    '. + {environment:$environment,actor:$actor,deployTime:$deployTime,result:"rollback_failed",rollbackOf:$rollbackOf}' "$manifest" \
    | tee "$record_file" >> "$DEPLOY_ROOT/audit/deployments.jsonl"
  chmod 0600 "$DEPLOY_ROOT/audit/deployments.jsonl"
}
trap 'recover_current_on_error $LINENO' ERR

# Database migrations are deliberately not reversed. The previous application
# must remain compatible with every migration admitted by the D4 policy.
docker compose --env-file "$release_env" "${slot_files[@]}" -p "robot-platform-$slot" up -d --remove-orphans
for container in "robot-platform-$slot-java-api" "robot-platform-$slot-nest-api" "robot-platform-$slot-web"; do
  for _ in $(seq 1 30); do
    [[ $(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null) == healthy ]] && break
    sleep 2
  done
  [[ $(docker inspect --format '{{.State.Health.Status}}' "$container") == healthy ]] || { echo "$container did not become healthy" >&2; exit 1; }
done
docker exec "robot-platform-$slot-nest-api" node -e "fetch('http://127.0.0.1:3000/version').then(r=>r.json()).then(v=>process.exit(v.gitCommit==='${commit}'?0:1)).catch(()=>process.exit(1))"
docker exec "robot-platform-$slot-java-api" curl --fail --silent http://127.0.0.1:3100/version | jq -e --arg commit "$commit" '.gitCommit == $commit' >/dev/null
docker exec "robot-platform-$slot-web" wget -qO- http://127.0.0.1:8080/version.json | jq -e --arg commit "$commit" '.gitCommit == $commit' >/dev/null

printf 'upstream active_web {\n  server robot-platform-%s-web:8080;\n}\n' "$slot" > "$DEPLOY_ROOT/edge/active-upstream.conf"
docker exec robot-platform-edge nginx -s reload >/dev/null
switched=1
curl --fail --silent "${curl_tls[@]}" "$edge_url/version.json" | jq -e --arg commit "$commit" '.gitCommit == $commit' >/dev/null
curl --fail --silent "${curl_tls[@]}" "$edge_url/healthz" >/dev/null
curl --fail --silent "${curl_tls[@]}" "$edge_url/api/health" | jq -e '.status == "healthy"' >/dev/null
metrics=$(curl --fail --silent "${curl_tls[@]}" "$edge_url/nest/metrics")
grep -q '^# HELP ' <<< "$metrics"
docker compose --env-file "$release_env" "${singleton_files[@]}" -p robot-platform-singletons up -d --force-recreate --remove-orphans
verify_singletons

printf '%s\n' "$current" > "$DEPLOY_ROOT/state/previous-release"
printf '%s\n' "$TARGET" > "$DEPLOY_ROOT/state/active-release"
printf '%s\n' "$slot" > "$DEPLOY_ROOT/state/active-slot"
deploy_time=$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)
jq -c --arg environment "$DEPLOYMENT_ENVIRONMENT" --arg actor "$ACTOR" --arg deployTime "$deploy_time" --arg rollbackOf "$current" \
  '. + {environment:$environment,actor:$actor,deployTime:$deployTime,result:"rolled_back",rollbackOf:$rollbackOf}' "$manifest" \
  | tee "$release_dir/deployment-${deploy_time//:/-}-rolled_back.json" >> "$DEPLOY_ROOT/audit/deployments.jsonl"
chmod 0600 "$DEPLOY_ROOT/audit/deployments.jsonl"
trap - ERR
echo "Rolled back $DEPLOYMENT_ENVIRONMENT from $current to $TARGET; database schema was not downgraded"
