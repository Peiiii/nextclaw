# v0.13.32-chat-history-message-grouping-fix

## 迭代完成说明（改了什么）
- 修复历史消息展示拆卡问题：`assistant -> tool -> assistant` 不再被拆成多张卡片。
- 重写 `buildUiMessagesFromHistoryMessages` 为纯转换聚合逻辑（未引入 `AgentChatController`）：
  - 扫描历史消息时维护当前 assistant 聚合卡片。
  - assistant 文本/reasoning/tool_calls 统一追加到当前 assistant 卡片。
  - tool/tool_result/function 消息按 `tool_call_id` 回填到当前 assistant 卡片对应 tool part（状态置为 `RESULT`）。
  - 仅在遇到 user/system/data 时才 flush 当前 assistant 卡片，保证 turn 内连续内容合并展示。
- 结果：历史回放的卡片组织与流式过程保持一致，不再出现“流式是一卡、刷新历史变多卡”。

## 测试/验证/验收方式
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/ui build`
- 结果：均通过。

## 发布/部署方式
- 本次仅涉及 `@nextclaw/ui` 前端逻辑。
- 按既有前端部署流程发布即可。

## 用户/产品视角的验收步骤
1. 在会话中触发一段包含 tool 的回复链路（assistant 文本 -> tool 调用/结果 -> assistant 继续）。
2. 观察流式阶段：确认内容在同一 assistant 卡片内按顺序展示。
3. 刷新页面进入同一会话，观察历史回放。
4. 验证历史展示仍为同一 assistant 卡片，不再拆成多卡。
