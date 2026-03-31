# v0.15.7-chat-skill-chip-and-send-enable

## 迭代完成说明（改了什么）
- 优化用户消息中 skill token 的视觉样式：从偏细边框样式调整为更接近输入区 token 的填充背景样式，提升识别度与一致性。
- 续改：将 skill token 调整为独立的实心色系（emerald），使其与普通 token 在消息卡片中有更明显的视觉区分。
- 调整输入区发送可用性判断：发送按钮改为基于 `composerNodes` 中解析出的 skill 选择状态进行兜底判断，确保“仅选择 skill、无文本”时也可发送。
- 改动文件：
  - `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-inline-content.tsx`
  - `packages/nextclaw-ui/src/components/chat/containers/chat-input-bar.container.tsx`

## 测试/验证/验收方式
- `pnpm -C packages/nextclaw-agent-chat-ui tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui test -- src/components/chat/ChatConversationPanel.test.tsx`
- `pnpm -C packages/nextclaw-agent-chat-ui test`
- `pnpm lint:maintainability:guard`
- `ReadLints` 针对本次改动文件检查：无新增 linter error
- 备注：执行 `pnpm -C packages/nextclaw-ui test` 全量测试时出现 Node heap OOM，与本次改动无直接报错关联；已改用受影响范围的最小充分验证完成收尾。

## 发布/部署方式
- 本次为前端样式与发送可用性修正，未执行发布。
- 如需发布，按仓库既有流程执行受影响包构建与前端发布闭环。

## 用户/产品视角的验收步骤
1. 打开聊天页，选择任意一个 skill，不输入文本。
2. 确认发送按钮可点击，点击后消息成功发出。
3. 观察发送出的用户消息卡片中 skill token，确认其具备明显背景填充（而非仅边框），视觉更接近输入区 token 风格。
4. 再次验证普通文本消息、带附件消息发送逻辑不受影响。
