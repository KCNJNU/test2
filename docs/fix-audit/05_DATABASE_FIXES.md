# 数据库修复

## FIX-P0-001 空库 D6 Migration

- 复现：全新 PostgreSQL 执行 `prisma migrate deploy`，D6 migration 在插入 `RolePermission(SUPER_ADMIN)` 时因 `RoleDefinition` 外键不存在，以 P3018/SQLSTATE 23503 失败。
- 根因：权限种子先于内置角色定义。
- 修改：`20260823183000_d6_production_hardening/migration.sql` 在权限关联前幂等插入 SUPER_ADMIN 与 ADMIN 的 `RoleDefinition`。
- 验证：保留首次失败数据库；新建空数据库 `robot_repair_retry1` 后 5 个 migration 全部部署、seed PASS、Prisma validate/generate PASS、Java JPA validate PASS。

没有删除表/列、不可逆 migration 或第二套迁移系统。BigInt 文件大小经 Java→Nest→Web 边界验证为十进制字符串。
