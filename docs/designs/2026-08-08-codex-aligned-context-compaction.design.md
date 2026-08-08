# Native Agent 上下文压缩系统设计

## 文档定位

本文是 NextClaw Native Agent 上下文压缩能力的规范设计，不是问题记录或补丁清单。预算、压缩、checkpoint、journal、继续运行、刷新恢复和 UI 展示必须共同遵守本文；局部实现与本文冲突时，以本文定义的领域模型和不变量为准。

本文只设计 Native runtime。Codex、Claude Code、Hermes 等 runtime-owned 会话继续由各自 runtime 管理上下文，NextClaw 不做外层二次压缩。

## 目标

系统必须同时满足以下用户结果：

1. 长对话和单轮长期工具执行都能在接近上下文上限时自动压缩并继续，而不是静默裁掉关键历史或无响应。
2. 压缩后模型仍能准确掌握当前任务、最近用户原话、已完成工作、未完成事项和下一步动作。
3. 压缩中的状态、完成、失败和取消在运行过程中的真实位置可见；刷新后顺序和状态不变。
4. send、continue、edit/retry 共享同一运行入口和状态 owner，不能出现后端运行而前端仍显示“继续运行”。
5. UI 展示的上下文占用、自动压缩线和 Agent 保存校验使用与最终 provider 请求相同的预算事实。
6. 任何 checkpoint 只有在完整 provider 输入面证明可安装后才能成为新事实；失败保留上一 checkpoint。
7. 同一 compaction epoch 内 provider 前缀稳定，压缩之后恢复 append-only 增长，避免无意义地破坏 prompt cache 前缀。

## 参考机制与取舍

### Codex `rust-v0.144.1`

- 新 turn 前执行 pre-turn compaction；一次 sampling 后若仍需 follow-up 且达到阈值，执行 mid-turn compaction。
- local compaction 不只保留 summary，还从最新真实用户消息向前按独立 token 预算保留原文；过滤 session prefix、AGENTS/environment 包装、旧 summary 等非真实用户输入。
- replacement history 安装后重算 token usage；mid-turn compaction 使用 continuation 继续当前任务。
- app-server 把 context compaction 作为 turn 内标准 item，具有 started/completed 生命周期。

### OpenCode `dev`

- 使用完整 model-visible request 判断压力，从 context window 中扣除输出 allowance/compaction reserve。
- 只有 compaction completed 后才安装新模型视图；失败或中断继续使用旧 history boundary。
- compaction 完成后追加 synthetic continuation，继续原 pending turn。

### NextClaw 的有意差异

- summary 继续投影为 leading system context，不复制 Codex local 的末尾 user role 排列。NextClaw 的 NCP、context provider 和多 provider bridge 已把 compressed context 定义为系统级事实。
- 用户原文保真采用 Codex local 的 20K 上限，但还受当前 Agent 实际 trigger budget 约束，小窗口不会机械预留 20K。
- 不把 OpenAI/Anthropic 的 cache-control 字段写进通用 NCP 合同；本设计保证确定性前缀，provider-specific cache capability 另行设计。
- 不复制无类型的通用网络重试。鉴权、配额、配置和瞬态网络错误必须先由 provider owner 提供类型化分类。

参考代码：

- <https://github.com/openai/codex/blob/rust-v0.144.1/codex-rs/core/src/session/turn.rs>
- <https://github.com/openai/codex/blob/rust-v0.144.1/codex-rs/core/src/compact.rs>
- <https://github.com/openai/codex/blob/rust-v0.144.1/codex-rs/core/src/compact_remote_v2.rs>
- <https://github.com/openai/codex/blob/rust-v0.144.1/codex-rs/core/src/event_mapping.rs>
- <https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/overflow.ts>
- <https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/compaction.ts>
- <https://github.com/anomalyco/opencode/blob/dev/specs/v2/session.md>

## 领域模型

### Session timeline

append-only NCP journal 是用户消息、assistant segment、工具事件、run 终态和 compaction marker 的唯一顺序事实。读取层可以物化 projection，但不能生成第二套可漂移事实，也不能回写或删除原 journal 历史。

