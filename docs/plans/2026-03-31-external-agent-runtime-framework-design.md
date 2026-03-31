# External Agent Runtime Framework Design

## 这份文档回答什么

这份文档沉淀本轮关于 `OpenClaw ACP / acpx / sessions_spawn` 与 `NextClaw` 当前 `NCP runtime plugin` 体系的讨论结论，重点回答：

1. `OpenClaw` 在 `Codex ACP` 这条路径上到底做了什么。
2. `acpx` 是什么，它在架构中处于哪一层。
3. 为什么我们不应把系统直接绑死到 `acpx`，但又应认真吸收它的优势。
4. `NextClaw` 当前已经有什么基础，缺的又是什么。
5. 我们接下来应该把系统演进到什么方向。

这不是一份“立刻实现某个小功能”的任务单，而是一份上层架构收敛文档，用于后续继续讨论、拆计划或直接进入实现。

## 当前背景

在讨论 `OpenClaw` 的 `Codex ACP / CLI backend` 路线时，我们确认了一个重要事实：

- `OpenClaw` 已经不是“接了一个 Codex 模型”这么简单。
- 它真正做出来的是一套“外部 coding agent 会话托管框架”。
- `Codex` 只是这套框架当前支持的一个外部 harness。

与此同时，`NextClaw` 当前并不是一片空白。

我们仓库已经有：

- `NCP-native` 默认 runtime
- `Codex SDK` 的独立 NCP runtime 插件
- `Claude Code SDK` 的独立 NCP runtime 插件
- 插件注册 runtime kind / session type 的通用机制
- 前端按 session type 创建不同 runtime 会话的基础结构

也就是说，我们已经有“插件化 runtime”的骨架；但我们还没有把它提升成一套更高层的“统一外部 Agent 会话框架”。

## 对 OpenClaw 的关键观察

### 1. ACP 不是普通 provider 集成

`OpenClaw` 的 `ACP` 路径不是把 `Codex` 当普通聊天模型使用。

它做的是：

- 把 `Codex`、`Claude Code`、`Cursor`、`Gemini CLI` 等外部 coding agent，当作“外部 runtime / harness”处理。
- 通过 `sessions_spawn(runtime="acp")` 创建独立 session。
- 通过 `thread bind / current-conversation bind` 把聊天面绑定到这个外部 session。
- 之后用户后续消息直接路由到这个外部 runtime。

换句话说，用户面对的是“被 OpenClaw 托管的 Codex 会话”，而不是“OpenClaw 自己先想一遍，再代打 Codex”。

### 2. acpx 不是 Codex，而是 ACP backend 宿主

`acpx` 的角色不是某个具体 Agent，而是一个 `ACP runtime backend`。

它的职责是：

- 作为 OpenClaw 的 ACP 后端插件
- 托管外部 harness runtime
- 提供 `codex`、`claude`、`cursor`、`gemini` 等 alias
- 管理这些 harness 的 session、resume、启动、桥接与权限策略

所以真正的关系是：

```text
OpenClaw
  -> 产品壳层 / 会话托管 / 路由 / 绑定 / 任务编排
acpx
  -> ACP backend / 外部 harness 宿主
Codex / Claude / Cursor / Gemini
  -> 具体外部 agent harness
```

### 3. sessions_spawn 的真正价值

`sessions_spawn` 吸引人的地方，不只是“开个子任务”。

它真正有价值的是：

- 把“外部 agent session”提升为系统一等公民
- 统一 native subagent 与 external runtime session 的创建入口
- 让会话级别的生命周期、绑定、恢复、可见性、编排都统一起来

这使得 `OpenClaw` 的系统气质从“有多个功能”升级成了“有一套更高阶的 Agent orchestration shell”。

## 对 NextClaw 当前状态的关键判断

### 1. 我们已经有对的底座

`NextClaw` 当前并不是缺少 runtime 插件化。

相反，我们已经有：

- `Codex` runtime 插件通过 `registerNcpAgentRuntime({ kind: "codex" })` 注册 NCP session type
- `Claude` runtime 插件通过同样方式注册 `claude` session type
- 前端通过 `/api/ncp/session-types` 感知可用 session type
- 默认 `native` runtime 与外部 runtime 已经共存

这意味着我们已经解决了下面这些问题：

- 外部 runtime 以插件方式接入
- 主包不强绑所有 SDK
- 前端按 session type 选择 runtime
- runtime kind 和会话语义已经对齐

### 2. 我们还缺更高一层

我们缺的不是再多接一个 `Codex` 或 `Claude`。

我们真正缺的是一个更上层的统一能力：

**External Agent Session Framework**

这层应该负责：

- 外部 agent session 的统一建模
- 会话与聊天面的绑定
- `spawn / resume / close / status / steer` 等统一编排语义
- SDK 型 runtime 与 ACP/harness 型 runtime 的统一接入

也就是说，我们当前的 runtime 插件体系是正确的，但还停留在“runtime implementation plugin”层。

而 `OpenClaw ACP + acpx` 展示出来的价值，更多是在“external session orchestration”层。

