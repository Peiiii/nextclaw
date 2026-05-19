# Session Metadata Storage Design

## 背景

NCP agent 会话现在同时承担两类数据：

- message journal：用户消息、assistant 消息、tool 调用、run 状态等事实事件。
- session metadata：标题、最后活动预览、模型偏好、UI 读状态等投影视图或会话属性。

这两类数据的生命周期不同。message journal 是运行时事实流，必须保持 append-only；metadata 是可覆盖的会话属性，可能由 UI、预览贡献器、后台索引逻辑频繁更新。

## 问题

`SessionActivityPreviewContribution` 监听 NCP 事件后，会调用 session API 更新 `last_activity_preview`。旧实现的 NCP journal 路径把这个 metadata patch 转成 `replaceSession`：

1. 先读取当前 session。
2. 修改 metadata。
3. 用 `replaceSession` 把整个 session 重新写回 journal。

这个行为违反了两个合同：

- metadata 更新不应该重写 message fact stream。
- replace snapshot 不应该伪装成用户或 assistant 的 `message.sent` 事件。

在工具调用流式事件仍在追加时，metadata 更新重写整个 journal 会和 append-only 事件链竞争，导致临时状态被物化成 snapshot。历史上如果 snapshot 又被写成 `message.sent`，reload 后就会把 assistant/tool 临时态当成真实消息重新回放，形成 `toolName = "unknown"` 的工具 part。

## 设计决策

### 1. Metadata 与 message journal 分离

新存储布局：

- `<session>.jsonl`：只保存事件 journal，包括运行时真实事件和少量历史迁移 snapshot event。
- `<session>.metadata.json`：保存 session metadata、agent id、createdAt、updatedAt。
- `index.json`：仍是列表查询索引，来源于 journal + metadata sidecar 的汇总。

metadata-only 更新只写 sidecar 和 summary index，不写 `<session>.jsonl`，不触发 message replay。

代码 owner：

- `NcpAgentSessionJournalStore`：负责 append-only event journal 与 replay。
- `NcpAgentSessionMetadataStore`：负责 metadata sidecar。
- `NcpAgentSessionSummaryIndexStore`：负责列表索引。

### 2. 删除通用 `replaceSession` 合同

`replaceSession` 不再属于 `AgentSessionStore` 通用合同，metadata patch 不能再调用全量替换入口。

历史 legacy session 第一次进入 journal 时仍需要把旧消息 materialize 成 journal 可读的 snapshot。这个能力收窄到 journal store 内部的 `materializeSession`，不是正常运行时热路径，也不是普通 store 调用方可依赖的更新方式。

### 3. Snapshot 事件不是 `message.sent`

全量 materialize 旧消息时使用内部事件：

```text
session.snapshot.message
```

replay 时它可以转换成内部 `MessageSent` 供 state manager 恢复消息，但持久化层不能把它写成协议层 `message.sent`。`message.sent` 只表示真实消息发送事实。

### 4. 历史数据只保证可读不崩溃

旧 journal 里的 `_type: "metadata"` 行继续可读。新代码不主动迁移所有历史文件，也不做 unknown tool 自动清洗。

如果历史文件里已经存在错误 snapshot，系统可以展示它；这类数据修复应由显式迁移或诊断工具完成，不能塞进正常 replay 逻辑里隐式修改事实。

## 新写入合同

- `appendSessionEvent`：只 append event line；同时用当前 session metadata 合并更新 sidecar，不改写 event journal。
- `updateSessionMetadata`：只更新 sidecar 和 summary index。
- `materializeSession`：写 sidecar，并把已有 messages 写成 `session.snapshot.message` event；不写 `_type: "metadata"` journal line，不写 `message.sent` snapshot。
- `listSessionMessages`：只从 journal replay messages。
- `getSession` / `listSessionSummaries`：metadata 从 sidecar 读取；没有 sidecar 时回退读取旧 journal metadata。

## 验收标准

- metadata patch 后，session `.jsonl` 文件不新增、不改写任何 event line。
- `SessionActivityPreviewContribution` 更新 `last_activity_preview` 时不再触发全量 session 替换。
- backend `updateSession` 只调用 metadata patch 合同，不再调用全量替换。
- `materializeSession` 写出的 snapshot event type 是 `session.snapshot.message`，不是 `message.sent`。
- 旧 `_type: "metadata"` journal 文件仍可 reload。
