# Agent 持续观察与 Reactive Runtime 思考

> 本思考已升级为 [Extension Observation：通用 Agent 观察能力设计](../designs/2026-08-22-extension-observation.design.md)。最新设计以 Extension 提供的 Context read 与 Event subscribe 为两条独立主链路，并由 Kernel Observation owner 负责关系、可靠投递与恢复。本文件保留问题来源、方案空间和长期推演；后续实现判断以当前 design 为准。

## 背景

这次思考从大模型 Prompt Cache 的前缀复用问题开始：如果每轮在会话历史末尾附加一段变化的世界状态，前面的稳定历史能否继续命中缓存。进一步讨论后，问题逐渐从“如何放置动态上下文”扩展为一个更长期的产品与架构命题：NextClaw 的 Agent 是否应该具备主动建立持续观察关系的能力，以及这种能力如何支撑未来不局限于单次任务、而是长期承担职责的 Agent。

当前工具调用更接近一次性函数：Agent 在需要时主动调用，得到一个结果，本次调用随即结束。设想中的 `observe` 则建立一条跨轮次持续存在的关系：Agent 选择一个世界连接器或观察源，后续运行自动获得其最新状态；必要时，重要变化还可以触发新的 Agent Run。Agent 也可以取消观察。

随着讨论深入，`observe` 又自然延伸出多 Agent 过滤与 Reactive/RxJS 类比：一个观察 Agent 可以消费高噪音原始事件，经过语义判断后发布一个新的派生观察源，再由更高层职责 Agent 订阅。这使观察不再只是“附加一段上下文”，而可能成为 NextClaw 未来持续感知、分层注意力和自治运行的基础设施。

这项方向直接对应 [NextClaw 产品愿景](../VISION.md) 中的自感知、自治、统一入口、能力编排和生态扩展：长期 Agent 若要自己发现问题、形成任务并闭合结果，就不能只拥有执行世界的“手”，还需要持续感知世界的“眼睛和耳朵”。

## 核心判断

### 1. Observe 不是普通工具的语法糖

普通工具调用可以抽象为：

```ts
(input: I) => Promise<O>;
```

它表达一次输入、一次执行和一个结果。Observe 更接近：

```ts
ObservationSource<T> -> Subscription<T>
```

它表达一条具有 owner、生命周期、权限、预算和取消语义的持续关系。工具调用解决“现在帮我读取一次”，Observe 解决“从现在开始持续把这个对象纳入我的关注范围”。要求模型每轮记得重新调用工具，无法可靠替代一等观察关系。

### 2. 持续感知是职责型 Agent 的必要条件，但不是充分条件

任务型 Agent 的基本循环是“收到任务 -> 思考 -> 调工具 -> 完成 -> 停止”。职责型 Agent 则需要“理解长期职责 -> 持续感知 -> 识别变化或问题 -> 形成任务 -> 行动 -> 验证 -> 更新认识 -> 继续等待或行动”。

没有持续感知，所谓“自己找问题、自己找事做”只能退化为昂贵的盲目轮询，或者继续等待用户告诉它发生了什么。但 Observe 本身也不能独立产生职责型 Agent；完整系统还需要长期职责、世界模型、注意力策略、任务发现、行动边界、结果验证、预算治理、记忆和学习。

### 3. LLM 不应承担持续监控循环

世界连接器和 Kernel 应负责采集、持久化、去重、聚合、鲜度判断与低成本变化检测。LLM 只在需要语义判断、决策或行动时运行。未来 Agent 更适合“平时休眠，由事件、心跳、用户输入或既有任务唤醒”，而不是持续不断地空转思考。

这与人的感知系统类似：感官持续接收信息，但不是每个像素和声音都进入高层意识。Agent 可以持续观察很多对象，但每次推理只应获得与当前目标相关的紧凑投影。

### 4. Observation Source 可以是原始来源，也可以是派生来源

观察源不应限定为外部 API 或物理连接器。规则、程序、模型和 Agent 都可以消费上游观察源，并发布新的派生观察源：

