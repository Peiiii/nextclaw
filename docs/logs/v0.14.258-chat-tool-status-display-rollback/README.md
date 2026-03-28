# v0.14.258-chat-tool-status-display-rollback

## 迭代完成说明

- 修正 NextClaw 前端工具调用卡片的展示回归。
- 对比 `2026-03-28` 的 `Refine chat tool status feedback` 之前版本，恢复工具卡片原有的信息层级。
- 保留工具状态展示能力，但撤回误加的“输入摘要”与“调用 ID”展示，以及对应的多余类型/适配/i18n 链路。

# 测试/验证/验收方式

- 组件展示验证：`pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`
- 适配层验证：`pnpm -C packages/nextclaw-ui test -- src/components/chat/adapters/chat-message.adapter.test.ts`
- 类型检查：
  - `pnpm -C packages/nextclaw-agent-chat-ui tsc`
  - `pnpm -C packages/nextclaw-ui tsc`
- 可维护性检查：
  - `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-agent-chat-ui/src/components/chat/view-models/chat-ui.types.ts packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-tool-card.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-list.test.tsx packages/nextclaw-ui/src/components/chat/adapters/chat-message.adapter.ts packages/nextclaw-ui/src/components/chat/adapters/chat-message.adapter.test.ts packages/nextclaw-ui/src/components/chat/containers/chat-message-list.container.tsx packages/nextclaw-ui/src/lib/i18n.chat.ts`

# 发布/部署方式

- 本次仅涉及前端聊天展示层，无后端与数据库变更。
- 如需发布前端包，按项目既有前端发布流程执行；本次修复本身不需要 migration。
- 如需本地验证构建，可执行：`pnpm -C packages/nextclaw-ui build`

# 用户/产品视角的验收步骤

1. 打开 NextClaw 聊天页，进入一个会触发工具调用的会话。
2. 发送一条会触发工具的消息，例如搜索、读取文件或执行命令。
3. 确认工具卡片仍显示原来的主体结构：工具标题、工具名、参数摘要、输出区域。
4. 确认额外误加的“输入摘要”“调用 ID”不再出现在卡片中。
5. 确认工具状态仍可见：
   - 运行中显示状态文案与转圈图标。
   - 完成/失败/取消显示对应状态文案。
