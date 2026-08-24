#!/usr/bin/env bash
set -Eeuo pipefail
MODE=${1:-all}
CONFIG=${BACKUP_CONFIG_FILE:-/opt/robot-platform/config/backup.env}
[[ $MODE == database || $MODE == objects || $MODE == all ]] || { echo 'mode must be database, objects, or all' >&2; exit 2; }
[[ -f $CONFIG ]] || { echo 'Backup configuration is missing' >&2; exit 1; }
[[ $(stat -c '%a' "$CONFIG") == 400 || $(stat -c '%a' "$CONFIG") == 600 ]] || { echo 'Backup configuration must be 0400 or 0600' >&2; exit 1; }
# shellcheck disable=SC1090
source "$CONFIG"
: "${POSTGRES_TOOLS_IMAGE:?}" "${MINIO_CLIENT_IMAGE:?}" "${RESTIC_IMAGE:?}" "${CURL_IMAGE:?}" "${BACKUP_STAGING_ROOT:?}" "${PLATFORM_RUNTIME_NETWORK:?}" "${DEPLOY_ROOT:?}"
for image in "$POSTGRES_TOOLS_IMAGE" "$MINIO_CLIENT_IMAGE" "$RESTIC_IMAGE" "$CURL_IMAGE"; do [[ $image =~ ^[a-z0-9./_-]+@sha256:[0-9a-f]{64}$ ]] || { echo 'All backup images must use immutable digests' >&2; exit 1; }; done
[[ $BACKUP_STAGING_ROOT == /var/lib/robot-platform-backup ]] || { echo 'Unsafe backup staging root' >&2; exit 1; }
install -d -m 0700 "$BACKUP_STAGING_ROOT/database" "$BACKUP_STAGING_ROOT/objects" "$BACKUP_STAGING_ROOT/manifests"
started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
stamp=$(date -u +%Y%m%dT%H%M%SZ)

report() {
  local type=$1 status=$2 snapshot=${3:-} completed payload slot url
  completed=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  payload=$(jq -cn --arg type "$type" --arg status "$status" --arg snapshot "$snapshot" --arg host "$BACKUP_SOURCE_HOST" --arg started "$started" --arg completed "$completed" '{type:$type,status:$status,snapshotId:$snapshot,sourceHost:$host,startedAt:$started,completedAt:$completed,details:{tool:"restic"}}')
  slot=$(<"$DEPLOY_ROOT/state/active-slot"); [[ $slot == blue || $slot == green ]] || return 1
  url="http://robot-platform-$slot-java-api:3100/api/internal/v1/resilience/evidence"
  docker run --rm --network "$PLATFORM_RUNTIME_NETWORK" --env-file "$CONFIG" -e "EVIDENCE_PAYLOAD=$payload" -e "EVIDENCE_URL=$url" --entrypoint /bin/sh "$CURL_IMAGE" -eu -c 'curl --fail --silent --show-error -H "Content-Type: application/json" -H "X-Resilience-Evidence-Token: $RESILIENCE_EVIDENCE_TOKEN" --data "$EVIDENCE_PAYLOAD" "$EVIDENCE_URL"' >/dev/null
}
trap 'report DATABASE_BACKUP FAILED "" || true' ERR

if [[ $MODE == database || $MODE == all ]]; then
  dump="/staging/database/postgresql-$stamp.dump"
  docker run --rm --network "$PLATFORM_RUNTIME_NETWORK" --env-file "$CONFIG" -v "$BACKUP_STAGING_ROOT:/staging" "$POSTGRES_TOOLS_IMAGE" sh -eu -c 'pg_dump --format=custom --no-owner --no-privileges --file="$1" "$DATABASE_URL"' -- "$dump"
  (cd "$BACKUP_STAGING_ROOT" && sha256sum "database/postgresql-$stamp.dump" > "manifests/postgresql-$stamp.sha256")
  snapshot=$(docker run --rm --env-file "$CONFIG" -v "$BACKUP_STAGING_ROOT:/staging:ro" "$RESTIC_IMAGE" backup /staging/database /staging/manifests --tag database --json | jq -sr 'map(select(.message_type=="summary"))[0].snapshot_id')
  report DATABASE_BACKUP SUCCEEDED "$snapshot"
  trap - ERR
fi

if [[ $MODE == objects || $MODE == all ]]; then
  trap 'report OBJECT_BACKUP FAILED "" || true' ERR
  IFS=',' read -ra buckets <<< "$SOURCE_S3_BUCKETS"
  for bucket in "${buckets[@]}"; do
    [[ $bucket =~ ^[a-z0-9][a-z0-9.-]{1,62}$ ]] || { echo 'Invalid source bucket' >&2; exit 1; }
    install -d -m 0700 "$BACKUP_STAGING_ROOT/objects/$bucket"
    docker run --rm --env-file "$CONFIG" -v "$BACKUP_STAGING_ROOT/objects:/export" --entrypoint /bin/sh "$MINIO_CLIENT_IMAGE" -eu -c 'mc alias set source "$SOURCE_S3_ENDPOINT" "$SOURCE_S3_ACCESS_KEY" "$SOURCE_S3_SECRET_KEY"; mc mirror --overwrite --remove "source/$1" "/export/$1"' -- "$bucket"
  done
  (cd "$BACKUP_STAGING_ROOT" && find objects -type f -exec sha256sum {} + > "manifests/objects-$stamp.sha256")
  snapshot=$(docker run --rm --env-file "$CONFIG" -v "$BACKUP_STAGING_ROOT:/staging:ro" "$RESTIC_IMAGE" backup /staging/objects /staging/manifests --tag objects --json | jq -sr 'map(select(.message_type=="summary"))[0].snapshot_id')
  report OBJECT_BACKUP SUCCEEDED "$snapshot"
  trap - ERR
fi