```text
ObservationSource
├── ConnectorSource
├── RuleDerivedSource
├── ModelDerivedSource
└── AgentDerivedSource
```

因此，高层 Agent 不必直接订阅生产日志、指标、部署事件和用户反馈，而可以订阅一个由事故观察 Agent 产生的 `meaningful-incidents` 派生源。观察 Agent 在这里不是临时劳动力，而是长期存在的观察员、分析员、审核员或异常检测员。

### 5. Agent 产生的观察结果必须先进入 Kernel，而不是直接修改另一个 Agent 的 Prompt

推荐主链路是：

```text
观察 Agent
-> 发布结构化事件或快照
-> Kernel 写入 Observation Store
-> 去重、权限、预算、鲜度和因果链检查
-> 消费方的 Observation Binding 读取
-> 本轮附加、主动唤醒或形成候选任务
```

不应允许子 Agent 直接向父 Agent Prompt 任意插入文本，否则难以避免 Prompt injection、上下文污染、循环唤醒、来源丢失和预算失控。

### 6. 完整观察数据应位于 LLM 上下文之外

未来一个职责 Agent 可能观察几十乃至几百个对象。把所有完整状态塞进每轮 Prompt 不可扩展，也会破坏缓存。观察系统至少应分成三层：

```text
Observation Store
保存完整快照、事件、版本、游标和来源证据

Attention / Projection
根据职责、本轮目标、变化和预算选择相关信息

Ephemeral Context
只把本轮所需的紧凑最新视图附加给模型
```

## Reactive / RxJS 对应

这项能力与 Reactive/RxJS 不是名字相似，而是计算模型高度同构：

| Agent 系统概念      | Reactive/RxJS 概念                       |
| ------------------- | ---------------------------------------- |
| 世界连接器          | Observable Source                        |
| 外部状态变化        | `next(value)`                            |
| 来源故障            | `error(error)`                           |
| 来源结束            | `complete()`                             |
| Agent               | Observer                                 |
| `observe(source)`   | `subscribe()`                            |
| Observation Binding | 面向上下文投影的 Subscription            |
| Trigger Rule        | 面向 Agent ingress 的副作用 Subscription |
| `unobserve()`       | `unsubscribe()`                          |
| 最新状态读取        | `BehaviorSubject` / `shareReplay(1)`     |
| 过滤噪音            | `filter()`                               |
| 数据转换            | `map()`                                  |
| 去重                | `distinctUntilChanged()`                 |
| 高频合并            | `bufferTime()`                           |
| 唤醒节流            | `throttleTime()`                         |
| 多来源组合          | `merge()` / `combineLatest()`            |
| 观察 Agent          | 自定义异步语义 Operator                  |
| 派生观察源          | `source.pipe(...)` 产生的新 Observable   |

多 Agent 过滤可以表达为一条 Observation Pipeline：

```ts
const meaningfulIncidents$ = productionSignals$.pipe(
  normalize(),
  distinctUntilChanged(),
  bufferTime("30s"),
  agentFilter({ role: "只识别可能影响真实用户的生产事故" }),
  filter((result) => result.relevant),
  shareLatest(),
);
```

一个派生源可以继续 Pipe，也可以被多个 Agent 共同订阅。这比把过滤 Agent 硬编码成某个父 Agent 的私有子节点更可组合、更适合生态扩展。私有派生源仍然有价值，但应是同一抽象下的权限和可见性配置。

不过，NextClaw 不应直接把 RxJS 对象作为跨模块或跨进程协议。RxJS 主要解决进程内响应式编程，长期 Agent Runtime 还必须处理进程重启后的恢复、远程连接器、事件持久化、游标与重放、投递与幂等、权限隔离、成本预算、因果审计、TTL、环路和事件风暴。更准确的长期方向是：

> Reactive 的组合语义 + 持久化事件流 + Agent Runtime + 权限、预算与生命周期治理。

## 状态源与事件源

