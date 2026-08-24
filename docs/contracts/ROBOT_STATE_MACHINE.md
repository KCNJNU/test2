# Robot State Machine

Canonical states are `OFFLINE`, `BOOTING`, `IDLE`, `READY`, `DISPATCHING`, `RUNNING`, `PAUSED`, `BLOCKED`, `RETURNING`, `CHARGING`, `MAINTENANCE`, `FAULT`, and `UPGRADING`.

Robot Agent is the fact source for runtime state. The platform may mark a robot `OFFLINE` after the configured heartbeat lease expires, but this never means the robot is physically stopped.

| From | Allowed target | Required evidence |
| --- | --- | --- |
| OFFLINE | BOOTING, IDLE, READY, MAINTENANCE, FAULT | Newer heartbeat/state event |
| BOOTING | IDLE, READY, FAULT, OFFLINE | Robot event or lease expiry |
| IDLE | READY, RETURNING, CHARGING, MAINTENANCE, FAULT, OFFLINE | Robot event |
| READY | DISPATCHING, RETURNING, CHARGING, MAINTENANCE, FAULT, OFFLINE | Accepted platform command or robot event |
| DISPATCHING | RUNNING, READY, BLOCKED, FAULT, OFFLINE | Command ACK/task event |
| RUNNING | PAUSED, BLOCKED, RETURNING, READY, FAULT, OFFLINE | Task/SAFE event |
| PAUSED | RUNNING, BLOCKED, RETURNING, READY, FAULT, OFFLINE | Legal resume/cancel ACK or robot event |
| BLOCKED | RUNNING, RETURNING, READY, MAINTENANCE, FAULT, OFFLINE | Robot-side clearance and policy authorization |
| RETURNING | CHARGING, IDLE, READY, BLOCKED, FAULT, OFFLINE | Robot event |
| CHARGING | IDLE, READY, MAINTENANCE, FAULT, OFFLINE | Robot event |
| MAINTENANCE | IDLE, READY, FAULT, OFFLINE | Recorded maintenance exit and robot event |
| FAULT | IDLE, READY, MAINTENANCE, OFFLINE | Robot-side clearance; never alarm acknowledgement alone |
| UPGRADING | BOOTING, IDLE, READY, FAULT, OFFLINE | OTA validation result or lease expiry |

Every accepted transition records source, source timestamp, receive timestamp, sequence and correlation identifiers. Controllers must call the centralized transition service rather than update state directly.

