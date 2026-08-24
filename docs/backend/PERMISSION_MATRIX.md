# 权限矩阵

| 能力 | SUPER_ADMIN | TENANT_ADMIN | PROJECT_ADMIN | OPERATOR | MAINTENANCE_ENGINEER | VIEWER |
|---|---:|---:|---:|---:|---:|---:|
| Tenant 管理 | ✓ |  |  |  |  |  |
| Project/Site/Floor | ✓ | ✓ | ✓(授权项目) |  |  |  |
| 设备/任务读取 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Start/Pause/Resume/Cancel | ✓ | ✓ | ✓ | ✓ |  |  |
| SAFE 告警确认 | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| Maintenance/诊断 | ✓ | ✓ | ✓ |  | ✓ |  |
| 地图发布/Keepout | ✓ | ✓ | ✓ |  |  |  |
| OTA/安全配置 | ✓ | ✓ | ✓ |  | ✓ |  |
| 用户/审计 | ✓ | ✓(本租户) | 有限 |  |  |  |

旧 ADMIN 在 Java 主体中归一化为 SUPER_ADMIN。tenantId 对非全局管理员从会话推导；跨租户对象按 404 处理，资源可见但动作无权按 403 处理。
