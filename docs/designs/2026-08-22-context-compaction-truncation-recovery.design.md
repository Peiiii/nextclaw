# 上下文压缩截断摘要恢复设计

## 结论

采用“重要性递减摘要 + 分级完整性校验 + 单调缩小输入的有限重试”作为唯一主链路。

`finishReason=length` 只说明 provider 因输出边界停止，不再直接决定成功或失败。摘要的必需前缀完整时，丢弃未闭合的低优先级尾部并提交降级 checkpoint；必需前缀不完整时，最多执行三次总调用，每次确定性缩小压缩输入。三次语义生成均失败后，不再调用模型，而是确定性保留受预算约束的近期原文、丢弃旧历史并提交降级 checkpoint，使原请求仍有继续执行的出口。

本设计取代此前“标题和 `Continuation Contract` 两个字符串存在即可接受”的局部合同。该判断不足以证明核心内容完整，也不能解决重复相同输入导致的会话卡死。

## 可观察问题与范围

当前实现同时存在三类缺口：

1. `length` 在内容校验前被升级为整次 agent run 失败；
2. 摘要目标、provider 输出上限和最终安装上限彼此分离；
3. 压缩失败不改变输入或持久状态，后续消息会重复同一失败。

这不是单个 `if` 的实现偏差，而是覆盖摘要协议、预算、重试和持久恢复的能力面缺失。范围限定为 NCP 主链路的上下文压缩；不新增 legacy 压缩路径，不承诺任意 provider 故障都能静默成功。

## 候选与取舍

### 候选 A：任何截断都拒绝

完整性最保守，但一次可用的前缀摘要会导致整次运行失败；若没有输入变化，重试没有意义。维持现状不可接受。

### 候选 B：任何非空截断都接受

接近 OpenCode 的可用性取向，运行不易被阻断，但可能把缺少当前目标、约束或下一步的半成品永久安装，无法证明续跑正确性。不采用。

### 候选 C：优先级前缀 + 分级校验 + 单调有限重试

必需信息先输出并用完成标记闭合；低优先级信息后置并按完整节提交。截断发生在必需前缀之后时可接受，发生在此前则缩小输入重试。它同时保留完整性、可用性和有界成本，作为选定方案。

## 摘要协议

摘要必须按重要性递减输出，禁止把必需信息放在可选尾部：

```md
# Compressed Working Context

## Active Request
...

## Current Work State
...

## Safety and User Constraints
...

## Continuation Contract
...

<!-- nextclaw-essential-context-complete -->

## Critical Technical Context
...
<!-- nextclaw-section-complete:critical-technical-context -->

## Evidence and Verification
...
<!-- nextclaw-section-complete:evidence-and-verification -->

## Recent High-Fidelity Context
...
<!-- nextclaw-section-complete:recent-high-fidelity-context -->

## Older Relevant Context
...
<!-- nextclaw-section-complete:older-relevant-context -->
```

前四节是必需前缀：

- `Active Request` 保存最新用户意图和仍有效的原始目标；
- `Current Work State` 保存已完成、进行中、阻塞和未提交修改；
- `Safety and User Constraints` 保存用户约束、权限边界和不可违反的规则；
- `Continuation Contract` 给出下一响应必须记住的事实和立即下一步。

必需节必须按顺序出现、正文非空，并由唯一 essential 完成标记闭合。可选节只在自己的完成标记存在时安装；最后一个未闭合节整体丢弃，不能因为其中出现若干有效文本就猜测它已完整。

## 响应分类与安装合同

