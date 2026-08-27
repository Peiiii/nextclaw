# 并行开发 Worktree 合同

仅当本次会产生提交，且主工作区存在或可能出现并行 WIP、自动快进或其它交付并发时读取。

1. 主工作区始终检出本地 `master`，只作为可安全自动快进的镜像；不得在其中累计待交付提交。
2. 通过 `pnpm dev:worktree -- --name <kebab-slug> [--base <ref>]` 创建唯一的 `codex/<slug>` 分支和相邻 worktree。命名必须表达任务，不复用其它活跃 worktree。
3. bootstrap 使用共享 pnpm store 的 `pnpm install --frozen-lockfile --offline --ignore-scripts`，只创建当前 worktree 正确的软链接；禁止共享或软链另一个 worktree 的 `node_modules`，否则 workspace 依赖会解析到错误源码。
4. `--ignore-scripts` 后只为本次验证所需的 workspace 依赖闭包执行 `build`。原生依赖只有实际运行路径需要时才明确 rebuild；不能为图省事在每个 worktree 执行全仓安装脚本。
5. 每个 worktree 使用独立的服务端口、`NEXTCLAW_HOME` / run-home 和临时数据目录；不得重启或复用其它 worktree 的宿主实例。
6. 提交前精确 stage 本任务文件。进入 Delivery 后由 `pnpm release:reconcile:mainline` 在新的 integration worktree 合并已提交分支、验证、普通 push 并安全同步主工作区；不手工 pull/rebase/stash/reset 活跃 `master`，不把回流留给用户。

完成标准：隔离 worktree 的提交已闭合到 `origin/master`，并返回 `LOCAL_MAINLINE_SYNCED` 或由 `LOCAL_WORKTREE_RETRYING` 自动 owner 持续处理；主工作区原有 WIP 未被覆盖。
