# v0.18.46 Chat Session Materialization Waiting State

## 迭代完成说明

- 根因：根路由首次发送时，后端物化出的 sessionId 会触发路由替换；原实现同时在 `ChatSessionListManager.materializeRootSessionRoute` 中提前写入 `selectedSessionKey` 与 `thread.sessionKey`，和路由同步逻辑形成双 owner，可能让 `/chat` 旧路由同步在同一轮清掉等待态。会话面板还会在 `messages.length === 0` 时优先渲染空态，导致“正在思考”短暂出现后消失。
- 确认方式：阅读 `ncp-chat-page` 的 sessionId materialize effect、`chat-page-shell` 的 route selection sync、`ChatSessionListManager` 的状态写入，以及 conversation 面板空态分支，确认闪烁来自路由物化期间的状态归属竞态。
- 修复方式：`materializeRootSessionRoute` 只负责执行 route replace，选中态继续由 route sync 单一 owner 接管；会话面板在空消息但仍等待 assistant 首 token 时继续挂载消息列表容器，并移除以 `sessionKey` 为 key 的强制 remount。
- 追加修正：发送根草稿后若 runtime 失败，`isSending` 可能回到 `false`，导致 welcome 条件重新成立。现在由 thread store 记录 `hasSubmittedDraftMessage`，`ChatSessionListManager.ensureDraftSession` 在根草稿发送链路设置该状态，`createSession`/草稿重置链路清理该状态。原 `draftSessionKey` 没有生产消费者，本次同步删除。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test -- src/features/chat/managers/chat-session-list.manager.test.ts src/features/chat/components/conversation/chat-conversation-panel.test.tsx src/features/chat/managers/ncp-chat-input.manager.test.ts src/features/agents/components/agents-page.test.tsx`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui exec eslint src/features/chat/stores/chat-thread.store.ts src/features/chat/stores/chat-session-list.store.ts src/features/chat/managers/chat-session-list.manager.ts src/features/chat/managers/chat-session-list.manager.test.ts src/features/chat/managers/ncp-chat-input.manager.test.ts src/features/agents/components/agents-page.test.tsx src/features/chat/components/conversation/chat-conversation-panel.tsx src/features/chat/components/conversation/chat-conversation-panel.test.tsx`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/features/chat/stores/chat-thread.store.ts packages/nextclaw-ui/src/features/chat/stores/chat-session-list.store.ts packages/nextclaw-ui/src/features/chat/managers/chat-session-list.manager.ts packages/nextclaw-ui/src/features/chat/managers/chat-session-list.manager.test.ts packages/nextclaw-ui/src/features/chat/managers/ncp-chat-input.manager.test.ts packages/nextclaw-ui/src/features/agents/components/agents-page.test.tsx packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.tsx packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.test.tsx`

## 发布/部署方式

未发布、未部署。本次是本地 bugfix 实现稿，等待用户确认体验后再决定是否进入发布闭环。

## 用户/产品视角的验收步骤

1. 进入新的根聊天会话。
2. 发送第一条消息。
3. 后端返回真实 sessionId 并替换路由时，“正在思考”不应先闪现后消失。
4. assistant 首 token 到达前，消息区域应持续保持等待态；开始流式输出后正常显示内容。
5. 若 runtime/ACP 连接失败导致发送结束但没有消息，新会话 welcome 不应闪回。

## 可维护性总结汇总

- 本次使用 `post-edit-maintainability-review` 思路复核：非功能 bugfix 的非测试代码净增为 `-4`。
- 正向减债动作：职责收敛、简化与删除。路由物化不再同时写 route-owned selection/thread 状态，减少双 owner；UI 不再用 `sessionKey` 强制 remount 消息列表，减少生命周期扰动；删除无生产消费者的 `draftSessionKey`。
- 代码增减：总计 `+131 / -93 / +38`；非测试代码 `+11 / -15 / -4`。
- 目录、文件命名、公共导入、React effect owner、参数 mutation 和 class method 治理均通过新代码治理检查。

## NPM 包发布记录

不涉及 NPM 包发布。
