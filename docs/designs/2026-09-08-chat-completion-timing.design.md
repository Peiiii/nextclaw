# 聊天完成事件与耗时设计

## NC-167：已完成消息的生命周期

- 风险 L3，bugfix；reproduce。验收：真实事件顺序 `run.started → text.delta → message.completed → run.finished/error` 保留 startedAt/endedAt；实时和冷恢复一致；无时间不伪造、错误不标成功、不更新其他消息。
- 主链路：Native runtime `completeAssistantStep` 先发 MessageCompleted，再发携带 timing 的 RunFinished；SessionRun / UI / journal replay 消费 toolkit 同一 `DefaultNcpAgentConversationStateManager`；UI process-summary 只展示 lifecycle 时间差。
- 根因：MessageCompleted 的 upsert 清空 streamingMessage；RunFinished 的 settleStreamingMessage 随即无目标返回，丢失时间。修前新增两个同顺序测试稳定失败，现有测试只覆盖结束时仍在 streaming 的情况。
- 方案：terminal handler 将 payload.messageId 传给现有 settlement；明确 ID 在 streaming 或已提交 messages 中定位同一 assistant，复用 lifecycle/status/metadata 合并及 upsert。没有 ID 时保留原 streaming 语义，不猜“最后一条”，不在 UI 用消息 timestamp 或工具耗时估算。
- 不改变协议、owner 或运行完成时机，不新增 store、fallback 或投影版本。已有缺时的历史记录不能凭空恢复；有事件时间的 journal 重新回放及有 lifecycle 的存量消息应保留。
- 自审：MessageCompleted 只代表一步消息完成，不能清 activeRun；末尾耗时只附到指定消息。指定 ID 不存在或角色非 assistant 时不修改无关消息；hydrate 使用同一事实快照比较。
- 验证：修前失败 → 同用例修后通过；追加 real toolkit → UI summary 的组装证据；kernel journal 冷回放验证；tsc/定向 lint/维护性检查。

## NC-170

尚未调查，不以 NC-167 根因推断思考状态延迟；该部分开始时按真实时序补充设计。
