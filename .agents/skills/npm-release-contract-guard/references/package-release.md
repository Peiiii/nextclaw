# NPM Package 发布

1. 用与发布命令相同的 npm config 验证 auth；项目私有 `.npmrc` 存在时显式设置 `NPM_CONFIG_USERCONFIG`。
2. `pnpm release:sync-readmes`、`release:check-readmes`、`release:check:health`。
3. 根据用户安装入口和 workspace 依赖确定闭包；`@nextclaw/ui` 变化会影响 `nextclaw` 嵌入产物。窄发布必须证明排除依赖已按精确版本发布并通过 packed install。
4. 使用 `release:auto:changeset`/changeset、`release:version`、release notes owner，再 `release:publish`。
5. `pnpm release:verify:published` 和 `npm view ... dist-tags --json` 验证 registry；首发短暂 404 先按同一 npm config 重试。
6. 发布后检查每个 worktree 的 generated artifacts；应提交的进入发布记录，其余恢复/清理，不把 hash churn 留给用户。

完整 stable NPM 闭环使用 `pnpm release:stable`：它在不可逆 publish 前冻结 release plan、验证 auth/branch/release notes/public key，随后串联严格检查、registry、release commit/tag/push、stable runtime 和真实安装升级。先用 `--dry-run` 审计；发布后失败按输出的 `--resume-from git|runtime|install` 精确续跑，不重新执行 package publish。

`nextclaw` 的 workspace runtime API、UI 产物或公共 package 有未发布语义变化时，必须纳入同批；不能用 CLI 版本号或复制的 ui-dist 证明运行依赖闭包正确。
