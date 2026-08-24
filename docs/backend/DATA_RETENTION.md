# 数据保留策略

- AuditLog、FaultEvent、发布地图/版本：不可物理删除，默认长期保留。
- TelemetrySample：PostgreSQL 月分区；热数据默认 30 天、聚合数据 13 个月，最终期限须由产品/合规冻结。
- Inbox/Outbox：完成记录默认 30 天；未完成记录不得自动清除。
- SSE/Redis：只作最新快照、租约、短期去重与事件分发，不是事实源。
- DiagnosticBundle/软件包/地图对象：数据库保留元数据；对象生命周期删除必须具备审计与引用检查。
- Session：到期 12 小时，可主动撤销；PushDevice 在退出或失效反馈后停用/删除。

任何保留期限在生产启用前需由产品、安全与合规共同确认。
# D6 executable baseline

The enforced baseline is Audit 730 days, completed Fault/Task 365 days, raw Telemetry 30 days, RobotHealth/telemetry aggregates 365 days, application logs 90 days and DiagnosticBundle objects 90 days. Frozen/published DVC snapshots are excluded. Cleanup is previewed first, requires `SUPER_ADMIN`, exact confirmation `APPLY_RETENTION_POLICY`, enabled production configuration, fresh database/object backup evidence and a successful restore drill within 35 days.

The Worker processes at most 5,000 relational Task and Diagnostic candidates per Job, clears dependent records in a transaction, deletes diagnostic objects only through `ObjectStorage`, and writes `RETENTION_POLICY_APPLIED` audit evidence. Repeating the Job is safe because only rows older than fixed cutoffs remain eligible.
