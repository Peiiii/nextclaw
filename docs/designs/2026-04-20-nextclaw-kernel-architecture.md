# NextClaw Kernel Architecture

## 目标

这份文档只回答一个问题：

`NextClaw` 的唯一内核到底是什么，以及 `nextclaw`、`@nextclaw/core`、`@nextclaw/runtime`、`@nextclaw/server` 这几个核心包在长期结构里各自应该扮演什么角色。

这里不讨论：

- `remote`
- marketplace
- 具体迁移批次
- 短期兼容方案
- 目录级小修小补

这里讨论的是产品本体哲学与长期分层。

## 产品本体判断

把 `CLI`、`UI`、`HTTP server`、`provider`、`plugin`、`channel`、`protocol adapter` 这些外衣都剥掉之后，`NextClaw` 的本质不是一个命令行工具，也不是一个网页应用，更不是一个单纯的模型调用 SDK。

`NextClaw` 更接近一个 `Agent OS`。

更准确地说，它是一个长期运行的 `Agent Operating Process`：

- 它持有系统状态，而不是只处理一次性输入
- 它管理持久化状态与运行时状态，而不是只做无状态请求转发
- 它编排外部能力，而不是试图亲自实现所有能力
- 它承接用户意图，并把意图推进成持续执行的任务
- 它统一对数字世界的接入，而不是再制造新的碎片入口

因此，`NextClaw` 的本体应被视为：

**一个长期运行的、状态化的、可装载能力的 Agent OS 内核进程。**

## 唯一内核原则

本设计明确采用一个原则：

**内核只能有一个。**

不能把“基础机制核心”“产品运行时核心”“入口编排核心”分别都叫内核。
如果一个系统需要长期清晰，它必须有唯一的 kernel owner。

这并不意味着 kernel 内部不能有子系统。
它当然可以有：

- config 子系统
- session 子系统
- task / runtime 子系统
- capability registry 子系统
- orchestration 子系统

但这些都只是同一个 kernel 内部的职责模块，而不是多层 kernel。

## Kernel 的最小职责

唯一 kernel 必须亲自拥有下面这些职责：

1. 系统状态 owner
   - 配置状态
   - 会话状态
   - 任务状态
   - 能力装载状态
   - 运行时健康状态

2. 生命周期 owner
   - 系统启动
   - 系统关闭
   - 重启与恢复
   - 前后台运行形态切换

3. 编排 owner
   - 意图到执行的推进
   - task / session / tool / subagent 的生命周期协调
   - 对外部能力的统一调度

4. 统一控制面
   - 为 CLI shell 提供控制接口
   - 为 UI / HTTP shell 提供控制接口
   - 对 shell 暴露统一的状态读取与动作调用接口

5. 能力装载边界
   - 注册哪些能力
   - 卸载哪些能力
   - 决定哪些能力进入当前运行时

如果一个模块不拥有上面这些职责，它就不是 kernel。

## 不属于 Kernel 的职责

下面这些职责默认不应该成为 kernel 本体：

- 命令行参数解析
- 终端文本输出
- HTTP 路由注册
- WebSocket 宿主
- 浏览器页面服务
- 官方 builtin provider/channel 清单
- 第三方协议适配细节

这些都应该是：

- shell
- host adapter
- runtime distribution
- extension

而不是 kernel 本体。

## 用户可感知形态

从内部结构上看，用户最终不会直接感知 `kernel`，就像普通用户不会直接感知 Linux kernel，而是感知 Ubuntu 这种已经把 kernel 包起来的系统形态。

对应到 NextClaw，这个关系应理解为：

- `kernel` 是系统本体
- `runtime` 是官方运行时发行层
- `nextclaw` 是最终产品入口包

也就是说，用户直接使用和安装的，不应是裸 `kernel`，而应是：

**一个基于 kernel 组装完成、已经带有默认能力的官方 NextClaw runtime distribution。**

因此，`runtime` 不应该和 `kernel` 争抢“谁是本体”的定义；它的职责是：

**把 kernel 包起来，并给它挂上官方默认的能力组合。**

## 现状判断

### `@nextclaw/core`

当前最接近内核，但还不是完整的产品内核。

