# NextclawApp 启动流程标准化设计

**Goal:** 把当前 UI NCP agent 的启动链路重构为一个由 `NextclawApp` 持有的、阶段明确、职责收敛、语义稳定的标准化启动流程，让“搭建应用核心架构”“恢复必需持久化状态”“预热衍生能力”彻底解耦。

**Scope:** 本次设计覆盖 `packages/nextclaw/src/cli/commands/service-support/gateway/` 与 `packages/nextclaw/src/cli/commands/ncp/` 当前的 UI NCP agent 启动主链，重点包括 `createUiNcpAgent(...)`、bootstrap status、deferred NCP agent 激活时机，以及与 MCP / session search 相关的启动期 IO。前端 UI 生命周期展示只消费新的后端启动合同，本方案本身不展开前端具体实现细节。

**Non-goals:**
- 不在这份方案里同时重构所有聊天业务逻辑
- 不把整个仓库做成一个 God object
- 不把所有 plugin/runtime 描述探测一并纳入首批改造
- 不在本次设计里重新定义 remote access 或其它宿主形态的完整启动流

## 问题定义

当前实现把三类本质不同的事情绑进了同一个 `createUiNcpAgent(...)` Promise：

1. 搭建应用核心架构
   - 创建 runtime registry、session store、broker、backend 等核心 owner
   - 启动 `DefaultNcpAgentBackend`
2. 恢复持久化状态
   - 恢复那些会影响首条消息正确性的持久化事实
3. 预热衍生能力
   - MCP server prewarm
   - session search 初始化与全量索引回填
   - 其它“有了更好、没有也不该挡住主链”的补充能力

结果是：

- `ncpAgent.state=running` 覆盖了过大的时间窗口
- `ready` 的语义被污染，不再等价于“聊天主链已经可用”
- 扩展能力慢会被误报成 agent 内核没起来
- 启动流程是“外部 orchestration + 函数链 + 中间态拼接”的形式，代码可读性差，边界不稳定

## 设计原则

### 1. 唯一核心 owner

引入唯一应用核心类：`NextclawApp`。

它的定位不是 controller、lifecycle manager 或 coordinator，而是应用本体。凡是属于“应用启动、核心设施装配、启动状态、系统级依赖关系”的东西，都应该默认由它持有，而不是在外部到处拼接。

### 2. 阶段 action 显式化

启动流程必须被标准化为一组显式 action，而不是靠若干 helper 隐式串起来：

- `start()`
- `bootstrapKernel()`
- `recoverDurableState()`
- `warmDerivedCapabilities()`

函数名直接就是阶段行为。阅读主链时，应能一眼看懂应用是如何从空状态走到可用状态的。

### 3. 禁止 context 在阶段间传来传去

阶段之间不再使用 `ContextA -> ContextB -> ContextC` 的传递风格。

所有核心组件与阶段状态都由 `NextclawApp` 自己持有：

- `this.backend`
- `this.runtimeRegistry`
- `this.mcpSupport`
- `this.sessionSearch`
- `this.bootstrapStatus`
- `this.phase`

阶段方法直接读写 `this` 上的内部变量，不暴露中间态对象。

### 4. constructor / 类字段只负责预制结构，不负责重 IO

核心组件的 owner、默认状态、依赖占位，可以在 constructor 或类字段上创建。

但真正的重 IO 不应该放在 constructor 里，因为：

- constructor 不适合承担异步失败语义
- 它会让“实例存在”与“系统 ready”混淆
- 不利于把阶段语义与错误边界表达清楚

因此：

- 组件搭建在 constructor / 类字段
- 真正的 IO 放在阶段 action 中执行

### 5. Ready 语义必须收紧

未来的 `ready` 必须只代表一件事：

> 聊天主链已可用，首条消息已经可以被正确接收与执行。

不属于这一定义的事情，默认不准挡在 `ready` 前面。

## 现状调研结论

### 当前真正卡住 ready 的 IO

#### 1. MCP prewarm

