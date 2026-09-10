# Published NPM 安装验证

- 验证精确发布包，不用 workspace link：安装 `nextclaw@beta` 或 stable，核对全局路径和版本。包 identity 直接读取已安装 `package.json`；空 home 下执行 launcher 会触发 Runtime 自举，不能用来证明 NPM 包版本。
- 每个 published install 使用独立 NPM cache 和 online metadata；脚本只对 Registry 刚发布版本的 `ETARGET`/404 做有界重试。禁止复用发布前 `--prefer-offline` metadata，也禁止要求操作者手工重复安装。
- 在隔离 `NEXTCLAW_HOME=$(mktemp -d)` 运行 update check、download-only、apply 和新进程版本；不得用自定义 manifest URL/public key 环境变量替代用户路径。
- 验证“从上一 stable 升级”前，脚本必须自动下载上一版本 GitHub Release 的当前平台官方 Runtime asset，核对 version/platform/arch 后写入旧 active pointer。只有旧 launcher + 空 home 是首次自举，不是升级夹具。
- Packed/临时安装检查最近新增 runtime API、launcher/app entries、public key 和最小受影响命令。
- `--check` 只检测，download-only 不切 active pointer，apply 切换后由新进程运行下载版本；不要先执行会下载并应用的一体命令破坏分阶段验收。
- Stable parent workflow 必须自己完成上述真实升级并输出最终状态；不得在发布过程中临时编写自定义验证流程。失败恢复复用同一 `validation:npm-update --published-stable` owner。
- 仓库推荐 beta 入口：`pnpm -C packages/nextclaw validation:npm-update -- --published-beta`。
