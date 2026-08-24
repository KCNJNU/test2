# MQTT 与状态链回归

隔离 EMQX、Gateway 和开发模拟器验证：

- Task start/pause 命令经 Outbox→MQTT→ACK 后进入 RUNNING/PAUSED。
- 新 sequence 更新状态；较旧 sequence 只入 Inbox、不覆盖 Robot 状态。
- 同一 messageId 发布两次，Inbox 唯一记录为 1。
- 相同 persistent clientId 断开重连后新消息继续处理。
- 离线 Robot start 返回 409；READY 守卫有效。
- FullBlock/latched SAFE 在 Fault acknowledge 后仍 active，普通 resume 返回 409。

生产 mTLS、证书轮换与 ACL deny-by-default 未以匿名隔离 EMQX 冒充验收，列入外部证据缺口。