当前 `createMcpRuntimeSupport()` 在创建 MCP adapter 的同时，直接执行：

- `await mcpRegistryService.prewarmEnabledServers()`

对应代码：

- [create-ui-ncp-agent.service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.service.ts:96)
- [mcp-registry-service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-mcp/src/registry/mcp-registry-service.ts:35)

这一步会启动/连接 MCP server、拉 catalog，属于明确 IO，不该与 kernel 启动绑定。

#### 2. Session search 初始化

当前 `createUiNcpAgent(...)` 会直接：

- `await sessionSearchRuntimeSupport.initialize()`

对应代码：

- [create-ui-ncp-agent.service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.service.ts:341)
- [session-search-feature.service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/session-search/session-search-feature.service.ts:29)
- [session-search-store.service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/session-search/session-search-store.service.ts:60)

它会：

- 创建 sqlite 存储
- 扫所有历史 session
- 全量回填索引
- 清理失效索引

这显然属于派生能力构建，不应阻塞首条消息路径。

### 当前并不重的部分

真正的 backend 启动非常轻：

- 构造 `DefaultNcpAgentBackend`
- `await backend.start()`

而 `backend.start()` 本身几乎只是：

- 标记 started
- 发布 ready 事件

对应代码：

- [agent-backend.ts](/Users/peiwang/Projects/nextbot/packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-backend.ts:112)

这说明当前 `running -> ready` 过长，不是因为内核本体慢，而是因为我们把不该挡在前面的 IO 一起算进了“agent 创建完成”。

## 目标架构

## 总体结构

引入新的应用本体类：

```ts
class NextclawApp {
  private readonly bootstrapStatus = new ServiceBootstrapStatusStore();
  private readonly deferredNcpAgent = createDeferredUiNcpAgent();
  private readonly runtimeRegistry = new UiNcpRuntimeRegistry();

  private readonly sessionSearch = new SessionSearchRuntimeSupport(...);
  private readonly learningLoopRuntime = new LearningLoopRuntimeService(...);

  private backend: DefaultNcpAgentBackend | null = null;
  private mcpSupport: NextclawAppMcpSupport | null = null;
  private uiStartup: UiStartupHandle | null = null;

  private phase: NextclawAppPhase = "idle";
  private kernelState: StartupState = "pending";
  private durableStateState: StartupState = "pending";
  private capabilityWarmupState: StartupState = "pending";

  start = async (): Promise<void> => {
    await this.bootstrapKernel();
    await this.recoverDurableState();
    void this.warmDerivedCapabilities();
  };
}
```

其中：

- `NextclawApp` 是唯一 owner
- 所有核心组件默认挂在 `this`
- 启动阶段不传 context，只改应用内部状态

## 三阶段模型

### Phase 1: `bootstrapKernel()`

职责：尽快把聊天主链搭起来，让应用达到 `kernel-ready`。

允许包含：

- runtime registry 基础注册
- native runtime 注册
- plugin runtime registration controller 创建
- session store / session creation / request broker 搭建
- backend 构造
- `await backend.start()`
- deferred NCP agent 激活

不允许包含：

- MCP prewarm
- session search 全量初始化
- 任何“只影响附加能力，不影响首条消息”的 probe、catalog 加载、索引构建

完成定义：

- `this.backend !== null`
- deferred NCP agent 已激活到真实 backend
- UI 聊天请求主链可用
- bootstrap status 可标记 kernel ready

### Phase 2: `recoverDurableState()`

职责：恢复真正影响正确性的持久化事实。

关键原则：

- 只恢复“没有它就可能让第一条消息错、丢、乱”的状态
- 绝不把派生缓存、派生索引、能力 catalog 混进来

当前第一版设计里，这一阶段应尽量保持极薄，甚至允许阶段内暂时没有额外 IO。

原因：

- `SessionManager` 这类原始事实读取本来就是按需的
- 现有 session search 索引并不是原始事实，而是派生数据
- MCP catalog 也不是原始事实

因此本阶段的合理结果很可能是：

