# v0.14.246-codex-runtime-plugin-lint-release-unblock

## 迭代完成说明

- 修复 `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk` 在正式 `release:publish` 中暴露的 lint 阻塞。
- 删除 `src/index.ts` 中未使用的类型导入，消除 `@typescript-eslint/no-unused-vars` 错误。
- 保持运行时行为不变，只做发布前的最小源码清理。

## 测试/验证/验收方式

- 执行 `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk lint`。
- 在隔离 release worktree 中重新执行 `pnpm release:publish`。
- 发布后用 npm registry 查询关键包版本。

## 发布/部署方式

- 将本次最小修复提交 cherry-pick 到隔离 release worktree。
- 在隔离 worktree 继续既有 release commit，重新执行标准 `release:publish` 流程。

## 用户/产品视角的验收步骤

- 通过 npm 安装发布后的 `nextclaw` 与相关 NCP runtime 包，确认安装与运行链路正常。
- 启动包含 codex NCP runtime 的场景，确认不会因为发布过程中的 lint 阻塞而中断交付。
