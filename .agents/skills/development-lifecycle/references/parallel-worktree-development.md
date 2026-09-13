# 并行开发 Worktree 合同

切入 worktree、迁移草稿或存在主线并发时读取；仅在主工作区起草不要求提前创建 worktree。

1. 主工作区保持本地 `master`，可承载前期草稿；提交前进入任务隔离 worktree，用户明确指定在主工作区提交时除外。草稿未迁走时不得为自动快进清除它。
2. 通过 `pnpm dev:worktree -- --name <kebab-slug> [--base <ref>]` 一次完成精确 Node 选择、`codex/<slug>` 分支、相邻 worktree 和依赖 bootstrap；版本缺失时 wrapper 通过 NVM 自动安装 `.nvmrc` 的精确版本。命名必须表达任务，不复用其它活跃 worktree。
3. 创建脚本在 bootstrap 前校验实际 Node 并在结构化结果中记录版本；pnpm 由该 Node 自带的 Corepack 按根 `packageManager` 解析，不依赖机器的全局 pnpm。worktree 位于主 workspace 外时不得绕过此入口直接安装。
4. bootstrap 使用共享 pnpm store 的 `pnpm install --frozen-lockfile --offline --ignore-scripts`，只创建当前 worktree 正确的软链接；禁止共享或软链另一个 worktree 的 `node_modules`，否则 workspace 依赖会解析到错误源码。
5. `--ignore-scripts` 后只为本次验证所需的 workspace 依赖闭包执行 `build`。原生依赖只有实际运行路径需要时才明确 rebuild；不能为图省事在每个 worktree 执行全仓安装脚本。
6. 每个 worktree 使用独立的服务端口、`NEXTCLAW_HOME` / run-home 和临时数据目录；不得重启或复用其它 worktree 的宿主实例。
7. 提交前精确 stage 本任务文件；只有合入主干或适用发布授权才执行集成与 push，并由 `pnpm release:reconcile:mainline` 协调主线回流；不手工 pull/rebase/stash/reset 活跃 `master`，不把回流留给用户。

## 草稿迁移与唯一写入位置

1. 首次写入前保存源工作区的 HEAD、staged/unstaged diff 与未跟踪文件状态，并记录本任务实际改动的路径和内容归属；状态列表本身不能区分同一文件的不同任务。证据留在任务上下文或仓库外的本地恢复材料，不另建仓库台账。缺少起点证据时用现有 diff、任务记录和目标内容重建归属，不能把全部脏文件认作本任务。
2. 切换前列全本任务已产生的新增、修改、删除与重命名，包括设计、计划、skill、AGENTS 和复盘；明确源、目标绝对路径及目标基线。同一文件混有既存或并发改动时按内容拆分，无法确认归属的部分保留源状并报告具体缺口，不猜测撤销。
3. 先将本任务增量应用到目标，处理目标已有内容或基线差异；不得以复制源文件覆盖目标的其他修改。核对新增文件内容、修改差异、删除与重命名结果，确认全部增量已在目标且无丢失。两边已有副本时先逐项比较，不能因文件同名或部分内容相同就清理。
4. 目标核对通过后，重新检查源文件与迁移快照一致，再仅撤掉本任务增量；发生并发变化则重新拆分核对。保留原有 staged/unstaged 状态和其它任务内容，禁止整仓 restore、stash、reset；新文件仅在确认完全属于本任务、目标副本完整且源未再变化时移除。失败时保留可恢复副本，不能先清源再补目标。
5. 迁移完成即将目标设为唯一任务写入根目录；工具每次显式使用该 worktree 的工作目录或路径。skill 发现目录的绝对路径可用于读取，修改仓库内 skill 时必须映射到目标 worktree，禁止复盘或文档更新写回源区。
6. 提交前及最终收尾对照起点、迁移清单、源区当前状态和目标 diff/提交逐项查漏；本任务源区残留须继续迁移，其他任务变化不混入、不撤销。未获提交授权时仍完成迁移，只保留目标未提交状态；仅起草而未切换时报告草稿位置，不强制创建 worktree。

完成标准：本任务改动无跨工作区遗漏，源区其他 WIP 和暂存状态保留。仅提交授权时完成任务分支提交；合入主干授权时提交已闭合到 `origin/master`，并返回 `LOCAL_MAINLINE_SYNCED` 或由 `LOCAL_WORKTREE_RETRYING` 自动 owner 持续处理。未提交草稿不宣称已交付到主线。
