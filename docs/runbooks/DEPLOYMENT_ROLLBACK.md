# Deployment and Rollback Runbook

## Before first deployment

1. Provision a dedicated environment host and separate PostgreSQL, Redis, EMQX, ObjectStorage, queue and device identities.
2. Install Docker Compose, `jq`, `curl` and `flock`; authenticate Docker to GHCR with read-only credentials.
3. Create the environment-specific runtime and edge Docker networks.
4. Copy `deploy/deployment.env.example` to `/opt/robot-platform/config/deployment.env`; replace the Edge placeholder with a verified digest.
5. Copy `deploy/runtime.env.example` to `/opt/robot-platform/config/runtime.env`, fill runtime secrets out of band, then `chmod 0600`.
6. Provision the DVC Git worktree at `DVC_REPOSITORY_PATH` without placing its credentials in an image.
7. Configure GitHub Environment connection values and required reviewers for Production.

## Deploy

For TEST, merge to `master` and observe `CI` followed by `Images and TEST`. For Production, run `Production Promotion` with the full TEST-verified commit SHA, a unique SemVer and release note. Confirm approval, signature verification, migration, inactive-slot health, stable Edge version, Worker heartbeat and Gateway connection all pass.

On the host, confirm:

```bash
cat /opt/robot-platform/state/active-release
cat /opt/robot-platform/state/active-slot
curl --fail http://127.0.0.1:8080/version.json
tail -n 1 /opt/robot-platform/audit/deployments.jsonl | jq .
```

Do not label TEST or Production accepted when its deployment enable flag is absent. Investigate any `deployment_not_configured` or failed singleton validation.

## Roll back

Read `/opt/robot-platform/state/previous-release`; select exactly that version in `Production Rollback`, include the incident reason, and obtain the same Production approval. The workflow restores the recorded application slot and singleton digests and verifies their health. It does not downgrade the database.

After rollback, verify `/version.json`, Nest `/health`, Worker `healthy`, Gateway connected metric `1`, host audit JSONL and GitHub deployment evidence. If the old application is incompatible with the current schema, stop and fix forward; never manually reverse a production migration through this runbook.

## Incident boundary

Preserve both release manifests and deployment logs. Do not delete the inactive slot during investigation. If the cloud control plane is unavailable, robot-side SAFE state, MCU safeguards, obstacle detection and emergency-stop handling remain authoritative.