从 [`packages/nextclaw-core/src/index.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/index.ts) 可以看到，它已经持有大量基础系统能力：

- config
- session
- providers
- channels
- cron
- heartbeat
- bus
- runtime-context
- agent primitives

例如：

- [`session/manager.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/session/manager.ts)
- [`config/loader.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/config/loader.ts)

这说明 `core` 今天更像：

**内核所依赖的基础核心能力库**

而不是：

**完整的产品主进程 kernel**

### `@nextclaw/runtime`

当前不是 kernel。

从 [`packages/nextclaw-runtime/src/index.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-runtime/src/index.ts) 和 [`providers/index.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-runtime/src/providers/index.ts) 可以看到，它主要负责：

- builtin provider registry 安装
- builtin provider / channel 清单暴露

这说明它更像：

**官方运行时发行层的最初雏形**

也就是 runtime distribution / assembly，而不是 kernel。

### `@nextclaw/server`

当前不是 kernel。

从 [`packages/nextclaw-server/src/ui/server.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-server/src/ui/server.ts) 和 [`router.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-server/src/ui/router.ts) 可以看到，它主要负责：

- HTTP / WebSocket host
- UI / API route registration
- 静态资源承载

这说明它本质上是：

**UI / API shell 的宿主层**

### `nextclaw`

当前最混乱。

它今天表面上长得像 CLI 包，但从产品定位看，它更应该代表：

**最终产品入口包**

也就是用户安装、调用、感知到的 `NextClaw` 产品形态。

当前的问题在于，它内部既包含入口层，又偷带了大量本应下沉到 kernel 的产品主编排职责。具体表现为：

- 对外导出 [`packages/nextclaw/src/index.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/index.ts) 只是 `export * from "@nextclaw/core"`
- 真实的大量产品级运行时编排，却堆在 [`packages/nextclaw/src/cli/app/runtime.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/app/runtime.ts)

`CliRuntime` 现在拥有大量本应属于系统本体的职责：

- gateway / ui / start / restart / serve / stop orchestration
- config / plugin / mcp / channel / cron / diagnostics 的统一编排
- runtime state 与 host 行为协调
- server / runtime / core 之间的产品级拼装

这说明当前最大的问题不是 “`core` 不够大”，而是：

**唯一 kernel 还没有被清晰收口，结果产品入口包 `nextclaw` 偷偷背了很多本体职责。**

## 推荐方案

长期最优方案：

**新增唯一的 `@nextclaw/kernel`。**

角色定义如下：

- `@nextclaw/kernel`
  - 唯一 kernel
  - 代表 NextClaw 作为 Agent OS 的产品本体

- `@nextclaw/core`
  - foundation library
  - 提供 kernel 所需的基础通用能力

- `@nextclaw/runtime`
  - official runtime distribution / assembly
  - 把 kernel 包起来，并提供官方默认 provider/channel/runtime 组合

- `@nextclaw/server`
  - UI/API shell host
  - 提供 HTTP / WebSocket / static host

- `nextclaw`
  - product entry package
  - 面向最终用户分发和调用
  - 默认依赖并启动官方 runtime，同时提供 CLI 入口

这套角色划分里，只有 `@nextclaw/kernel` 可以被称为内核。

## 推荐依赖链

长期推荐依赖关系应收敛为：

```text
nextclaw -> @nextclaw/runtime -> @nextclaw/kernel -> @nextclaw/core
```

含义如下：

- `@nextclaw/core`
  - 提供基础部件与基础机制
- `@nextclaw/kernel`
  - 依赖 `core`
  - 拥有唯一 kernel 职责
- `@nextclaw/runtime`
  - 依赖 `kernel`
  - 负责把 kernel 组装成官方默认运行时形态
- `nextclaw`
  - 依赖 `runtime`
  - 作为最终用户入口包提供产品分发与 CLI 接触面

这条链路表达的是：

**用户感知到的是 `nextclaw` 产品入口；`nextclaw` 背后启动的是官方 `runtime`；`runtime` 背后承载的是唯一 `kernel`；`kernel` 再建立在 `core` 这些基础部件之上。**

## 推荐运行链路

从运行关系上，更准确的描述是：

```text
user -> nextclaw -> runtime -> kernel -> core
```

这里各层回答的问题分别是：

- `nextclaw`
  - 用户如何进入系统
- `runtime`
  - 用户进入的这个官方系统默认带什么能力
- `kernel`
  - 系统如何活着、持有状态、协调运行
- `core`
  - kernel 依赖哪些基础机制

## 为什么不直接把 `core` 定义成唯一 kernel

这是一条可行的次优路线，但不是首选。

原因不是技术做不到，而是语义长期不够清晰。

今天 `core` 这个名字更像：

- 核心基础库
- 通用 runtime primitives
- foundation components

如果强行让它同时承担“产品主进程本体”的含义，会把两个概念绑在一起：

- foundation
- product kernel

短期可以接受，长期会持续制造认知噪音。

而 `kernel` 这个名字天然表达的是：

- 唯一 owner
- 产品本体
- 主进程中心

这更符合 NextClaw 作为 Agent OS 的长期定位。

## `@nextclaw/kernel` 的职责边界

`@nextclaw/kernel` 应该拥有：

- product runtime lifecycle
- task / session orchestration
- capability mount / unmount orchestration
- managed service lifecycle
- shell control surface
- runtime state model
- startup / restart / recovery orchestration

`@nextclaw/kernel` 不应该拥有：

- commander 命令声明
- CLI 专属输出文案
- HTTP route path 细节
- Hono / ws host 细节
- 前端页面资源
- 官方 builtin provider 清单定义本身

换句话说：

`kernel` 负责“系统怎么活着、怎么运行、怎么协调”，  
`runtime` 负责“官方系统默认给它装什么能力”，  
`nextclaw` 和 `server` 负责“用户从哪些入口接触它”。

## Kernel 的默认装配原则

`kernel` 既然是唯一 owner，它就不能只是一个“外部传九个 manager 进来再帮忙串一下”的空壳。

更准确的原则应该是：

- `NextclawKernel` 自己直接拥有默认 manager 实例
- 这些实例在 class field 初始化阶段创建
- 不是通过 constructor 依赖注入从外部传入

也就是说，长期推荐形态应该更接近：

```ts
export class NextclawKernel {
  readonly agents = new AgentManager();
  readonly tasks = new TaskManager();
  readonly sessions = new SessionManager();
  readonly contextBuilder = new ContextBuilder(this.sessions);
}
```

而不应该是：

```ts
new NextclawKernel({
  agents,
  tasks,
  sessions,
  context,
});
```

原因很简单：

- 如果 manager 必须由外部装进来，那么真正的 owner 其实还是外部装配层
- `kernel` 会退化成 facade，而不是系统本体
- 长期会把“谁负责默认系统状态”和“谁负责默认子系统边界”重新搞混

这不意味着以后完全不能支持更复杂的 runtime assembly。
它的意思只是：

**默认主路径上，kernel 必须先自带一套明确的默认子系统 owner。**

后续如果要支持持久化后端、远程状态后端、可插拔 store，再在 `runtime` 或更高层做替换式装配，但那应该是在默认 owner 已经清晰之后的下一层扩展，而不是从第一版就把 kernel 设计成纯注入容器。

## Kernel 的 public surface 原则

默认 manager owner 明确之后，`kernel` 顶层 public API 还必须继续收敛。

原则如下：

- manager 自己的局部状态动作，直接通过 manager 访问
- `kernel` 顶层不再重复包装一层同义 API
- `kernel` 顶层只保留真正的 OS 级动作

因此，下面这类接口不应长期挂在 `kernel` 顶层：

- `appendSessionMessage()`
- `scheduleAutomation()`
- `enableChannel()`
- 其它只是把 `manager.method()` 再转发一遍的 facade 方法

这些动作分别属于：

- `kernel.sessions.*`
- `kernel.automation.*`
- `kernel.channels.*`

它们不应该再伪装成 `kernel` 自己的系统级能力。

当前骨架阶段，推荐的 `kernel` public surface 应先收敛到最小形态：

```ts
export class NextclawKernel {
  readonly agents = new AgentManager();
  readonly tasks = new TaskManager();
  readonly sessions = new SessionManager();
  readonly contextBuilder = new ContextBuilder(this.sessions);
  readonly tools = new ToolManager();
  readonly skills = new SkillManager();
  readonly llmProviders = new LlmProviderManager();
  readonly automation = new AutomationManager();
  readonly channels = new ChannelManager();

  readonly run = (input: NextclawKernelRunInput) => NextclawKernelRun;
}
```

这里的含义是：

- manager 负责状态面
- `contextBuilder` 依赖 `sessions`，只负责从 session/task/agent 派生上下文快照，不拥有 context 持久化状态；当前文件落点临时放在 `managers/` 目录
- `run(...)` 负责编排面

也就是说，`kernel` 顶层不应该是 CRUD facade 集合，而应该先只有：

**manager 直出 + 一个核心系统动作。**

其中第一核心动作，就是：

**`run(input)`**

## 为什么 `run(input)` 才是核心动作

如果从 Agent OS 的角度看，`kernel` 最通用的公共能力，不是“开 session”“建 task”“prepare execution”这些中间步骤，而是：

- 在某个 session 里接收到一组 messages
- 触发一次 run
- 让系统自己决定 agent / task / context / provider / capability 的内部编排

因此，长期更合理的抽象不是：

- `openSession()`
- `createTask()`
- `prepareAgentExecution()`

而是：

```ts
type NextclawKernelRunInput = {
  sessionId: SessionId;
  messages: NcpMessage[];
  metadata?: {
    agentId?: AgentId;
    model?: string;
    skills?: SkillId[];
  };
  extra?: Record<string, unknown>;
};

type NextclawKernelRun = {
  taskId: TaskId;
};
```

由 `run(input)` 统一负责：

- 接收“某个 session 里发生了一组 messages”这件事
- 把 `metadata.agentId / model / skills` 视作稳定偏好，把其它不稳定扩展放进 `extra`
- 在 kernel 内部决定 agent / provider / capability / task / context 的具体编排
- 返回一个最小任务句柄，而不是把内部运行结构整包暴露出去

这样 `session`、`task`、`context` 就不再是外部必须手工推进的 public workflow，而是 run 编排链路里的系统性组成部分。

## 当前骨架阶段的实现约束

在 `kernel` 设计尚未完全稳定之前，当前代码应停在“骨架表达”阶段，而不是提前写入具体实现逻辑。

也就是说：

- manager 可以先是 class
- method body 可以先只有注释、伪代码或 `Not implemented`
- `run()` 可以先只保留编排步骤说明
- 不要在这个阶段引入具体的内存存储、具体 ID 生成、具体状态迁移细节

原因是：

- 一旦具体逻辑先落进去，就会反过来约束后续真正的架构讨论
- 很多实现细节会制造“既成事实”，让后面的职责拆分被迫围着早期代码让步
- 当前阶段的目标是把 public surface 和 owner 关系定准，而不是把默认实现抢先写完

所以当前最合理的状态是：

- `kernel` 的结构和命名已经稳定下来
- `run(input)` 已经成为唯一核心 public action
- manager 边界已经清晰
- 但具体行为实现仍然故意留白

## `@nextclaw/kernel` 的唯一职责清单

为了避免 `kernel` 概念再次膨胀，本设计要求 `@nextclaw/kernel` 只拥有下面这些唯一职责，且这些职责必须由它统一 owner。

### 1. Product lifecycle owner

`kernel` 必须是唯一的产品生命周期 owner，负责：

- 启动产品 runtime
- 关闭产品 runtime
- 重启与恢复
- 前台 / 后台 / 守护化运行形态切换
- 系统 ready / degraded / restarting / stopped 状态切换

### 2. Runtime state owner

`kernel` 必须统一持有产品运行时状态，而不是让 CLI、UI、server 各自散持：

- managed service state
- pending restart state
- local runtime availability state
- active capability mount state
- bootstrap / readiness state
- runtime control state

### 3. Capability orchestration owner

`kernel` 必须负责“能力如何被挂载、卸载、激活、协调”，包括：

- provider / channel / MCP / plugin / session runtime 等能力的统一装载边界
- capability hydration
- capability wiring
- capability lifecycle hooks
- capability readiness aggregation

### 4. Product control surface owner

`kernel` 必须向外提供统一控制面，而不是让 CLI / server 直接摸底层实现：

- start / stop / restart / serve / gateway / ui 这类产品级控制动作
- runtime status / bootstrap status 读取
- 统一的 restart request / restart coordination
- shell 可调用的 product commands facade

### 5. Product orchestration owner

`kernel` 必须统一拥有跨子系统编排，而不是让这些编排继续散落在入口包内部：

- gateway 与 UI 的启动顺序协调
- runtime config init 与启动链路编排
- service managed startup 编排
- cron / agent / NCP / UI runtime 的产品级装配
- runtime 生命周期中的副作用收口

## 明确不属于 `@nextclaw/kernel` 的职责清单

下面这些职责必须明确排除在 `kernel` 外，否则 `kernel` 会重新退化成“大杂烩本体”。

### 1. Foundation primitives

以下内容应继续留在 `@nextclaw/core`，而不是迁入 `kernel`：

- config schema / loader / migration primitives
- session manager primitives
- provider manager primitives
- bus / typed-event-bus
- cron / heartbeat primitives
- agent / tool / runtime-context 基础原语

原则：

这些是 `kernel` 依赖的基础机制，不是产品本体 owner。

### 2. Official capability catalog

以下内容应继续留在 `@nextclaw/runtime`，而不是迁入 `kernel`：

- builtin provider registry 安装
- builtin provider plugin 列表
- builtin channel 清单
- 官方默认 capability 组合

原则：

这些回答的是“官方系统默认带什么能力”，不是“系统如何活着”。

### 3. Shell / host concerns

以下内容应明确留在 `nextclaw` 或 `@nextclaw/server`：

- commander 命令树
- CLI 参数解析
- 终端输出与交互
- HTTP route path 定义
- Hono / ws host
- 静态页面服务
- HTTP controller / route registration

原则：

这些是用户入口与宿主问题，不是内核问题。

### 4. Domain feature leaves

以下能力默认也不应整体迁入 `kernel`，除非它们承担了真正的系统级 owner：

- marketplace 业务细节
- plugin 安装 UI / marketplace 内容呈现
- platform-auth 的业务 API 细节
- usage read side 展示
- server-path 浏览与读取

原则：

`kernel` 只拿系统级 orchestrator，不吞 feature 业务叶子。

## 现有模块映射：建议迁入 `kernel`

基于当前代码结构，下面这些现有模块最像唯一 kernel 的种子，建议优先视为 `kernel` 候选范围。

### A. 运行时主编排入口

- [`packages/nextclaw/src/cli/app/runtime.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/app/runtime.ts)