### Run 与 assistant segment

- 一个 run 从命令被接受开始，经历 `accepted → started → terminal`。
- 一条物理 assistant message 是一个 assistant segment，拥有自己的局部 parts 坐标。
- “继续运行”通过 hidden continuation prompt 建立 `target assistant segment → next assistant segment` 的有向边。
- 多个相连 segment 可以在 UI 折叠为一个 visual assistant surface，但 segment ID、segment 起始 offset 和事件边界必须保留。

### Compaction checkpoint

checkpoint 是已经通过安装证明的 replacement history 描述，包含：

- 结构完整的 summary；
- 被覆盖的 session/message 边界；
- 独立保留的真实用户消息选择结果；
- 边界用户消息的显式截断文本（如有）；
- 压缩时固定保留的 raw tail message IDs；
- phase、trigger reason、预算证明和创建时间。

checkpoint 不复制完整原始消息正文。完整消息仍由 session timeline 拥有；checkpoint 只保存选择结果和不可从原文恢复的边界截断结果。

### Compaction epoch

一个 checkpoint 成功安装后，到下一 checkpoint 成功替换前，称为一个 compaction epoch：

```text
stable prefix
  = compressed summary
  + preserved raw user messages
  + retained raw tail
  + mid-run synthetic continuation（仅模型视图）

dynamic suffix
  = checkpoint 后新增或继续增长的 user / assistant / tool 内容
```

同一 epoch 内，checkpoint、Agent、静态 context blocks、工具定义和 provider 配置不变时，stable prefix 的内容、角色和顺序必须深度相等；新内容只能 append 到 dynamic suffix。

### Compaction marker

marker 是压缩动作的可观察生命周期，不等于 checkpoint。新数据采用明确的 placement 合同：

```ts
type ContextCompactionPlacement =
  | { kind: "session-boundary" }
  | {
      kind: "assistant-part";
      assistantMessageId: string;
      coveredPartCount: number;
      cause: "mid-run" | "continuation-pre-run";
    };

type ContextCompactionMarker = {
  id: string;
  phase: "pre-run" | "mid-run" | "manual";
  state: "compressing" | "compressed" | "failed" | "cancelled";
  placement: ContextCompactionPlacement;
  trigger: "automatic" | "manual";
  checkpoint?: ContextCompactionCheckpoint; // 仅 compressed
  error?: TypedCompactionError;              // 仅 failed
};
```

`compressing → compressed / failed / cancelled` 使用同一个 marker ID。UI 不从 phase、相邻消息或文案猜 placement。

现有 checkpoint v1 的 wire 兼容编码为：`session-boundary` 不写 assistant anchor；`assistant-part` 写入 `continuationMessageId + continuationMessageCoveredPartCount`。字段名虽然源自最早的 mid-run 实现，但在 v1 中规范语义统一为“展示所归属的物理 assistant segment 与局部 part 边界”，因此 continuation pre-run 也必须写入。UI 读取后先规范化成上面的 placement union，后续若升级持久协议，再把 placement 变成显式对象；业务和组件不得继续依赖旧字段名推断 phase。

## 不可退化不变量

1. **单一预算事实：** 保存校验、压缩触发、summary 安装、最终 provider build 和 UI snapshot 使用同一 estimator、同一工具序列化和同一 reserve resolver。
2. **单一 checkpoint 安装事实：** 只有 append 到 journal 的 `compressed` marker 携带的 checkpoint 是持久事实；session metadata 只是该事件的查询投影。
3. **双层保真：** replacement history 必须同时包含独立自洽的 summary 和 token-bounded 真实用户原文。
4. **稳定前缀：** checkpoint 安装后到下次压缩前，不重新选择、移动或重复投影 preserved users 和 retained tail。
5. **归属守恒：** 每个 marker 恰好展示一次，要么属于 session boundary，要么属于 assistant surface。
6. **顺序守恒：** continuation 折叠只能减少视觉卡片数量，不能改变物理 parts 与 marker 的因果顺序。
7. **流式/刷新同构：** 对同一 journal 前缀，实时 projection 与冷重载 projection 在 canonical messages、parts、工具状态、marker ID、状态和边界上等价。
8. **终态唯一：** run、assistant、未完成工具、marker 和 composer 状态由同一终态事件结算，不能各自猜测。
9. **失败不污染：** summary、安装证明或持久化任一步失败，都保留上一 checkpoint；不得先宣称 compressed 再让下游报错。
10. **新数据不走兼容猜测：** 新 marker 必须带合法 placement，新 checkpoint 必须带显式覆盖边界；legacy fallback 只处理旧数据。

