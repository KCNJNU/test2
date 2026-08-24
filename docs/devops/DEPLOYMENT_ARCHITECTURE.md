# Deployment Architecture — D1–D4

## Release unit

D4 builds Java API, NestJS runtime, Worker, Migration and Web images once from a successful `master` commit. The NestJS runtime image is reused by the HTTP API and Device Gateway. Site and Mobile remain CI build/test workspaces and are not server images. Every application image carries OCI version, revision and build-time labels and is promoted only as `repository@sha256:digest`.

The Worker image adds `dvc[s3]==3.67.1`, Python and Git. Its DVC Git worktree is provisioned on the host and mounted at runtime; repository credentials are never baked into an image. The Migration image has one purpose: `prisma migrate deploy` before a new slot starts.

## Host topology and release order

Each TEST, STAGING and PRODUCTION environment uses its own Compose host and infrastructure. A stable Edge Nginx fronts two application slots:

```text
Client -> Edge Nginx -> active blue|green Web
                           |-> Java API
                           `-> NestJS API

singletons: Worker (one consumer) + Device Gateway (one MQTT client ID)
data: PostgreSQL + Redis + EMQX + ObjectStorage (environment-owned)
```

Deployment executes under an exclusive host lock:

1. Validate the signed release manifest and digest-only image references.
2. Run the one-shot forward migration.
3. Pull and start the inactive Java/Nest/Web slot.
4. Require container health and matching `/version` commit from all three services.
5. Atomically reload Edge to the new Web slot and smoke the stable endpoint.
6. Recreate the singleton Worker and Gateway, then require Worker heartbeat and `Gateway connected=1`.
7. Persist active/previous state and append deployment evidence.

If pre-switch checks fail, traffic stays on the old slot. If a post-switch singleton check fails, the deploy script restores traffic and singleton images from the prior release. The old application slot remains available as the previous stable release.

## Container boundary

Application containers run as non-root with a read-only root filesystem, `cap_drop: ALL`, `no-new-privileges`, bounded tmpfs paths and explicit health checks where a listener exists. Web is served by unprivileged Nginx and exposes `/healthz` and `/version.json`; `/api/` proxies Java while `/nest/` proxies NestJS. Runtime configuration therefore changes per host without rebuilding Web.

The stable Edge image is separately provisioned by verified digest. Host runtime secrets live only in a mode `0400` or `0600` env file. GitHub Environments hold deployment connection material, not application secrets, and the host has pre-provisioned GHCR read-only credentials.

## Migration and rollback boundary

CI rejects `DROP`, destructive rename/type replacement, immediate `SET NOT NULL` and `TRUNCATE` patterns. Schema evolution must follow expand → backfill/dual-read → contract and remain compatible with the previous stable application. Rollback switches API/Web to the recorded previous slot, then restores that release's Worker/Gateway digests. It never automatically reverses a database migration.

`Cloud Down ≠ Safety Down`: deployment, broker or application failure cannot clear a robot SAFE latch, bypass MCU/robot-side safety, or imply physical stop state.

## Local foundation

Repository-root `docker-compose.yml` remains the D1 DEV foundation for PostgreSQL, Redis, EMQX 5.8.8, MinIO and pgAdmin. It is not the production release topology. See `CICD_PIPELINE.md` and the deployment/rollback runbook for D4 operation.
# D6 production overlays

Production adds the digest-pinned EMQX infrastructure Compose file and the TLS overlays for Edge and Device Gateway. Vault Agent is a host systemd service, not an application container. It renders root-only runtime and TLS files before Compose starts. Deploy/rollback continue to use immutable application digests and schema-compatible migrations; secret refresh uses the same active digests and does not create a release.

Production deployment configuration must set `EDGE_BIND_ADDRESS=0.0.0.0` and `EDGE_PORT=80`; the base mapping supplies redirect-only HTTP while the production overlay adds HTTPS 443. Any other production HTTP port is rejected before deployment.

The deployment account has no general Docker access. A root-owned sudo allowlist is the only release entrypoint. Production activation is blocked until HTTPS, mutual MQTT TLS, ACL tests, current backup evidence and the monthly restore drill pass.
