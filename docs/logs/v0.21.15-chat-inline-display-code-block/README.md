# v0.21.15 Chat Inline Display Code Block

## 迭代完成说明

本轮完成 `nextclaw-inline` Markdown fenced code block 的内联展示协议与实现。

- 新增设计文档 `docs/designs/2026-07-04-chat-inline-display-code-block.design.md`，明确 Markdown link、inline display code block 与 `show_content` 的边界。
- 在 `@nextclaw/agent-chat-ui` 增加 `ChatInlineDisplayViewModel` / `ChatInlineDisplayTarget` 类型合同。
- 在 `ChatMessageMarkdown` 中识别 `nextclaw-inline` fenced code block，并把合法 JSON descriptor 渲染为只读 inline display。
- invalid descriptor 回退普通代码块，不吞内容。
- 在 `@nextclaw/ui` 中把 `panel_app` inline display 接到现有 `ChatInlinePanelAppCard`，但关闭 side-panel expand action，保持“永远内联”。
- 更新 `ReplyFormatContextProvider`、Inline Interactive Surfaces native context、`show_panel_app` 工具描述与内置 app creator skills，明确 `nextclaw-inline` 是最终回复里的 inert inline display，模型可见展示工具只用于 side panel 即时预览，且不再暴露 `placement` 参数。
- 默认 AI context 明确只允许 `nextclaw-inline` 一个代码块语言名，并列出 `panel_app`、`json`、`file`、`url` 四类 target 的使用边界；`file` / `url` 只作为非点击占位，不替代 Markdown 链接。
- 添加 `.changeset/chat-inline-display-code-block.md`，标记 `@nextclaw/agent-chat-ui`、`@nextclaw/core`、`@nextclaw/kernel` 与 `@nextclaw/ui` patch。

本次根因不是 bug，而是交互语义边界补齐：工具调用是动作/执行链路，特殊代码块是消息内的展示声明。实现没有把代码块升级为 tool action、file open 或 right-panel open。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-message-list/__tests__/chat-message-markdown.test.tsx`
  - 1 个文件，16 个测试通过。
  - 覆盖 inert inline display、host renderer、invalid descriptor fallback、普通代码块和 inline token 行为。
- `pnpm -C packages/nextclaw-ui test -- src/features/chat/features/message/components/__tests__/chat-inline-panel-app-card.test.tsx src/features/chat/features/message/components/__tests__/chat-message-list.container.test.tsx`
  - 2 个文件，15 个测试通过。
  - 覆盖 Panel App inline card 无 expand action、container 透传 inline display renderer。
- `pnpm -C packages/nextclaw-agent-chat-ui tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-kernel test -- src/contributions/context-provider/providers/reply-format-context.provider.test.ts src/contributions/context-provider/providers/context-provider-contract.provider.test.ts src/tools/show-content.tools.test.ts`
  - 3 个文件，9 个测试通过。
  - 覆盖回复格式、native prompt context、assembled context 与 show-content 工具 schema 合同，确认模型可见 context 不再出现 `placement="inline"` / `placement="side_panel"` 工具参数诱导，且 `show_file` / `show_url` / `show_panel_app` schema 不再暴露 `placement` 参数。
  - 覆盖默认 AI context 已包含 `nextclaw-inline` 支持的 target 类型。
- `pnpm -C packages/nextclaw-kernel exec tsx -e '<show-content schema probe>'`
  - 输出：`show_file` 参数为 `path/title/purpose/line/column/viewer`，`show_url` 参数为 `url/title/purpose`，`show_panel_app` 参数为 `appId/title/purpose`。
- `pnpm -C packages/nextclaw-core test -- src/features/agent/features/tests/skills.test.ts`
  - 1 个文件，9 个测试通过。
  - 覆盖内置 Panel App creator skills 要求 inline 展示使用 `nextclaw-inline`，不得调用 `show_panel_app` 做 inline 展示。
- `pnpm -C packages/nextclaw-agent-chat-ui lint`
- `pnpm -C packages/nextclaw-ui lint`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-core lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm lint:maintainability:guard`
- `node scripts/governance/checks/lint-new-code-governance.mjs -- <本轮精确文件列表>`
- `pnpm -C packages/nextclaw-agent-chat-ui build`
- `pnpm -C packages/nextclaw-ui build`
- `pnpm -C packages/nextclaw-kernel build`
- `pnpm -C packages/nextclaw-core build`

验证结果：本轮定向测试、相关包 tsc/lint/build、`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`pnpm lint:maintainability:guard` 与本轮精确文件列表治理均通过。`packages/nextclaw-ui build` 有既有 Vite chunk size / dynamic import 警告，不影响构建成功；`packages/nextclaw-core build` 有 plugin timing warning，不影响构建成功。

## 发布/部署方式

不涉及立即部署。需要跟随后续统一 NPM 发布流程发布。

## 用户/产品视角的验收步骤

1. 在 assistant markdown 中输出合法 `nextclaw-inline` 代码块。
2. 文件、URL、JSON descriptor 默认显示为只读内联展示条，不出现按钮、链接或点击打开行为。
3. `panel_app` descriptor 在 NextClaw chat 中以内联 Panel App card 展示。
4. 来自 code block 的 Panel App inline card 不显示 expand 按钮。
5. descriptor 写错时显示普通代码块，用户仍能看到原始内容。
6. Native prompt/context 中明确区分：最终回复的惰性内联展示用 `nextclaw-inline`；`show_panel_app` 只用于 side panel 即时预览，不再有 inline 工具入口。

## 可维护性总结汇总

本轮是新增用户可见能力，非测试生产代码净增符合功能增量性质。

- 本次相关文件统计：生产代码约 `+372/-8`，测试约 `+107/-12`，提示词/skill 合同约 `+9/-4`，设计与 changeset 文档同步更新。
- 正向减债：把“内联展示声明”从 `show_content` 工具动作链路中分离出来，并取消模型可见展示工具的 `placement` 参数，避免后续继续把纯展示包装成工具卡片。
- owner 边界：Markdown 解析留在 `ChatMessageMarkdown`/无状态 utils；Panel App 真实内联展示继续复用 `ChatInlinePanelAppCard`；回复格式提示留在 `ReplyFormatContextProvider`；工具即时预览提示留在 Inline Interactive Surfaces 与 `show_panel_app` schema；没有新增 manager、service 或 registry。
- 全量 maintainability guard 与本轮精确文件列表 governance 均通过。最新精确文件 maintainability 统计为总计 `+93/-86`，非测试 `+11/-23`，本次删除工具 `placement` 参数后的非测试净增为 `-12`。
- `chat-message-markdown.tsx` 增加 21 行，仍低于 500 行预算；新增解析逻辑已拆入 `utils/chat-inline-display.utils.ts`。
- `chat-message-list` 目录文件数触及已有 exception 上限，本轮为展示能力新增一个组件文件；后续同目录继续增长时应优先拆出更明确的子目录。

已使用 `post-edit-maintainability-guard` 与主观可维护性复核。

## NPM 包发布记录

涉及 NPM 包发布，但本轮不直接发布。

- `@nextclaw/agent-chat-ui`：需要 patch，原因是新增共享 UI inline display 类型、解析与渲染能力；状态：待统一发布。
- `@nextclaw/core`：需要 patch，原因是内置 app creator skills 更新展示路径提示；状态：待统一发布。
- `@nextclaw/kernel`：需要 patch，原因是 native prompt context 与展示工具 schema 更新；状态：待统一发布。
- `@nextclaw/ui`：需要 patch，原因是产品侧接入 Panel App inline display 并补无 expand action 模式；状态：待统一发布。
