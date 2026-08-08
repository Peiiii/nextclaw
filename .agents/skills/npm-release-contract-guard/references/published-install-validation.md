# Published NPM 安装验证

- 验证精确发布包，不用 workspace link：安装 `nextclaw@beta` 或 stable，核对全局路径和版本。
- 在隔离 `NEXTCLAW_HOME=$(mktemp -d)` 运行 update check、download-only、apply 和新进程版本；不得用自定义 manifest URL/public key 环境变量替代用户路径。
- Packed/临时安装检查最近新增 runtime API、launcher/app entries、public key 和最小受影响命令。
- `--check` 只检测，download-only 不切 active pointer，apply 切换后由新进程运行下载版本；不要先执行会下载并应用的一体命令破坏分阶段验收。
- 仓库推荐 beta 入口：`pnpm -C packages/nextclaw validation:npm-update -- --published-beta`。