## Owner 与职责

| Owner | 唯一职责 | 明确不负责 |
| --- | --- | --- |
| `DefaultNcpAgentRuntime` | 判断 pre-run、mid-run follow-up 时机 | 预算算法、summary、持久化、UI placement |
| `AgentRunContextCompactionManager` | 一次压缩动作的 begin/finish/cancel 编排 | provider message 构造、UI 渲染 |
| `ContextCompactionPreflightService` | 完整输入预算、summary 动态预算、checkpoint 候选与安装证明 | 修改原 journal 历史 |
| `ContextCompactionService` | covered history、preserved users、边界截断、replacement history 计划 | NCP 身份判断、持久化 |
| `AgentRunModelInputBuilder` | 构造最终 provider 请求和 stable-prefix 边界 | 产生 checkpoint、选择历史重要性 |
| `InputBudgetPruner` | 最终硬安全闸 | 替代语义压缩、改写 checkpoint 意义 |
| `AgentContextWindowManager` | 装配真实固定输入、求解最低窗口、产生完整预算 snapshot | 使用 history-only 近似值 |
| journal ingestion | append marker/run 事实并更新查询投影 | UI 特判、读取时修数据 |
| message projection store | 从 journal 物化 canonical cumulative messages | 按 UI 需求拼 delta 或修顺序 |
| conversation state manager | 接受 run handle、消费事件、收敛 live 状态 | 从页面按钮各自维护运行态 |
| chat timeline projector | segment graph、surface、marker placement 的唯一展示投影 | 产生业务事实、修 journal |
| React component | 渲染 projector 输出 | 推断 marker 归属、排序或终态 |

## 预算系统

### 完整请求预算面

```text
fixed input
  = system instructions
  + context provider blocks
  + provider-normalized full tool schemas
  + message/protocol overhead

used input
  = fixed input
  + active replacement history
  + dynamic suffix

output reserve R
  = configured exact reserve
    ?? provider/model capability reserve（未来可用时）
    ?? min(floor(context window C × 20%), 10K)

trigger T = C - R
compact when used input >= T
```

35K 窗口默认 reserve 7K、trigger 28K；200K 或 1M 窗口默认 reserve 都封顶 10K。百分比不是无上限线性浪费。

工具 schema 必须按真正发给 provider 的 wire 形状估算。Skill 清单只是 system context 的一个组成部分，不能和全量工具 schema 混为同一个数字；UI 分项必须来自 owner snapshot，不能由前端再估算。

### Agent 保存阶段的动态最低窗口

`contextTokens` 不是静态 `min=1000` 表单字段。对候选窗口 `C`，kernel 求解最小满足值：

```text
C >= fixedInput(agent, provider, fullTools)
   + minimumDynamicInput
   + reserve(C)
```

- reserve 必须对候选 `C` 重新求值，不能沿用当前配置的 reserve。
- create、update、默认值保存都经过同一 kernel owner；server/controller 不维护常量副本。
- 输入 100 或 3000 不被前后端静默夹值。不可用时返回明确 400，包含 Agent ID、需要的最小窗口、收到的窗口和主要固定输入分项，原配置不落盘。
- 保存阶段只证明空会话有最小动态输入空间；运行时最终预算闸仍处理未来超长单条输入。

### Context window snapshot 与 UI

snapshot 是原子事实：

