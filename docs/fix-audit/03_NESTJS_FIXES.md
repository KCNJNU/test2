# NestJS 修复

## FIX-P1-003 DVC 发布兼容

- Windows 隔离：DVC 子进程默认 `DVC_NO_ANALYTICS=true`，system/global/site-cache 指向发布仓库 `.dvc/tmp/runtime`，不再尝试写 `C:\ProgramData\iterative`。
- DVC 3.67 CLI：移除已不支持的 `remote modify -f`。
- DVC 3.x 指针：哈希解析同时支持 `md5:` 与目录指针 `- md5: ...dir`。
- 验证：4 项 DVC 单测；隔离 MinIO 上真实 add/push、Git commit/tag、临时 worktree pull/recovery PASS。

## FIX-P2-003 Nest CORS

与 Java 对齐上传、CSRF、幂等和 trace headers；只允许显式 `CORS_ORIGIN` 且启用凭据。

## FIX-P3-002 Nest 路由通配符

Trace middleware 从旧 `'*'` 改为 Nest/path-to-regexp 支持的 `'{*path}'`，启动日志不再出现 LegacyRouteConverter 自动转换告警。