- 有显式阶段，但内容极少
- 用它明确表达“架构搭建”和“持久化恢复”是两回事
- 为后续真正需要的 durable recovery 预留稳定位置

### Phase 3: `warmDerivedCapabilities()`

职责：后台补齐“有了更好、没有也不该挡主链”的能力。

初始纳入：

- MCP prewarm
- session search 初始化与全量建索引

后续可纳入：

- probe 型运行时检查
- 某些 plugin capability catalog 预热
- 其它不影响首条消息主链的扩展能力

完成定义：

- warm 成功则标记 `capabilityWarmupState=ready`
- 部分失败则标记 `degraded`
- 不反向污染 kernel ready

## 子系统解耦方案

### MCP: 从“创建 + 预热绑定”改为“两段式”

当前问题：

- `createMcpRuntimeSupport()` 同时做了 support 构造与 prewarm

目标改造：

```ts
type NextclawAppMcpSupport = {
  toolRegistryAdapter: McpNcpToolRegistryAdapter;
  applyMcpConfig: (config: Config) => Promise<void>;
  warmInBackground: () => Promise<void>;
  dispose: () => Promise<void>;
};
```

拆分后语义：

- `buildMcpSupport()`：只创建 support，不 warm
- `warmInBackground()`：后台执行 prewarm

这样 `bootstrapKernel()` 里只需拿到 adapter，首条消息就能构造 runtime；是否已经预热所有 MCP server，不再阻塞 kernel ready。

### Session Search: 从“启动前全量初始化”改为“未 ready 前不暴露工具”

这块不能只把 `await initialize()` 后移，否则会留下半成品语义。

必须同时改合同：

```ts
type SessionSearchWarmupState =
  | "pending"
  | "running"
  | "ready"
  | "disabled"
  | "error";
```

并要求：

- `createAdditionalTools()` 只有在 `ready` 时才返回 search tool
- `initialize()` 放到 `warmDerivedCapabilities()` 后台执行
- 未 ready 前，系统 simply 不暴露 search capability，而不是暴露一个会在调用时失败的工具

这保证行为可预测，也符合“统一入口优先，但不要制造半成品体验”的产品原则。

### Runtime Registration: 保留同步搭建，避免额外后置复杂度

`UiNcpRuntimeRegistry`、内建 runtime 注册、plugin runtime registration controller 目前主要是结构搭建与同步注册，不是关键阻塞点。

因此第一版不建议过度拆它们。

策略：

- 保持在 `bootstrapKernel()` 内同步完成
- 只把真正有 IO 的 runtime probe / healthcheck 排除在 kernel ready 语义之外

## 状态模型标准化

后端 bootstrap status 不再只用 `ncpAgent.state` 粗暴表达整条链路，而是应拆成三组状态：

```ts
type NextclawAppBootstrapStatus = {
  phase: "idle" | "bootstrapping-kernel" | "recovering-durable-state" | "warming-derived-capabilities" | "ready" | "degraded" | "error";
  kernel: {
    state: "pending" | "running" | "ready" | "error";
    startedAt?: string;
    completedAt?: string;
    error?: string;
  };
  durableState: {
    state: "pending" | "running" | "ready" | "error";
    startedAt?: string;
    completedAt?: string;
    error?: string;
  };
  derivedCapabilities: {
    state: "pending" | "running" | "ready" | "degraded" | "error";
    startedAt?: string;
    completedAt?: string;
    error?: string;
  };
};
```

产品语义：

- `kernel.ready`：聊天主链已经可用
- `durableState.ready`：必需持久化恢复完成
- `derivedCapabilities.ready/degraded`：附加能力补齐情况

对前端最重要的规则：

- UI 能否允许第一条消息发送，只看 `kernel.ready`
- capability warmup 不再把聊天整体挡住

## `NextclawApp` 的建议成员结构

### 类字段 / 构造阶段

适合放在类字段或 constructor 中创建：

- `bootstrapStatus`
- `deferredNcpAgent`
- `runtimeRegistry`
- `sessionSearch`
- `learningLoopRuntime`
- plugin runtime registration controller
- 其它纯结构型 owner

