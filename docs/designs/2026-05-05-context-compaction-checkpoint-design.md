# 上下文压缩检查点设计

## 背景

长会话持续增长后，模型输入会逐步逼近上下文窗口上限。现有机制能通过工具结果截断、无效工具协议清理、旧历史裁剪和边界消息截断来保证请求不爆，但它仍然有两个明显问题：

1. 用户看不到“较早上下文是怎么被处理的”。
2. 历史一旦只靠硬裁剪处理，连续性会变差，而且压缩边界对用户不可见。

我们需要一套“可见、可定位、可替代旧历史但不破坏存储”的上下文压缩机制。

## 目标

- 原始 session message 继续完整保留，不做删除式压缩。
- 压缩结果在消息流中有明确位置，而不是悬浮在消息列表外。
- 压缩条目可以被认为是“特殊 message / timeline item”，但不是普通用户消息，也不是送给 AI 的 `system message`。
- 模型输入构造时，可以用压缩检查点替代其覆盖范围内的旧历史。
- 前端只做轻量分割线式展示，不做普通聊天气泡。
- 上下文压缩与 context build 解耦：发送前预检负责判断和写入压缩状态，builder 只消费已有 checkpoint 构建模型输入。
- 上下文窗口占用变化必须通过独立事件实时通知前端，不能依赖工具结果、run metadata 或会话列表刷新间接同步。
- 支持运行时上下文所有权策略：NextClaw 只管理自己负责模型输入的 runtime；Codex、Claude Code 这类自带上下文管理的 runtime 不做外层二次压缩。
- 为未来用户手动触发压缩保留同一个后端入口。

## 非目标

- 这次不做异步 LLM 二次摘要任务编排。
- 这次不做多检查点链式重算优化。
- 这次不做原始历史展开回放面板。
- 这次不为 Codex、Claude Code 等 runtime-owned 会话强行注入 NextClaw 压缩。
- 这次不做前端手动压缩按钮，但后端接口边界要能承接未来手动触发。

## 核心定义

上下文压缩检查点是消息流中的一种特殊条目。它有顺序、有位置，但不属于用户/助手/tool/system 四类普通对话消息。

建议统一按 `service` role 承载，并通过明确元数据区分：

```ts
{
  role: "service",
  metadata: {
    nextclaw_timeline_kind: "context_compaction",
    checkpoint: {
      version: 1,
      id: string,
      status: "compressing" | "compressed",
      summary: string,
      coveredMessageCount: number,
      coveredSessionMessageCount: number,
      originalEstimatedTokens: number,
      projectedEstimatedTokens: number,
      createdAt: string,
      updatedAt: string
    }
  }
}
```

这里最关键的是两点：

- `context_compaction` 是一种**特殊 timeline item**。
- 这条 timeline item 的**物理位置**就是覆盖边界：它之前的普通消息由摘要替代，它之后的普通消息继续原样参与模型输入。

## 为什么它既像 message，又不是普通 message

从用户视角，它必须在消息流中出现，因为它表达的是“到这里为止，前面的历史已压缩”。

但从模型输入视角，它不能被当成普通对话内容直接送进模型。它是系统内部的会话管理条目，只有在构建模型输入时，builder 才会读取它的 checkpoint 信息，并用 checkpoint 摘要替代它覆盖的旧历史消息。

所以它的本质是：

- **会话时间线条目**
- **不是普通聊天语义消息**
- **不是原样喂给 AI 的 protocol system message**

## 存储方案

保留两类信息：

1. `session.messages` / `session.events` 中存储特殊 timeline 条目，用于 UI 顺序渲染。
2. 上下文窗口统计不写入 session metadata，而是在需要展示或发送前预检时按当前消息流、checkpoint 和 agent context 配置实时计算，并通过 `context-window.updated` 写入 live snapshot。

这样职责是分开的：

- timeline item 管位置与生命周期
- context window snapshot 管整体窗口统计，其中 `usedContextTokens` 表示“如果此刻立刻发起模型请求，当前会话会形成的有效模型输入占用”，不能用压缩前原始全量历史估算替代，也不能理解为“已经实际发给模型的 token”。

同时保留一份最近检查点元数据：

- `session.metadata.last_context_compaction`

它的职责不是给 UI 直接渲染消息流，而是：

- 让后端知道最近一次 checkpoint 的状态与主键
- 支撑 `compressing -> compressed` 状态更新
- 给上下文窗口 metadata 提供 `checkpointId` 关联

也就是说：

- `last_context_compaction` 是后端状态锚点
- timeline item 是消息流位置锚点
- `context-window.updated` / hydration seed live snapshot 是输入框占用指标锚点

## 职责边界

上下文压缩必须和模型输入构建分开：

