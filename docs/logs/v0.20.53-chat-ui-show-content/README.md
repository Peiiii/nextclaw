# v0.20.53 Chat UI Show Content

## 迭代完成说明

本次实现 `show_content` MVP：Agent 可以通过工具结果请求当前 Chat UI 展示内容。第一阶段只支持 `file`、`url`、`panel_app` 三类目标，不引入 Artifact、Library、自动导入或新的 preview manager。

实现链路：

- kernel 新增 `show_content` 工具，校验 `{ type, payload, title?, purpose? }` 并返回 `{ action: "showContent", request }`。
- chat message adapter 识别规范工具结果，生成 `show-content` tool-card action。
- tool-card 使用 icon-only action，提供 tooltip、`aria-label`、focus-visible 状态。
- `NcpChatThreadManager.showContent` 作为会话级展示 owner，复用 `openFilePreview`、`docBrowser.open` 和 `nextclaw://panel-app/<id>` 路由。
- 同批次 follow-up：`ChatSessionWorkspacePanel` 不再自行判断 child session 的 running/readAt/lastMessageAt 已读规则，改为调用 `ChatSessionListManager.markVisibleWorkspaceChildRead`，由 session list owner 复用既有 read watermark 判定。

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

## 可维护性总结汇总

本次是新增用户能力，生产代码净增长属于功能实现所需。实现保持单一路径：tool result -> chat adapter -> tool-card action -> `NcpChatThreadManager.showContent`。没有新增 Artifact 模型、资产注册表、独立 manager 或 presenter 转发 facade。

Maintainability guard 通过，提示 4 个接近预算文件：

- `tool-card-views.tsx`
- `chat-conversation-panel.test.tsx`
- `chat-conversation-panel.tsx`
- `ncp-chat-thread.manager.ts`

后续拆分缝：如果 `NcpChatThreadManager` 继续增长，应优先按 workspace file/session/content action 职责拆分，而不是继续追加会话 workspace 行为。

Follow-up 维护性复核：workspace child 已读规则从组件 effect 内的字段判断收敛到 `ChatSessionListManager`。非功能改动的触达文件 maintainability guard 结果为总计 `+72/-17`、非测试代码 `+17/-17`、净增 `0`；保留一个测试文件接近预算 warning，后续应拆分 `chat-conversation-panel.test.tsx` 的 workspace 场景。

## NPM 包发布记录

不涉及 NPM 包发布。
