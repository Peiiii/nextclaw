# 真实上下文压缩设计

## 一句话定义

上下文压缩不是“从历史里删掉一些消息，再保留几条原文”，而是：

**从完整 append-only 会话历史中生成一条可继续工作的压缩上下文消息。**

模型下一轮看到的核心内容应是：

```text
系统消息
压缩上下文消息
压缩后新增的用户/assistant 消息
```

压缩上下文消息本身必须包含两类信息：

1. 较早上下文的结构化 summary。
2. 最近若干轮对继续任务有关键影响的信息，经过高保真摘要后写进同一条 summary。

因此，压缩完成后不再保留“最近 6 条原始消息”或任何 retained raw tail。

## 为什么这样设计

之前的 retained-tail 设计把复杂度放错了位置：系统需要在 runtime 中判断哪些原始消息保留、marker 应该放到哪、tool 协议组能不能切开、最近 6 条是否过大、timestamp 是否晚于 checkpoint 完成时间。

这些复杂度本质上都来自一个假设：压缩后还要混合“summary + 原始尾巴”。

真实压缩设计取消这个混合态。压缩服务要对被压缩范围内的上下文负责，包括最近意图、当前用户要求、已做决定、未完成事项和关键错误现场。压缩质量属于 summary 生成职责，而不是 projection 运行时继续保留原文来兜底。

## 顶层模型

### Source Timeline

完整会话历史。它是事实源，append-only，不因为压缩而改写。

### Checkpoint

一次压缩结果。它代表“到某个时间点为止的上下文已经被 summary message 覆盖”。

Checkpoint 不需要记录 retained ids。最小合同应是：

```ts
type ContextCompactionCheckpoint = {
  version: 1;
  id: string;
  status: "compressing" | "compressed";
  summary: string;
  coveredSessionMessageCount: number;
  originalEstimatedTokens: number;
  projectedEstimatedTokens: number;
  createdAt: string;
  updatedAt: string;
};
```

如果以后需要更强审计，可以新增只读审计字段，但本轮不保留额外边界 id，避免重新引入“部分原文保留”的误导。

### Context View

从 Source Timeline 和 Checkpoint 生成模型输入：

```text
compressed summary message + checkpoint 后新增消息
```

没有 checkpoint 时，模型输入就是去掉 service marker 后的原始消息。

## 核心行为

### 首次压缩

当当前模型输入超过阈值时：

1. 将当前待发送给模型的全部上下文作为压缩源。
2. summary prompt 要明确要求输出：
   - 历史目标和用户硬性要求；
   - 最近若干轮的高保真上下文；
   - 已执行动作、文件、命令、测试结果；
   - 当前最新用户意图；
   - 下一步该继续做什么；
   - 不确定事项和阻塞。
3. 生成 checkpoint。
4. 本轮实际模型输入变成 `system + compressed summary message`，不再追加原始 retained tail。

### 滚动压缩

如果已经有 checkpoint，后续又新增很多消息并再次超窗：

1. 先用旧 checkpoint summary 加 checkpoint 后新增消息，形成当前 model input view。
2. 将这个 view 整体再次压缩成新 summary。
3. 更新同一个 checkpoint id 或写入新的 checkpoint 记录，取决于 timeline 是否需要显示多次历史压缩记录。
4. 新 summary 继续代表“旧 summary + 后续新增消息”的整体上下文。

### Timeline marker

Timeline marker 只是 UI 说明，不参与模型输入边界判断。

推荐行为：

- 每次压缩完成写一条 service message：“较早上下文已自动压缩”。
- 它可以按真实发生时间显示。
- 不需要把 marker 移动到 retained tail 前，因为没有 retained tail。

## 现有代码梳理

### `ContextCompactionService`

当前职责保留：判断压缩、调用 summary generator、产出 checkpoint 和压缩后的 model messages。

最终合同：

- 删除 retained-tail split 逻辑。
- 删除 retained-tail 合同字段。
- `prepareForModelInput()` 应把压缩源定义为当前完整 model input。
- `compactPreparedForModelInput()` 应返回 `system + summary message`，不再拼 `recentHistory/currentTurn`。

### `ContextCompactionPreflightService`

当前职责保留：从 NCP messages 转 legacy model messages、评估预算、执行 begin/finish、写 metadata 和 timeline message。

最终合同：

- begin 阶段用 `buildContextCompactionModelInput()` 得到当前 model input view。
- plan 不再携带 retained boundary。
- finish 后的 `contextWindow` 预算基于 `system + compressed summary message`。
- summary prompt 要升级为“真实压缩上下文”，不是“只压缩 earlier runtime messages”。