| Provider 结果 | 必需前缀 | 可选节 | 行为 |
|---|---|---|---|
| `stop` 等自然完成 | 完整 | 任意 | 安装必需前缀及所有已闭合可选节 |
| `length` / `max_tokens` | 完整 | 尾部未闭合 | 丢弃未闭合尾部，安装降级 checkpoint |
| 任意 finish reason | 缺节、乱序、空正文或缺 essential 标记 | 任意 | 不安装，进入下一次缩小输入的尝试 |
| 空响应 | 不适用 | 不适用 | 计入语义调用，缩小输入后有限重试 |
| provider error | 不适用 | 不适用 | 不安装；adapter 自身重试后仍失败则立即终止，不浪费三次语义预算 |
| 用户取消 | 不适用 | 不适用 | 立即终止，不再重试或安装降级 checkpoint |

安装还必须满足：

- 安装后的 checkpoint 不超过动态可安装预算；
- checkpoint 估算 token 必须小于它替代的历史片段；
- 当前用户输入、未闭合 tool-call/result 对和受保护的近期原文不能被摘要提交覆盖；
- 原 journal 保持可回放，降级安装不等于物理删除历史。

`finishReason` 只作为分类和诊断信号；结构完整性和实际缩减才是提交条件。

## 预算合同

预算只保留一条推导链：

1. `installableSummaryTokens`：由模型上下文减去固定输入、受保护近期原文和下一次正常输出 reserve 得到；
2. `targetSummaryTokens`：不超过安装预算的产品目标；
3. `providerOutputTokens`：由目标加小幅受控余量得到，并受 provider/model 能力上限约束；
4. `summaryInputTokens + providerOutputTokens <= summarizationModelContextTokens`。

`targetSummaryTokens` 必须在生成后硬校验，不能只写进 prompt。provider 的默认 thinking/推理 token 语义必须由对应 adapter 显式解析；调用方要求 `thinkingLevel=off` 时，要么真实发送受支持的关闭参数，要么明确记录不支持，不能假装已经关闭。

本设计不冻结 4k、8k 的最终常量。实现阶段应保留当前产品目标作为默认值，但 provider 输出余量必须由目标推导，不能继续使用与目标脱离的全局 8k 上限。

## 有限重试合同

“最多三次”定义为三次 provider 总调用，而不是首次调用加三次重试。

### 第一次：正常覆盖

使用正常 compactable range、已有 checkpoint、受保护锚点和近期原文。要求输出完整优先级协议。

### 第二次：删除最旧的非保护输入

只缩小摘要生成请求，不修改 journal。删除最旧的非保护历史，保留：

- 已有 checkpoint；
- 最新有效用户意图；
- 当前工作状态及最近 tool/edit/test 证据；
- 用户约束和未解决 blocker；
- 完整的近期交互边界。

### 第三次：essential-only 输入

只提供已有 checkpoint、受保护锚点和最小近期上下文，并要求优先完成四个必需节。可选节可以全部省略。

每次尝试的请求指纹必须变化，且摘要输入 token 单调减少。禁止以相同 model、prompt、输入和输出预算原样重试；那只是重复消费 token。

网络瞬断等 transport retry 归 provider 自身短重试，不占用语义压缩的三次调用计数；但 provider retry 也必须有独立上限。鉴权、配置和 adapter 终态错误不能当作“摘要内容不完整”重复三次。

### 三次后的确定性熔断

若三次响应仍为空、结构不完整或 essential 前缀无法安装，则不进行第四次模型调用。运行时用第三阶段保留的 system/service 锚点和最近消息构造一个 essential-only checkpoint：原文片段按预算引用，明确标记旧历史已丢弃，不生成未经来源支持的自然语言事实。该 checkpoint 记为 `deterministic-recent-context` 且 `degraded=true`。

这个熔断相当于 Codex 式“丢弃最旧历史后继续”，但通过 checkpoint 走同一提交链路；它不伪装成高质量模型摘要，也不物理删除 journal。

## “状态真正缩小后才重试”的含义

它只约束原用户请求的重放，不阻止上面的摘要内部重试。