## 为什么不应直接把系统绑死到 acpx

这个问题是本轮讨论最容易混淆，也最需要明确立场的地方。

### 直接对接 acpx 的明显好处

- 可以更快拿到 ACP / harness 生态
- 可以更快支持 `codex / claude / cursor / gemini`
- 可以更快获得 session 托管、resume、thread bind 等能力
- 对社区已有 ACP-compatible agent 更友好

这些都是真实优势，不应该回避。

### 但直接绑死 acpx 的问题同样真实

如果我们把 `acpx` 当作系统中心，而不是一个 backend 选项，会产生以下结构性风险：

1. 我们的产品语义会被 `acpx` 反向塑形。
2. 我们的 session / event / permission / tool surface 会过度依赖它的 contract。
3. 我们后续若要继续支持官方 SDK runtime、非 ACP runtime、企业私有 runtime，会面临更大摩擦。
4. 我们本来应该积累为自身核心资产的“外部 Agent 会话框架”，会退化成“acpx 的宿主壳”。

### 结论

因此，长期正确方向不是：

- “把 NextClaw 做成 acpx 的 UI 壳”

而应该是：

- “让 NextClaw 拥有自己的统一外部 Agent 会话框架，而 `acpx` 只是未来的一个 adapter / backend”

这并不是排斥 `acpx`，而是在架构 ownership 上做出清晰边界。

## 推荐的统一分层

为了消除当前讨论中的混乱，需要把系统拆成三个层级。

### 第一层：产品 / 会话层

这是 `NextClaw` 自己必须拥有的核心资产。

职责包括：

- session type / runtime kind 的产品语义
- 会话创建、恢复、删除、列表展示
- 某个 chat / thread 与某个外部 agent session 的绑定
- `sessions_spawn`、`resume`、`close`、`status` 等统一入口
- 前端消息流、历史恢复、UI 展示

这一层不应外包给 `acpx` 或任何第三方 backend。

### 第二层：runtime contract 层

这是统一抽象层，负责定义：

- 什么叫一个 external runtime
- 一个 external session 的身份如何表示
- 如何 `ensureSession`
- 如何 `runTurn`
- 如何 `cancel`
- 如何 `close`
- 如何返回 event / status / session identity

这一层也应由 `NextClaw` 主导，因为它决定我们未来是否能统一容纳：

- 官方 SDK runtime
- ACP runtime
- 社区 runtime
- 企业私有 runtime
- 当前 native runtime

### 第三层：adapter / backend 层

这一层才是各类具体实现。

包括但不限于：

- `Codex SDK adapter`
- `Claude Code SDK adapter`
- `acpx adapter`
- 未来其它 ACP backend adapter
- 未来社区 runtime adapter

`acpx` 在这个结构里处于第三层，不应上升为整个系统的唯一底座。

## 推荐的核心抽象

### 1. ExternalRuntimeBackend

建议定义统一接口，最小必要能力包括：

- `ensureSession`
- `runTurn`
- `cancel`
- `close`
- `getStatus`

这是 SDK 型 runtime 与 ACP/harness 型 runtime 的共同交汇点。

### 2. ExternalSession

需要统一会话身份模型，至少包含：

- `runtime kind`
- `backend id`
- `agent id`
- `session runtime id`
- `workingDirectory`
- `mode`
- `state`

无论底层是 `Codex SDK`、`Claude Code SDK` 还是 `acpx/codex`，都应能落到同一套 session 元模型上。

### 3. ConversationBinding

需要统一“聊天面绑定外部 runtime session”的概念：

- 当前 chat 是否绑定某个 external session
- 是否是 current-conversation bind
- 是否是 child-thread bind
- 后续消息是否自动路由
- 解绑 / reset / replace 的行为如何定义

这是把 runtime 插件能力提升为真实产品体验的关键一层。

### 4. sessions_spawn

`sessions_spawn` 应成为统一编排入口，而不仅是某个工具名字。

长期推荐形态：

```text
sessions_spawn({
  runtime: "native" | "external",
  backend: "sdk" | "acpx" | "<future-backend>",
  agentId: "codex" | "claude" | "<future-agent>",
  mode: "run" | "session",
  cwd,
  bind,
  thread,
  metadata
})
```

这里最重要的不是字段名，而是统一语义：

- “创建一个新执行单元”
- “这个执行单元可能是 native，也可能是 external”
- “系统后续能统一编排、观察、恢复和绑定它”

## 我们现有体系与推荐方向的关系

### 现有体系不是错的，反而是正确基础

我们现在的 `Codex` / `Claude` NCP runtime 插件体系，不应被推翻。

它们解决的是：

- 如何把具体 SDK 封装成 `NcpAgentRuntime`
- 如何注册 session type
- 如何保持默认主包轻量
- 如何让前端自然出现 `Codex` / `Claude`

这套东西未来仍然成立。

### 需要新增的是更上层的 orchestrator

因此推荐方向不是“抛弃现有插件体系，改投 acpx”。

而是：

