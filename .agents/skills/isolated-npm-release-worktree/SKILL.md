---
name: isolated-npm-release-worktree
description: 当用户要发布已经提交的 NPM 包，但当前工作区还有未完成、半吊子、staged/unstaged WIP，或用户明确要求“不要把未完成改动发上去”“隔离发布”“全部发布”“发布产物再合回 master”时使用。覆盖 git worktree 隔离发布、NPM stable/beta 全量或窄发布、保护当前 WIP、registry 验证、release commit/tag 回流本地目标分支。
---

# Isolated NPM Release Worktree

## 目标

从已提交代码发布 NPM，同时保护当前工作区的未完成改动。发布完成后，把 release metadata、tags、skill/日志等可回流产物安全合回本地目标分支。

## 触发条件

- 用户要发布 NPM，但当前工作区不干净。
- 用户说已提交部分可以发，半成品不要发。
- 用户希望在隔离目录发布，发布产物最终回到本地 `master` / 当前目标分支。
- 用户要求沉淀可复用发布流程。

## 工作流

1. 冻结发布目标：
   - 记录当前目标分支、目标提交、dirty/staged/untracked 状态。
   - 明确哪些提交允许发布，哪些 WIP 禁止发布。
   - 禁止 stash、reset、checkout 用户 WIP，除非用户明确要求。

2. 创建隔离 worktree：
   - `git worktree add -b codex/release-<slug> <release-dir> <target-commit>`，不要用 detached worktree 直接发布；`pnpm publish --publish-branch` 会拒绝 detached HEAD。
   - 后续发布、version、build、pack、publish 都在 release worktree 内执行。

3. 决定 release 范围：
   - 先用 `npm-release-contract-guard` 判断 closure。
   - 若用户说“全部发布”“别限定”“直接全部”，默认使用 full public workspace batch：`pnpm release:auto:changeset` -> `pnpm release:version` -> `pnpm release:publish`。
   - 不要在用户明确纠偏为全量发布后继续用“最小可生效链路”解释窄发布；全量发布的成功标准是 `release:verify:published` 确认本批次所有公开包都 published。
   - 若 repo changeset flow 会把无关旧债或半成品 package 拉进 batch，允许改用受控窄发布，但必须说明原因。
   - 受控窄发布只适用于用户明确接受窄范围，或全量发布存在真实阻塞且用户确认降级。
   - 受控窄发布仍必须用 `pnpm publish`，禁止 raw `npm publish`。

4. 发布前验证：
   - 使用与 publish 相同的 npm config 验证 auth，例如 `NPM_CONFIG_USERCONFIG=<project>/.npmrc npm whoami`。
   - 如果主仓库存在私有 `.npmrc`，隔离 worktree 的所有 `npm view`、`npm install`、`pnpm publish` 和 registry 验证命令都必须带同一个 `NPM_CONFIG_USERCONFIG=<project>/.npmrc`；不要只在 publish 时带，否则验证和安装烟测可能读到用户级未登录配置并误报 401/404。
   - 运行被发布包的 `test`、`tsc`、`lint`、`build`。
   - 用 `pnpm pack` 检查 tarball manifest，确认 `workspace:*` 已转成已发布或本批次将发布的精确版本。
   - 对依赖闭包关键包做临时安装验证。

5. 发布：
   - 先发布底层依赖，再发布依赖它的包。
   - 全量发布优先用 `pnpm release:publish`，并在发布前提交 version/changelog commit，保证 npm tags 指向包含 release metadata 的 commit。
   - 窄发布在非 `master/main` 的 release branch 上使用 `pnpm publish --publish-branch <branch>`。
   - 每个包发布后用同一 npm config 执行 `npm view <pkg> version dist-tags dependencies --json` 验证 registry；首发 scoped package 刚发布后可能短暂 404，先按有限重试处理，不要立刻判定发布失败或重复 publish。

6. 回流本地目标分支：
   - NPM registry 发布成功后，必须先把 release commit / version / changelog / generated package artifacts / 必要源码修复回流到本地目标分支，再进入最终收尾；不能只停在隔离 worktree。
   - 默认在目标工作区执行 `git merge --ff-only <release-branch>`。如果 release branch 不是目标分支的快进后代，先停下说明差异，不要自动创建 merge commit。
   - 若目标工作区有 WIP，只允许在不重叠时 fast-forward；失败就停止，不要 stash、reset 或强行 merge。
   - 若因为 WIP 或非快进关系暂时无法回流，最终回复必须明确写“发布已到 registry，但本地目标分支尚未闭合”，并给出阻塞原因。
   - 未完成本地目标分支回流时，不得说“全部完成”或“发布闭环完成”。

7. 收尾：
   - 创建/更新本次 `docs/logs` 发布记录。
   - 若流程暴露了可复用规则，更新本 skill 或相关 release skill。
   - 给出发布包名、版本、dist-tag、验证命令、临时安装结果、release commit、tags。

## 关键约束

- 已提交代码可以发布；未完成 WIP 不能发布。
- 不要为了发布去整理、修复或提交无关 WIP。
- 不要让 changeset 自动扩大的旧债 batch 偷偷变成本次发布范围。
- 用户已经要求全量发布时，不要再以“避免扩大范围”为理由继续窄发；这时应该解决全量发布的验证问题，或明确报告真实阻塞。
- 若发布了 NPM registry，但 release metadata 尚未回流目标分支，不能说“全部完成”。
