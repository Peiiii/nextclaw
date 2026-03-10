# 迭代完成说明（改了什么）

本迭代产出一份“目标与方案”技术文档，用于在正式改造前完整固化背景、目标、约束与设计决策，确保后续实现不偏离方向。文档覆盖：

- 背景与问题：当前前端聊天态分散在 `historyEvents` / `optimisticUserEvent` / `streamingSessionEvents` / `streamingAssistantText` / `streamingAssistantTimestamp` 等多份状态中，容易混淆（事件 vs 消息 vs 流式临时态），也让重入会话与流式续接的语义难以理解。
- 目标方向：前端仅维护一份 `uiMessages` 列表作为渲染来源；对齐 agent-kit `agent-chat` 的范式（`uiMessages + Subjects`），差异仅来自本项目独有的流式/运行态约束；最终代码结构更简洁、更清晰。
- 约束确认：
  - 不再单独维护 `optimisticUserEvent` / `streamingSessionEvents` / `streamingAssistantText` 等变量。
  - `uiMessages` 允许包含 `meta` 字段（如 `seq` / `status` / `source` / `runId`）。
  - 不新增“只有轻微逻辑收益”的新 class（如无必要不引入新 assembler 类）。
  - 需要保持“重入会话时流式续接”能力，沿用现有 `resumeRun -> streamChatRun` 链路，只调整其输出写入 `uiMessages`。

# 测试/验证/验收方式

- 不适用：本次仅产出技术方案文档，无代码改动。

# 发布/部署方式

- 不适用：本次无代码变更与发布内容。

# 用户/产品视角的验收步骤

- 打开本迭代文档，确认以下内容明确无歧义：
- 前端只维护 `uiMessages` 作为渲染源。
- 与 agent-kit `agent-chat` 的一致性优先，差异需有明确理由。
- 流式 delta 与 session_event 仅作为输入源，不再暴露为独立 UI 状态。
- 重入运行中会话仍能接收流式更新并落入 `uiMessages`。

---

# 技术方案：Chat UI 单一 `uiMessages` 模型统一方案

## 0. 目标与方案摘要

### 目标

- 前端仅维护一份 `uiMessages` 作为渲染来源，消除 events/messages/delta 的心智混乱。
- 对齐 agent-kit `agent-chat` 范式（`uiMessages + Subjects`），仅保留必要差异。
- 保持重入会话时流式续接能力，且让实现路径更清晰、代码更简洁。

### 方案

- 在 `ChatStreamManager` 内集中维护 `uiMessages$` 与 `add/update/set` Subjects；运行态仍在 `state$`。
- 把 `optimisticUserEvent` / `streamingSessionEvents` / `streamingAssistantText` 等变量移除，改为写回 `uiMessages` 的 `meta` 与 `parts`。
- SSE `delta` 直接更新“assistant 草稿消息”，`session_event` 合并稳定消息，`final` 做兜底收敛。

## 1. 背景与现状

### 1.1 当前前端状态结构

现有聊天前端在多个位置维护独立状态：

- `historyEvents`：从 `/api/sessions/:key/history` 获得的事件列表（若为空则回退 `messages` 转事件）。
- `optimisticUserEvent`：用户发送时的本地乐观消息事件。
- `streamingSessionEvents`：SSE 的 `session_event` 事件列表。
- `streamingAssistantText` / `streamingAssistantTimestamp`：SSE `delta` 流的临时缓冲。

这些状态随后在 `mergeChatEvents` 中合并为渲染列表。

### 1.2 存在的问题

- 语义混淆：事件（events）、消息（messages）、流式 delta（临时态）被并列维护。
- 维护成本高：开发者需要理解多份状态及其优先级、合并规则、去重逻辑。
- 重入会话逻辑复杂：需要同时考虑历史 + 流式 + 乐观态的叠加。
- 命名与心智模型不一致：同一数据有时被称为 events，有时被当作 messages。

### 1.3 参考范式

agent-kit `agent-chat` 采用：

- 单一 `uiMessages` 列表作为渲染来源。
- 使用独立的 Subject 记录 `addMessages` / `setMessages` / `updateMessage` 事件。
- 控制层（controller）集中维护消息与运行态。

本项目应尽量对齐此范式，除非项目特性强制要求差异。

---

## 2. 目标与非目标

### 2.1 目标

- 前端只维护一份 `uiMessages` 列表作为聊天 UI 的唯一渲染来源。
- 不再单独维护 `optimisticUserEvent` / `streamingSessionEvents` / `streamingAssistantText` 等变量。
- 对齐 agent-kit `agent-chat` 的 `uiMessages + Subjects` 范式。
- 维持现有“重入运行中会话可续流”的能力。
- 代码结构更简洁、更易理解。

### 2.2 非目标

- 不改后端数据格式与 SSE 协议。
- 不改变会话存储结构（events/messages 仍由后端提供）。
- 不进行 UI 视觉层设计调整（仅状态结构与渲染输入调整）。

---

## 3. 设计原则

- **一致性优先**：尽量与 agent-chat 保持一致的状态与通知结构。
- **单一渲染源**：UI 只消费 `uiMessages`，不直接消费 events/delta。
- **必要差异**：仅在本项目流式/运行态约束下做必要扩展。
- **最小复杂度**：不新增无必要 class；优先在现有 `ChatStreamManager` 内完成整合。

