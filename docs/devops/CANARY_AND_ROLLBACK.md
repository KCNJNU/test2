# Blue-Green, Canary and Rollback — D4

## Release strategy

D4 uses host-level blue-green for Java API, NestJS API and Web. The inactive slot is the application canary: it receives health and version probes before any user traffic. Edge switches only after all checks pass; there is no percentage traffic split in D4.

Worker and Device Gateway are intentionally single-active. Running two workers could duplicate consumption; running two gateways with one MQTT Client ID could steal the broker session. They are replaced only after Edge cutover, then verified through Worker heartbeat and the Gateway connected metric.

## Failure behavior

- Migration or inactive-slot failure: do not switch Edge; current release keeps serving.
- Stable-endpoint failure immediately after switch: restore the prior Edge slot.
- Worker/Gateway replacement failure: restore prior Edge and prior singleton release.
- Later production regression: run the approved rollback workflow and select only the recorded previous stable release.
- Migration incompatibility: rollback is prohibited as a remedy if the prior application cannot run on the expanded schema; fix forward instead.

Database migrations are never reversed automatically. Release authors must prove the old application starts after every migration admitted to a deployment.

## Acceptance drill

On an isolated TEST host, deploy blue, promote a newer commit to green, verify commit identity through Edge, and prove only one Worker and Gateway are active. Induce an inactive-slot health failure and confirm no switch. Complete a successful switch, rollback to the recorded prior manifest, and verify Edge, Worker heartbeat and Gateway MQTT connectivity. Capture host JSONL and GitHub Environment/Deployment evidence.

This exercise validates cloud rollout mechanics only. `Cloud Down ≠ Safety Down`; a successful or failed rollout never substitutes for robot-side safety validation.

## D5 robot release distinction

D4 blue-green controls cloud service images. D5 OTA gray release controls robot software/configuration and uses `SINGLE → SELECTED_BATCH → PERCENTAGE → PROJECT`; the two mechanisms do not share slots or rollback records. Robot rollout requires a successful explicit canary before project-wide release. A Robot Agent checksum failure must stop before installation, while a boot/validation failure restores the device's recorded previous stable version and reports `ROLLED_BACK`. Cloud deployment rollback never claims to roll back a robot, and robot rollback never reverses a database migration. See `OTA_RELEASE.md`.
