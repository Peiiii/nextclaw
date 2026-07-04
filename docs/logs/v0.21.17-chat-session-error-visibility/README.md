# v0.21.17 Chat Session Error Visibility

## 迭代完成说明

本次补齐会话详情页的会话级错误展示：当选中会话的 `activityPreview.state` 为 `failed` 时，聊天详情会在消息列表底部、输入面板上方展示通用错误卡片。

根因：会话列表 preview 使用 session summary 的 `metadata.last_activity_preview`，但会话详情页原本只渲染消息列表和输入状态；该失败会话的 messages 接口只有用户消息，没有 assistant error message，因此详情页没有任何地方消费 session summary 中的失败状态。

确认方式：`/api/ncp/sessions` 返回目标会话的 `last_activity_preview.state = failed` 和 401 错误详情；`/api/ncp/sessions/<id>/messages` 仅返回 1 条用户消息。修复目标是让详情页消费 selected session summary，而不是把会话级失败错误塞进 message list 或输入发送错误。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test -- --run src/features/chat/features/conversation/components/__tests__/session-conversation-area.test.tsx src/features/chat/components/conversation/__tests__/chat-conversation-content.test.tsx`：通过，2 个测试文件、7 个用例。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui lint`：通过。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`：通过，无 errors / warnings。
- `pnpm check:generated-clean`：通过，生成产物干净。
- Playwright 冒烟打开 `http://127.0.0.1:5174/chat/sid_bmNwLW1yNm4yMHVyLWY3N2VmYmNi`：页面能看到通用错误标题和 `Invalid API Key` 错误详情，位置在消息之后、输入框之前。

## 发布/部署方式

本次未执行发布或部署；改动为本地前端源码、i18n 文案和测试补齐。若后续进入统一发布流程，按 NextClaw 常规前端/NPM 发布闭环处理。

## 用户/产品视角的验收步骤

1. 打开一个 `activityPreview.state = failed` 的会话详情页。
2. 确认消息列表底部、输入面板上方出现错误卡片。
3. 中文界面标题应为“出错了”；英文界面标题应为 “Something went wrong”。
4. 错误正文应展示 session summary 里记录的真实失败原因，例如 provider 401 / Invalid API Key。
5. 没有失败 preview 的会话不应显示该错误卡片。

## 可维护性总结汇总

本次将会话级错误归属到 selected session summary 事实源，消息级错误仍由消息列表承载，当前发送/补水错误仍由输入面板承载；没有新增平行错误状态。新增 `ChatConversationContent.bottomSlot` 是窄表面扩展，用于把会话级尾部内容放在消息列表之后，避免把错误塞到顶部 alerts 或输入组件内部。

可维护性守卫结果：总代码变化 `+78 / -9 / net +69`，非测试代码变化 `+36 / -7 / net +29`。这是用户可见能力补齐，净增来自错误卡片渲染、i18n 文案和行为测试，未引入新 owner、全局状态或重复数据通道。

## NPM 包发布记录

本次涉及 `@nextclaw/ui` 用户可见行为修复，已新增 `.changeset/chat-session-error-visibility.md`，标记为 patch。当前未执行 NPM 发布，状态为待后续统一发布。