```text
agentId
fixedInputTokens
dynamicConversationTokens
usedContextTokens
reservedContextTokens
triggerContextTokens
totalContextTokens
availableBeforeCompaction
completeInputBudget: true
```

- `fixed + dynamic == used`，`trigger == total - reserve`。
- Native snapshot 若没有完整 context blocks 或 full tools，必须标记 incomplete 并不展示；禁止显示“系统与工具 0”。
- 主圆环表达 `used / trigger` 的压缩压力；详情先放 used、trigger、distance，再分组展示 fixed、conversation、reserve、total。
- preflight、session API、realtime event 和 UI 消费同一 snapshot；UI 不从消息长度、历史 usage 或 Agent 默认配置重算。

## 压缩算法

### 触发点

- `pre-run`：命令被接受后、`run.started` 前评估。失败不宣称 run 已开始。
- `mid-run`：一次 sampling 完成且工具结果/追加输入要求继续 follow-up 时，在下一次 provider request 前评估。
- 不在每个 delta 上评估，不做轮询，不新增第二个 mid-run manager。

### Covered history 与真实用户身份

- pre-run 和 mid-run 都只压缩当前有效 model projection，不重新扫描已经被上一 epoch 淘汰的旧历史。
- 真实用户消息必须同时满足：存在于原始 session timeline、`role=user`、不是 hidden continuation、context wrapper、service marker 或 synthetic message。
- 下一次滚动压缩只能从上一 checkpoint 的 replacement history 与 checkpoint 后增量中选择，不得“复活”更早用户消息。

### 双层 replacement history

1. summary 独立描述当前任务、约束、关键事实、完成工作、失败、未完成事项和 continuation contract。
2. preserved users 从最新真实用户消息向前按 token 选择，预算为：

```text
min(20K, trigger - fixed - summary - retainedTail - protocol - minimumDynamicInput)
```

3. 最老入选边界消息若超预算，只保留带明确 omission marker 的头尾文本；更早内容只存在于 summary。
4. preserved users 按原时间顺序重新投影，checkpoint 只保存 IDs 和最多一个边界截断结果。
5. mid-run 追加仅存在于 model projection 的 synthetic continuation；它不写 session timeline，也不能成为下一次 preserved-user 候选。

### Summary 动态输入/输出预算

summary 调用必须同时求解四个值：

- `maxInstallableSummaryTokens`：从最终 replacement history 可用空间反推的硬上限。
- `targetSummaryTokens`：硬上限内的软质量目标，只用于提示 provider 留出 preserved-user 空间。
- `providerMaxTokens`：考虑 reasoning headroom 后的 completion allowance。
- `maxSummaryInputTokens = summaryProviderContextWindow - providerMaxTokens`。

规则：

- `summary prompt + fitted source <= maxSummaryInputTokens`。source fit 同时保留最早任务上下文和最近状态，不只截取大消息中段。
- 摘要请求尽量关闭 thinking；provider adapter 必须真正转成 wire 字段。无法关闭时使用足够 completion headroom，不能反复调用消耗输入 token。
- response 必须 content 非空、finish reason 非 length/incomplete、包含固定标题和 `Continuation Contract`。
- 结构完整但超过硬上限时，不再次调用模型。summary owner 用确定性结构 refit 保留固定标题、Active Task 前部、最近状态尾部、Continuation Contract 头尾，并插入 omission marker；用同一 estimator 二分收敛。
- 只有最小结构合同也放不下时才失败。真实 `833 soft / 1667 hard / 1696 actual` 应在本地 refit 后安装，而不是终止 run。

### 最终安装证明

summary 生成或 refit 后，preflight 必须构造与最终 provider builder 相同角色、顺序和工具 schema 的候选请求：

```text
leading system/context + summary
+ preserved users
+ retained tail
+ synthetic continuation / minimum dynamic input
+ full tool schemas
+ output reserve
```

