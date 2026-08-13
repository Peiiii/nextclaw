# NPM 发布分支闭合

- 临时 worktree、detached HEAD 或 release branch 发布后，运行 `pnpm release:check:branch-closure -- --target <target> --release <ref>`。
- 比较目标与 release 分支，分类功能源码、版本/changelog/生成产物、历史 baseline 和无关改动。
- 用户可见功能源码不得只留在 release branch；回流目标分支，除非用户明确拒绝。
- 只剩发布 metadata 时也要说明 merge/cherry-pick/保留历史的确切选择。
- 最终明确回答目标分支是否缺功能代码、是否缺已发布记录/产物，并保护目标分支活跃 WIP。
