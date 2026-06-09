# v0.20.53 Chat UI Show Content

## 迭代完成说明

本次实现 `show_content` MVP：Agent 可以通过工具结果请求当前 Chat UI 展示内容。第一阶段只支持 `file`、`url`、`panel_app` 三类目标，不引入 Artifact、Library、自动导入或新的 preview manager。

实现链路：

- kernel 新增 `show_content` 工具，校验 `{ type, payload, title?, purpose? }` 并返回 `{ action: "showContent", request }`。
- chat message adapter 识别规范工具结果，生成 `show-content` tool-card action。
- tool-card 使用 icon-only action，提供 tooltip、`aria-label`、focus-visible 状态。
- `NcpChatThreadManager.showContent` 作为会话级展示 owner，复用 `openFilePreview`、`docBrowser.open` 和 `nextclaw://panel-app/<id>` 路由。
- 同批次 follow-up：`show_content` 工具执行时通过 shared typed app event `eventKeys.uiShowContent` 发出 `ui.show-content`，前端在 `ChatPresenterProvider` 下用 `useUiShowContentEvent` 订阅，并交给 `NcpChatThreadManager.handleUiShowContentEvent` 自动展示内容。
- 同批次 follow-up：`ShowContentTool` 的稳定依赖 `eventBus` 改为 constructor 注入，execute context 只保留 `toolCallId` 等本次调用事实；tool result 继续作为聊天记录和手动兜底，不承担自动打开副作用。
- 同批次 follow-up：补齐 `features/cron` 公共入口，并把 chat 对 cron 的 deep import 收敛到 feature 入口，保证同批 UI 结构迁移能通过 module-structure governance。
- 同批次 follow-up：`ChatSessionWorkspacePanel` 不再自行判断 child session 的 running/readAt/lastMessageAt 已读规则，改为调用 `ChatSessionListManager.markVisibleWorkspaceChildRead`，由 session list owner 复用既有 read watermark 判定。
- 同批次 follow-up：workspace panel 的 active selection、file title 和 tabs view model 装配从组件/Nav 移到 `chat-workspace-panel-view-model.utils.ts`，组件只保留渲染、订阅和 manager 调用。
- 同批次 follow-up：新增 `code-investigation-workflow` skill，只约束代码排查方法，不承载具体架构规范；`ChatMessageListContainer` 明确为 chat feature 的业务 adapter/container，并内聚 `showContent`、tool session action 与 file preview action，删除主会话和 child session 调用方的重复 action props 搬运。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel test src/tools/show-content.tools.test.ts`
- `pnpm -C packages/nextclaw-ui test src/features/chat/utils/chat-message-show-content-tool-card.utils.test.ts src/features/chat/managers/ncp-chat-thread.manager.test.ts`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-agent-chat-ui tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-agent-chat-ui lint`
- `pnpm -C packages/nextclaw-ui lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm check:generated-clean`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/managers/chat-session-list.manager.test.ts src/features/chat/components/conversation/chat-conversation-panel.test.tsx`
- `pnpm --filter @nextclaw/ui tsc --noEmit`
- `pnpm --filter @nextclaw/ui exec eslint src/features/chat/components/chat-session-workspace-panel.tsx src/features/chat/managers/chat-session-list.manager.ts src/features/chat/managers/chat-session-list.manager.test.ts src/features/chat/components/conversation/chat-conversation-panel.test.tsx`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/features/chat/components/chat-session-workspace-panel.tsx packages/nextclaw-ui/src/features/chat/managers/chat-session-list.manager.ts packages/nextclaw-ui/src/features/chat/managers/chat-session-list.manager.test.ts packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.test.tsx`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/utils/chat-workspace-panel-view-model.utils.test.ts src/features/chat/components/conversation/chat-conversation-panel.test.tsx`
- `pnpm --filter @nextclaw/ui tsc --noEmit`
- `pnpm --filter @nextclaw/ui exec eslint src/features/chat/components/chat-session-workspace-panel.tsx src/features/chat/components/chat-session-workspace-panel-nav.tsx src/features/chat/utils/chat-workspace-panel-view-model.utils.ts src/features/chat/utils/chat-workspace-panel-view-model.utils.test.ts`
- `pnpm -C packages/nextclaw-ui test src/features/chat/components/conversation/chat-message-list.container.test.tsx src/features/chat/components/conversation/chat-conversation-panel.test.tsx`
- `pnpm -C packages/nextclaw-ui test src/features/chat/hooks/__tests__/use-ui-show-content-event.test.tsx src/features/chat/managers/__tests__/ncp-chat-thread.manager.test.ts src/features/chat/pages/__tests__/ncp-chat-page.test.ts src/features/chat/components/conversation/__tests__/chat-conversation-header.test.tsx`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui lint`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-shared lint`
- `pnpm -C packages/nextclaw-server test src/app/tests/server-event-stream.test.ts`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm check:generated-clean`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/features/chat/components/conversation/chat-message-list.container.tsx packages/nextclaw-ui/src/features/chat/components/conversation/chat-message-list.container.test.tsx packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.tsx packages/nextclaw-ui/src/features/chat/components/chat-session-workspace-panel.tsx .agents/skills/code-investigation-workflow/SKILL.md .agents/skills/code-investigation-workflow/agents/openai.yaml .agents/skills/writing-beautiful-code/SKILL.md .agents/skills/mvp-view-logic-decoupling/SKILL.md`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-shared/src/types/ui-show-content.types.ts packages/nextclaw-shared/src/configs/event-keys.config.ts packages/nextclaw-shared/src/index.ts packages/nextclaw-kernel/src/tools/show-content.tools.ts packages/nextclaw-kernel/src/contributions/tool-provider/providers/show-content-tool.provider.ts packages/nextclaw-kernel/src/contributions/tool-provider/index.ts packages/nextclaw-ui/src/features/chat/hooks/use-ui-show-content-event.ts packages/nextclaw-ui/src/features/chat/pages/ncp-chat-page.tsx packages/nextclaw-ui/src/features/chat/managers/ncp-chat-thread.manager.ts packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-header.tsx packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.tsx packages/nextclaw-ui/src/features/chat/components/layout/chat-page-shell.tsx packages/nextclaw-ui/src/features/chat/components/workspace/session-cron-job-content.tsx packages/nextclaw-ui/src/features/cron/index.ts`