只有候选在同一 estimator 下满足硬预算，才能 append `compressed` marker。`InputBudgetPruner` 仍在每个 provider request 前运行，但它只能裁剪 dynamic suffix 或确定性规范化 checkpoint 之后的 system tail；不可删除 summary、preserved users 或改变 stable prefix。

## 压缩生命周期与持久化

### 状态机

```text
no marker
  └─ append compressing(markerId, placement)
       ├─ append compressed(same markerId, checkpoint)
       ├─ append failed(same markerId, typed error)
       └─ append cancelled(same markerId)
```

- `compressing` 必须在 summary provider 调用前发布，因此用户能看到压缩正在进行。
- `compressed` 是唯一可安装 checkpoint 的状态。
- failed/cancelled 不覆盖上一 checkpoint。
- ingestion 顺序固定：先 append journal marker，再从该事件更新 `last_context_compaction` 查询投影。
- 进程在 append 与 metadata projection 之间退出时，journal 重放仍能恢复；反向顺序不允许。

### Run accepted 状态

send、continue、edit/retry 的 REST/NCP 命令都返回同一种 `NcpRunHandle`。唯一 conversation state manager 执行：

```text
command accepted(runId)
  → optimistic active run
  → optional pre-run compressing
  → persisted run.started confirms same runId
  → terminal event clears active run
```

页面入口不能分别维护 pending 状态，也不能等 `run.started` 才认为运行。pre-run 压缩可能持续很久，但 composer 必须立即显示停止按钮，abort 使用已接受的 runId。

## Canonical message projection

message projection store 是 page API 的唯一 read-model owner：

- 同 ID assistant 每次物化的是从消息起点到当前 journal offset 的完整累计快照，不是 tail delta。
- 增量重放前，从 seed projection 恢复 active assistant replay frontier 和仍处于 compressing 的 marker 集合。
- terminal event 即使紧跟 marker、tail 中没有新文本，也能结算 assistant、工具和 marker。
- projection 首次创建或版本升级时，完整 journal snapshot 与其真实 byte offset 原子安装；不能拿完整 record 配较早 offset。
- GET/page 查询保持纯读，不在页面加载时顺手修 journal。

## UI 时间线投影设计

### 三层坐标

```text
append-only physical timeline
  └─ assistant segment graph
       └─ visual assistant surface
```

chat timeline projector 按 journal 顺序单次扫描：

1. 为每个 physical assistant 建立 `surfaceId + segmentStartOffset`。
2. hidden continuation prompt 建立 target edge；新 assistant 到达时只追加到 target surface，并登记新 segment offset。
3. marker 按持久化 placement 映射：
   - `session-boundary` 生成独立 divider；
   - `assistant-part` 的绝对边界为 `segmentStartOffset + coveredPartCount`。
4. 同一绝对边界按 journal order 稳定排序。
5. 一次性物化 surface parts 和 timeline items；React 只渲染结果。

### Placement 规则

| 场景 | placement | 用户看到的位置 |
| --- | --- | --- |
| 普通 send 的 pre-run | session boundary | 用户消息与新 assistant 之间 |
| manual compaction | session boundary | 两条可见消息之间 |
| mid-run | current assistant + covered parts | 当前 assistant 的 reasoning/tool 流程内部 |
| continue 的 pre-run | target assistant + target covered parts | 旧 continuation segment 末尾、新 segment 开头 |

continue pre-run 的 placement 在命令被接受时即可确定并写入 marker，不等待新 assistant 创建。压缩中先显示在 target surface 当前末尾；新 assistant 到达后只追加在 marker 后面。这样流式输出和刷新使用同一坐标，不依赖“pending hidden prompt 恰好相邻”的推断。

### 展示状态

- compressing：`正在压缩较早上下文`
- compressed：`较早上下文已自动压缩`
- cancelled：`上下文压缩已取消`
- failed：只有可行动的压缩失败才显示中性失败 item；具体内部诊断进入详情/日志。

状态更新复用 marker ID 和 React key，不重挂载前后的 reasoning、工具卡、编辑器或其它状态型 DOM。

## 中断、错误与恢复

### Crash recovery

