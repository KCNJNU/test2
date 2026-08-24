# CI/CD Pipeline — D4

## Workflows

| Workflow | Trigger | Result |
| --- | --- | --- |
| `CI` | Pull request and push to `master` | Node 24 and Java 21 build/lint/test, Prisma validation and empty-PostgreSQL migrations, policy and security gates |
| `Images and TEST` | Successful `CI` push run on `master` | One build of five GHCR images, SBOM/provenance, keyless signatures, signed candidate manifest, optional automatic TEST deploy |
| `Production Promotion` | Manual verified full SHA, `vX.Y.Z`, release note | Reuses candidate digests, requires `production` approval, blue-green deploys and records GitHub Deployment evidence |
| `Production Rollback` | Manual previous stable version and reason | Reuses prior host manifest, same approval/concurrency lock, no schema downgrade |

## CI gates

CI uses `npm ci`, root `build`, `lint`, `test`, Prisma validate, Java packaging and an empty PostgreSQL migration run. It parses workflow/Compose YAML and enforces the additive migration policy. CodeQL, Gitleaks, dependency review, npm audit policy and Trivy filesystem scanning run independently.

Any Critical vulnerability fails. A new direct High vulnerability fails unless its GHSA appears in `security/vulnerability-baseline.json` with an owner, reason and a future expiry no more than 90 days from review. Expiry fails automatically. The baseline is debt acceptance, not a claim that the issue is fixed. Images are scanned again for Critical findings after build.

## Immutable evidence

Each candidate manifest contains exactly:

- `version`, `gitCommit`, `buildTime`, `releaseNote`, `sourceWorkflow`
- `images[{name,repository,digest}]` for `java-api`, `migration`, `nest`, `web`, `worker`

Image builds emit SBOM and provenance attestations, and CI keyless-signs every digest plus the manifest. Production downloads the successful candidate artifact for the requested SHA, verifies signatures and commit identity, changes only the production version/release note/source workflow, signs the promoted manifest, and never rebuilds.

## Environment setup

Create GitHub Environments `test` and `production`. Configure deployment values only:

- secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_HOST_KEY`
- variables: `DEPLOY_ROOT`; `TEST_DEPLOY_ENABLED=true` or `PRODUCTION_DEPLOY_ENABLED=true`

Configure required reviewers on `production`. On each host, install Docker Compose, `jq`, `curl`, `flock`, create the two external networks, pre-login to GHCR using read-only credentials, provision the DVC worktree, copy `deploy/deployment.env.example` and `deploy/runtime.env.example`, and protect the runtime file with mode `0600` or `0400`.

No configured deployment host exists in the current implementation environment. Consequently static/unit/configuration verification can complete, but TEST/Production deployment acceptance remains open until the workflows execute against real isolated hosts.
