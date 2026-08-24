# Device Gateway Protocol

## Topics

- `robots/{robotId}/heartbeat`
- `robots/{robotId}/telemetry`
- `robots/{robotId}/events`
- `robots/{robotId}/faults`
- `robots/{robotId}/commands`
- `robots/{robotId}/commands/ack`

## Envelope

```json
{
  "schemaVersion": "1.0",
  "messageId": "MSG-uuid",
  "robotId": "robot-uuid",
  "robotSn": "CR-001",
  "timestamp": 1786800000000,
  "sequence": 42,
  "type": "heartbeat",
  "payload": {}
}
```

Inbound messages are unique by robot and messageId. Sequence controls state freshness; stale events are retained but cannot overwrite current state. The platform records device timestamp and receivedAt independently. Production requires MQTT TLS, device identity and per-robot ACLs. Final heartbeat intervals, retry counts and timeout thresholds remain external contract gates.

## D2 validation and identity

- D2 supports `schemaVersion: 1.0`; unknown versions are rejected with compatibility logging and without logging the raw payload.
- The Topic robot UUID, envelope `robotId`, registered Robot ID and registered `robotSn` must all agree.
- Production certificate authentication and per-robot broker ACLs remain D6 gates. D2 message checks do not replace broker authentication.
- `sequence` is a non-negative, robot-global monotonic integer. Older messages are retained in Inbox/Event/Telemetry storage but cannot replace newer Robot or Task state.
- `messageId` is deduplicated by `(robotId, messageId)` in the same database transaction as message effects.

## Message types

| Topic suffix | `type` | Platform effect |
| --- | --- | --- |
| `heartbeat` | `heartbeat` | Refresh online lease and apply fresh Robot state/version facts |
| `telemetry` | `telemetry` | Append TelemetrySample and apply only fresh summary facts |
| `events` | `task_event`, `robot_state`, `maintenance_event`, `ota_status` | Retain event and reconcile fresh final state |
| `faults` | `fault_event` | Apply configured SAFE policy; unknown SAFE codes fail closed |
| `commands/ack` | `command_ack` | Advance Command and eligible Task state without trusting HTTP acceptance |

Commands are published at QoS 1 from PostgreSQL Outbox. The gateway validates Robot existence, Robot SN and Topic ownership immediately before publish. Only the business command types frozen in `CommandType` are allowed; direct velocity or safety-bypass commands do not exist in the enum.

## Offline and reconnect

The platform reports `UNSTABLE` after the configured heartbeat lease and `OFFLINE` after the offline lease. `OFFLINE` is cloud reachability evidence only and never asserts that the robot is physically stopped. Reconnect processing relies on Inbox deduplication, robot-global sequence ordering and a fresh heartbeat for final-state reconciliation.
