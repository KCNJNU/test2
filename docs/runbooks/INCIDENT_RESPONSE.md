# Incident Response Runbook

## Severity and first actions

Declare an incident for suspected secret/certificate disclosure, cross-tenant access, MQTT authorization bypass, backup integrity loss, unrecoverable deployment or prolonged EMQX/Vault outage. Assign commander, recorder and technical owner; record UTC timestamps and release digest. Preserve append-only deployment, EMQX, Vault, Edge, application and audit logs. Do not paste secrets or private keys into tickets.

`Cloud Down ≠ Safety Down`: loss of cloud, MQTT, Vault or Redis must never clear a robot's local safety stop. Disable cloud command publication when identity or authorization integrity is uncertain. Robot-local safety and on-site emergency procedures remain authoritative.

## Credential or device-certificate compromise

1. Disable affected command paths and identify certificate serial/fingerprint without exporting the private key.
2. Revoke the serial through Vault PKI; verify the CRL has refreshed in EMQX and terminate existing sessions.
3. Mark the platform certificate revoked and review MQTT authentication/authorization logs for foreign topics.
4. Provision a replacement certificate through the controlled device ceremony and verify only its own topics.
5. Rotate adjacent credentials if scope is uncertain and record the incident/audit IDs.

## Tenant-isolation event

Immediately disable the affected endpoint or actor, preserve request/audit IDs, and determine source tenant, target tenant and resource types. Test direct IDs, lists, search, exports, batch routes and indirect relations. Fix scope derivation server-side; never rely on a frontend tenant ID. Notify according to the legal/privacy procedure and add the exact scenario to the two-tenant regression matrix.

## Backup or restore failure

Stop retention execution. Preserve the failing repository and evidence, switch to the append-only backup identity, verify destination availability and run `restic check`. If recovery is required, create an isolated database and object namespace, restore the latest verified snapshot, validate migrations/counts/checksums, then follow the controlled traffic-cutover procedure. Never restore over production in place and never reverse Prisma migrations automatically.

## EMQX or Vault outage

For EMQX single-node failure, keep commands disabled, confirm robots retain local safety, restore the broker using its persistent data and current Vault-rendered TLS material, then stagger reconnects. For Vault outage, existing unexpired rendered secrets may continue; do not restart services that would lose them. If certificate/secret validity cannot be established, fail closed and invoke break-glass with two-person approval.

## Closure

Confirm service health, certificate/Secret rotation, tenant tests, backup freshness and a recovery path. Record impact, root cause, timeline, actor, release digest, corrective actions and owners. Any real ACL bypass, cross-tenant leak or failed restore blocks production promotion until independently reviewed.
