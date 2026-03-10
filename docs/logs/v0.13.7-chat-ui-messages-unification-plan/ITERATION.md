# 迭代完成说明（改了什么）

- 记录并固化“聊天前端统一 UI 消息结构”的设计结论与约束，作为后续改造的唯一参照。
- 明确与 agent-kit `agent-chat` 的一致性目标：尽量对齐其 `uiMessages + Subjects` 范式，只有在本项目约束下才做必要差异。
- 明确不再单独维护 `optimisticUserEvent` / `streamingSessionEvents` / `streamingAssistantText` 等分散状态，统一进入 `uiMessages`。
- 明确 `uiMessages` 可包含 `meta` 字段（如 `seq`/`status`/`source`/`runId`），用于状态与去重。
- 明确重入会话时的续流策略仍通过现有 `resumeRun -> streamChatRun` 链路接入，只是把流式输入写回 `uiMessages`。

# 测试/验证/验收方式

- 不适用：本次仅为方案记录与设计约束整理，未改动代码路径。

# 发布/部署方式

- 不适用：本次无代码变更与发布内容。

# 用户/产品视角的验收步骤

- 阅读本迭代文档，确认以下目标被清晰界定：
- UI 只维护一份 `uiMessages` 列表作为渲染来源。
- 与 agent-kit `agent-chat` 的一致性优先，差异需明确理由。
- 流式 delta 与 session_event 仅作为输入源，不再暴露为独立 UI 状态。
- 重入运行中会话可继续接收流式更新，并反映在 `uiMessages`。
