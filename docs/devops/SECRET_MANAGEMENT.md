# Secret Management

## Production contract

Vault is the production source of truth. GitHub Environments contain only host, user, SSH key, host key and deployment root. Application passwords, signing keys, object-storage credentials, Restic credentials, MQTT CA material and private keys must not appear in Git, images, release manifests, deployment JSON or CI logs.

The host runs Vault Agent as root with AppRole auto-auth. The initial SecretID must be response-wrapped, written once to `/run/vault-agent/bootstrap/secret-id`, mode `0400`, and is removed by Vault Agent after reading. No reusable SecretID or Vault token is passed through Compose. Policies in `deploy/vault/policies` separate runtime reads, backup reads and PKI revocation.

The auto-auth proxy listens on host port 8201 only for the Docker runtime bridge; host firewall rules must reject every other source. Java reaches it through the `vault-agent:host-gateway` alias, sends the required Vault request header, and receives no Vault token. The attached AppRole may call only the dedicated PKI revoke path in addition to its rendered reads.

Vault Agent atomically renders `/opt/robot-platform/config/runtime.env` and certificate files below `/opt/robot-platform/secrets/tls`. Templates use `error_on_missing_key`; services fail closed when files, required values or certificate verification are absent. The environment file is `0400`; directories are `0700`; key files are `0400` and owned by the service-launching root account.

## Rotation

1. Write a new version in Vault and verify its lease/expiry without displaying the value.
2. Vault Agent renders into a temporary file and atomically replaces the destination.
3. The root-owned refresh entrypoint recreates the active Java/Nest slot, then Worker and Gateway gracefully.
4. Check HTTPS health, target git commit, Worker heartbeat and `platform_device_gateway_connected=1`.
5. Append only path/version, actor, time and result to `audit/secret-rotations.jsonl`.

On failure, keep the prior Vault version available, restore it, rerender and repeat health checks. Never copy old secret files as backups. Robot and service certificates are issued by Vault PKI; public metadata may be registered in PostgreSQL, but private keys remain in the provisioning boundary.

## Access and break-glass

The deployment user is not a member of the Docker group. The reviewed sudoers allowlist permits only fixed deploy, rollback and status entrypoints. Break-glass requires two-person approval, a short-lived Vault token, an incident ID and immediate revocation after use. Certificate compromise requires Vault revocation, CRL refresh verification, database status update, EMQX disconnect and credential re-issuance.

Production enablement gates: Vault audit devices enabled, AppRole response wrapping verified, policies reviewed, renewal alerts active, certificate CN/SAN policy verified, and a complete rotation rehearsal recorded.