原因：

这是当前产品级 runtime orchestration 最集中的 owner，今天最大的问题不是它不存在，而是它还挂在入口包里。

### B. runtime 子系统

- [`shared/services/runtime/runtime-command.service.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/services/runtime/runtime-command.service.ts)
- [`shared/services/runtime/runtime-config-init.service.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/services/runtime/runtime-config-init.service.ts)
- [`shared/services/runtime/service-managed-startup.service.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/services/runtime/service-managed-startup.service.ts)
- [`shared/services/runtime/service-remote-runtime.service.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/services/runtime/service-remote-runtime.service.ts)

原因：

这些更像产品运行时生命周期与 host 行为编排，不是 CLI 表层。

### C. restart 子系统

- [`shared/services/restart/restart-coordinator.service.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/services/restart/restart-coordinator.service.ts)
- [`shared/services/restart/restart-sentinel.service.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/services/restart/restart-sentinel.service.ts)
- [`shared/services/restart/runtime-restart-request.service.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/services/restart/runtime-restart-request.service.ts)

原因：

restart / recovery 是典型的 kernel 职责，不能长期依附在 shell 包内部。

### D. gateway 子系统中的系统 owner 部分

下面这些模块建议迁入 `kernel`，因为它们表达的是产品启动 / 装配 / 生命周期：

- [`shared/services/gateway/nextclaw-app.service.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/services/gateway/nextclaw-app.service.ts)
- [`shared/services/gateway/service-gateway-bootstrap.service.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/services/gateway/service-gateway-bootstrap.service.ts)
- [`shared/services/gateway/service-gateway-context.service.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/services/gateway/service-gateway-context.service.ts)
- [`shared/services/gateway/service-gateway-runtime-lifecycle.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/services/gateway/service-gateway-runtime-lifecycle.ts)
- [`shared/services/gateway/service-gateway-startup.service.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/services/gateway/service-gateway-startup.service.ts)
- [`shared/services/gateway/service-capability-hydration.service.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/services/gateway/service-capability-hydration.service.ts)
- [`shared/services/gateway/service-bootstrap-status.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/services/gateway/service-bootstrap-status.ts)

