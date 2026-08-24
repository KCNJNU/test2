# Java 修复

## FIX-P1-004 任务命令幂等

- 现象：相同 `Idempotency-Key` 的第二次 `start` 在第一次已改变 Robot/Task 状态后返回 `ROBOT_NOT_READY` 409。
- 根因：状态、READY 与 SAFE 校验先于幂等命中查询。
- 修改：先解析 action 类型并查询 actor+key；精确匹配 task/type 时直接返回原命令，跨 task/action 复用返回 `IDEMPOTENCY_KEY_REUSED`；仅新命令执行状态和安全校验。
- 文件：`TaskService.java`、`TaskServiceIdempotencyTest.java`。
- 验证：Java 29/29 PASS；真实 E2E 相同 key 返回同一 command，并完成 MQTT ACK。

## FIX-P2-003 Java CORS

允许显式 Web origin 和凭据模式，补齐 `Content-Range`、`X-Part-SHA256`、`X-CSRF-Token`、`Idempotency-Key`、`X-Request-ID`、`X-Trace-ID`、`traceparent`、`Last-Event-ID`；暴露 request/trace headers。SecurityConfig 单测覆盖。

JPA 仍为 `ddl-auto=validate`；Prisma 仍是唯一 schema/migration owner；未引入 Flyway。
