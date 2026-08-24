#!/usr/bin/env bash
set -Eeuo pipefail
CONFIG=${BACKUP_CONFIG_FILE:-/opt/robot-platform/config/backup.env}
# shellcheck disable=SC1090
source "$CONFIG"
[[ $RESTIC_IMAGE =~ ^[a-z0-9./_-]+@sha256:[0-9a-f]{64}$ ]] || exit 1
args=(check)
[[ ${RESTIC_READ_DATA:-false} == true ]] && args+=(--read-data)
docker run --rm --env-file "$CONFIG" "$RESTIC_IMAGE" "${args[@]}"
