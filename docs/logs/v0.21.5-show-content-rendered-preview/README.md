# v0.21.5 show_content rendered file preview

## 迭代完成说明

本轮为 `show_content` 增加文件预览 viewer 合同：file target 支持 `payload.viewer = "auto" | "source" | "rendered"`。默认仍保持源文本预览；当 agent 明确传入 `viewer="rendered"` 且目标文件为 `.html/.htm` 时，chat workspace 文件预览使用 sandboxed `iframe srcDoc` 渲染 HTML。

实现链路保持单一路径：`@nextclaw/shared` 承载事件合同，`@nextclaw/kernel` 校验工具参数并发出 `ui.show-content`，`@nextclaw/agent-chat-ui` 暴露 chat UI view model 字段，`ChatThreadManager` 将 file target 转成 workspace file tab，workspace preview 组件负责 source/rendered 分流。

同时更新 native prompt context 与 `nextclaw-app-creator` skill，明确普通本地 HTML 文件或页面原型应使用 `show_content(type="file", payload.viewer="rendered", placement="side_panel")`，需要看源码时使用 `payload.viewer="source"`；不要为了预览普通 HTML 文件强行创建 Panel App。

## 测试/验证/验收方式

- `packages/nextclaw-kernel`: `./node_modules/.bin/vitest run src/tools/show-content.tools.test.ts src/contributions/context-provider/providers/context-provider-contract.provider.test.ts`
- `packages/nextclaw-ui`: `./node_modules/.bin/vitest run src/features/chat/features/workspace/components/__tests__/chat-session-workspace-file-preview.test.tsx src/features/chat/managers/__tests__/chat-thread.manager.test.ts src/features/chat/stores/__tests__/chat-thread.store.test.ts src/features/chat/features/message/utils/__tests__/chat-message-show-content-tool-card.utils.test.ts`
- `packages/nextclaw-core`: `./node_modules/.bin/vitest run src/features/agent/features/tests/skills.test.ts`
- `packages/nextclaw-shared`: `./node_modules/.bin/tsc -p tsconfig.json`
- `packages/nextclaw-agent-chat-ui`: `./node_modules/.bin/tsc -p tsconfig.json`
- `packages/nextclaw-kernel`: `./node_modules/.bin/tsc -p tsconfig.json`
- `packages/nextclaw-ui`: `./node_modules/.bin/tsc --noEmit`
- 包级 ESLint：`nextclaw-shared`、`nextclaw-agent-chat-ui`、`nextclaw-kernel`、`nextclaw-ui`、`nextclaw-core`
- touched-file ESLint：`./node_modules/.bin/eslint --max-warnings=0 <本轮触达 TS/TSX 文件>`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `node scripts/governance/checks/lint-new-code-governance.mjs -- <本轮 show_content 触达文件>`
- `node scripts/governance/backlog/check-governance-backlog-ratchet.mjs`
- `git diff --check -- <本轮 show_content 触达文件>`

说明：全量 `pnpm lint:new-code:governance` 被工作区已有的 terminal 工具卡片 WIP 阻塞，阻塞点是 `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/__tests__/chat-message-list.terminal.test.tsx` 的 unrelated module-structure import 违规；本轮 show_content 文件的 path-scoped governance 已通过。

## 发布/部署方式

本轮未执行发布、部署或 NPM publish。已添加独立 changeset，后续统一 NPM 发版需要纳入：

- `@nextclaw/shared`
- `@nextclaw/agent-chat-ui`
- `@nextclaw/kernel`
- `@nextclaw/ui`
- `@nextclaw/core`

## 用户/产品视角的验收步骤

1. Agent 创建或定位一个本地 `.html` 文件后，调用 `show_content`，参数包含 `type="file"`、`payload.path` 和 `payload.viewer="rendered"`。
2. Chat 右侧 workspace file tab 打开该 HTML 文件，并展示 rendered 页面，而不是只显示源码。
3. 同一路径若改用 `payload.viewer="source"` 或省略 viewer，仍展示原来的源文本/code preview。
4. 对非 HTML 文件传入 `viewer="rendered"` 不会误渲染，仍回退到 source preview。
5. Tool card 的“Show content”展开动作保留 viewer 字段，不丢失 rendered/source 意图。

## 可维护性总结汇总

- 本次没有新增平行 HTML preview 系统，也没有引入新的 URI/resource 模型；HTML rendered preview 归属于现有 workspace file preview owner。
- 为避免 `chat-thread.store.ts` 继续膨胀，已将 workspace file-tab 持久化归一化抽到 `chat-workspace-file-tab-persistence.utils.ts`，store 从 396 行降到 338 行。
- `post-edit-maintainability-guard` 通过，无 error；保留的 warning 均为既有接近预算或已记录例外目录。
- `post-edit-maintainability-review` 已执行：这是新增用户能力，非测试代码净增长来自必要的跨包合同、UI 渲染和 agent 指引；同时通过 store 职责抽取完成了一处正向减债。

## NPM 包发布记录

本轮未发布 NPM 包。当前状态：待统一发布。
