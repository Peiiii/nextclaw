---
title: "让上下文压缩不再卡死会话：NextClaw 的三层恢复机制"
description: "从 finishReason=length 到可验证前缀、有限重试与零模型调用熔断：一次长会话连续性修复。"
releaseBlogTarget: next-stable
releaseBlogChangeset: context-compaction-truncation
releaseBlogState: draft
---

# 让上下文压缩不再卡死会话：NextClaw 的三层恢复机制

一个运行了很久的 Agent 会话，最不应该发生的事，是用户发出下一条消息后，系统把全部时间花在重复失败的上下文压缩上。

NextClaw 的一次真实故障正是这样：会话历史已经很大，压缩摘要输出触及 8,000 token 上限，provider 返回 `finishReason=length`。旧链路没有查看已经生成的内容是否可用，而是直接让整个 run 失败。checkpoint 没有变化，下一条用户消息又触发完全相同的压缩，最终形成稳定死循环。[GitHub #27](https://github.com/Peiiii/nextclaw/issues/27) 记录了这条完整链路。

下一稳定版会把这条路径改成三层恢复：先判断内容是否足以安全续跑，再用更小输入有限重试，最后用不消耗模型 token 的近期原文 checkpoint 熔断。目标不是让 provider “永不报错”，而是让摘要输出边界不再轻易变成会话终点。

## 当前结果

| 场景 | 过去 | 新行为 |
| --- | --- | --- |
| 摘要自然完成 | 安装 checkpoint | 安装完整 checkpoint |
| `length` 发生在必需信息之后 | 整次 run 失败 | 丢弃未完成的低优先级尾部，继续会话 |
| `length` 发生在必需信息之前 | 整次 run 失败 | 最多三次总调用，每次严格缩小摘要输入 |
| 三次摘要都不合格 | 会话仍可能卡住 | 不做第四次调用，保留近期原文并丢弃旧历史 |
| 鉴权、配置或 provider 终态错误 | 失败 | 仍明确失败，不伪装成摘要问题重复三次 |

这意味着，用户在一个已经积累大量工具调用、代码修改和讨论记录的任务里继续发送消息时，NextClaw 可以在保留可用连续性的同时，把恢复成本限制在明确上限内。

## `length` 不是“内容一定不可用”

`finishReason=length` 只表示生成在输出边界停止。它不能单独回答两个更重要的问题：

1. 当前输出是否已经包含继续任务所需的核心信息？
2. 截断丢掉的是当前目标，还是较旧、较低优先级的背景？

新的压缩协议按重要性从高到低输出：

```md
# Compressed Working Context

## Active Request
## Current Work State
## Safety and User Constraints
## Continuation Contract
<!-- nextclaw-essential-context-complete -->

## Critical Technical Context
<!-- nextclaw-section-complete:critical-technical-context -->

## Evidence and Verification
<!-- nextclaw-section-complete:evidence-and-verification -->
```

前四节必须按顺序出现、正文非空，完成标记必须位于 `Continuation Contract` 末尾。可选节也必须用自己的标记闭合。这样，运行时无需猜测一段半成品“看起来是否差不多完整”：

- essential 标记已经闭合时，可以安装必需前缀和所有闭合的可选节；
- 标记之前被截断时，不能安装这份摘要；
- 标记之后的可选尾部被截断时，整节丢弃，不把半节内容永久写入 checkpoint。

完成标记不是格式装饰，而是模型输出与运行时之间的提交边界。

## 三次调用，每次都必须更小

对不完整摘要原样重试，通常只会再次付费得到同一个结果。恢复调用因此有两个硬条件：总数最多三次，输入 token 必须单调下降。

| 调用 | 输入范围 | 输出要求 |
| --- | --- | --- |
| 第一次 | 正常可压缩历史 | 完整优先级协议 |
| 第二次 | 删除最旧的非保护历史，保留近期任务与约束 | 优先完成 essential 前缀 |
| 第三次 | system/service 锚点与最小近期上下文 | 只输出四个 essential 节 |

运行时会在每次调用前重新估算输入。如果下一次请求没有真实变小，就不会为了凑满次数再次调用 provider。

网络、鉴权和配置错误走另一条路径。provider adapter 完成自己的有限 transport retry 后，终态错误立即返回；三次语义预算只用于“模型返回了内容，但内容不足以安全安装”的情况。

## 三次之后：丢旧历史，但不要吞掉新消息

三次坏摘要之后继续请求第四次模型，不会增加确定性，只会增加成本。完全保留旧 checkpoint 又会让下一条消息重新撞上同一个上下文压力。

新的最终出口不再调用模型。NextClaw 从第三阶段仍保留的 system/service 锚点与最近消息中，按安装预算生成一个 deterministic checkpoint：

- 近期内容以引用形式保留原文片段，不生成没有来源支持的新事实；
- 明确把更旧的历史视为未知；
- 当前用户消息仍作为 checkpoint 之后的原始消息保留；
- checkpoint 标记为 `degraded` 和 `deterministic-recent-context`，不会冒充高质量模型摘要。

这是一次有边界的信息损失，但它比“反复压缩失败，用户消息永远得不到处理”更可恢复。原始 journal 仍然保留，降级 checkpoint 只改变下一次模型看到的输入表面。

## 从三个开源 Agent 实现中学到什么

这次排查对照了 2026-08-22 获取的三个开源实现，固定到具体 commit，避免把持续变化的项目写成永久结论。

| 实现 | 可核查行为 | 带来的启发 |
| --- | --- | --- |
| [OpenAI Codex `4f39251`](https://github.com/openai/codex/blob/4f39251a010a8bd7d692d25fb33832ff06f1635a/codex-rs/core/src/compact.rs) | 压缩请求发生 context overflow 时，从最旧 history item 开始删除并继续，同时保留近期消息 | 恢复必须让下一次输入真实变小 |
| [OpenCode `e00890c`](https://github.com/anomalyco/opencode/blob/e00890c67261a435cee6409366a68999a93393fd/packages/opencode/src/session/compaction.ts) | 为近期 turn 设置预算，并先清理较旧的大型工具输出；overflow 路径会缩短参与压缩的历史 | 原文保留与摘要不是二选一，近期 tail 可以单独保护 |
| [DeepSeek Harness `b150a55`](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/packages/compaction/compaction-basic/README.md) | 默认按 routed context 的 `0.8` 触发、保留 `0.16`，只在 surface replacement generation 前进后授权 overflow retry | “重试”应建立在 durable progress 上，而不是建立在希望上 |

NextClaw 没有照搬其中某一套。新的主链路同时采用了三种思想：保护近期原文、证明输入已经缩小、在模型摘要仍不可用时确定性丢弃最旧历史。额外加入的 priority-prefix 协议，则用于区分“可接受截断”和“缺少核心任务信息的半成品”。

## 预算不再是互相无关的 4K 和 8K

旧实现里，4,000 token 是 prompt 中的目标，8,000 token 是独立写死的 provider 输出上限。模型可以花满 8,000 token，运行时却没有在安装前执行同一条硬预算合同。

现在预算从最终可安装空间向前推导：

1. 先算 checkpoint 在下一次正常请求里最多可以占多少 token；
2. 产品摘要目标不超过 4,000 token，也不超过实际安装空间；
3. provider 输出上限等于目标加最多 10% 的受控余量，余量最多 512 token；
4. 生成后再次硬校验，安装摘要不能超过目标和最终 model input budget。

当目标是 4,000 token 时，provider 上限通常是 4,400，而不是固定 8,000。余量给模型完成当前结构，但不会把目标翻倍。

DeepSeek provider 也会在压缩调用请求 `thinkingLevel=off` 时发送明确的 `thinking: { type: "disabled" }`。这样，摘要预算用于可见 checkpoint，而不是在调用方以为已经关闭 thinking 时仍被隐藏推理消耗。

## 验证

仓库的上下文压缩验证命令现已包含新的摘要恢复测试。当前证据包括：

- 152 项跨 core、kernel、runtime、server 与 UI 的上下文压缩链路测试；
- 24 项 provider 请求与路由测试；
- 4 项 runtime provider 注册表 Node test；
- core、kernel、runtime 三个包的 TypeScript 检查与构建；
- diff-only 可维护性检查为 0 error。

定向场景覆盖 essential 标记前后截断、可选尾部丢弃、三次调用上限、输入 token 单调下降、第三次 essential-only、三次坏摘要后的 deterministic recovery、provider 错误不做语义重试、取消、已有 checkpoint、mid-run continuation 和最终 provider input budget。

## 能力边界

- provider 鉴权、配置或网络终态错误仍会失败；如果主 provider 不可用，压缩恢复无法让后续正常回答凭空成功。
- deterministic recovery 会主动丢弃旧历史。它保证会话有继续出口，不保证旧上下文零损失。
- token 数来自运行时估算，不是每个 provider 的精确 tokenizer 结果；最终请求仍由模型上下文上限约束。
- 以上结果已经通过本地实现、测试与构建验证，但草稿绑定的是下一稳定版，不能解读为当前已发布版本的行为。

## 下一步

下一步会观察真实长会话里的 `summaryDiagnostics`：调用次数、finish reason、provider usage、原始与安装摘要 token，以及 deterministic recovery 的触发率。

如果 priority-prefix 在不同模型上稳定，后续可以继续减少提示词成本，并按 provider 能力调整摘要模型与预算。真正的目标不是让压缩本身更复杂，而是让长任务在上下文压力下仍然可预测地继续。