原因：

这些模块表达的是“NextClaw 作为系统如何启动并进入 ready”，这是 kernel 核心职责。

### E. ui 子系统中的统一控制面部分

下面这些模块建议迁入 `kernel`，但只迁“系统控制面”部分，不迁 UI host 细节：

- [`shared/services/ui/runtime-control-host.service.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/services/ui/runtime-control-host.service.ts)
- [`shared/services/ui/service-ui-hosts.service.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/services/ui/service-ui-hosts.service.ts)
- [`shared/services/ui/service-remote-access.service.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/services/ui/service-remote-access.service.ts)

原因：

这些模块已经不是前端壳本身，而是在做产品系统对 UI / remote 的统一控制映射。

### F. runtime state stores

下面这些 store 建议迁入 `kernel`：

- [`shared/stores/managed-service-state.store.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/stores/managed-service-state.store.ts)
- [`shared/stores/pending-restart.store.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/stores/pending-restart.store.ts)
- [`shared/stores/local-ui-runtime.store.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/stores/local-ui-runtime.store.ts)

原因：

它们存的不是某个命令的临时数据，而是产品系统的 runtime state。

## 现有模块映射：建议明确排除在 `kernel` 外

### A. 保留在 `core`

继续保留在 `@nextclaw/core` 的模块族：

