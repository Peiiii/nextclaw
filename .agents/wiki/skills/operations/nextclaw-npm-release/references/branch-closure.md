# NPM 发布分支闭合

- 临时 worktree、detached HEAD 或 release branch 发布后，运行 `pnpm release:check:branch-closure -- --target <target> --release <ref>`。
- 比较目标与 release 分支，分类功能源码、版本/changelog/生成产物、历史 baseline 和无关改动。
- 用户可见功能源码不得只留在 release branch；回流目标分支，除非用户明确拒绝。
- 只剩发布 metadata 时也要说明 merge/cherry-pick/保留历史的确切选择。
- 远程完成门成立后运行 `pnpm release:reconcile:mainline`。禁止对活跃本地 `master` 执行 rebase、stash、reset 或 force push；本地独有提交在隔离 integration worktree 与最新 `origin/master` 合并、验证并普通 push，保留双方祖先关系。
- `LOCAL_WORKTREE_RETRYING` 由目标 worktree 单例 retry worker 自动接管，不是用户待办；不同 worktree 的 worker 必须彼此隔离，不能复用或覆盖其它活跃 worktree 的 lease。`MAINLINE_RECONCILIATION_RECOVERING` 必须由当前发布 Agent 在输出的恢复 worktree 继续解决，不能以分叉或冲突为由让用户手工收尾。
- 最终明确回答目标分支是否缺功能代码、是否缺已发布记录/产物、远程主线是否闭合，以及本地主线处于 `LOCAL_MAINLINE_SYNCED` 还是自动恢复状态，并保护目标分支活跃 WIP。
