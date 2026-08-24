#!/usr/bin/env bash
set -Eeuo pipefail
DEPLOY_ROOT=${DEPLOY_ROOT:-/opt/robot-platform}
[[ $DEPLOY_ROOT == /opt/robot-platform ]] || { echo 'Unexpected deployment root' >&2; exit 1; }
for path in "$DEPLOY_ROOT/config/runtime.env" "$DEPLOY_ROOT/secrets/tls"; do [[ -e $path ]] || { echo 'Rendered secret material is incomplete' >&2; exit 1; }; done
active_release=$(<"$DEPLOY_ROOT/state/active-release")
release_env="$DEPLOY_ROOT/releases/$active_release/release.env"
[[ -f $release_env ]] || { echo 'Active release metadata is missing' >&2; exit 1; }
docker compose --env-file "$release_env" -f "$DEPLOY_ROOT/package/deploy/compose/slot.yml" -f "$DEPLOY_ROOT/package/deploy/compose/production-slot.yml" -p "robot-platform-$(<"$DEPLOY_ROOT/state/active-slot")" up -d --force-recreate java-api nest-api
docker compose --env-file "$release_env" -f "$DEPLOY_ROOT/package/deploy/compose/singletons.yml" -f "$DEPLOY_ROOT/package/deploy/compose/production-singletons.yml" -p robot-platform-singletons up -d --force-recreate worker device-gateway
event=$(jq -cn --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg release "$active_release" '{event:"secret_refresh",at:$at,release:$release,result:"succeeded"}')
umask 077
printf '%s\n' "$event" >> "$DEPLOY_ROOT/audit/secret-rotations.jsonl"
