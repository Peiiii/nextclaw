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

## 非目标

- 这次不做异步 LLM 二次摘要任务编排。
- 这次不做多检查点链式重算优化。
- 这次不做原始历史展开回放面板。

## 核心定义

上下文压缩检查点是消息流中的一种特殊条目。它有顺序、有位置，但不属于用户/助手/tool/system 四类普通对话消息。

建议统一按 `service` role 承载，并通过明确元数据区分：

```ts
{
  role: "service",
  metadata: {
    nextclaw_timeline_kind: "context_compaction",
    checkpoint: {
      id: string,
      status: "compressing" | "compressed",
      summary: string,
      coveredMessageCount: number,
      coveredSessionMessageCount: number,
      coveredUntilMessageId?: string,
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
- `coveredUntilMessageId` 或等价覆盖边界信息，定义它在消息流里的准确位置与覆盖范围。

## 为什么它既像 message，又不是普通 message

从用户视角，它必须在消息流中出现，因为它表达的是“到这里为止，前面的历史已压缩”。

但从模型输入视角，它不能被当成普通对话内容直接送进模型。它是系统内部的会话管理条目，只有在构建模型输入时，builder 才会读取它的 checkpoint 信息，并用 checkpoint 摘要替代它覆盖的旧历史消息。

所以它的本质是：

- **会话时间线条目**
- **不是普通聊天语义消息**
- **不是原样喂给 AI 的 protocol system message**

## 存储方案

保留两层信息：

1. `session.messages` / `session.events` 中存储特殊 timeline 条目，用于 UI 顺序渲染。
2. `session.metadata.last_context_window` 中保留上下文窗口统计信息，用于输入框旁边的上下文占用指示器。

这样职责是分开的：

- timeline item 管位置与生命周期
- context window metadata 管整体窗口统计

同时保留一份最近检查点元数据：

- `session.metadata.last_context_compaction`

它的职责不是给 UI 直接渲染消息流，而是：

- 让后端知道最近一次 checkpoint 的状态与主键
- 支撑 `compressing -> compressed` 状态更新
- 给上下文窗口 metadata 提供 `checkpointId` 关联

也就是说：

- `last_context_compaction` 是后端状态锚点
- timeline item 是消息流位置锚点
- `last_context_window` 是输入框占用指标锚点

## 前端展示方案

前端不要把它渲染成聊天气泡，而是在消息流内部渲染成一条轻量分割线：

- `正在压缩较早上下文`
- `较早上下文已自动压缩`

它应插在准确的消息边界处，而不是消息列表顶部单独展示。

渲染形式建议：

- 一条横线
- 中间一个浅灰背景的小标签
- hover/title 可看覆盖消息数、压缩前后 token 估算

## 模型输入投影

`NextclawNcpContextBuilder` 在构建请求时：

1. 读取完整历史时间线
2. 识别 `context_compaction` 特殊条目
3. 对它覆盖范围之前的旧历史不再直接拼进 prompt
4. 使用 checkpoint `summary` 作为临时替代内容
5. 再交给现有 `InputBudgetPruner` 做最终兜底裁剪

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

当 builder 发现上下文超预算并准备构建 checkpoint 时，先写入 `compressing` 条目；完成后更新为 `compressed`。

虽然当前实现仍是同步快速完成，但这个生命周期设计是必要的，因为后续升级为真正异步摘要时，UI 和数据模型不需要重做。

前端在消息流中只展示两种文案：

- `正在压缩较早上下文`
- `较早上下文已自动压缩`

这让用户能感知后台正在进行的会话管理动作，而不是只在压缩完成后突然看到结果。

## 可维护性原则

- 后端压缩逻辑集中在一个 owner class 中。
- 不新增第二套会话存储模型。
- 不把 checkpoint 伪装成普通 `system` message。
- 不让前端从 metadata 猜位置，而是让 timeline item 自带顺序语义。
- `usedContextTokens` 和 `totalContextTokens` 继续保持为独立字段，不与 checkpoint 结构耦合。

补充约束：

- 命中压缩后，原始 session message 绝不删除。
- timeline item 虽然采用 `service` role 承载，但 builder / bridge 必须显式过滤，防止它被误当成普通上游历史消息送给模型。
- `coveredUntilMessageId` 必须由压缩 owner 真实产出，而不是由前端或其它层做近似猜测。

## 第一版实现策略

第一版摘要使用确定性压缩，而不是额外发起一次 LLM 摘要请求。原因：

- 现有 `prepare()` 路径是同步构造模型输入。
- 如果这次强行引入二次异步摘要，会把 runtime 主链路大幅改大。
- 先把“特殊条目 + 正确位置 + builder 替代逻辑”这套骨架做好，后续再把摘要生成器升级成 LLM 版本即可。

## 失败与兜底

即使 checkpoint 已生成，也保留现有 `InputBudgetPruner` 作为最终安全网：

- 工具结果截断
- 无效工具协议清理
- 旧历史丢弃
- system / user 边界截断

压缩检查点是优先路径，不是唯一兜底。

## 当前实现落点

第一版代码落点如下：

- 后端 owner：
  - `context-compaction.service.ts`
- timeline 特殊条目工具：
  - `context-compaction-timeline-message.utils.ts`
- 上下文窗口 metadata 工具：
  - `context-window-metadata.utils.ts`
- builder 接入：
  - `nextclaw-ncp-context-builder.ts`
- 前端 timeline 解析：
  - `ncp-session-context-metadata.utils.ts`
- 前端消息流 divider 渲染：
  - `chat-message-list.container.tsx`

这样做的目的，是把“压缩策略”“timeline 挂载”“UI 读取”三层分开，但仍然保持在很小的实现面内，不引入额外 orchestrator。
