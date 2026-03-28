# v0.14.241-chat-tool-status-feedback

## 迭代完成说明

- 优化前端会话界面中的工具卡片展示，让工具调用过程具备更明确的状态反馈，而不再只是静态参数/结果块。
- 在消息适配层补齐工具生命周期映射，把 `partial-call / call / result / error / cancelled` 统一转换成 UI 可用的状态语义。
- 重做工具卡片的信息层次：加入状态徽记、输入摘要、调用 ID、结果区与运行中动态提示，使其更接近成熟 Agent 产品的反馈密度，同时保持项目现有中性色与轻量卡片风格。
- 补充中英文文案与回归测试，覆盖工具执行中、完成、失败等状态场景。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`
- `pnpm -C packages/nextclaw-ui test -- src/components/chat/adapters/chat-message.adapter.test.ts`
- `pnpm -C packages/nextclaw-agent-chat-ui tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-agent-chat-ui/src/components/chat/view-models/chat-ui.types.ts packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-tool-card.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-list.test.tsx packages/nextclaw-ui/src/components/chat/adapters/chat-message.adapter.ts packages/nextclaw-ui/src/components/chat/adapters/chat-message.adapter.test.ts packages/nextclaw-ui/src/components/chat/containers/chat-message-list.container.tsx packages/nextclaw-ui/src/lib/i18n.chat.ts`
- 验收关注点：
  - 工具执行中应显示明确状态，而不是只看到一块静态信息。
  - 工具完成、失败、取消时应有可区分的状态颜色与标签。
  - 有参数时应展示输入摘要；有返回时应展示输出；无输出但成功时应明确提示“无输出（执行完成）”。

## 发布/部署方式

- 本次未单独执行发布。
- 随下一次前端正常发布链路带出即可，无需数据库 migration、后端部署或额外运维动作。
- 若需要提前验证，可按常规前端流程重新构建并发布 `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` 所在产物。

## 用户/产品视角的验收步骤

1. 打开聊天页面，进入一个会触发工具调用的会话。
2. 发送会触发搜索、命令执行或读取类工具的消息。
3. 观察工具卡片：执行中应看到明确的状态徽记和动态提示，而不是只有工具名。
4. 等待工具返回后，确认卡片状态切换为已完成、失败或已取消，并且颜色与标签同步变化。
5. 若工具有输入摘要或输出内容，确认卡片中能直接看到摘要、调用 ID 和结果；长输出应可展开查看。