kernel 启动时扫描 journal 中 `run.started` 后没有 terminal 的 run，通过既有 ingestion 主链追加一次 typed `run.error(interrupted=true)`。再次启动保持幂等。

该单一终态同时结算：

- active run 清空；
- streaming assistant → error/interrupted；
- call/partial-call 工具 → cancelled；
- pending compressing marker → failed 或 cancelled（按 terminal reason）；
- session preview → `failed/run-interrupted`；
- composer → 可继续。

`run-interrupted` 是恢复事实，不是用户任务错误。conversation 底部不显示内部英文红色错误卡；列表可保留中性“运行已中断”。普通 provider、工具、鉴权和配置失败仍显示 typed 可行动错误。禁止按英文字符串隐藏。

### 压缩错误分类

| 类型 | 用户语义 | checkpoint |
| --- | --- | --- |
| config-unusable | Agent 固定输入装不进窗口 | 不启动 run，保存或 preflight 明确拒绝 |
| summary-incomplete | provider 截断/空/缺结构 | 保留旧 checkpoint，run 失败并给可行动信息 |
| summary-minimum-unfit | 最小摘要结构也放不下 | 保留旧 checkpoint，提示扩大窗口/减少固定输入 |
| installability-failed | 最终 provider 面仍超预算 | 保留旧 checkpoint，报告预算分项 |
| cancelled | 用户停止或 run abort | 保留旧 checkpoint，中性展示取消 |
| interrupted | 进程退出/热重载未写终态 | 保留旧 checkpoint，中性恢复为可继续 |

## Session Agent 身份

持久化 `session.agentId` 是已有 session 下一次 run 和预算 snapshot 的唯一身份事实。历史 `run_spec.agentId` 只用于审计，不能反向改变 session 身份。

```text
nextRun.agentId == session.agentId
snapshot.agentId == session.agentId
cachedSurface.agentId != session.agentId => rebuild
```

- 新草稿第一次发送使用全局 Agent 选择并固化到 session。
- 已有 session 普通发送忽略冲突的全局选择和临时 metadata。
- preview 是纯查询，不写 runtime surface cache。
- 未来若支持切换 session Agent，必须先执行单一持久化 mutation，再同时切换 run 与预算；不能只改请求参数。

## 兼容策略

- 旧 checkpoint 无 preserved-user 字段：表示旧版本没有独立用户原文保真，不回扫旧 timeline 补造。
- 旧 checkpoint 无 retained IDs：沿用旧 coveredUntil/timestamp 语义，但不宣称具备稳定前缀证明。
- 旧 mid-run marker 只有 `continuationMessageId + coveredPartCount`：读取时映射为 assistant-part placement。
- 旧 continuation pre-run marker 没有 placement：仅 legacy projector 可以利用紧邻的 hidden continuation edge做一次可证明映射；无法证明则作为物理 session boundary 展示并记录诊断。新数据禁止走此分支。
- 旧 projection 中被 last-write-wins 截短的 assistant 快照在 projection version 升级时从完整 journal 重建，不做不可证明的 parts 拼接。
- 旧孤儿 compressing marker 若后续已有 abort/error，在 projection 重放中确定性结算；不改写历史 journal。

## 目录与依赖约束

不新增 `MidRunCompactionManager`、UI compaction store、retry wrapper 或第二套预算 service。

- runtime trigger：`nextclaw-ncp-agent-runtime-next` runtime owner
- core selection：`nextclaw-core` context compaction service
- kernel orchestration：context compaction preflight/manager
- provider input：model input builder + budget pruner
- config/snapshot：agent context window manager
- persistence：session journal ingestion + message projection store
- live state：NCP conversation state manager
- presentation：单一 chat timeline projector

跨层只传稳定领域合同：budget snapshot、checkpoint、marker placement、run handle 和 canonical NCP events。组件不能接收一组零散布尔值重新推导业务状态。

## 验证矩阵

设计完成后，验证按“合同测试 → 贴近链路功能测试 → 真实全新会话”三层执行；真实验证不是设计替代品，也不自动接入发布门槛。

