# Tool History 裁剪策略设计

## 结论

本方案讨论的不是上下文压缩，也不是三方 compaction / checkpoint / summary 机制。这里唯一讨论的是：

```text
历史 tool call / tool result 在模型输入里如何保留；
当极端预算压力下必须裁剪时，如何保证 provider 协议合法、语义不误导、行为可预测。
```

最终策略：

```text
默认不裁剪历史 tool。
单个 tool result 过大时，只截断该 result 的正文，保留 tool 协议结构。
整体模型输入超过硬预算时，才允许裁剪历史 tool。
裁剪单位必须是完整 call/result pair，禁止只裁一半。
发送给 provider 前必须做最终协议 normalize，保证没有 orphan call/output。
```

这不是 compaction 策略。它不负责把长会话总结成 checkpoint，也不负责替换整段历史。它只负责 provider-visible tool protocol 的稳定投影和极端情况下的合法裁剪。

## 背景

当前排查到的问题是：模型输入预算评估和真实发送链路会无条件清洗历史 tool 协议：

- 历史 `role === "tool"` 消息被删除。
- 历史 assistant 的 `tool_calls` 和 `reasoning_content` 被剥离。
- 这些规则在没有超出 token 预算时也会执行。

这会导致一个会话的 raw 历史明明有大量 tool 调用、tool 结果和 reasoning，但 provider-visible 模型输入被压到极低 token 数。例如当前样本会话中，历史 tool 相关内容从约 56K token 的模型消息输入坍缩为约 1.1K token；51 条 tool result 全部不再进入模型输入。

这个行为有两个问题：

1. **时机错误**：默认情况下不应该裁剪历史 tool，只有极端预算压力才可以裁剪。
2. **单位错误**：不能只删 `tool` result 或只删 assistant `tool_calls`，必须按 call/result pair 成对处理。

## 产品约束

NextClaw 的长期目标是成为 AI 时代的个人操作层。这个目标要求系统具备稳定的自感知连续性：

- 知道自己做过什么。
- 知道哪些工具执行成功。
- 知道哪些工具失败以及失败原因。
- 知道哪些路径已经尝试过，避免重复犯错。
- 知道哪些历史内容是因为预算被裁剪，而不是假装它从未发生。

因此历史 tool 处理不能只从 provider 400 的角度设计。它必须同时满足：

- provider 协议合法；
- agent 行为连续；
- prompt cache 稳定；
- UI 口径可解释；
- 裁剪动作可审计。

## 设计原则

命中的工程原则：

- `information-expert`：tool protocol 合法性应由最懂 provider-visible model input 的 owner 负责。
- `complete-owner`：负责模型输入的 owner 必须覆盖估算、裁剪、normalize 和统计输出闭环。
- `single-domain-owner`：历史 tool 裁剪不能散落在 budget pruner、preview service、message mapper 多个位置。
- `boundary-normalization`：provider 协议合法化是发送边界职责，不应在普通消息转换阶段静默改变语义。
- `data-flow-locality`：tool call/result 的成对关系应在同一 owner 内读取、校验和裁剪。
- `cqs-pure-read`：context window preview 是读路径，不能顺手改变历史语义，只能报告将会如何投影。

## 非目标

本方案明确不做：

- 不设计上下文 compaction。
- 不设计 checkpoint summary。
- 不设计长期 memory。
- 不引入每轮动态 execution ledger。
- 不改变 raw NCP journal 的持久化语义。
- 不把历史 tool 全部转成普通文本。
- 不为了 UI 数字变小而提前裁剪。
- 不允许为了规避 provider 400 而默认清空历史 tool 轨迹。

如果未来要做 context compaction，应另立设计文档；不能把本策略扩展成“默认压缩历史”的入口。

## 术语

### Raw History

NCP journal / session messages 中保存的原始会话历史。这里是审计事实源，不因 prompt budget 被直接删除。

### Provider-visible History

真正发送给模型 provider 的消息序列。它必须满足 provider 协议约束。

### Tool Pair

一个完整工具交互单元：

```text
assistant tool_call
  -> tool result
```

或 provider 协议中等价的 call/output pair，例如 Codex 的 `FunctionCall` / `FunctionCallOutput`。

### Active Tool Chain

当前轮仍在执行、刚完成、或 provider 协议上仍必须保持连续的 tool call/result 链。Active chain 不能被裁剪，除非 run 被中断并显式生成 synthetic aborted result。

### Recent Completed Tool Pair

最近若干 turn 内已经完成的 tool pair。默认完整保留。

### Old Completed Tool Pair

较早且已完成的 tool pair。只有整体超预算时，才从这里开始按 pair 裁剪。

