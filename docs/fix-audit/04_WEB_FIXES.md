# Web 与 Mobile 修复

## FIX-P2-001 服务边界

- 根 `.env` 与 `.env.example`：Web 主业务 API 指向 Java 3100；健康 API 指向 Nest 3000；Web 不直接调用 Nest 业务域。
- Java 继续把 Files/Uploads/Datasets/Jobs/Storage 透明代理到 Nest。
- 隔离回归因 3100 已被既有进程占用，将 Web 临时覆盖到 Java 3110。

## FIX-P2-002 Mobile API 配置

`apps/mobile/src/api.ts` 优先读取 `EXPO_PUBLIC_API_BASE_URL`，校验非空并去除尾斜杠；`.env.example` 明确 `http://localhost:3100/api/v1`。

## FIX-P3-001 Web 拆包

在 `apps/web/vite.config.ts` 对 React、router、query、AntD engine/icons/color、rc-picker、dayjs、upload 依赖做真实 manual chunks。最终最大 chunk 489.94 kB，无 >500 kB 或循环 chunk 警告。

Web 8 文件/21 项测试、typecheck、lint、build PASS；5173 HTTP 200。浏览器运行时访问 localhost 被安全审查拒绝，登录/权限/Offline UI 交互项为 `NOT_VERIFIED`。
