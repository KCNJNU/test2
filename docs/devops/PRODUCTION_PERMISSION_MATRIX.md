# Production Permission Matrix — D4

| Action | GitHub actor | Host deployment account | Required control |
| --- | --- | --- | --- |
| Build candidate | `master` workflow | None | CI success; GHCR package write; keyless OIDC signing |
| Deploy TEST | TEST workflow | Restricted deploy user | `TEST_DEPLOY_ENABLED`; isolated TEST Environment and host |
| Promote Production | Authorized operator | Restricted deploy user | Verified TEST SHA, SemVer/note, required `production` reviewers |
| Roll back Production | Authorized incident operator | Restricted deploy user | Same reviewers and concurrency lock; recorded previous manifest only |
| Change runtime secrets | Environment administrator | Root/privileged host administrator | Out-of-band change to root-only env; never through release manifest |
| Pull application image | None | Docker daemon with GHCR read-only credential | Digest-only reference |

The deploy account needs access to Docker, the deployment root and the two pre-created networks. It does not receive registry write access or application secret values in GitHub. SSH host-key verification is mandatory; password authentication is outside the D4 contract.
# D6 additions

`DEVICE_IDENTITY_MANAGE` and `RESILIENCE_MANAGE` are `SUPER_ADMIN` only. `DEVICE_IDENTITY_MANAGE` registers public certificate metadata and invokes PKI revocation; it never exposes private keys. `RESILIENCE_MANAGE` reads backup/restore state, previews retention and creates a guarded retention Job. The deprecated `ADMIN` value is normalized to `SUPER_ADMIN` and has no separate bypass.