### Per-result Truncation

单个 tool result 正文过大时，对该 result 的内容做截断。它不删除 call/result 结构。

### Pair Pruning

整体模型输入超预算时，按完整 tool pair 删除较老工具交互。它必须同步移除 call 和 result。

## Codex 参考模式

Codex 的相关做法可以抽象成三点：

1. **单条 output 入 history 时可以按 policy 截断**
   `FunctionCallOutput` / `CustomToolCallOutput` 写入历史时会经过 truncation policy，避免单个工具输出无限膨胀。

2. **发送前 normalize provider-visible history**
   发送给模型前会 normalize history：
   - 缺 output 的 call 补 synthetic output，例如 `aborted`。
   - orphan output 会被移除。
   - 不支持的 media 会被 strip 或替换为占位。

3. **移除历史项时维护 call/output 成对不变量**
   如果移除一个 function call，会同步移除对应 output；如果移除 output，也会移除对应 call 或 local shell call。核心原则是：不能给 provider 留半截 tool 协议。

NextClaw 应学习的是这套 tool protocol 不变量，而不是把当前问题误解成 context compaction。

## 推荐方案

采用 `Codex-style Paired Tool History Policy`。

### 规则 1：默认不裁剪历史 tool

只要 provider-visible history 没有超过预算，就完整保留历史 tool call/result。

禁止：

```text
每轮发送前无条件删除 role=tool
每轮发送前无条件 strip assistant.tool_calls
每轮 preview 时把历史 tool 视为可丢弃内容
```

正常情况下，历史 tool 进入模型输入是合理的。它让 agent 知道：

- 已读过哪些文件；
- 已跑过哪些命令；
- 哪些测试失败；
- 哪些 HTTP/API 调用返回了什么；
- 哪些工具参数已经尝试过。

### 规则 2：单个 tool result 过大时只截断正文

单个 tool result 超过上限时，允许截断 result 内容，但必须保留结构与关键元信息：

- tool name；
- call id；
- input / arguments；
- status；
- exit code / error type / HTTP status；
- 截断标记；
- 原始输出长度或 hash，如果已有相关机制。

推荐输出形态：

```text
<first N chars/tokens>
[Tool result truncated: omitted X chars/tokens]
```

失败结果的错误类型、exit code、stderr 摘要应优先保留。不能把失败详情截到模型完全看不见。

### 规则 3：整体超预算才裁剪历史 tool

整体预算判断应使用固定合同：

```text
estimatedInputTokens + reservedOutputTokens > modelContextWindow
```

或等价的 provider hard limit / safe budget。只有命中这个条件，才进入 pair pruning。

不允许因为“历史 tool 看起来大”就提前裁剪。大不是问题，超过预算才是问题。

### 规则 4：裁剪单位必须是完整 Tool Pair

进入 pair pruning 后，从最老的 old completed tool pair 开始裁剪。每次裁剪必须完整处理关联项：

```text
remove assistant tool_call
remove corresponding tool result
```

或：

```text
remove FunctionCall / LocalShellCall / CustomToolCall
remove corresponding FunctionCallOutput / CustomToolCallOutput
```

禁止以下状态进入 provider-visible history：

- assistant 有 `tool_calls`，后面没有对应 `tool` result；
- 有 `tool` result，但前面没有对应 assistant `tool_calls`；
- tool call id 重复或错配；
- pending tool call 被当作 completed history 保留；
- active chain 被切断一半。

### 规则 5：Active Tool Chain 优先完整保留

当前轮正在进行或刚完成的 tool chain 不参与 old history pruning。

如果 run 被中断，必须显式补一个 synthetic result：

```text
aborted
```

或：

```text
[Tool execution was interrupted]
```

这样 provider-visible history 仍然是合法的，模型也知道发生了中断。

### 规则 6：Recent Completed Tool Pair 默认完整保留

推荐保护最近完成的工具交互：

```text
recentToolTurnProtectCount = 2 或 3
```

或：

```text
recentToolTokenProtectBudget = 20K 到 40K tokens
```

两者选其一即可。推荐先用 turn count，因为行为更可解释、更稳定。

这不是动态 compaction，只是 pruning 保护区。未超预算时不会启用。

### 规则 7：发送前统一 normalize

provider-visible history 在发送前必须经过最终 normalize：

- 缺 result 的 call 补 aborted result；
- orphan result 删除；
- 删除 history item 时同步删除对应项；
- 不支持的 media 转占位或 strip；
- 最终输出协议合法性统计。

normalize 是最后防线，不应该承担默认裁剪职责。

## Owner 设计

推荐新增或明确一个模型输入 owner，例如：

