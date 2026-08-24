# Command State Machine

`CREATED -> SENT -> ACCEPTED -> EXECUTING -> SUCCEEDED`

Terminal failures are `REJECTED`, `FAILED`, and `TIMEOUT`. Allowed command types are `MISSION_START`, `MISSION_PAUSE`, `MISSION_RESUME`, `MISSION_CANCEL`, `RETURN_TO_CHARGE`, `RETURN_TO_STANDBY`, `CONFIG_APPLY`, and `SOFTWARE_UPDATE`.

`DIRECT_CMD_VEL`, `FORCE_MOVE`, `IGNORE_SAFETY`, and `REMOTE_BRAKE_RELEASE` are forbidden at schema, API and gateway boundaries. `commandId` is globally unique. Repeated delivery returns the recorded outcome and never performs the action twice.