### 运行期可空成员

由阶段 action 填充：

- `backend`
- `mcpSupport`
- `uiStartup`
- `assetStore`
- `sessionCreationService`
- `sessionRequestBroker`

### 阶段状态成员

- `phase`
- `kernelState`
- `durableStateState`
- `capabilityWarmupState`
- `startupError`

## 迁移步骤

### Step 1: 引入 `NextclawApp`

新建应用本体类，先只承接当前 UI NCP 启动主链，不求一步到位吃掉所有 service 逻辑。

目标：

- 让 `service-gateway-startup.ts` 不再自己拼装主链
- 外部只做 `await app.start()`

### Step 2: 把 `createUiNcpAgent(...)` 拆进 `NextclawApp`

把当前 `createUiNcpAgent(...)` 中的逻辑拆到：

- `bootstrapKernel()`
- `recoverDurableState()`
- `warmDerivedCapabilities()`

并保留现有稳定组件实现，先不做无必要重写。

### Step 3: MCP support 两段式改造

- 把 support 构造与 prewarm 拆开
- `bootstrapKernel()` 只拿 adapter
- `warmDerivedCapabilities()` 再后台执行 prewarm

### Step 4: Session search 工具门控

- session search 增加显式 warmup state
- search tool 只在 ready 时暴露
- initialize 后移到 capability warmup

### Step 5: Bootstrap status 合同升级

- `ServiceBootstrapStatusStore` 改为三段状态模型
- 前端改为消费新的结构化状态，而不是继续把 `ncpAgent.state` 当总代表

### Step 6: 清理旧 helper / 隐式 orchestration

目标是让最终启动主链收敛成：

```ts
await app.start();
```

而不是外部仍然散落：

- 标记 running
- 创建 agent
- 激活 deferred agent
- 手动 warm 其它能力

## 测试与验证计划

### 单元测试

新增或改造测试覆盖：

1. `bootstrapKernel()` 完成后即可发送首条消息
2. capability warmup 失败不影响 kernel ready
3. session search 未 ready 前不会暴露 tool
4. MCP prewarm 在后台执行，不阻塞 deferred agent 激活
5. `bootstrapStatus` 正确反映三阶段状态

### 定向链路测试

1. 冷启动后立刻打开聊天页
   预期：在 capability warmup 未完成前，聊天仍可在 kernel ready 后开始使用
2. 关闭 / 破坏 MCP server
   预期：聊天主链仍可工作，capabilities 状态可降级
3. 大量历史 session 存在时启动
   预期：session search 后台慢慢恢复，不影响第一条消息

### 验证命令

- `pnpm -C packages/nextclaw tsc`
- 受影响测试文件的定向 vitest / test 命令
- 启动链路定向 smoke

## 风险与控制

### 风险 1：过早暴露半成品能力

控制：

- capability 未 ready 前不暴露对应 tool / session type 入口

### 风险 2：把本应属于 durable state 的内容误后移

控制：

- 以“是否影响首条消息正确性”为唯一准绳
- 第一版 `recoverDurableState()` 宁可偏保守偏小，也不要把派生数据塞进去

### 风险 3：`NextclawApp` 变成 God object

控制：

- `NextclawApp` 只 owning 应用启动与核心设施，不吞掉领域业务实现
- 具体能力仍留在各自稳定类中，`NextclawApp` 负责持有与编排

## 设计结论

这次重构不应该被理解为“给当前启动链挪几个 `await`”，而应该被理解为：

- 用 `NextclawApp` 收回应用本体 ownership
- 用显式阶段 action 标准化启动主链
- 把“搭建架构”“恢复必需持久化状态”“预热衍生能力”拆成三个不同层次
- 把 `ready` 收紧成“聊天主链已可用”的明确产品语义

最终目标不是让代码“更花哨”，而是让应用结构更清晰、更简单、更可读，避免任何核心流程逻辑继续外泄到外部 orchestration 中。