```text
AgentRunModelInputHistoryPolicy
```

或：

```text
ProviderVisibleHistoryPolicy
```

该 owner 只负责 provider-visible history 的历史 tool 策略，不负责整个 context compaction。

### 职责

它负责：

- 识别 tool call/result pair；
- 判断 active / recent / old；
- 对单个 result 做 per-result truncation；
- 在整体超预算时按 pair pruning；
- 维护 call/output 成对不变量；
- 生成裁剪统计；
- 给 preview 和真实发送链路提供同一份投影结果。

它不负责：

- 读取 raw journal；
- 创建 session；
- 调用模型；
- 生成 compaction summary；
- 写长期 memory；
- 决定业务 tool 的执行行为。

### 与现有 owner 的关系

推荐关系：

```text
AgentRunModelInputBuilder
  -> message projector
  -> ProviderVisibleHistoryPolicy
  -> InputBudgetPruner
  -> provider request
```

`InputBudgetPruner` 应退回成预算工具，不再私自做语义清洗。它可以继续负责：

- 系统 prompt 截断；
- 用户消息极端截断；
- 超预算时的最后兜底；
- token 估算与剩余预算计算。

但它不应该无条件删除历史 tool 协议。

`ContextWindowBudgetService` / preview 应调用同一个 policy，不能自己另写一套估算逻辑。

## 预算流程

推荐流程：

```text
project messages
  -> identify tool pairs
  -> per-result truncation for oversized results
  -> estimate model input tokens
  -> if within budget: return unchanged normalized history
  -> if over budget: pair pruning from oldest old completed pairs
  -> estimate again
  -> final normalize
  -> return history + diagnostics
```

### 预算判断

输入：

```text
modelContextWindow
reservedOutputTokens
estimatedInputTokens
```

判断：

```text
safeInputBudget = modelContextWindow - reservedOutputTokens
overBudget = estimatedInputTokens > safeInputBudget
```

`reservedOutputTokens` 必须是稳定配置或模型配置派生值，不能每轮由历史内容动态决定。

### 裁剪顺序

只在 `overBudget === true` 时执行：

1. 保留 active tool chain。
2. 保留 recent completed tool pairs。
3. 从最老 old completed tool pair 开始移除。
4. 每移除一组 pair 后更新 token estimate。
5. 达到 safe budget 即停止。
6. 若所有可裁 tool pair 裁完仍超预算，再交给更上层预算策略处理普通历史消息。

### 不足预算时的兜底

如果裁完 old tool pairs 后仍超预算：

- 不能开始裁 active tool chain；
- 不能裁半个 pair；
- 不能把 user 当前输入截没；
- 应进入普通 history pruning 或明确报 context overflow；
- 后续若引入 compaction，也必须作为单独策略触发。

## 裁剪诊断

每次 policy 输出必须包含 diagnostics。

建议字段：

```ts
type ToolHistoryPolicyDiagnostics = {
  readonly rawToolPairCount: number;
  readonly activeToolPairCount: number;
  readonly recentProtectedToolPairCount: number;
  readonly oldToolPairCount: number;
  readonly truncatedToolResultCount: number;
  readonly prunedToolPairCount: number;
  readonly prunedToolTokenEstimate: number;
  readonly insertedSyntheticToolResultCount: number;
  readonly removedOrphanToolResultCount: number;
  readonly overBudgetBeforePruning: boolean;
  readonly estimatedTokensBeforePruning: number;
  readonly estimatedTokensAfterPruning: number;
};
```

这些 diagnostics 应同时用于：

- context window UI；
- debug log；
- 回归测试断言；
- 用户可解释的“为什么历史少了”。

## UI 口径

上下文圆环不能再只显示一个被清洗后的 token 数，让用户误以为完整会话只有 1.1K。

推荐展示：

- `模型输入预计占用`：最终 provider-visible history tokens。
- `原始会话历史估算`：raw session / projected-before-policy tokens。
- `历史工具调用`：总 tool pairs、保留 tool pairs、裁剪 tool pairs。
- `单条工具截断`：truncated result count。
- `预算裁剪`：只有发生 pair pruning 时才显示。

如果没有触发裁剪，应显示：

```text
历史工具：完整保留
```

如果触发裁剪，应显示：

```text
历史工具：因超过模型上下文预算，已按完整 call/result pair 裁剪 N 组
```

## 当前错误规则的处置

当前规则：

```text
规则 1：无条件删除历史 role=tool
规则 2：无条件剥离历史 assistant.tool_calls / reasoning_content
```

应改为：

```text
默认不执行。
只有整体超预算并进入 pair pruning 时才允许移除历史 tool。
移除必须按 pair。
preview 和 send 使用同一 policy。
```