前端 dev server 验收：

- `pnpm dev:frontend`
- `curl -I http://127.0.0.1:5174/`
- 请求 Vite 转换后的 `chat-message-show-content-tool-card.utils.ts` 与 `tool-card-header.tsx`，确认前端源码消费路径可加载。

受限项：本轮没有完成真实浏览器点击 `show-content` action 的端到端交互截图验证；当前环境只暴露了 Chrome 页列表/截图能力，没有导航能力。

## 发布/部署方式

本次未发布、未部署。

## 用户/产品视角的验收步骤

1. Agent 调用 `show_content`，传入 `file`、`url` 或 `panel_app` 的 `payload`。
2. Chat 中出现工具结果卡片和展示 action。
3. 点击 action：
   - `file` 打开会话 workspace 文件预览。
   - `url` 打开 DocBrowser。
   - `panel_app` 通过 `nextclaw://panel-app/<id>` 打开 panel app 承接面。
4. Agent 执行 `show_content` 工具后，后端发出 `ui.show-content` 事件，当前 Chat UI 自动打开对应文件、URL 或 panel app；聊天里的 tool card action 仍作为手动兜底存在。

## 可维护性总结汇总

本次是新增用户能力，生产代码净增长属于功能实现所需。实现保持单一路径：tool result -> chat adapter -> tool-card action -> `NcpChatThreadManager.showContent`。没有新增 Artifact 模型、资产注册表、独立 manager 或 presenter 转发 facade。

Maintainability guard 通过，提示 4 个接近预算文件：

- `tool-card-views.tsx`
- `chat-conversation-panel.test.tsx`
- `chat-conversation-panel.tsx`
- `ncp-chat-thread.manager.ts`

后续拆分缝：如果 `NcpChatThreadManager` 继续增长，应优先按 workspace file/session/content action 职责拆分，而不是继续追加会话 workspace 行为。

Follow-up 维护性复核：workspace child 已读规则从组件 effect 内的字段判断收敛到 `ChatSessionListManager`。非功能改动的触达文件 maintainability guard 结果为总计 `+72/-17`、非测试代码 `+17/-17`、净增 `0`；保留一个测试文件接近预算 warning，后续应拆分 `chat-conversation-panel.test.tsx` 的 workspace 场景。

Follow-up 维护性复核：workspace panel view-model 逻辑从 UI 组件剥离到 `utils`，`chat-session-workspace-panel.tsx` 和 `chat-session-workspace-panel-nav.tsx` 合计删除约 190 行组件内业务推导；新增 util 与纯函数测试承接选择优先级、tab title、unread dot 和 action 装配合同。非功能改动 maintainability guard 结果为总计 `+293/-190`、非测试代码 `+189/-190`、净减 `1`。

Follow-up 维护性复核：message list action 处理从两个调用方收敛到 `ChatMessageListContainer`，该 container 作为 chat feature 业务 adapter/container 直接连接 `chatThreadManager`；主会话和 child session 不再重复装配 `show-content`、tool session 和 file preview action。触达文件 maintainability guard 结果为总计 `+32/-120`、非测试代码 `+16/-120`、净减 `104`；`chat-conversation-panel.tsx` 仍接近文件预算，但本轮已净减 13 行。

Follow-up 维护性复核：`ui.show-content` 自动展示链路只新增一个 shared event key、一个 kernel emit 点、一个前端订阅 hook，并复用 `NcpChatThreadManager` 作为展示 owner；未新增 command bus、control plane、preview manager 或 presenter 转发 facade。触达文件 maintainability guard 结果为总计 `+417/-376`、非测试代码 `+417/-376`、净增 `41`；本次属于新增用户能力，增长主要来自 shared contract、事件订阅 hook、测试和同批结构迁移补齐。warning：`chat-conversation-panel.tsx` 与 `ncp-chat-thread.manager.ts` 接近文件预算，后续继续增长时应优先拆业务 container / workspace content dispatch 子 owner。

## NPM 包发布记录

未执行 NPM 包发布。`@nextclaw/kernel`、`@nextclaw/shared`、`@nextclaw/ui`、`@nextclaw/agent-chat-ui` 的用户可见 show-content 行为变更已通过现有 `.changeset/chat-ui-show-content.md` 纳入后续统一发布。
