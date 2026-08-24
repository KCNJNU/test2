# 上传与存储回归

本轮未修改 ObjectStorage 接口或 Prisma schema。隔离链路验证：

- 错误 `Content-Range` 返回 400；错误 part SHA-256 返回 409。
- 正确分片上传、complete、Worker finalize 与 MinIO compose 成功。
- `RobotFile.fileSize` 对外为字符串；对象与数据库记录一致。
- 冻结 DatasetVersion 引用文件后删除返回 409，P2003 保护有效。
- DVC bucket 与 raw file bucket 分离；发布与恢复均只使用隔离 MinIO。

证据：`evidence/isolated-smoke.log`。
