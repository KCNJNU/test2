# SAFE Operation Matrix

Unknown codes fail closed: block Start and ordinary Resume, display the raw code and `Policy not configured`, require on-site handling, and never offer remote reset.

| Code | Meaning | Latched | Full block | Platform behavior |
| --- | --- | --- | --- | --- |
| SAFE-101 | Forward obstacle / waiting | No | No | Show waiting; allow robot-side automatic recovery |
| SAFE-106 | Negative obstacle / fall risk | Yes | Yes | Block task; on-site inspection; no ordinary Resume |
| SAFE-201 | Product definition pending | Yes | Yes | Fail closed pending product matrix |
| SAFE-202 | Product definition pending | Yes | Yes | Fail closed; no ordinary Resume |
| SAFE-301 | Physical emergency stop | Yes | Yes | Require physical reset; never expose remote release |
| SAFE-302 | Product definition pending | Yes | Yes | Fail closed pending product matrix |
| SAFE-303 | Product definition pending | Yes | Yes | Fail closed; no ordinary Resume |
| SAFE-403 | Product definition pending | Yes | Yes | Fail closed pending product matrix |
| SAFE-404 | Product definition pending | Yes | Yes | Fail closed pending product matrix |
| SAFE-405 | Product definition pending | Yes | Yes | Fail closed pending product matrix |

Acknowledgement means that an operator has read or accepted responsibility for an alarm. It never clears SafetyState and never acts as a safety reset.

