# 隔离 Worktree 发布

用于从已提交代码发布，同时保护当前工作区的 staged/unstaged/untracked WIP。禁止为发布 stash、reset、checkout、整理或提交无关 WIP。

## 流程

1. **冻结范围**：记录目标分支、允许发布的 commit 和当前 WIP；明确禁止进入发布的内容。
2. **创建分支 worktree**：

   ```bash
   git worktree add -b codex/release-<slug> <release-dir> <target-commit>
   ```

   不用 detached HEAD；version、build、pack 和 publish 全部在隔离 worktree 执行。默认主工作区始终保持检出 `master`，不得为了释放目标分支而把它切到保护、功能或 release 分支。

3. **检查健康与范围**：version/publish 前运行 `pnpm release:check:health`。用户说“全部发布”时使用 full public workspace batch：`release:auto:changeset -> release:version -> release:publish`；只有用户同意或存在已说明的真实阻塞时才缩窄。窄发布仍使用 `pnpm publish`，禁止 raw `npm publish`。
4. **统一 registry 身份**：若主仓库有私有 `.npmrc`，所有 `npm whoami/view/install`、`pnpm pack/publish` 和 registry 验证都使用同一个 `NPM_CONFIG_USERCONFIG=<project>/.npmrc`，避免不同配置造成假 401/404。`release:stable` 在链接 worktree 缺少 `.npmrc` 时会自动引用主 worktree 配置；其它命令仍需显式传入。出现 401 时先对比配置来源，禁止直接推断 token 失效或要求重新登录。
5. **发布前验证**：运行被发布包匹配的 test/tsc/lint/build；严格检查必须在干净 worktree 中先构建发布包的完整 workspace 依赖闭包，未升版本的构建前置不得进入 checkpoint、tag 或 publish 范围。用 `pnpm pack` 检查 tarball、launcher/assets 和 `workspace:*` 转换；对关键依赖闭包做临时安装。
6. **发布与 registry 验证**：底层依赖先发。全量优先 `pnpm release:publish`，并确保 tag 指向包含 version/changelog 的提交；窄发布在 release branch 使用 `pnpm publish --publish-branch <branch>`。逐包用相同 npm config 验证 version、dist-tags 和 dependencies；首次 scoped 包短暂 404 只做有限重试，不重复 publish。
7. **回流目标分支**：发布后运行 `pnpm release:check:branch-closure -- --target <target> --release <ref>`。目标分支已在默认工作区检出时，发布器应在该工作区保持 `master` 的前提下执行 `git merge --ff-only <release-commit>`；WIP 不重叠且能 fast-forward 才回流，否则停止，不切分支、不 stash、不强制 merge。未回流时必须明确“registry 已发布，但本地目标分支尚未闭合”。
8. **收尾**：release worktree 与目标工作区分别检查 status，并确认默认主工作区仍检出 `master`；发布产生的版本、changelog 和必要产物应提交回流，临时构建物清理。报告包、版本、dist-tag、安装证据、release commit、tags、目标分支闭合和残余 WIP。

完成条件：未提交 WIP 未进入 release；registry 与临时安装证据成立；release metadata 已回流目标分支，或阻塞被明确报告。只完成 registry 不能称为“发布闭环完成”。
