# v0.13.29-chat-event-order-dedup-align-agent-kit

## 迭代完成说明（改了什么）
- 修复“文本都聚集在前面、工具卡片全部在最后、文本重复拼接”的核心链路问题，按 agent-kit 思路收敛为稳定事件处理：
  - `AgentEventHandler` 文本处理从“全量覆盖”改为“按 delta 追加到当前 text part”，避免工具事件插入后文本被回写到最前面。
  - `AgentEventHandler` 的 tool 更新从 `lastMessage` 改为按 `toolCallId` 精准定位消息与 part，避免 tool 乱挂载和重复 start/end 导致的卡片异常。
  - `AgentEventHandler` 的 `emitToolCallEvents` 改为扫描全部 assistant 消息，避免只看最后一条导致漏触发/错触发。
- 修复 run 恢复重放导致的重复输出：
  - resume metadata 增加 `fromEventIndex`，使用 `ChatRunView.eventCount` 作为恢复游标。
  - resume 流请求透传 `fromEventIndex` 到 `/api/chat/runs/:runId/stream`，避免从 0 重播已消费事件。
- 修复 UI 顺序展示：
  - `ChatThread` 从“聚合 text/reasoning/tool 再分组渲染”改为按 `message.parts` 原始顺序渲染，保证文本/工具卡片顺序与事件顺序一致。

## 测试/验证/验收方式
- `pnpm --filter @nextclaw/agent-chat tsc`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/ui build`
- 结果：全部通过。

## 发布/部署方式
- 本次涉及 `@nextclaw/agent-chat` 与 `@nextclaw/ui`：
  - 前端发布按现有 `@nextclaw/ui` 构建与部署流程执行。
  - 如需同步发包 `@nextclaw/agent-chat`，按仓库既有 changeset/version/publish 流程执行。

## 用户/产品视角的验收步骤
1. 在聊天页发送一条会触发工具调用的消息。
2. 观察 assistant 输出：文本与工具卡片应按发生顺序交错展示，不应“文本全在前、工具全在后”。
3. 观察整段输出完成后，不应新增重复文本片段或重复工具卡片。
4. 触发中断后再恢复（或切会话再返回触发恢复），确认不会从头重放已展示内容。
