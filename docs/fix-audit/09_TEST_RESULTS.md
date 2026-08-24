# 最终测试结果

| 门禁 | 结果 |
| --- | --- |
| 根 `npm run build` | PASS |
| 根 `npm run lint` | PASS |
| 根 `npm test` | PASS |
| NestJS | 24 suites / 89 tests PASS |
| Web | 8 files / 21 tests PASS |
| Mobile | 3 tests、lint/typecheck PASS |
| Site | 10 tests PASS |
| release policy | 18 tests PASS |
| Java | 29 tests PASS；verify/package PASS |
| Prisma validate/generate | PASS |
| 空库 migrate deploy + seed | PASS（首次失败库保留） |
| Expo Doctor | 21/21 PASS |
| 隔离基础设施 health | PASS |
| Auth/CSRF/Tenant/IDOR E2E | PASS |
| Upload/MinIO/Worker/BigInt/P2003 | PASS |
| Dataset freeze/publish/DVC/recovery | PASS |
| Task/SAFE/MQTT ACK/order/dedupe/reconnect | PASS |
| 三轮启停与端口释放 | PASS |
| 浏览器登录/路由 smoke | NOT_VERIFIED（浏览器安全审查拒绝 localhost） |

依赖审计：0 critical、43 high、12 moderate；high 由 4 个已审查且未过期例外传播，release audit policy PASS，未使用 `npm audit fix --force`。

原始日志：`evidence/root-build-final.log`、`root-lint-final.log`、`root-test-final.log`、`isolated-smoke.log`、`prisma-migrate-retry.log`、`start-stop-cycles.log`。
