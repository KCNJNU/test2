# OpenAPI 公共契约

运行 Java 后通过 `/api/v1/openapi.yaml` 获取契约，通过 `/api/docs` 浏览。Web/App 统一使用 `/api/v1`；Java 将 Files/Datasets/Uploads/Jobs/Storage 等透明代理到内部 NestJS。

所有列表返回 `{items,total,page,pageSize}`；写命令支持 `Idempotency-Key`。Web 使用 `cr_session` HttpOnly Cookie + `X-CSRF-Token`，移动端使用同一 Session 表签发的可撤销 opaque bearer token。SSE `/api/v1/events/stream` 支持 Last-Event-ID，事件类型为 robot.state.changed、robot.online.changed、task.status.changed、fault.created、fault.updated、command.status.changed。