1. `ContextCompactionPreflightService`
   - 发送前预检 owner。
   - 在用户消息进入会话、模型输入构建之前执行。
   - 负责读取 session、agent profile、上下文窗口配置和当前 runtime ownership。
   - 负责判断是否需要压缩、写入 `compressing -> compressed`、更新 timeline item、更新 `last_context_compaction`，并发布实时 context window snapshot。
   - 未来手动压缩也走这个 service，只是触发来源从 `send-preflight` 变成 `manual`。

2. `ContextCompactionService`
   - 压缩算法 owner。
   - 负责将可压缩旧历史投影成 checkpoint summary，并产出覆盖消息数与 token 估算。
   - 不关心 UI、runtime、会话存储触发方式。

3. `NextclawNcpContextBuilder`
   - 只做模型输入构建。
   - 不触发压缩。
   - 不写 session。
   - 不插 timeline message。
   - 只消费预检阶段已经存在的 checkpoint，把被覆盖的旧历史替换成摘要。

这个边界避免 builder 同时承担 build、压缩、写入、通知四种职责。

## Runtime Context Ownership

不同 runtime 对上下文的职责不同：

- `nextclaw-managed`：NextClaw 负责构建完整模型输入、估算窗口、触发压缩和最终裁剪。第一版主要对应 native runtime。
- `runtime-managed`：runtime 自己负责上下文窗口、压缩、裁剪和缓存策略。Codex、Claude Code 这类专业 agent runtime 属于这一类。

预检规则：

- `nextclaw-managed` 会话：每次发送前执行 NextClaw 压缩预检。
- `runtime-managed` 会话：跳过 NextClaw 外层压缩，避免二次压缩、缓存破坏和责任冲突。

UI 展示规则：

- `nextclaw-managed` 会话可以展示 NextClaw 的压缩 checkpoint。
- `runtime-managed` 会话如果 runtime 能提供自己的上下文状态，未来接入 runtime-reported metadata；如果不能，只展示轻量说明“上下文由运行时管理”，不伪装成 NextClaw 已压缩。

## 前端展示方案

前端不要把它渲染成聊天气泡，而是在消息流内部渲染成一条轻量分割线：

- `正在压缩较早上下文`
- `较早上下文已自动压缩`

它应插在准确的消息边界处，而不是消息列表顶部单独展示。

渲染形式建议：

- 一条横线
- 中间一个浅灰背景的小标签
- hover/title 可看覆盖消息数、压缩前后 token 估算

## 发送前预检

发送前预检发生在用户消息进入会话之后、模型输入构建之前：

1. 读取当前 session 历史和当前用户消息。
2. 根据 agent profile 获取 `contextTokens`。
3. 构造一次与 builder 一致的可估算输入视图。
4. 当上下文占用达到压缩阈值，并且存在足够旧历史时，生成 checkpoint。
5. 写入特殊 timeline item 与 metadata。
6. 发布 `context-window.updated`，让前端上下文圆环立即刷新。

实时通知分两类：

- `context-window.updated`：独立 NCP 事件，只携带 `sessionId` 和最新 `contextWindow`；前端输入框圆环优先读取 live snapshot，避免长时间运行时继续展示会话列表里的旧百分比。
- `message.sent` + `service/context_compaction`：用于把同一条 timeline item 的 `compressing -> compressed` 生命周期送到消息流；前端按消息顺序渲染分割线。

页面刷新或重新进入会话时不依赖历史事件重放，也不读取持久 `last_context_window`。`contextWindow` 由会话摘要生成者在 `getSession()` 的 session view 中实时派生：runtime 未就绪时由 `UiSessionService` 生成，runtime 就绪后由 `DefaultNcpAgentBackend` 生成。`listSessions()` 不计算 `contextWindow`，避免会话列表加载时对所有历史会话做上下文估算。`GET /api/ncp/sessions/:sessionId/messages` 只读取当前会话的 session view 并把它随 messages seed 返回，不再通过 runtime / shell / server / router 逐层传递 callback，也不在 bridge 里手写 `NcpSessionApi` proxy。前端只在 NextClaw UI 的会话 hook 中把该 snapshot 合并为展示状态，不扩展通用 NCP React hydration contract。这样既保持“不落盘”，又保证刷新后能立即显示上下文窗口。

触发来源第一版包含：

- `send-preflight`

未来可扩展：

- `manual`
- `scheduled-maintenance`
- `runtime-reported`

手动触发时复用同一个 service，避免另起一套压缩路径。

## 模型输入投影

`NextclawNcpContextBuilder` 在构建请求时：

1. 读取完整历史时间线
2. 查找消息流中最近一条 `compressed` 的 `context_compaction` checkpoint
3. 对这条 checkpoint 之前的旧历史不再直接拼进 prompt
4. 使用 checkpoint `summary` 作为临时替代内容
5. 保留 checkpoint 之后的普通消息
6. 再交给现有 `InputBudgetPruner` 做最终安全裁剪

