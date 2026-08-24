# RobotHygienism 全面修复总结

- 执行窗口：`2026-08-23T20:31:31+08:00` 至 `2026-08-23T22:06:00+08:00`
- Git：`master` / `72019921ad28d427378c4869bcaa279162e0bb8e`
- 修复指令 SHA-256：`4FBA937FD9FCE3D28F18CB1E9394E9405F8F90DBC0A35E4FF5D062AC4C6987C3`
- 工作树策略：未 reset、checkout、clean、commit；保留全部既有 tracked/untracked 改动。

## 结论

`Core Smoke Test: CONDITIONAL`

根 build/lint/test、Java 29 项测试、Prisma 校验、空库迁移、隔离基础设施健康、API/数据库/上传/DVC/MQTT/双租户写入式 E2E 均通过。浏览器运行时的安全审查拒绝访问 `localhost:5173`，因此真实浏览器登录/路由 smoke 为 `NOT_VERIFIED`，不能把 HTTP 200、构建或 Web 单测替代为浏览器验收证据。

## 缺陷计数

| 等级 | Fixed | Remaining known code defects |
| --- | ---: | ---: |
| P0 | 1 | 0 |
| P1 | 4 | 0 |
| P2 | 3 | 0 |
| P3 | 2 | 0 |

验收/环境缺口不计入代码缺陷：浏览器 smoke 被策略阻断；真实机器人及生产 MQTT mTLS/ACL、签名、Vault、OSS、备份恢复无真实证据；4 个 npm 高危公告处于已审查例外；隔离 Compose 的 stop 被执行额度审查拒绝。

## 服务与端口

| 服务 | 验证端口 | 验证结果 | 当前状态 |
| --- | ---: | --- | --- |
| Nest API / Worker | 3000 | health/docs/metrics 与 E2E PASS | 已停止 |
| Java API | 3110（隔离） | health/docs/openapi/401 与代理 E2E PASS | 已停止 |
| Java 标准开发端口 | 3100 | 被执行前已存在的 PID 30484 占用 | 未触碰 |
| Web / Site / Expo | 5173 / 5174 / 8081 | HTTP 200、三轮释放 PASS | 已停止 |
| Gateway metrics | 9464 | MQTT 处理与 metrics PASS | 已停止 |
| PostgreSQL / Redis / MinIO / EMQX | 15432 / 16379 / 19000,19001 / 11883,18084 | 隔离容器健康、E2E PASS | 仍运行，卷保留 |

## 主要修复

- P0：空库 D6 migration 在写入 `RolePermission` 前缺少内置 `RoleDefinition`，已按依赖顺序补齐。
- P1：Maven 改用项目隔离仓库；Windows 进程树监督与三轮释放；DVC Windows 全局目录及 DVC 3.67 CLI/指针兼容；任务幂等重试前置。
- P2：Java/Nest/Web/Mobile 服务边界、API 地址与 CORS headers 修正。
- P3：Ant Design 实际拆包；Nest wildcard middleware 改为命名通配符。

详细结果见 `01` 至 `10` 报告，原始证据位于 `docs/fix-audit/evidence/`。