### 预算与配置

- researcher + 全量工具在 3000/100 窗口保存时明确 400，原配置不变，模型调用次数为零。
- 35K 显示 fixed>0、reserve 7K、trigger 28K；200K/1M reserve 封顶 10K。
- preflight、session API、realtime snapshot 的 fixed/used/trigger/reserve 完全一致。
- session 为 researcher、历史错误 run metadata 为 main 时，下一 run 和 snapshot 仍使用 researcher。

### Summary 与 checkpoint

- 低于软目标直接安装；超过软目标但低于硬上限重新平衡后安装；结构完整且略超硬上限本地 refit 后安装；截断/空/缺结构不安装。
- 复刻 `833 soft / 1667 hard / 1696 actual`，只调用 provider 一次，refit 后保留标题和 Continuation Contract，下一模型 round 可继续。
- fixed/tools 已占满时 summary provider 调用次数为零。
- 连续两次 rolling compaction 不复活旧用户消息，第二次仍能引用任务和最新工具结果。

### Lifecycle 与状态

- send、continue、edit/retry 都在真实 `run.started` 前安装同一 runId active state。
- compressing 在 provider resolve 前可见；同 ID 原位变为 compressed/failed/cancelled。
- 压缩中 stop 后 composer 可继续；继续后不重复已完成工具。
- crash recovery 只追加一次 typed interrupted terminal，assistant、工具、marker、preview、composer 同时收敛。

### Projection 与展示

- 普通 pre-run/manual 是 session divider；mid-run 是 assistant inline part。
- continue pre-run 在新 assistant 尚未出现时已内联到 target surface 末尾。
- 两次 continue 合并后，两个 pre-run marker 与各自 mid-run marker 都留在对应 segment 边界，不堆到卡片末尾。
- 同一 assistant 连续三段 parts、三个 marker，live projection 与冷重载深度等价。
- marker 后无新 delta 直接 abort/error，冷重载仍结算累计 assistant、工具和 marker。
- 非法新 anchor 明确暴露 contract violation，不用 `Math.min` clamp 掩盖。

### 真实功能验收

- 使用当前源码完整构建、隔离 NEXTCLAW_HOME、冻结构建，创建全新 session。
- 成功场景：同一 run 至少连续两次真实压缩，第二次后继续真实模型 round 并 `run.finished`。
- 取消/继续场景：压缩中停止、刷新、继续、再次压缩、最终完成；不重复已完成工具。
- 每次记录刷新前后的 message/part/marker 稳定 ID、状态和顺序，逐项对比。
- MiniMax-M3 wire 证明 summary thinking 确实关闭或获得足够 headroom，finish reason 完整，最终输入满足预算。

工程验证还必须包含触达 package 的定向测试、TypeScript `tsc`、targeted ESLint、governance 和 maintainability guard。

## 实施阶段门

1. 本文先完成领域模型、状态机、数据合同、owner、预算、投影、兼容和验证矩阵审查；设计未冻结前不继续源码实现。
2. 先落实持久合同和唯一 owner，再实现纯 projection；UI 组件最后接入，不在组件层补特判。
3. 每个阶段用本文不变量验收，发现缺口先回到本文修正模型，不直接为截图添加条件分支。
4. 全部确定性与贴近链路测试通过后，才进行全新真实会话验收。
5. 只有真实功能矩阵通过，才能对用户声明完成；编译、类型、lint 或单点单测不能替代功能完成。

## 非目标

- 不改变 runtime-owned Agent 的上下文管理。
- 不新增远程 compaction 服务。
- 不新增用户可调 compaction threshold；只统一现有预算口径。
- 不把 Agent contextTokens 变成完整模型 catalog。
- 不删除或改写 append-only 用户历史。
- 不用静默 fallback、错误字符串识别、无限重试或第二次 summary 模型调用掩盖合同失败。
- 不为了兼容旧坏数据削弱新 marker placement、checkpoint installability 或 stream/reload isomorphism 合同。