上下文窗口占用指标必须和这条投影链路一致：

- 主圆环展示 `usedContextTokens / totalContextTokens`。
- `usedContextTokens` 是“当前若发请求”的有效占用快照，不是历史总量。
- 如果已经有最近的 compressed checkpoint，估算范围从 checkpoint 摘要加其后的消息开始。
- 如果没有 checkpoint，估算范围是当前可用历史经安全裁剪后的请求视图。
- 压缩前原始历史估算只保留在 checkpoint 的 `originalEstimatedTokens` 中，用于诊断和压缩效果对比，不作为主占用值。

也就是说：

- 存储不删历史
- 展示保留 timeline
- 送给 AI 时按需替换

第一版实现里，替换策略是：

- 保留 system prompt
- 保留最近 `6` 条历史消息
- 保留当前轮用户输入
- 用一个临时 checkpoint message 替代更早历史

这个 checkpoint message 只存在于本次模型输入投影中，不会回写成普通聊天消息。

## 生命周期

第一版保留两个状态：

- `compressing`
- `compressed`

第一版在同一次发送前预检中同步完成 LLM 摘要，但必须先写入并发送 `compressing` 条目；摘要 LLM 返回后，再用同一个 checkpoint ID 更新为 `compressed`。这样用户在长时间摘要时能看到“正在压缩较早上下文”，而不是只在结束后突然看到已压缩结果。

前端在消息流中只展示两种文案：

- `正在压缩较早上下文`
- `较早上下文已自动压缩`

这让用户能感知后台正在进行的会话管理动作，而不是只在压缩完成后突然看到结果。

## 可维护性原则

- 后端压缩逻辑集中在一个 owner class 中。
- 触发时机集中在一个 preflight service 中。
- builder 保持纯构建，不再承担压缩写入副作用。
- 不新增第二套会话存储模型。
- 不把 checkpoint 伪装成普通 `system` message。
- 不让前端从 metadata 猜位置，也不再维护第二套覆盖边界字段，而是让 timeline item 的消息流位置自带顺序语义。
- `usedContextTokens` 和 `totalContextTokens` 继续保持为独立字段，不与 checkpoint 结构耦合。

补充约束：

- 命中压缩后，原始 session message 绝不删除。
- timeline item 虽然采用 `service` role 承载，但 builder 必须显式识别，防止它被误当成普通上游历史消息送给模型；普通 `service` 历史仍按既有合同转成上游 `system` 历史。
- checkpoint ID 只用于更新同一条压缩记录和展示追踪，不参与模型输入边界判断。

## 第一版实现策略

第一版摘要必须使用 LLM 生成结构化 summary，而不是确定性摘录或裁剪。原因：

- 上下文压缩的核心价值是语义保真和信息重组，简单截取旧消息只能算裁剪，不能算压缩。
- 编程 Agent 的长会话摘要需要保留用户目标、显式约束、关键决策、已读/已改文件、命令与测试结果、失败尝试、风险和下一步。
- checkpoint 仍然只是一条消息流位置锚点；真正进入后续模型输入的是 LLM 生成的 summary。

第一版仍然采用同步 preflight 方式：

1. 先估算当前输入是否达到压缩阈值。
2. 只有需要压缩时，才用当前 Agent 模型发起一次 summary 请求。
3. summary 请求成功后写入 `compressed` checkpoint。
4. 后续业务模型输入使用 summary 替代 checkpoint 之前的历史。

如果 summary 生成失败，不写入假的压缩 checkpoint；请求应保留可观察失败，而不是把裁剪结果伪装成压缩结果。

## 失败与兜底

即使 checkpoint 已生成，也保留现有 `InputBudgetPruner` 作为最终安全网：

- 工具结果截断
- 无效工具协议清理
- 旧历史丢弃
- system / user 边界截断

压缩检查点是优先路径，不是唯一兜底。

## 当前实现落点

代码落点如下：

- 后端压缩 owner：
  - `context-compaction.service.ts`
- 发送前预检 owner：
  - `context-compaction-preflight.service.ts`
- timeline 特殊条目工具：
  - `context-compaction-timeline-message.utils.ts`
- 上下文窗口实时快照工具：
  - `context-window-snapshot.utils.ts`
- builder 投影消费：
  - `nextclaw-ncp-context-builder.ts`
- 前端 timeline 解析：
  - `ncp-session-context-metadata.utils.ts`
- 前端消息流 divider 渲染：
  - `chat-message-list.container.tsx`

这样做的目的，是把“触发时机”“压缩策略”“timeline 挂载”“模型输入投影”“UI 读取”分开，但仍然保持在很小的实现面内，不引入通用 pipeline 或多层 orchestrator。