虽然状态和事件都可以表示为流，但二者不应在协议上被模糊为同一种消息。

### 状态源

状态源回答“现在是什么”，类似 `BehaviorSubject` 或带 `shareReplay(1)` 的最新值：

```text
当前浏览器页面
当前部署状态
当前项目健康度
当前设备场景
```

它至少需要 `value`、`version`、`updatedAt` 和 `freshness`。典型消费方式是在 Agent Run 到来时读取最新值。

### 事件源

事件源回答“发生过什么”：

```text
收到一封新邮件
发生一次部署失败
用户提交一条反馈
文件发生一次修改
```

它至少需要 `eventId`、`cursor`、`occurredAt`、`payload` 和 `sourceRefs`，并涉及重放、确认、去重和丢失语义。只保存最新事件会丢失中间事实。

二者可以通过 Pipeline 转换：事件经 `scan/reduce` 形成当前状态，状态经 `pairwise/diff` 形成变化事件。因此，当前推荐的方向是把二者作为两种一等 Source 类型，但允许组合和相互派生。

## 消费模式

### 一次读取

```text
read(source)
```

立即读取并返回，不建立长期关系。适合偶发、廉价且只与当前任务有关的数据。

### 被动观察

```text
observe(source)
```

建立 Observation Binding，但世界变化本身不创建 Agent Run。Agent 因用户输入、已有任务或心跳运行时，系统再附加最新状态或尚未消费的重要事件。Reactive 语义接近 `agentRuns$.pipe(withLatestFrom(worldState$))`。

### 主动唤醒

```text
watch(source)
```

重要变化经过过滤、去重、聚合和节流后，可以创建 Agent Run、候选任务或主动消息。它与被动观察可以复用同一 Source，但 Sink 不同：

```text
Observation Source
├── Context Sink：下次运行时提供最新状态
├── Wake Sink：满足条件时唤醒 Agent
└── Task Sink：形成候选任务或工作项
```

被动附加和主动唤醒的产品语义应保持分离，避免一个 `observe` 参数同时隐藏长期副作用、运行成本和主动联系用户的权限。

## 分层注意力与多 Agent 过滤

不应让每一条原始事件都启动一个 Agent。推荐按成本和语义复杂度分层：

```text
L0 Connector
采集原始数据

L1 确定性处理
过滤、去重、聚合、阈值、权限检查

L2 轻量语义判断
小模型分类、相关性判断、简短摘要

L3 观察职责 Agent
跨事件关联、历史记忆和复杂判断

L4 高层职责 Agent
接收值得决策或行动的信息
```

能用确定性规则解决的，不调用模型；能用轻量分类解决的，不唤醒完整 Agent；只有需要上下文理解和判断时，才使用观察 Agent。否则多 Agent 只会把原始噪音转化成更昂贵的噪音。

派生事件必须包含结构化判断及证据，例如严重度、摘要、判断原因、置信度、来源引用、时间、去重键和版本。高层 Agent 应能够回到原始证据继续调查，而不是只能相信一句不可追溯的模型结论。

## 可能的应用场景

- 运维 Agent 持续观察服务、部署、告警和用户影响，只在形成真实事故候选时介入。
- 项目负责人 Agent 观察 Issue、PR、发布、反馈和里程碑，由专门观察 Agent 筛选高风险变更和阻塞。
- 个人助理 Agent 观察日历、重要邮件、待办和设备场景，只暴露与当前时间和职责相关的变化。
- 销售 Agent 观察客户活动，由线索观察 Agent 过滤高意向或异常流失信号。
- 研究 Agent 观察论文、新闻和数据源，由研究观察 Agent 去重、关联并发布有证据的新增发现。
- 浏览器 Agent 观察指定标签页或页面状态，而不是每次依赖主 Agent 主动重新读取。
- 长任务 Agent 观察构建、下载、数据处理、部署或其它 Agent 的进度与结果。
- 结果验证 Agent 观察行动后的真实世界状态，独立判断目标是否达成。

## 当前 NextClaw 架构证据

