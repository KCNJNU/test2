# 平台 ERD 与数据字典

```text
Tenant ─ Project ─ Site ─ Floor ─ Robot ─ TelemetrySample/Health/Fault/Maintenance
                         ├─ PlatformMap ─ MapVersion ─ Zone
                         └─ MissionTemplate ─ Task ─ TaskRun/TaskEvent ─ Command ─ OutboxMessage
User ─ UserProjectAccess ─ Project      User ─ Session / PushDevice / AuditLog
SoftwareVersion / ConfigVersion ─ OTAJob ─ Robot
Dataset ─ DatasetVersion ─ RobotFile（由 Nest 数据域维护，Java 透明代理）
```

所有业务主键为 UUID；TelemetrySample 使用 BIGSERIAL。层级和机器人使用 ACTIVE/INACTIVE 软停用。设备事实同时保存 deviceTimestamp/receivedAt/sequence；未知事实为 null。objectKey、checksum、MIME、size 仅作为对象存储索引，文件内容不进入 PostgreSQL。详细列定义及约束以 `apps/api/prisma/schema.prisma` 为唯一来源。

Prisma 是唯一 schema/migration 所有者；Java 仅 validate，不执行 DDL。迁移为加法式并创建 LEGACY 层级，保留旧 UUID、externalId/name 物理列及全部 DVC/ObjectStorage 引用。
