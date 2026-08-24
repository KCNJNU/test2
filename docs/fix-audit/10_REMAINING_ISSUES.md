# 剩余问题与验收缺口

## 已知代码缺陷

P0：0；P1：0；P2：0。没有因本轮修复引入公共 REST/MQTT contract、Prisma schema 或业务状态语义变更。

## NOT_VERIFIED / 外部项

1. Web 真实浏览器登录、路由权限、Loading/Error/Empty/Offline、上传和数据集交互：浏览器安全审查拒绝 localhost。等级：验收阻断，不判为代码缺陷。
2. 真实机器人、生产 MQTT mTLS/ACL、生产签名、Vault、OSS、生产备份恢复：缺少目标环境和凭据，不以模拟器替代。
3. npm audit：4 个已审查高危公告例外仍有效，需按例外到期日复核上游版本；当前 0 critical。
4. Expo 开发时 React Native DevTools 最新版缓存写入 `C:\Users\21658\AppData\Local\dotslash` 被运行器拒绝，Metro 使用 fallback；Expo Doctor 21/21，不影响 typecheck/test，但最新 DevTools 行为未验证。
5. 隔离 Compose 服务未能自动 stop：运行器额度审查拒绝；端口 15432/16379/19000/19001/11883/18084 当前仍监听，卷刻意保留。
6. 标准 Java 3100 在执行前已被 PID 30484 占用；本轮未触碰。隔离 Java 在 3110 完成验证。

因此本地 API/数据/MQTT 核心链通过，但完整客户型验收仍为 `CONDITIONAL`。
