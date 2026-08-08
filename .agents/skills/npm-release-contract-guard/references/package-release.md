# NPM Package 发布

1. 用与发布命令相同的 npm config 验证 auth；项目私有 `.npmrc` 存在时显式设置 `NPM_CONFIG_USERCONFIG`。
2. `pnpm release:sync-readmes`、`release:check-readmes`、`release:check:health`。
3. 根据用户安装入口和 workspace 依赖确定闭包；`@nextclaw/ui` 变化会影响 `nextclaw` 嵌入产物。窄发布必须证明排除依赖已按精确版本发布并通过 packed install。
4. 使用 `release:auto:changeset`/changeset、`release:version`、release notes owner，再 `release:publish`。
5. `pnpm release:verify:published` 和 `npm view ... dist-tags --json` 验证 registry；首发短暂 404 先按同一 npm config 重试。
6. 发布后检查每个 worktree 的 generated artifacts；应提交的进入发布记录，其余恢复/清理，不把 hash churn 留给用户。

`nextclaw` 的 workspace runtime API、UI 产物或公共 package 有未发布语义变化时，必须纳入同批；不能用 CLI 版本号或复制的 ui-dist 证明运行依赖闭包正确。