- 摘要内部重试：journal 尚未变化，但下一次摘要请求的输入必须更小，因此允许继续；
- 原用户请求重放：只有 checkpoint 已提交，或确定性 tool-result pruning 已落地，使 model surface 的 generation/version 前进且估算 token 下降，才允许重放一次；
- 如果压缩失败且 surface 没有变化，禁止重放原用户请求，因为它必然再次命中同一预算错误。

当前 NCP 主链路在 preflight 后继续同一次 run，并没有独立的 overflow replay 循环，因此本次不新增第二套计数器。未来若加入自动 replay，必须使用独立计数器并遵守上述 durable-progress 门槛。

## 状态与生命周期

| 场景 | 状态变化 | 后续行为 |
|---|---|---|
| 普通完整摘要 | `compressing -> compressed` | 从新 checkpoint 继续原请求 |
| 可接受截断 | `compressing -> compressed(degraded)` | 记录丢弃节、finish reason 和 usage 后继续 |
| 一次不可接受截断 | 保持 `compressing` 尝试上下文 | 使用更小输入进入下一 attempt |
| 三次语义生成均失败 | `compressing -> compressed(degraded)` | 安装确定性近期原文 checkpoint，不做第四次模型调用 |
| provider 终态错误 | `compressing -> failed` | 保留旧 checkpoint/journal；主 provider 不可用时本次 run 明确失败 |
| 用户取消 | `compressing -> cancelled` | 不进行后续尝试或原请求重放 |
| 进程中断/刷新 | journal 恢复 orphaned `compressing` marker | 关闭为 `cancelled`；不把半次调用误认成已完成 checkpoint |
| 旧数据 | 无 attempt 元数据 | 按一次新的三阶段压缩开始，不迁移历史正文 |

成功 checkpoint 的 `summaryDiagnostics` 记录 attempt 数、输入/目标/输出预算、finish reason、累计 provider usage、原始/安装摘要 token、是否降级以及采用的是 provider summary 还是 deterministic recovery。终态 provider error 保留调用序号和原始 cause，不伪造 usage。

## Owner 与边界

- kernel 的 `ContextCompactionPreflightService` 是压缩提交主链路 owner；
- kernel 的 `ContextCompactionSummaryGenerationService` 拥有三次语义尝试、provider 结果解释和确定性熔断；
- core 的 `ContextCompactionService` 只提供预算、compactable range 和单调缩小输入的纯计算，不持有运行状态；
- kernel manager 只提交 `compressing/compressed/failed/cancelled` 事件与 checkpoint；降级是 `compressed` checkpoint 的诊断属性，不复制校验和重试策略；
- provider adapter 拥有模型能力、thinking 参数和 usage/finish reason 的准确归一化。

禁止新增第二套 recovery manager、按错误字符串猜测 provider、或在下一条用户消息上隐式重启相同失败请求。此前的“`length` 且有两个标题就接受”路径应由本协议校验器替代，不作为兼容分支保留。

## 最小验证标准

- `length` 截断发生在 essential 标记之后：只安装已闭合节并继续原请求；
- `length` 截断发生在 essential 标记之前：输入按三阶段严格缩小，最多三次调用；
- 三次请求指纹不同且输入 token 单调下降；
- 三次语义失败后安装确定性近期原文 checkpoint，不发生第四次模型调用或同一 run 的压缩死循环；
- 成功 checkpoint 小于被替代历史且满足最终 model input budget；
- thinking 关闭能力、`completion_tokens` 和 `reasoning_tokens` 可观察；
- checkpoint 提交后原请求沿既有 preflight 主链路继续；provider 终态错误不触发同输入自动重放；
- 取消、中断恢复、已有 checkpoint 和无 checkpoint 两类会话均有定向测试；
- TypeScript 检查及 diff-only maintainability 检查通过。

## 非目标

- 不保证 provider 永不失败；
- 不接受缺少必需前缀的非空摘要；
- 不物理删除 journal 来伪装压缩成功；
- 不在本设计阶段冻结所有模型的统一 token 常量；
- 不修改 legacy chat 压缩路径。
