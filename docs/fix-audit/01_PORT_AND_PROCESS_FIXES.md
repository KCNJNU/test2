# 端口与进程修复

## FIX-P1-001 Maven 隔离仓库

- 现象：用户级 `.m2` 损坏导致根 build 出现 `FileAlreadyExistsException`。
- 根因：根脚本隐式依赖全局 Maven local repository。
- 修改：`scripts/run-java-maven.mjs` 默认使用 `apps/java-api/.mvn/repository`，允许 `ROBOT_MAVEN_REPOSITORY` 覆盖；Windows 显式使用 `cmd.exe /d /s /c mvnw.cmd`。
- 验证：根 build PASS，Java verify 29/29 PASS；参数解析单测 PASS。

## FIX-P1-002 受控进程树

- 现象：Nest/Worker 任一异常退出或终端关闭可能遗留 API、Expo、Vite 子进程。
- 根因：原开发脚本没有统一生命周期，Windows `taskkill` 失败时没有精确 PID 后备路径。
- 修改：新增 `scripts/process-supervisor.mjs`；`run-api-dev.mjs` 监督 Nest/Worker；`run-dev.mjs` 监督 API/Mobile/Site/Web；Windows 先按直接子 PID 使用 `taskkill /T`，失败时枚举该 PID 的后代并逐个发信号。
- 验证：三轮 3000/5173/5174/8081 启动、health 200、停止后 `remaining=none`。证据：`evidence/start-stop-cycles.log`。

## 端口矩阵

Nest 3000、Java 3100、Web 5173、Site 5174、Expo 8081、Gateway metrics 9464。由于执行前已有 PID 30484 占用 3100，隔离 Java 使用 3110；未终止、访问或改写该既有进程。