- `src/config/*`
- `src/session/*`
- `src/providers/*`
- `src/channels/*`
- `src/cron/*`
- `src/heartbeat/*`
- `src/bus/*`
- `src/agent/*`
- `src/runtime-context/*`

理由：

这些是 foundation primitives，不应因为产品内核收口就全抬升。

### B. 保留在 `runtime`

继续保留在 `@nextclaw/runtime` 的模块族：

- [`src/providers/index.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-runtime/src/providers/index.ts)
- [`src/providers/plugins/*`](/Users/peiwang/Projects/nextbot/packages/nextclaw-runtime/src/providers/plugins/index.ts)
- [`src/channels/builtin.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-runtime/src/channels/builtin.ts)

理由：

这些表达的是官方默认 capability catalog，而不是系统 owner。

### C. 保留在 `server`

继续保留在 `@nextclaw/server` 的模块族：

- [`src/ui/server.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-server/src/ui/server.ts)
- [`src/ui/router.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-server/src/ui/router.ts)
- [`src/ui/ui-routes/*`](/Users/peiwang/Projects/nextbot/packages/nextclaw-server/src/ui/ui-routes)
- [`src/ui/server-path/*`](/Users/peiwang/Projects/nextbot/packages/nextclaw-server/src/ui/server-path)

理由：

这些是 HTTP / UI host concerns，不应塞进 kernel。

### D. 保留在 `nextclaw` product entry

继续保留在 `nextclaw` 包入口层的模块族：

- [`src/cli/app/index.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/app/index.ts)
- `src/cli/app/register-*.ts`
- `src/cli/commands/*` 中所有 commander 入口与终端交互绑定

理由：

这些负责产品入口和 CLI 接触面，不应被内核吞掉。

## `@nextclaw/kernel` 的设计

### 设计目标

`@nextclaw/kernel` 不应再是一个“巨型 runtime.ts 文件的新落点”，而应被设计成：

**一个围绕系统状态、生命周期和能力编排展开的单一产品内核。**

### 设计原则

1. 单一 owner
   - kernel 内必须有一个明确的主 owner，例如 `NextclawKernel`
   - 不再让多个平级入口分别偷偷持有系统状态

2. state first
   - kernel 先定义系统状态模型，再定义动作
   - 所有 shell 与 host 都应围绕这份状态模型读写

3. orchestration only
   - kernel 只做产品级 orchestrator
   - 不吞 feature 业务叶子

4. runtime mount boundary
   - runtime 只能通过显式 mount contract 把官方能力装进去
   - 不能反向成为状态 owner

5. shell isolation
   - CLI / server 只能调用 kernel control surface
   - 不再直接摸内部运行时拼装细节

### 推荐内部模块

`@nextclaw/kernel` 内部推荐围绕以下几个子系统组织，但它们都仍然属于同一个 kernel：

- `state/`
  - runtime state model
  - readiness / restart / managed-service state

- `lifecycle/`
  - boot
  - shutdown
  - restart
  - recovery

- `capabilities/`
  - capability mount contract
  - capability hydration
  - capability registry orchestration

- `control/`
  - shell-facing control surface
  - runtime status queries
  - start / stop / restart actions

- `assembly/`
  - 把 core primitives、runtime capabilities、server host hooks 编织进产品 kernel

### 推荐对外接口

`@nextclaw/kernel` 对外应优先只暴露一组产品级接口，而不是把内部实现全量抛出去：

- `createKernel(...)`
- `kernel.start()`
- `kernel.stop()`
- `kernel.restart()`
- `kernel.getStatus()`
- `kernel.getBootstrapStatus()`
- `kernel.mountRuntime(...)`
- `kernel.createControlSurface()`

这样做的目的，是让 `nextclaw` 与 `server` 都依赖统一控制面，而不是继续各自拼装半套系统。

## 与现有代码的对应关系

按当前代码观察，未来最可能迁入 `kernel` 的，不是整个 `nextclaw` 包，而是今天散落在 `nextclaw/src/cli` 里的产品主流程 owner，尤其是：

- `app/runtime.ts` 中的主运行时编排职责
- `shared/services/runtime/`
- `shared/services/gateway/`
- `shared/services/ui/` 中真正属于统一控制面的部分
- `shared/services/restart/`
- `shared/stores/` 中属于系统 runtime state 的部分
- 目前由 CLI runtime 统一拼装的 product-level commands/services owner

反过来，应该继续留在 `nextclaw` shell 的，只应是：

- commander 入口
- CLI 参数声明
- 终端交互
- 入口层文案与输出格式
- product entry 到 runtime 的调用绑定

而不是继续在 `nextclaw` 包里直接拥有完整产品运行时 owner。

## 长期收益

采用唯一 `kernel` 方案后，长期收益主要有四个：

1. 概念更干净
   - 团队不再混淆 “core 是基础库” 还是 “core 是产品内核”

2. 产品入口可以真正变薄
   - `nextclaw` 回到 product entry 本位，而不是继续兼任本体 owner

3. server 可以真正变壳
   - `@nextclaw/server` 回到 host adapter 本位

4. 产品本体 owner 更清晰
   - NextClaw 的本质不再藏在入口包内部，而是被清晰命名并独立承载

## 非目标

本设计当前不直接决定：

- `kernel` 的最终目录结构细节
- 首批迁移批次
- 是否一次性迁移全部 orchestration
- 是否同步调整 `remote`、marketplace、MCP 等外围包
- 是否同时重构 `core` 内部模块边界

这些都属于后续迁移设计，不属于本次本体架构判断。

## 当前结论

结论收敛如下：

- `NextClaw` 的本体应被定义为一个长期运行的 `Agent OS` 进程
- 内核只能有一个，不能再做多层内核叙事
- 当前仓库里没有任何一个包干净地等于这个唯一 kernel
- `@nextclaw/core` 最接近基础核心，但更像 foundation，而不是完整产品 kernel
- `@nextclaw/runtime` 是官方 runtime distribution，不是 kernel
- `@nextclaw/server` 是 shell host，不是 kernel
- `nextclaw` 是最终产品入口包，但当前错误地承载了过多本体职责
- 长期最优方案是新增唯一的 `@nextclaw/kernel`

## 下一步讨论入口

下一轮讨论应只聚焦一个问题：

**`@nextclaw/kernel` 的唯一职责清单，到底应该精确包含哪些内容，以及哪些现有模块应该明确排除在 kernel 外。**
