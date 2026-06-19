# Child 会话上下文继承设计

## 背景

当前 `sessions_spawn` 已支持通过 `scope="child"` 创建 child 会话，并通过现有 `parent_session_id` metadata 表达父子关系。问题是 child 会话默认从空消息历史开始，只有 `notify` 时才把 `task` 作为第一条请求发送到 child 会话。

这会导致一种产品断层：用户在父会话里已经形成了上下文，但开子代理执行分支任务时，child 会话不能选择性继承父会话已有上下文。用户提出的目标不是新增一个新的父子身份字段，而是新增一个解耦参数，用来表示 child 会话是否继承父上下文，并且继承必须有锚点边界。

## 现状依据

- `packages/nextclaw-kernel/src/tools/session-spawn.tools.ts` 是 NCP `sessions_spawn` 工具 owner，已经有 `scope: "standalone" | "child"`。
- `packages/nextclaw-kernel/src/managers/session.manager.ts` 是 NCP session 创建 owner，当前 `createSession` 会继承少量 metadata，但 `messages` 固定为空数组。
- `parent_session_id` 已经由 `SessionManager.createSession` 写入 child metadata，并被 `packages/nextclaw-ui/src/features/chat/features/session/utils/ncp-session-adapter.utils.ts` 读取成 `parentSessionId` / `isChildSession`。
- `SessionRunManager.createSessionRun` 从 `SessionManager.listSessionMessages(sessionId)` 初始化运行时历史。因此，如果创建 child 时写入一段父消息快照，后续 runtime 会自然把它作为 child 会话自己的历史输入，不需要运行时每轮跨 session 拼接。
- `packages/nextclaw-ui/src/features/chat/features/message/components/chat-message-list.container.tsx` 已经有 timeline divider 机制用于 context compaction，可以复用相同“消息列表前置提示/分隔提示”的交互位置展示继承来源。

## 核心判断

需要做，而且应建模为 child spawn 的上下文继承策略，而不是新的父子关系模型。

父子身份继续只由现有 `parent_session_id` 表达。新增参数只表达“是否继承父上下文”；锚点只表达“继承到哪里为止”。这三件事不能混在一个字段里。

## 推荐方案

在 `sessions_spawn` 增加独立参数：

```ts
inheritContext?: boolean
```

语义：

- 默认 `false`，保持当前行为。
- 只有 `scope="child"` 时允许为 `true`。
- `scope="standalone"` 使用 `inheritContext=true` 直接报错，不做隐式降级。
- 当 `inheritContext=true` 时，创建 child 会话前，从当前父会话读取消息历史，只继承锚点之前的消息。

锚点来源：

- 第一阶段不新增让模型手填的 message id 参数，避免把低层会话内部细节暴露给工具调用者。
- 由工具执行上下文中的 `toolCallId` 自动推导锚点：找到父会话里包含该 `toolCallId` 的 assistant tool-call 消息，继承该消息之前的历史。
- 找不到 `toolCallId` 对应消息时，退化为继承父会话当前已持久化消息全集，并在 metadata 标记 anchor kind 为 `latest_persisted`。这是显式可观察的边界，不静默伪装成精确锚点。

写入 child 的内容：

- 把锚点之前的父消息复制成 child session 的初始消息快照。
- 每条继承消息保留原 role、parts、status、timestamp 等内容，但改写：
  - `sessionId` 为 child session id。
  - `id` 加稳定前缀，避免和父会话消息 id 冲突。
  - `metadata` 增加 `inherited_from_session_id` 和 `inherited_from_message_id`。
- child metadata 增加一个独立继承描述对象，例如：

```ts
context_inheritance: {
  enabled: true,
  sourceSessionId: "parent-session",
  anchorKind: "tool_call" | "latest_persisted",
  anchorToolCallId?: "call-1",
  anchorMessageId?: "assistant-message-1",
  inheritedMessageCount: 12
}
```

这里不新增 `fork_parent_session_id`，因为父会话身份已经由 `parent_session_id` 表达。

## Owner 与数据流

Owner：

- 工具参数 owner：`SessionSpawnTool`。
- 会话创建与继承快照 owner：`SessionManager.createSession`。
- 请求调度 owner：`SessionRequestManager.spawnSessionAndRequest` 透传继承策略。
- UI 展示 owner：chat message timeline container 或其同 feature utils，从 child session metadata 和首条继承消息 metadata 派生提示。

数据流：

