# Session Metadata 单一事实源设计

## 背景

会话列表的 last message preview 会在最终回复完成后回退成“工具调用完成”或默认文案。真实接口复现显示，`message.completed` 到达时 `last_activity_preview.replyText` 曾经写入成功，随后 `run.finished` / `context-window.updated` 之后又丢失。

直接原因是 session metadata 同时存在多份可写副本：

- `*.metadata.json` 中的落盘 metadata；
- `LiveSession.metadata` 中的运行期内存副本；
- `.ncp-agent-session-index.json` 中的 summary metadata；
- `appendSessionEvent` 参数里携带的 metadata 快照。

其中 `appendSessionEvent` 本应只追加事件，却会把旧的 `LiveSession.metadata` 快照写回 metadata 文件和 summary index，导致旧副本覆盖新事实。
同一个职责问题也存在于 `createdAt` / `updatedAt` / `agentId`：事件追加接口不应该携带 session record 快照，也不应该要求调用者传入持久化时间。它只应该接收事件事实本身，以及定位事件所属会话所必需的 `sessionId`。

## 目标

会话 metadata 只能有一个可写事实源：

```text
NcpAgentSessionMetadataStore
  -> read current metadata
  -> set / update
  -> write *.metadata.json
```

上层只表达写入意图，不持有、不回写 metadata 副本。其他结构最多使用一次性只读 snapshot 作为运行输入，不能作为 metadata 更新基础。

## 设计原则

- `single-domain-owner`：metadata 只有一个 owner。
- `information-expert`：store 最知道当前 metadata 文件状态，因此 merge/set 必须在 store 写链内完成。
- `deletion-first`：删除 live metadata 同步、event append metadata 写回、summary metadata 合并等重复路径。
- `cqs-pure-read`：summary/list 可以组合读取结果，但不能把组合结果变成第二份可写 metadata。

## 目标链路

### 写入 metadata

```text
NcpSessionManager.setSessionMetadata / updateSessionMetadata
  -> NcpAgentSessionJournalStore
  -> NcpAgentSessionMetadataStore
  -> publishSessionChange
```

`updateSessionMetadata` 的 read-modify-write 必须在 store 的 per-session write chain 内完成。

### 追加事件

```text
SessionRunManager.appendSessionEvent
  -> NcpSessionManager.appendSessionEvent
  -> NcpAgentSessionJournalStore.appendSessionEvent
  -> append journal JSONL
  -> update summary message counters
```

事件追加不接收、不读取、不写回 metadata。
事件追加也不接收 `createdAt` / `updatedAt` / `agentId` 这类 session identity 或 projection 字段。journal owner 内部生成 append timestamp，并用同一个 timestamp 更新 journal entry 与 summary projection。summary 所需的 identity 从已有 summary/session owner 读取；没有历史记录时，内部 append timestamp 就是新 summary 的创建时间。

`session.updatedAt` 的语义收窄为“事件流最后活动时间”。`setSessionMetadata` / `updateSessionMetadata` 只修改 metadata sidecar，不推进 session record 或 summary 的 `updatedAt`。如果未来需要展示 metadata 写入时间，应新增 metadata owner 自己的字段，而不是复用 session activity timestamp。

### 列表读取

```text
summary index
  -> sessionId / agentId / messageCount / timestamps
metadata store
  -> metadata
NcpSessionManager
  -> 合成 NcpSessionSummary 返回给 UI
```

summary index 可以作为列表排序和消息计数的 projection，但不保存 metadata。

### live session

`LiveSession` 只保存运行状态和 conversation state，不保存 metadata，也不保存 `createdAt` 这类不会随运行变化的 session identity。runtime 创建和 run 输入需要 metadata 时，从唯一 store 读取一次 snapshot，然后作为输入传递。这个 snapshot 不允许被 append event 写回。

## 本次执行范围

一次性完成以下收敛：

1. 删除 `LiveSession.metadata` 和 `session.metadata.changed` 到 live session 的同步路径。
2. 删除 `LiveSession.createdAt`。
3. 删除 `appendSessionEvent` 参数中的 session record 快照，只保留 `sessionId` / `event`。
4. 删除 `appendSessionEvent` 参数中的 metadata 回写语义。
5. 删除 `NcpAgentSessionJournalStore.appendSessionEventNow` 对 metadata 文件的写入。
6. 删除 summary event upsert 对 metadata 的合并。
7. `listSessionSummaries` 从 summary index 读取轻量 projection 后，按 sessionId 从 metadata store 合成 metadata。
8. 增加回归测试：`message.completed` 写入 `replyText` 后，后续 `run.finished` 不得覆盖 metadata。

## 验收条件

- 真实接口触发“查看一下系统信息”后，最终会话 summary 的 `metadata.last_activity_preview.replyText` 保留最终 assistant 文本。
- `run.finished` 之后不能把 preview 回退为只有 `statusText: "工具调用完成"`。
- TypeScript 检查通过。
- 定向 store / run manager 测试通过。
- 非功能改动的非测试代码净增必须 `<= 0`。