- 保留当前 `NCP runtime plugin` 体系
- 在其上新增 `external session orchestration` 层
- 让当前 `Codex SDK runtime`、`Claude SDK runtime` 成为第一批 external runtime adapter
- 未来再把 `acpx` 纳入同一套 orchestrator contract

也就是说：

```text
NextClaw External Agent Session Framework
  -> Native runtime adapter
  -> SDK runtime adapters
     - Codex SDK
     - Claude Code SDK
  -> ACP backend adapters
     - acpx
     - future ACP backends
```

这才是两条路线的正确汇合方式。

## 对生态接入的判断

用户的核心目标不是“让 acpx 跑起来”，而是：

- 做一个通用的东西
- 能直接连接社区生态
- 不为每个 Agent 单独重做一套集成
- 后面可以继续接更多平台

基于这个目标，推荐结论是：

- 我们应该主动设计“生态接入层”
- 但这个层应建立在我们的统一 contract 之上
- 不应把某一个具体 backend（例如 acpx）直接等同于“生态本身”

更直白地说：

- `acpx` 可以帮助我们更快接到一部分生态
- 但 `acpx != 生态`
- 我们真正该拥有的是“能容纳 acpx，也能容纳其它社区 runtime 的统一接入框架”

## 推荐实施策略

### Phase 0：统一概念收敛

先明确下列概念并固化到设计层：

- `runtime implementation plugin`
- `runtime backend / harness host`
- `external session`
- `conversation binding`
- `sessions_spawn`

避免后续继续把不同层级的“插件”混在一起谈。

### Phase 1：在现有 NCP runtime 插件体系上新增 external session 元模型

目标：

- 让 `Codex` / `Claude` 不再只是“另一个 session type”
- 而是开始拥有统一的 `external session` 语义

优先项包括：

- session metadata 统一
- runtime identity 统一
- working directory / mode / state 统一

### Phase 2：引入统一的 conversation binding 与 sessions_spawn

目标：

- 不管底层是 native 还是 external，都能通过统一入口 spawn
- 某个 chat/thread 可以绑定到某个 external session
- 用户后续在同一聊天面继续与该 runtime 对话

这是把“runtime 插件”升级为“Agent 会话产品能力”的关键一步。

### Phase 3：将当前 SDK runtime 适配到新框架

优先适配：

- `Codex SDK runtime`
- `Claude Code SDK runtime`

理由：

- 我们已经有这些能力
- 适配成本最低
- 能先验证统一框架是否真实成立

### Phase 4：评估并接入 acpx adapter

等我们拥有自己的 orchestrator contract 后，再评估：

- 是否实现 `acpx adapter`
- 接入后如何映射 session / status / event / permission
- 如何把 ACP backend 纳入统一系统，而不是反客为主

这一步的意义是“扩大生态”，而不是“决定核心架构归属”。

## 本轮讨论形成的最终结论

### 结论 1

`OpenClaw` 在 `ACP + acpx + sessions_spawn` 这条路径上，确实已经实现了一套更成熟、更通用的“外部 Agent 会话托管框架”。

### 结论 2

`NextClaw` 当前已经有一半正确答案：

- 插件化 runtime
- `Codex` / `Claude` 的独立 session type
- 默认 `native` runtime 与外部 runtime 共存

因此我们不是从零开始。

### 结论 3

当前最关键的缺口不是“再接一个 Agent”，而是缺少：

- unified external session model
- conversation binding
- sessions_spawn
- SDK runtime 与 ACP/harness runtime 的统一 orchestrator

### 结论 4

长期正确方向不是“把系统直接绑死到 acpx”，而是：

**让 NextClaw 升级成统一的外部 Agent 会话框架，而 acpx 作为未来生态接入的一个 backend / adapter。**

### 结论 5

我们当前已有的 `NCP runtime plugin` 体系不应被推翻，而应作为这个更高层框架的基础层继续保留与演进。

## 后续建议

下一步建议从以下两个方向二选一继续推进：

1. 输出一份更具体的“最小实现架构图 + 核心接口草案”
2. 直接拆出第一阶段实施计划：
   - external session metadata
   - binding model
   - sessions_spawn contract
   - Codex / Claude adapter convergence

在没有继续澄清前，不建议直接进入大规模实现，以免把 `runtime plugin`、`ACP backend`、`生态接入层` 三者再次混在一起。

## 相关参考

- [NCP Pluggable Agent Runtime Plan](./2026-03-19-ncp-pluggable-agent-runtime-plan.md)
- [NCP Phase 1: Codex SDK Runtime Integration Plan](./2026-03-19-ncp-phase1-codex-sdk-runtime-integration-plan.md)
- [Claude Code SDK NCP Runtime Plan](./2026-03-19-claude-code-sdk-runtime-plan.md)
- [Codex Plugin Runtime Plan](./2026-03-19-codex-plugin-runtime-plan.md)
- [ACP Agents](/Users/peiwang/Projects/openclaw/docs/tools/acp-agents.md)
- [CLI acp Bridge](/Users/peiwang/Projects/openclaw/docs/cli/acp.md)