### `context-compaction.utils.ts`

该模块是 context-compaction feature 下唯一 utils 文件，负责纯函数和极薄的 timeline/context-window 辅助：

- 读取最新 compressed checkpoint。
- 构造压缩后的 model input。
- 构造 context-compaction timeline marker。
- 判断 context-window 事件是否需要刷新。

目标逻辑：

```text
if no checkpoint:
  return non-service-marker messages

return [
  synthetic summary message,
  messages with timestamp > checkpoint.updatedAt
]
```

旧 checkpoint 兼容只需要保留 timestamp 逻辑，不需要 retained-tail fallback。

### 已删除文件

以下文件都属于 retained-tail 或分散小 helper 方案，真实压缩设计下删除：

- `context-compaction-timeline-message.utils.ts`
- `context-window-event.utils.ts`
- `ncp-agent-session-context-compaction.utils.ts`
- `context-compaction-boundary-planner.service.ts`
- `context-compaction-boundary.utils.ts`

## 改造方案

### 第一步：清理错误方向的半成品

删除 retained-tail 方向新增的文件和字段：

- `context-compaction-boundary-planner.service.ts`
- `context-compaction-boundary.utils.ts`
- `ncp-agent-session-context-compaction.utils.ts`
- retained-tail checkpoint 字段
- retained-tail marker materialization

### 第二步：重写压缩 plan

`ContextCompactionPlan` 简化为：

```ts
type ContextCompactionPlan = {
  messages: RuntimeMessage[];
  coveredMessages: RuntimeMessage[];
  originalEstimatedTokens: number;
};
```

`coveredMessages` 就是当前要被 summary 覆盖的 model input，通常包含 system 之外的所有上下文。当前用户消息必须在压缩源里。

### 第三步：重写 summary prompt

summary prompt 从“Compress earlier runtime messages”改成“Build a complete compressed working context”。

必须要求输出固定结构：

```md
# Compressed Working Context

## User Goals And Hard Requirements
## Recent High-Fidelity Context
## Decisions And Current Direction
## Files, Commands, And Evidence
## Current Task State
## Next Steps
## Uncertainties Or Risks
```

其中 `Recent High-Fidelity Context` 是替代 retained raw tail 的关键。

### 第四步：简化 model input 构造

Model input 构造只做：

1. 找最新 compressed checkpoint。
2. 构造 synthetic summary message。
3. 附加 checkpoint 完成后新增的非 compaction marker 消息。

这会重新允许 timestamp 边界，但这次语义不同：checkpoint summary 已经覆盖了触发压缩前的全部上下文，包括当前用户意图，所以不需要用 timestamp 保留旧原文。

### 第五步：简化 timeline

压缩 marker 按实际完成时间显示即可。

不再移动 marker，不再插入 retained tail 前，不再使用 `insertBeforeMessageIds`。

### 第六步：替换测试

删除 retained-tail 相关测试：

- explicitly retained messages older than checkpoint completion；
- marker-adjacent fallback；
- marker materializes before retained tail；
- assistant/tool group retained raw tail。

新增测试：

- 压缩源包含触发压缩的当前用户消息。
- 压缩后 model input 不包含原始历史尾巴，只包含 summary message。
- rolling compaction 会把旧 summary 和新增消息一起再次压缩。
- `context-compaction.utils.ts` 在 checkpoint 后只附加新消息。
- 真实会话 smoke 验证 summary 输入中包含“现代技术栈”这类最近意图。

## 验证标准

- `pnpm --filter @nextclaw/core test -- src/features/runtime-context/services/context-compaction.service.test.ts`
- `pnpm --filter @nextclaw/kernel test -- src/features/context-compaction/services/context-compaction-preflight.service.test.ts src/stores/ncp-agent-session-journal.store.test.ts`
- `pnpm --filter @nextclaw/core tsc`
- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/core lint`
- `pnpm --filter @nextclaw/kernel lint`
- targeted governance
- `pnpm check:governance-backlog-ratchet`
- 真实会话 smoke：对 `ncp-mq2g2hmt-9f912762` 验证新压缩输入会把最近用户意图写进 summary 源，而不是靠 retained raw tail。

## 成功标准

- checkpoint 合同不再包含 retained-tail 字段。
- `context-compaction.utils.ts` 不再知道“最近 6 条”“retained ids”“marker 前后位置”。
- timeline marker 不再影响模型输入。
- 压缩后模型输入结构可以一句话解释：`system + compressed working context + checkpoint 后新增消息`。
- 非测试生产代码应明显减少，至少删除 retained-tail 方案引入的大部分复杂度。
