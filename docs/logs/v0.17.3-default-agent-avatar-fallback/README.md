# v0.17.3 Default Agent Avatar Fallback

## 迭代完成说明（改了什么）

本次修复默认 Agent 在无头像 URL 时退化显示首字母 `M` 的体验问题。根因是共享组件 `AgentAvatar` 对所有无图片 Agent 都统一使用 `displayName / agentId` 首字母作为 fallback，而默认 Agent 的 `displayName=Main`、`agentId=main`，因此在欢迎页、Agents 页等使用共享头像的位置会显示成 `M`。

根因通过代码路径确认：`ChatWelcome`、`AgentsPage`、`AgentIdentityAvatar` 等入口均复用 `packages/nextclaw-ui/src/shared/components/common/agent-avatar.tsx`，该组件此前在无 `avatarUrl` 时直接渲染 `resolveLetter(seed)`。本次修复命中根因：在共享头像组件内将 `main` Agent 的无图片 fallback 改为复用现有 `lucide-react` 的 `Bot` 图标，同时保留其它自定义 Agent 的首字母 fallback，不在各业务入口分别打补丁。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/shared/components/common/agent-avatar.test.tsx`
- `pnpm --filter @nextclaw/ui exec eslint src/shared/components/common/agent-avatar.tsx src/shared/components/common/agent-avatar.test.tsx`
- `pnpm --filter @nextclaw/ui tsc`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/shared/components/common/agent-avatar.tsx packages/nextclaw-ui/src/shared/components/common/agent-avatar.test.tsx`
- `pnpm lint:new-code:governance`

补充说明：`pnpm check:governance-backlog-ratchet` 执行失败，失败项为既有 doc 文件名治理基线超限：`docFileNameViolations` 当前 13，高于 baseline 11。本次只触达 `agent-avatar.tsx`、`agent-avatar.test.tsx` 与本迭代 `README.md`，不新增受管 doc 文件名违规。

## 发布/部署方式

本次只修改 `@nextclaw/ui` 源码与测试。进入后续统一前端构建、桌面打包或 NPM 发布流程时随包产物一起发布；本次未单独执行发布。

## 用户/产品视角的验收步骤

1. 打开 Chat 欢迎页或 Agents 页面。
2. 确认默认 Agent（`main / Main`）在没有自定义头像 URL 时显示机器人图标，而不是字母 `M`。
3. 确认其它非默认 Agent 在没有头像 URL 时仍显示对应首字母 fallback。

## 可维护性总结汇总

本次已尽最大努力优化可维护性：是。改动收敛在共享 `AgentAvatar` 组件内，避免在欢迎页、Agents 页、会话工具标记等调用点重复写特判。

本次遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。删除了独立 `resolveLetter` helper，将首字母逻辑内联为极小表达式，非测试代码统计为新增 6 行、删除 9 行、净增 -3 行。

总代码量因新增测试净增长，但生产代码净减少；分支数只增加一个必要产品身份分支，用于把默认 Agent 从低质首字母 fallback 收敛到统一机器人图标。未新增文件夹或业务入口补丁。

抽象、模块边界与职责划分保持清晰：头像 fallback 仍由 `AgentAvatar` 负责；没有新增 class、service、store 或额外 helper，也没有把显示规则散落到调用方。

目录结构与文件组织满足当前治理要求。`post-edit-maintainability-review` 结论：通过；正向减债动作是删除与简化，非测试代码净减少 3 行；no maintainability findings。

## NPM 包发布记录

本次未执行 NPM 包发布。若后续统一发布包含本次 UI 修复，涉及包为 `@nextclaw/ui`；当前状态为未发布，触发条件为后续统一发布流程。