当前 Kernel 已有两类接近的积木：

- `ToolProvider` 为模型提供主动调用能力，注册入口位于 [`packages/nextclaw-kernel/src/contributions/tool-provider/index.ts`](../../packages/nextclaw-kernel/src/contributions/tool-provider/index.ts)。
- `ContextProvider` 在每次 Agent Run 构建上下文，聚合入口位于 [`packages/nextclaw-kernel/src/managers/context-provider.manager.ts`](../../packages/nextclaw-kernel/src/managers/context-provider.manager.ts)。

因此，近期最自然的方向看似是“`observe` 工具建立 binding，再由 Observation Context Provider 后续注入”。但当前 `ContextBlock` 只是字符串，所有 context block 会合并为一个位于会话历史之前的 system message，见 [`packages/nextclaw-kernel/src/services/agent-run-model-input-builder.service.ts`](../../packages/nextclaw-kernel/src/services/agent-run-model-input-builder.service.ts)。若把每轮变化的世界状态直接做成普通 ContextProvider，会修改 Prompt 开头，破坏稳定历史的前缀缓存。

所以这项能力若进入正式设计，需要先解决模型输入的放置语义：稳定系统上下文、稳定会话历史和本轮临时观察投影不能继续全部共用一种无结构的 `ContextBlock`。

当前 MCP Manager 只通过 adapter 暴露 MCP tools，见 [`packages/nextclaw-kernel/src/managers/mcp.manager.ts`](../../packages/nextclaw-kernel/src/managers/mcp.manager.ts)，尚未形成 MCP Resource 的读取和订阅主链路。MCP 已经提供资源订阅或更新通知原语，但 MCP 明确把资源如何进入模型上下文留给 Host 决定。因此 MCP 可以成为某类 Observation Source 的连接协议，不能替代 NextClaw 自己的 Agent 关注关系、上下文投影、唤醒、权限和预算语义。

## 方案空间

### 路线 A：继续使用工具、Cron、Webhook 和记忆拼装

优点是无需新增内核抽象，适合少量明确场景。缺点是观察原因、owner、生命周期、取消、权限、预算、鲜度、错误和用户可见性分散在多个系统中；模型记忆中的“持续关注”也不是可靠的系统状态。若 NextClaw 只做短任务 Agent，这条路线可能足够；若走向职责型 Agent，它会持续积累碎片化成本。

### 路线 B：先建设会话级被动 Observe

提供 `observe`、`list_observations` 和 `unobserve`，由 Kernel 保存有 TTL 的 Observation Binding；每次已有 Agent Run 读取最新快照，并作为临时尾部投影注入，不主动唤醒。它能最小验证“持续关注是否真正提高任务连续性”，同时避免立即承担事件风暴、主动权限和无限运行成本。

局限是它仍然依附已有运行，无法独立支撑“无人输入时自己发现问题”。此外，若 binding 只属于 chat session，就不能直接承载未来跨会话的长期职责。

### 路线 C：建设持久化 Agent Reactive Runtime

把 Source、Operator、Pipeline、Binding、Observation Store 和多类 Sink 建成一等能力，支持原始与派生来源、状态与事件、Agent 语义 Operator、被动上下文、主动唤醒和任务形成。这条路线最符合长期愿景，但同时引入持久化、交付、权限、预算、调度、环路和生态协议等系统复杂度，不适合在缺少首个强场景时一次性建设。

## 推荐倾向

推荐采用“以路线 C 为长期模型、以路线 B 为首个可验证切片”的方向：

1. 现在先冻结 Observe 是持续关注关系而非普通工具语法糖。
2. 内部抽象面向 `ObservationSource` 与 `ObservationBinding`，不绑定某一种 Connector 或 RxJS 实现。
3. 从一开始区分状态源与事件源、完整存储与上下文投影、被动附加与主动唤醒。
4. 第一阶段只实现被动观察、最新快照、TTL、显式查看与取消，不主动创建 Agent Run。
5. Observation Binding 的 owner 模型要能从 session 升级到长期职责实例，而不是把 agent-global 当作唯一长期作用域。
6. 动态观察结果必须作为稳定前缀之后的 ephemeral suffix 或等价结构传给模型，不能直接进入当前 system-context 前缀。
7. 后续按真实场景逐步增加派生 Source、变化检测、Agent Operator、主动唤醒与任务发现。

