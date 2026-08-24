# 全平台测试与验收

1. Prisma：对空 PostgreSQL 顺序应用真实 migration；验证 LEGACY 回填及旧 Robot/File/Dataset/ObjectStorage/DVC 引用不变。
2. Java：状态机、SAFE fail-closed、Scope、CSRF/Session、Command 幂等、Map/Keepout、OTA 前置条件、审计脱敏；集成环境使用 PostgreSQL/Redis/MinIO/MQTT Testcontainers，禁止 H2/SQLite。
3. 模拟设备：正常 ACK、拒绝、超时、重复 messageId、乱序 sequence、断网补传；确认 PAUSED/BLOCKED 分离，云端离线不修改本地 SAFE。
4. Web：Vitest/Testing Library + Playwright 验证路由权限、Loading/Empty/Error/Offline/Blocked/Dispatching、SSE 重连、高风险确认及旧数据域回归。
5. Mobile：Jest/RNTL 验证 SecureStore、离线快照、不排队控制、告警确认和推送导航；运行 Expo Doctor 与 TypeScript。
6. 门禁：根 build/lint/test、Maven verify、Prisma validate、OpenAPI diff、Compose health。

实机联调依赖外部 Robot Agent、生产 MQTT TLS/ACL/证书和冻结 SAFE 矩阵，不属于模拟器验收结论。
# D6 two-tenant and resilience matrix

Create Tenant A/B with distinct users, projects, robots, maps, tasks, faults, datasets/files, Config and OTA campaigns. For each list, detail, mutation, bulk, search, export and indirect relation route, an A principal using a B identifier must receive 404 and must not create audit, command or outbox state in B. Repeat for TENANT_ADMIN, PROJECT_ADMIN, OPERATOR and deprecated ADMIN normalization; only an explicit SUPER_ADMIN flow may cross tenant boundaries.

The production acceptance suite also proves: no-certificate MQTT rejection; Robot A own topics allowed and Robot B topics denied; Gateway wildcard access limited to its service certificate; CRL revocation; Redis-shared control limits and fail-closed mutations; current database/object backups; isolated restore within four hours; guarded retention; HTTPS rollback; and 100-client jittered reconnect with at least 99 successful clients.