特别注意：不能把当前规则简单包一层 `if (history)` 或 `if (old)`。它的问题不是代码位置，而是语义：它默认裁剪、半截裁剪、静默裁剪。

## 测试策略

### 1. 默认不裁剪

输入包含多个完整历史 tool pair，预算充足。

期望：

- output 保留所有 tool pairs；
- `prunedToolPairCount = 0`；
- `truncatedToolResultCount = 0`；
- 没有 orphan call/output。

### 2. 单个 result 过大

输入一个 tool result 超过单条 result limit，但整体未超预算。

期望：

- call/result 结构保留；
- result body 被截断；
- 有截断 marker；
- `truncatedToolResultCount = 1`；
- `prunedToolPairCount = 0`。

### 3. 整体超预算时按 pair 裁剪

输入多个历史 tool pairs，整体超过 safe budget。

期望：

- 从最老 old completed pair 开始裁；
- 每个被裁 pair 的 call/result 同时消失；
- recent protected pairs 保留；
- active chain 保留；
- `prunedToolPairCount > 0`；
- final tokens <= safe budget。

### 4. 孤儿 result normalize

输入含 orphan tool result。

期望：

- orphan result 被删除；
- diagnostics 记录 `removedOrphanToolResultCount`；
- provider-visible history 合法。

### 5. 缺 result 的 call normalize

输入含历史 call 但无 result。

期望：

- 如果属于 interrupted / active boundary，可补 synthetic aborted result；
- 否则按非法 pair 处理，不能把半截协议发给 provider；
- diagnostics 记录 `insertedSyntheticToolResultCount`。

### 6. 当前样本会话回归

使用 `ncp-mpmq8j2f-86d06c5c` 对应 session fixture。

期望：

- 在未超预算时，不应从 56K 直接坍缩成 1.1K；
- 51 条工具交互不应无条件消失；
- 若预算充足，历史 tool 保留；
- 若人为设置小预算，才按完整 pair 裁剪，并输出准确 diagnostics。

## 验收标准

实现完成后必须满足：

1. 未超预算时，历史 tool call/result 默认完整进入 provider-visible history。
2. 单个 tool result 超长时，只截断 result body，不删除 pair。
3. 整体超预算时，只能按完整 pair 裁剪。
4. 发送前没有 orphan tool result。
5. 发送前没有 missing-output tool call，除非被补成 synthetic aborted result。
6. context window preview 与真实发送链路使用同一 tool history policy。
7. UI 能解释 raw history、model input、truncated results、pruned pairs 的差异。
8. diagnostics 能精确说明裁剪了几组 tool pair、估算减少了多少 token。
9. 不再存在“无条件删除全部历史 role=tool”的路径。
10. 不再存在“无条件 strip 全部历史 assistant.tool_calls”的路径。

## 实施顺序建议

### P0：冻结语义

先加测试锁定当前期望：

- 默认不裁剪；
- 超预算才裁；
- 裁剪必须成对；
- preview/send 口径一致。

### P1：抽出 owner

新增或明确 `ProviderVisibleHistoryPolicy` / `AgentRunModelInputHistoryPolicy`。

先让它只做：

- pair 识别；
- diagnostics；
- final normalize；
- 不裁剪。

### P2：迁移当前无条件清洗逻辑

删除或禁用当前 `sanitizeHistoricalToolProtocol` 的无条件规则。

将其能保留的 provider 合法化能力迁移到新 owner 的 final normalize 阶段。

### P3：实现 per-result truncation

为单条 tool result 设置稳定上限。截断只影响正文，不影响 pair 结构。

### P4：实现 over-budget pair pruning

只在 safe budget 被突破时启用，从最老 completed pair 开始裁，直到回到预算内。

### P5：接入 UI diagnostics

context window indicator 展示多口径，避免再次出现“看起来只有 1.1K”的误导。

## 偏移防线

后续实现 review 时，任何改动只要出现以下迹象，都应判定为偏移：

- 把本方案说成 context compaction。
- 未超预算就清历史 tool。
- 只删 `tool` result，不删对应 `tool_call`。
- 只删 `tool_call`，不删对应 `tool` result。
- preview 和真实发送走不同逻辑。
- 用 UI 文案掩盖语义裁剪。
- 把历史 tool 转成每轮动态生成的 summary/ledger。
- 裁剪后没有 diagnostics。
- 为了修 provider 400 牺牲 agent 对历史执行事实的感知。

最小正确心智模型：

```text
默认保留。
单条太大才截正文。
整体太大才裁历史。
裁历史必须裁完整 pair。
发送前必须 normalize。
所有变化必须可解释。
```

