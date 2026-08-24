# DevOps 修复与隔离环境

- Docker Desktop 4.87.0 / Engine 29.7.2 / Compose 5.4.0 可用。
- Compose project：`robot-repair-20260823-203131`。
- 独立 PostgreSQL、Redis、MinIO、EMQX 端口和命名卷；没有连接现有开发数据库。
- `minio-init` 成功创建 raw 与 DVC 两个隔离 bucket；所有基础设施服务在 E2E 前健康。
- DVC 使用 `.venv-dvc/audit-repo-20260823-2145` 嵌套 Git 仓库；当前项目没有测试 commit/tag。
- 三轮 Node 开发组启停均释放端口。

执行结束时 `docker compose stop` 因运行器额度安全审查被拒绝，未绕过。容器仍运行、卷保留。待执行环境恢复后，在已设置原隔离变量的 PowerShell 中运行：

```powershell
docker compose -p robot-repair-20260823-203131 -f docs/fix-audit/evidence/isolated-infrastructure.compose.yml stop
```

不要追加 `-v`，不要使用 `down -v`。
