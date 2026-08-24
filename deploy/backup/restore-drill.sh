#!/usr/bin/env bash
set -Eeuo pipefail
CONFIG=${BACKUP_CONFIG_FILE:-/opt/robot-platform/config/backup.env}
# shellcheck disable=SC1090
source "$CONFIG"
: "${RESTORE_STAGING_ROOT:?}" "${RESTORE_DATABASE_URL:?}" "${RESTIC_IMAGE:?}" "${POSTGRES_TOOLS_IMAGE:?}" "${CURL_IMAGE:?}" "${DEPLOY_ROOT:?}"
[[ $RESTORE_STAGING_ROOT == /var/lib/robot-platform-restore ]] || { echo 'Unsafe restore root' >&2; exit 1; }
[[ $RESTORE_DATABASE_URL != "$DATABASE_URL" ]] || { echo 'Restore target must not be production' >&2; exit 1; }
install -d -m 0700 "$RESTORE_STAGING_ROOT"
target=$(mktemp -d "$RESTORE_STAGING_ROOT/drill.XXXXXXXX")
resolved=$(realpath "$target")
[[ $resolved == "$RESTORE_STAGING_ROOT"/* ]] || { echo 'Restore target escaped its guard root' >&2; exit 1; }
started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
database_snapshot=$(docker run --rm --env-file "$CONFIG" "$RESTIC_IMAGE" snapshots --tag database --latest 1 --json | jq -er '.[0].short_id')
object_snapshot=$(docker run --rm --env-file "$CONFIG" "$RESTIC_IMAGE" snapshots --tag objects --latest 1 --json | jq -er '.[0].short_id')
docker run --rm --env-file "$CONFIG" -v "$target:/restore" "$RESTIC_IMAGE" restore "$database_snapshot" --target /restore
docker run --rm --env-file "$CONFIG" -v "$target:/restore" "$RESTIC_IMAGE" restore "$object_snapshot" --target /restore
dump=$(find "$target" -type f -name 'postgresql-*.dump' | sort | tail -n 1)
[[ -n $dump ]] || { echo 'No database dump was restored' >&2; exit 1; }
docker run --rm --network "$PLATFORM_RUNTIME_NETWORK" --env-file "$CONFIG" -e RESTORE_DUMP=/restore/database/"$(basename "$dump")" -v "$target:/restore:ro" "$POSTGRES_TOOLS_IMAGE" sh -eu -c 'pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$RESTORE_DATABASE_URL" "$RESTORE_DUMP"; psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM \"_prisma_migrations\"" -c "SELECT count(*) FROM \"Tenant\"" -c "SELECT count(*) FROM \"Robot\""'
(cd "$target/staging" && sha256sum --check manifests/*.sha256)
completed=$(date -u +%Y-%m-%dT%H:%M:%SZ)
payload=$(jq -cn --arg snapshot "$database_snapshot+$object_snapshot" --arg host "$BACKUP_SOURCE_HOST" --arg started "$started" --arg completed "$completed" '{type:"RESTORE_DRILL",status:"SUCCEEDED",snapshotId:$snapshot,sourceHost:$host,startedAt:$started,completedAt:$completed,details:{databaseSchema:true,checksums:true,isolatedTarget:true}}')
slot=$(<"$DEPLOY_ROOT/state/active-slot"); [[ $slot == blue || $slot == green ]] || exit 1
url="http://robot-platform-$slot-java-api:3100/api/internal/v1/resilience/evidence"
docker run --rm --network "$PLATFORM_RUNTIME_NETWORK" --env-file "$CONFIG" -e "EVIDENCE_PAYLOAD=$payload" -e "EVIDENCE_URL=$url" --entrypoint /bin/sh "$CURL_IMAGE" -eu -c 'curl --fail --silent --show-error -H "Content-Type: application/json" -H "X-Resilience-Evidence-Token: $RESILIENCE_EVIDENCE_TOKEN" --data "$EVIDENCE_PAYLOAD" "$EVIDENCE_URL"' >/dev/null
printf '%s\n' "$payload" >> /opt/robot-platform/audit/restore-drills.jsonl
rm -rf -- "$resolved"
