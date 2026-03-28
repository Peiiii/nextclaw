# v0.14.259-chat-tool-completed-icon-only

## 迭代完成说明

- 调整 NextClaw 前端工具卡片的成功态展示。
- 工具状态为“已完成”时仅展示成功图标，不再展示状态文案。
- 运行中、失败、取消等其它状态保持原有展示方式不变。

# 测试/验证/验收方式

- 组件测试：`pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`
- 类型检查：`pnpm -C packages/nextclaw-agent-chat-ui tsc`
- 可维护性检查：`node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-tool-card.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`

# 发布/部署方式

- 本次仅涉及前端展示层，无后端或数据库变更。
- 如需发布，按既有前端发布流程执行即可；本次不需要 migration。

# 用户/产品视角的验收步骤

1. 打开聊天页并触发一次会成功完成的工具调用。
2. 确认工具卡片头部在成功态仅显示成功图标，不显示“已完成/Completed”文案。
3. 再触发一次运行中或失败的工具调用。
4. 确认运行中仍显示转圈图标和状态文案，失败/取消仍显示对应图标和状态文案。
