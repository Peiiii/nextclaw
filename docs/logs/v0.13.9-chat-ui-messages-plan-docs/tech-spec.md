# 技术方案：Chat UI 单一 `uiMessages` 模型统一方案

## 1. 背景与现状

### 1.1 当前前端状态结构

现有聊天前端在多个位置维护独立状态：

- `historyEvents`：从 `/api/sessions/:key/history` 获得的事件列表（若为空则回退 `messages` 转事件）。
- `optimisticUserEvent`：用户发送时的本地乐观消息事件。
- `streamingSessionEvents`：SSE 的 `session_event` 事件列表。
- `streamingAssistantText` / `streamingAssistantTimestamp`：SSE `delta` 流的临时缓冲。

这些状态随后在 `mergeChatEvents` 中合并为渲染列表。

### 1.2 事件/消息/流式的事实口径

- `events` 为会话事实源：包含 `message.*`、`tool.*`、`system.*` 等事件。
- `messages` 为事件投影：信息量更少，用于上下文或兼容。
- `delta` 为流式临时态：只用于实时 UI，不落盘，不应进入历史事件。

### 1.3 存在的问题

- 语义混淆：事件（events）、消息（messages）、流式 delta（临时态）被并列维护。
- 维护成本高：需要理解多份状态及其合并、去重规则。
- 重入会话逻辑复杂：历史 + 流式 + 乐观态叠加，心智负担大。
- 命名与心智模型不一致：同一数据有时被称为 events，有时被当作 messages。

### 1.4 参考范式

agent-kit `agent-chat` 采用：

- 单一 `uiMessages` 列表作为渲染来源。
- 使用独立 Subject 记录 `addMessages` / `setMessages` / `updateMessage` 事件。
- controller 统一维护消息与运行态。

本项目应尽量对齐此范式，除非项目特性强制要求差异。

---

## 2. 目标与非目标

### 2.1 目标

- 前端只维护一份 `uiMessages` 列表作为聊天 UI 的唯一渲染来源。
- 不再单独维护 `optimisticUserEvent` / `streamingSessionEvents` / `streamingAssistantText` 等变量。
- 对齐 agent-kit `agent-chat` 的 `uiMessages + Subjects` 范式。
- 维持“重入运行中会话可续流”的能力。
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

- `session_event.message.role = user/assistant/system/tool` -> `UIMessage`，`content` 进入 `text` part。
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

合并逻辑主要是“事件输入 -> UI 消息更新”，可在 `ChatStreamManager` 内完成；如后续复杂度明显上升，再考虑拆分。

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

- 以 `seq` 为主键去重：历史事件与流式事件合并时，同 `seq` 保留“可渲染内容更丰富”的消息。
- 流式 `user` 事件仍可忽略（避免覆盖本地乐观消息）。
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
# 补充：可执行级别的最小规范（不过度设计）

## A. UIMessage 最小结构示例（对齐 agent-chat，保留 meta）

### A.1 用户消息（pending）

```ts
{
  id: "u-1700000000000",
  role: "user",
  parts: [
    { type: "text", text: "你好" }
  ],
  meta: {
    source: "optimistic",
    status: "pending",
    sessionKey: "ui:web-ui",
    runId: "local-1"
  }
}
```

### A.2 Assistant 草稿消息（streaming delta）

```ts
{
  id: "a-draft-1700000000000",
  role: "assistant",
  parts: [
    { type: "text", text: "你好，我正在生成..." }
  ],
  meta: {
    source: "stream",
    status: "streaming",
    runId: "server-run-123",
    isDraft: true
  }
}
```

### A.3 Assistant 最终消息（由 session_event 或 final 生成）

```ts
{
  id: "a-evt-42",
  role: "assistant",
  parts: [
    { type: "text", text: "最终回复内容" },
    { type: "reasoning", reasoning: "...", details: [] }
  ],
  meta: {
    source: "history",
    status: "final",
    seq: 42
  }
}
```

### A.4 Tool 调用/结果（同一条 UIMessage 内更新 part）

```ts
{
  id: "a-evt-43",
  role: "assistant",
  parts: [
    {
      type: "tool-invocation",
      toolInvocation: {
        status: "call",
        toolCallId: "call_abc",
        toolName: "search",
        args: "{\"q\":\"nextclaw\"}",
        parsedArgs: { q: "nextclaw" }
      }
    }
  ],
  meta: { source: "history", status: "final", seq: 43 }
}
// tool 结果到来时：更新同一条 message 的 toolInvocation.status/result
```

---

## B. ID / 排序 / 去重（最小可执行规则）

- 优先使用 `seq` 去重：存在 `meta.seq` 时，`seq` 相同的消息仅保留一条。
- 同 `seq` 冲突时，保留“可渲染内容更丰富”的消息（包含 text/reasoning/tool-invocation 的优先）。
- 无 `seq` 的消息使用 `meta.status` + `meta.runId` + 时间戳拼接生成稳定 id（草稿例：`a-draft-${runId}`）。
- 渲染排序：
  - 有 `seq` 的按 `seq` 升序。
  - `seq` 为空的草稿置于末尾（确保生成中内容可见）。

---

## C. delta 草稿生命周期（最小规则）

- 若存在 `assistant` 草稿（`meta.isDraft === true` 且 `runId` 匹配），`delta` 直接追加到该消息的 `text` part。
- 若不存在草稿，创建一条草稿 `UIMessage`（`status=streaming`）。
- 当收到 `session_event` 的 `assistant` 消息时：
  - 用该事件消息替换草稿（同 runId 时直接替换）。
  - 清除草稿标记。
- 当只收到 `final` 而未收到 `session_event`：
  - 将草稿转为 `status=final`。

---

## D. 工具调用合并规则（最小规则）

- `assistant` 消息中的 `tool_calls` 映射为 `tool-invocation` parts。
- `tool` 结果消息携带 `tool_call_id`：
  - 找到同 `toolCallId` 的 part，更新 `status/result/error`。
  - 若不存在，作为独立 `assistant` 消息追加（避免丢失）。

---

## E. 会话切换与续流边界（最小规则）

- `runId` 与 `sessionKey` 不匹配的流式事件丢弃。
- 切换会话时：
  - 先用历史 `events/messages` 生成 `uiMessages` 覆盖当前列表。
  - 若该会话有 active run，则 resume 后继续更新草稿或事件。
- 结束后统一 `refetchHistory` 做最终一致性修正（保留现有行为）。

---

## F. 影响范围与实现入口（最小清单）

- `packages/nextclaw-ui/src/components/chat/managers/chat-stream.manager.ts`
  - 新增 `uiMessages$` 与 `add/set/update` Subjects
  - 移除 `optimisticUserEvent` / `streamingSessionEvents` / `streamingAssistantText` 状态
- `packages/nextclaw-ui/src/components/chat/chat-merged-events.ts`
  - 逐步替换或废弃（由 uiMessages 直接驱动）
- `packages/nextclaw-ui/src/components/chat/ChatThread.tsx`
  - 改为渲染 `uiMessages`
- `packages/nextclaw-ui/src/components/chat/chat-page-data.ts`
  - 历史数据映射为 `uiMessages`

---

## G. 验收标准（最小可执行）

- UI 只依赖 `uiMessages` 渲染，不再引用 `historyEvents/streamingAssistantText`。
- 发送消息时，用户消息立即出现；assistant 流式文本以草稿形式更新。
- 流式结束后，草稿被事件消息替换或转 final，历史刷新后保持一致。
- 重入运行中会话，仍能看到持续输出。
