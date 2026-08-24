#!/usr/bin/env bash
set -Eeuo pipefail
CONFIG=${BACKUP_MAINTENANCE_CONFIG_FILE:-/opt/robot-platform/config/backup-maintenance.env}
[[ -f $CONFIG ]] || { echo 'Maintenance credentials are missing' >&2; exit 1; }
# shellcheck disable=SC1090
source "$CONFIG"
[[ $RESTIC_IMAGE =~ ^[a-z0-9./_-]+@sha256:[0-9a-f]{64}$ ]] || { echo 'RESTIC_IMAGE must use an immutable digest' >&2; exit 1; }
docker run --rm --env-file "$CONFIG" "$RESTIC_IMAGE" forget --keep-hourly 24 --keep-daily 35 --keep-monthly 12 --keep-yearly 3 --dry-run
[[ ${APPLY_BACKUP_RETENTION:-false} == true ]] || { echo 'Dry-run completed; set APPLY_BACKUP_RETENTION=true with maintenance credentials to apply' >&2; exit 0; }
docker run --rm --env-file "$CONFIG" "$RESTIC_IMAGE" forget --keep-hourly 24 --keep-daily 35 --keep-monthly 12 --keep-yearly 3 --prune
