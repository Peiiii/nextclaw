# NCP 事件时间合同

## 背景

Codex 风格的 `已处理 3m 51s` 需要真实任务耗时。直接用相邻消息时间差只能得到估算值，不是 run 生命周期事实。NextClaw 需要把时间纳入 NCP 事件本体，让事件从出生开始就携带自己的发生时间，后续 UI、journal、preview 和 replay 只消费事实，不再猜测或补充。

## 现状依据

- `NcpEndpointEvent` 当前只有 `type` 与 `payload`，没有通用事件发生时间。
- `run.started`、`run.finished`、`run.error` payload 当前只有 `sessionId/messageId/runId/correlationId`，没有 `startedAt/endedAt`。
- 当前每条 `NcpMessage.timestamp` 是消息时间，不能代表 run 从开始到结束的处理耗时。
- journal entry timestamp、EventBus `emittedAt`、session preview timestamp 都是记录、发布或投影时间，不是事件事实。

## 核心判断

事件时间必须遵守 `fact-source-ownership`：谁创建事件，谁写完整事件事实。不能在 EventBus、journal、UI、conversation state manager 这类消费者里后补 `occurredAt` 或 run timing。

## 推荐方案

- `NcpEndpointEvent` 增加通用 `occurredAt?: string` 字段，表示事件领域发生时间。
- 第一方事件 producer 在构造 event object 时必须写入 `occurredAt`。
- `run.started` payload 增加 `startedAt`。
- `run.finished` / `run.error` payload 增加 `startedAt`、`endedAt`。
- 不在协议或 message 中持久化 `durationMs`；duration 是由 `startedAt/endedAt` 派生的展示值。
- `NcpMessage` 增加标准化 `lifecycle?: { startedAt?: string; endedAt?: string }` 字段，用于表达消息自身的生命周期时间，不暴露 run 内部命名。
- conversation state manager 只在处理 run terminal event 时更新它本来负责维护的 assistant message lifecycle；它不补事件字段，也不写内部 metadata key。
- UI 只在 `message.lifecycle.startedAt/endedAt` 同时存在真实值时计算并显示 `已处理 X`，否则继续只显示 `已处理`。

## Owner 与数据流

```text
event producer
  -> creates NcpEndpointEvent with occurredAt
  -> creates run terminal payload with startedAt/endedAt
  -> EventBus / journal / state manager consume event unchanged
  -> state manager settles assistant message and updates message.lifecycle
  -> chat UI reads message.lifecycle and formats the process summary
```

Owner 边界：

- NCP 类型：定义事件时间、run lifecycle timing 与 message lifecycle 合同。
- runtime / request manager / context producers：负责自己创建事件时写完整时间事实。
- journal：只记录事件与记录时间，不改写事件事实。
- conversation state manager：负责把已发生的 terminal run 事实反映到当前 streaming assistant message 的 lifecycle，不创造缺失时间。
- UI：只展示 `message.lifecycle` 中已经存在的真实 duration。

## 目录组织

- 协议类型留在 `packages/ncp-packages/nextclaw-ncp/src/types/`。
- conversation replay 与 message lifecycle 更新留在 `@nextclaw/ncp-toolkit` 的 conversation state manager。
- NextClaw 产品 UI 展示逻辑留在 `packages/nextclaw-ui/src/features/chat/features/message/`。
- 迭代记录在完成实现后写入 `docs/logs/v0.21.10-ncp-event-timing/README.md`。

## 兼容与迁移

`occurredAt` 和 run timing 字段在类型上保持可选，用于兼容旧 journal、外部 runtime 和历史测试 fixture。兼容只发生在读取层的“没有就不展示/不投影”，不允许消费者自行生成缺失时间。

旧消息没有完整 `message.lifecycle.startedAt/endedAt` 时，UI 继续显示 `已处理`，不估算 duration。

## 验收标准

- 第一方 runtime 生产的 NCP events 带 `occurredAt`。
- `run.started`、`run.finished`、`run.error` 在生产点写入 lifecycle timing。
- state manager 能把 terminal run timing 反映到最终 assistant message lifecycle。
- replay 中 `message.completed -> run.finished` 顺序能保留 terminal timing。
- chat process summary 只在真实 `message.lifecycle.startedAt/endedAt` 存在时派生显示 duration。
- 跑定向测试、相关 package `tsc`、lint、governance 和 maintainability guard。

## 非目标

- 不用消息时间差估算处理时长。
- 不做 EventBus/journal/SessionRun.applyEvents 的统一补字段器。
- 不要求一次性修复所有第三方或历史测试 fixture 的无 `occurredAt` 输入。
- 不新增 timing manager、adapter 或事件包装层。

## 后续实现顺序

1. 更新 NCP event/run/message lifecycle 类型合同。
2. 修改第一方 event producer，让事件创建时写入 `occurredAt` 和 run timing。
3. 修改 conversation state manager，仅把 terminal run timing 写入 message lifecycle。
4. 修改 chat process summary，仅消费真实 message lifecycle duration。
5. 补定向测试与迭代记录，完成验证闭环。
