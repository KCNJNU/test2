# Environment Model

## Required environments

| Environment | Purpose | Deployment rule | Data and device rule |
| --- | --- | --- | --- |
| DEV | Local development and simulation | Developer-controlled Compose | Synthetic/non-production data; no production robot access |
| TEST | Automated integration and acceptance | Successful `master` candidate auto-deploys when configured | Dedicated DB/broker/storage/Redis and test identities |
| STAGING | Release candidate and operational rehearsal | Production-like deployment with approval | Dedicated credentials and staged devices; no production secret reuse |
| PRODUCTION | Customer operations | Manual verified SHA + SemVer, required reviewer approval and audited rollback | Production-only identities, certificates and tenant-scoped data |

## Isolation contract

Each environment owns separate PostgreSQL databases, MQTT brokers, ObjectStorage buckets/accounts, Redis instances, message queues, secrets and device certificates. Environment identity is derived from trusted deployment configuration, never from a browser-supplied tenant or environment value.

DEV credentials may live in the ignored repository-root `.env`. In D4, TEST, STAGING and PRODUCTION application secrets live only in a root-owned host runtime env file with mode `0400` or `0600`; they must never be committed, copied into images/manifests, exposed by health endpoints, or reused. Moving these values to a Secret Manager/Vault/KMS and automating rotation is a D6 gate.

## Promotion

Artifacts are built once and promoted by immutable digest. Production accepts only a commit with successful TEST candidate evidence and does not rebuild it. Configuration and secrets are injected per environment. Database changes must be forward- and backward-compatible with the previous stable application version before production rollout.

GitHub Environments store only `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_HOST_KEY` and non-secret `DEPLOY_ROOT`/enable flags. The `production` Environment must have required reviewers and uses the same `production-deployment` concurrency lock for deploy and rollback. A disabled TEST target is explicitly reported as `deployment_not_configured`, not accepted.

## D1 defaults

D1 defines only the runnable DEV foundation. Local default ports are documented in `NETWORK_TOPOLOGY.md`; operators should override EMQX Dashboard credentials in `.env`. Anonymous/local MQTT behavior is not accepted as production authentication. Production TLS, device certificates and per-robot ACLs are D6 gates.
# D6 isolation additions

PRODUCTION requires its own Vault namespace/paths, private CA, EMQX instance, Restic repository and off-site S3 credentials. Certificates and runtime files are never copied from TEST/STAGING. DEV may use plaintext local MQTT; any process with `DEPLOYMENT_ENVIRONMENT=PRODUCTION` rejects it. Production RPO/RTO are database 1 hour, object data 6 hours and overall recovery 4 hours.