1. 父会话 agent 调用 `sessions_spawn({ scope: "child", inheritContext: true, ... })`。
2. `SessionSpawnTool` 校验 `inheritContext` 只用于 child scope，并把策略传给 `SessionManager` 或 `SessionRequestManager`。
3. `SessionManager.createSession` 读取 `sourceSessionId` 对应 record，按工具调用锚点截取父消息。
4. `SessionManager.createSession` 创建 child session snapshot，写入继承消息和 `context_inheritance` metadata。
5. 如果 `notify` 存在，`SessionRequestManager` 再把 task 作为 child 的新用户请求发送进去。
6. UI 通过继承消息 metadata 渲染“继承了父会话上下文”的 timeline 提示，但不把继承消息重复渲染成 child 会话气泡。

## 目录组织

尽量不新增新 owner。

预计改动：

- `packages/nextclaw-kernel/src/tools/session-spawn.tools.ts`：新增 schema、参数读取和 child-only 校验。
- `packages/nextclaw-core/src/features/session/types/session.types.ts`：扩展 `CreateSessionInput` / `SpawnSessionAndRequestParams` 相关共享类型。
- `packages/nextclaw-kernel/src/managers/session.manager.ts`：在现有 session 创建 owner 内完成继承快照，不新增平行 manager。
- `packages/nextclaw-kernel/src/tools/session-spawn.tools.test.ts`、`packages/nextclaw-kernel/src/managers/__tests__/session.manager.test.ts`、`packages/nextclaw-kernel/src/features/session-request/managers/session-request.manager.test.ts`：覆盖 schema、校验、snapshot 和 notify 路径。
- UI 若需要新增解析逻辑，放在现有 chat feature 的 `utils/*.utils.ts` 或直接收敛在 message list container，避免新增空心 service。

## 兼容与迁移

- 默认不继承，旧调用完全保持当前行为。
- 不读取 `inherit_context`、`fork`、`copyContext` 等别名，避免 schema 双路径。
- `inheritContext=true` 对 standalone 直接报错，避免产生“看似继承但没有父会话”的不确定行为。
- 旧 child session 没有 `context_inheritance` metadata，UI 不展示继承提示。

## UI 体现

消息列表应展示一个轻量 timeline 提示，但不重复展示被继承的父会话消息气泡。

这里要做关注点分离：

- 继承消息是 child 会话运行上下文的一部分，用于后续 runtime 历史输入。
- child 会话可见对话流只展示 child 自己的新请求、新回复和后续交互。
- UI 用 timeline 事件告诉用户“这里继承了父会话上下文”，不把父会话历史再复制一遍给用户看。

推荐文案语义：

- “已继承父会话上下文”
- tooltip 或详情里显示父会话 id、锚点消息或继承消息数。

显示条件：

- 消息流中存在 `inherited_from_session_id` 标记的继承消息。
- 至少继承了一条消息。

位置：

- 在第一条继承消息原本所在的位置；通常是 child 会话第一组可见消息之前。
- 视觉上接近 context compaction divider，作为 timeline 事件，而不是普通气泡。

## 验收标准

- `sessions_spawn` schema 暴露 `inheritContext`，且没有 legacy alias。
- `inheritContext=true` 只能用于 `scope="child"`。
- child 会话继承父会话锚点之前的消息，且不继承锚点之后的消息。
- `notify="final_reply"` 时，继承消息先存在，随后 task 作为 child 的新用户请求进入同一 child 会话。
- child session summary 保留现有 `parent_session_id`，并额外包含 `context_inheritance` 继承说明。
- UI 展示继承提示，但不重复展示继承消息气泡；没有继承的 child 和 standalone session 不展示。
- TypeScript、定向测试、相关治理检查通过。

## 非目标

- 不做通用“任意 session fork”入口。
- 不新增新的 parent id 字段。
- 不支持模型手动指定任意历史 message id 作为锚点。
- 不做父会话后续消息与 child 会话的持续同步。
- 不把继承逻辑放到 runtime 每轮拼接，避免跨 session 隐式依赖。

## 后续实现顺序

1. 扩展共享类型和 `SessionSpawnTool` schema，增加 child-only 参数校验。
2. 在 `SessionManager.createSession` 中实现继承快照与 metadata 写入。
3. 让 `SessionRequestManager.spawnSessionAndRequest` 透传继承策略，覆盖 notify 路径。
4. 增加定向单测。
5. 增加 UI timeline 提示与测试。
6. 跑定向测试、`tsc`、governance 和可维护性收尾检查。