这项方向现在值得保留和继续设计，但尚不应直接进入实现计划。最有价值的近期产物是明确产品语义和首个验证场景，而不是先建设完整流处理平台。

## 需要守住的边界

- Kernel 是 binding、生命周期、权限、投递、预算与审计的 owner；模型只提出观察意图。
- Connector 负责读取或接收外部状态，不决定哪些 Agent 应被唤醒。
- 观察完整数据位于模型上下文之外，本轮只注入相关、紧凑、有鲜度标记的投影。
- 派生事件必须带来源证据、事件 ID、时间和因果信息，不只发布不可追溯的自然语言结论。
- 持久观察默认需要 TTL、暂停和显式取消；不能产生用户无法发现的永久后台成本。
- Pipeline 必须具备幂等、去重、聚合、节流、传播深度或环路保护。
- 原始外部内容与 Agent 生成内容都应视为不可信数据，不能直接获得更高指令优先级。
- 主动唤醒、主动联系用户和自主行动是不同权限层级，不因订阅数据源而自动获得。
- 一个 Agent 观察另一个 Agent 时，消费的是结构化派生 Source，不直接共享隐藏推理或任意 Prompt。

## 未决问题

1. 长期 Agent 的默认运行模型是否正式确定为“事件和心跳驱动、平时休眠”。
2. Observation Binding 的 owner 应如何建模：run、session、mission/responsibility、agent instance 是否都需要一等支持。
3. 第一阶段最能证明价值的场景是什么：浏览器状态、长任务进度、项目状态、服务健康度，还是另一个 Agent 的派生事件。
4. `observe` 与 `watch` 是否采用两个明确工具，还是一个底层 binding 配合不同 Sink，并在产品入口上拆分语义。
5. StateSource 与 EventSource 的最小公共合同、版本、游标、重放和错误语义是什么。
6. Observation Store 的持久化边界、容量、保留期与敏感数据策略是什么。
7. 怎样定义 Projection 和注意力策略，既避免每轮全量注入，又不让重要信息因模型选择而消失。
8. 如何把 ephemeral observation 投影放到模型输入尾部，同时兼容多模型、多运行时、上下文压缩和 Prompt Cache breakpoint。
9. AgentDerivedSource 是默认私有，还是默认具名且可授权复用；共享时怎样防止跨用户和跨职责数据泄露。
10. 主动唤醒的去重、背压、预算、优先级、并发和用户控制面如何定义。
11. Observation Pipeline 是否必须保持 DAG，还是允许受控反馈环，并如何记录完整因果链。
12. 如何衡量观察 Agent 的质量：漏报、误报、证据充分性、成本和实际行动收益。

## 升级条件

满足以下条件后，将本思考升级为 `docs/designs` 下的正式设计：

1. 选定一个首个用户价值明确、能够端到端验证的 Observe 场景。
2. 冻结第一阶段的范围与非目标，特别是是否排除主动唤醒和 AgentDerivedSource。
3. 确定 Observation Binding 的首个 owner、生命周期、TTL、权限和用户可见性。
4. 确定 StateSource/EventSource 的最小类型合同，以及 Connector 与 Kernel 的责任边界。
5. 确定模型输入中的 ephemeral suffix 放置和缓存策略。
6. 给出从 `observe` 工具到 Binding、Source、Store、Projection、Agent Run 的完整数据流和失败语义。
7. 定义最小验证指标，包括上下文鲜度、缓存命中影响、额外 token/延迟、取消可靠性和错误可见性。

在这些问题未冻结前，本文件保持为架构与产品思考，不作为实现合同或排期承诺。
