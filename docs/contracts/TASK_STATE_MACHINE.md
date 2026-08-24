# Task State Machine

`DRAFT -> SCHEDULED -> QUEUED -> DISPATCHING -> ACCEPTED -> RUNNING -> COMPLETED`

Additional transitions are `RUNNING <-> PAUSED`, `RUNNING -> BLOCKED`, and active states to `FAILED` or `CANCELED` when allowed by policy.

- `PAUSED` is an intentional business action and may expose Resume.
- `BLOCKED` is caused by safety/navigation/device conditions and never automatically exposes Resume.
- HTTP acceptance can move a request only to `DISPATCHING`; `ACCEPTED` and `RUNNING` require device evidence.
- Every transition is appended to TaskEvent with source, reason, device timestamp and received timestamp.
- Terminal tasks cannot be restarted. A retry creates a new Task/TaskRun.