---

## 4. 数据模型设计

### 4.1 `UIMessage` 结构

借鉴 agent-kit `UIMessage`：

- `role`: `user` | `assistant` | `system` | `tool` | `data`
- `parts`: `text` / `reasoning` / `tool-invocation` / `source` / `file` / `step-start`
- `meta`: 本项目扩展字段（允许），例如：
  - `seq`: 对应 session event 序号
  - `status`: `pending` | `streaming` | `final` | `error`
  - `source`: `history` | `stream` | `optimistic`
  - `runId`: 当前流式 run 标识

### 4.2 消息与事件映射

- `session_event.message.role = user/assistant/system/tool` -> `UIMessage`，其 `content` 进入 `text` part。
- `assistant.tool_calls` -> `tool-invocation` part。
- `tool` 结果消息 -> 更新同一条 `tool-invocation` part 的 `result`。
- `reasoning_content` -> `reasoning` part。
- `delta` -> 更新当前 assistant 草稿消息的 `text` part（不再单独维护缓冲）。

---

## 5. 状态管理设计（对齐 agent-chat）

### 5.1 `ChatStreamManager` 内新增并集中维护

新增：

- `uiMessages$`: `BehaviorSubject<UIMessage[]>`
- `addMessages$`, `setMessages$`, `updateMessage$`: `Subject` 用于外部订阅消息变更

保留：

- `state$`: 运行态与控制态（`isSending` / `isAwaitingAssistantOutput` / `queuedMessages` / `canStopCurrentRun` / `activeBackendRunId` 等）

移除：

- `optimisticUserEvent`
- `streamingSessionEvents`
- `streamingAssistantText`
- `streamingAssistantTimestamp`

### 5.2 为什么不新增独立 assembler class

当前合并逻辑主要是“事件输入 -> UI 消息更新”。其复杂度可在 `ChatStreamManager` 内完成，不需要引入新的 class 结构；如后续逻辑确实复杂到不可维护，再评估拆分。

---

## 6. 流程与数据流

### 6.1 会话进入

1. 调用 `/api/sessions/:key/history` 获取 `events` / `messages`。
2. `events` 存在则优先映射为 `uiMessages`；否则 `messages` fallback 转 `uiMessages`。
3. `setMessages$` 广播新列表，UI 直接渲染。

### 6.2 发送消息

1. 本地立即插入一条 `UIMessage`（`role=user`, `status=pending`, `source=optimistic`）。
2. 进入流式 SSE：
   - `delta`：更新一个 assistant 草稿 `UIMessage`（`status=streaming`）。
   - `session_event`：按 `seq` / `tool_call_id` 合并到对应 `UIMessage`。
3. `final`：若未收到对应 `session_event`，以草稿内容生成 `final` assistant 消息。

### 6.3 重入运行中会话（续流）

保持现有链路：

- `useChatRuns` 检测 active run
- `useSessionRunStatus` 调用 `resumeRun`
- `resumeRun` -> `openResumeRunStream` -> `streamChatRun`

续流接入规则：

- `delta` 写入当前 assistant 草稿 message（如无则创建）。
- `session_event` 合并为稳定消息，覆盖草稿。
- 若只有 delta 无 event，final 时写入最终 assistant 消息。

---

## 7. 去重与一致性策略

- 以 `seq` 为主键去重：历史事件与流式事件合并时同 `seq` 保留“可渲染内容更丰富”的消息。
- 后端流式 `user` 事件仍可忽略（避免覆盖本地乐观消息）。
- 流式结束后可 `refetchHistory` 作为最终一致性修正。

---

## 8. 迁移与落地步骤（后续执行）

1. 增加 `UIMessage` 类型（借鉴 agent-kit 结构）。
2. 在 `ChatStreamManager` 添加 `uiMessages$` 与 Subjects。
3. 把现有 `mergeChatEvents` 流程迁移到 `uiMessages` 维护逻辑。
4. `ChatThread` 改为只消费 `uiMessages`。
5. 删除 `optimisticUserEvent` / `streamingSessionEvents` / `streamingAssistantText` 相关状态与 props。

---

## 9. 风险与缓解

- 风险：合并逻辑集中到 `ChatStreamManager` 后，状态变更链路可能遗漏 UI 更新。
  - 缓解：保持 `addMessages$` / `setMessages$` / `updateMessage$` 三类通知与 agent-chat 一致。
- 风险：重入会话时 delta 与历史合并不一致。
  - 缓解：续流只更新草稿或事件合并，结束后统一 `refetchHistory`。

---

## 10. 预期收益

- 心智模型简化：UI 只看 `uiMessages`。
- 代码结构清晰：状态集中，去除多份独立变量。
- 复用能力提升：更接近 agent-chat 生态范式。

---

## 11. 兼容性与差异说明

- 兼容性：不修改后端协议与存储格式。
- 差异：本项目仍需要 run 状态与队列控制，保留在 `state$`。

---

## 12. 开始执行前的确认点

- 是否接受 `uiMessages.meta` 承载 `seq`/`status`/`source`/`runId` 等字段。（已确认可接受）
- 是否确认“不新增无必要 class”，逻辑集中于 `ChatStreamManager`。（已确认）
- 是否接受与 agent-chat 在消息结构与 Subjects 上保持一致。（已确认）
