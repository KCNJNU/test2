# OTA and Configuration Release — D5

## Delivery boundary

D5 implements immutable Version and Artifact records, SHA-256 gates, optional Ed25519 verification, configuration approval evidence, four gray-release strategies, OTA state evidence and rollback reporting. The Java API owns authenticated release orchestration; ObjectStorage stores software bytes; PostgreSQL stores metadata and events; the NestJS Device Gateway consumes Robot Agent facts.

The Development Mock Robot Agent proves protocol behavior only. A real installer, hardware-specific boot slots, production signing private key custody and production trust-key rotation require the Robot Agent and production platform owners. A cloud command can never bypass local safety. `Cloud Down ≠ Safety Down`.

## Artifact integrity and identity

Supported software components are Robot Application, Robot Agent, ROS Package/Image and MCU Firmware. Each `(component, SemVer)` is immutable. Registration streams the uploaded file through SHA-256 before ObjectStorage persistence. The API stores MIME type, size, checksum, compatibility, hardware-model allowlist, minimum battery, signature metadata and verification time, but never exposes the object key or signing material.

DEV may use unsigned artifacts when `OTA_SIGNATURE_REQUIRED=false`. Production must set it to `true` and install an X.509-encoded Ed25519 public key in `OTA_SIGNATURE_PUBLIC_KEY_BASE64`. The signing private key is never an application environment variable. Before producing a download URL or campaign, the service checks object existence, stored size and the complete SHA-256 again. Checksum mismatch blocks release and install.

## Preconditions

The platform creates an OTA job only when the robot is:

- registered in the selected project, active and online;
- in `IDLE`, `READY` or `CHARGING`, never `RUNNING`;
- outside an active maintenance operation;
- reporting a known battery percentage at or above the target minimum;
- compatible with the artifact hardware-model allowlist; and
- not already on the target version.

For `SINGLE` and `SELECTED_BATCH`, any ineligible explicit target rejects the campaign. Percentage and project rollout record blocked targets and continue only with eligible robots. This is cloud scheduling policy, not a replacement for the Robot Agent's final local preflight.

## State machine and recovery

The only success path is:

`PENDING → DOWNLOADING → VERIFYING → INSTALLING → REBOOTING → VALIDATING → SUCCEEDED`

`FAILED` is permitted from active states. A post-install or boot-health failure may advance to `ROLLED_BACK`; no other terminal state may regress. Every Robot Agent message is Inbox-deduplicated, ownership-checked and stored as an `OTAEvent`. Invalid transition attempts are rejected without changing the job or robot version.

The Robot Agent must verify SHA-256 before `INSTALLING`. For boot or validation failure it restores the previous stable application/configuration slot, validates that slot, then emits `ROLLED_BACK`. The platform records the previous version, rollback result/reason, leaves failed non-recovered devices in `MAINTENANCE`, and returns recovered devices to `READY`. It never infers a physical stop or successful recovery from lost cloud connectivity.

## Gray release

Release order is deliberately narrow to broad:

1. `SINGLE`: exactly one explicit Robot UUID.
2. `SELECTED_BATCH`: an explicit bounded list, maximum `OTA_MAX_SELECTED_BATCH`.
3. `PROJECT`: all eligible robots in one explicit project, with explicit operator confirmation.
4. `PERCENTAGE`: deterministic UUID-ordered 1–99% selection.

`PROJECT` is rejected until the same target version has a successful `SINGLE` or `SELECTED_BATCH` canary in that project. There is no “implicit all robots” action. Campaign and per-robot job status remain visible independently; HTTP acceptance is not device success.

## Configuration levels and traceability

- L1 `BUSINESS`, L2 `CLEANING`, L3 `NAVIGATION`: immutable canonical JSON, reason, SHA-256 and optional approved rollback version.
- L4 `SAFETY`: additionally requires `CONFIG_SAFETY_MANAGE`, a second authorized user, an explicit decision and approval reason. Self-approval is forbidden.

The audit trail contains creator, approver, checksum, target project/robots, campaign reason, publish and completion timestamps, every status event and rollback evidence. Secrets, presigned URLs, raw exception text and private signing keys are excluded from audit responses.

## Development acceptance

Use `MOCK_ROBOT_SCENARIO=OTA_SUCCESS`, `OTA_CHECKSUM_FAILURE` or `OTA_BOOT_FAILURE`. The checksum scenario emits `FAILED/CHECKSUM_MISMATCH` directly after `VERIFYING` and never emits `INSTALLING`. The boot scenario emits `FAILED` after reboot followed by `ROLLED_BACK`. Real hardware acceptance must additionally prove atomic install, power-loss recovery, boot-health validation and retained local safety behavior.
