---
name: classic-software-design-principles
description: 当讨论或修改架构、模块职责、owner、生命周期、对象边界、状态归属、helper/service/class 拆分、重构方案，或用户要求“编程原则”“最佳实践”“底层思想”“不要张口就来”时使用。用于先深挖用户真实意图与约束，再用 GRASP、SOLID、Tell Don't Ask、Law of Demeter、封装、高内聚低耦合等经典原则校准设计，避免空心 owner、假注入、乱兼容和重复职责。
---

# Classic Software Design Principles

## 目标

用成熟软件工程原则约束设计判断，避免临时发明概念、换名包装、字段搬运、setter 包装、过度拆层、空心 owner 和内部兼容路径长期并存。

使用本 skill 时，先做原则校准，再写方案或代码。用户指出“偏航、过度设计、职责不清、最佳实践是什么”时，必须暂停实现，先用本 skill 复盘。

## 深层意图对齐

架构讨论、用户连续纠偏、用户质疑方案“为什么这样做”时，即使没有显式启动“深思模式”，也必须自动进入深思模式并深挖方案：

- 先复述用户真正要守住的工程原则，而不是只回答表层问题。
- 先判断用户是在要求方案讨论、机制改进、代码实现、还是持久化规则；不要过早落盘或动代码。
- 至少给出一个推荐方案和必要取舍；如果方案空间确实存在分歧，给出多个方案并明确推荐。
- 用户已经指出方向时，优先顺着其核心原则举一反三，而不是用局部技术名词重新发明一层。
- 如果现有 skill 本应挡住问题却没有挡住，联动 `learning-from-failures` 做机制修正。

## 原则清单

- `deletion-first`：能删代码就尽量删代码；新增结构前先找可以删除、合并或收敛的旧路径。
  - 关键点：非新增用户能力的改动，默认应通过删除旧实现、合并重复入口、收敛 owner 或减少分支来完成。
  - 关键点：如果必须新增代码，要同时说明它删除了什么重复职责，或为什么当前没有可删路径。
  - 关键点：不要靠缩短命名、折叠语句、隐藏复杂度或把复杂度外移来伪造净减。
  - 坏味道：旧 manager、旧 registry、旧 helper、旧 adapter 还在，又新增一套“更干净”的平行实现。

- `information-expert`：职责交给拥有完成该职责所需信息的对象。
  - 关键点：状态、不变量、派生规则和失效规则应归同一个 owner。
  - 关键点：不要让路过的 runtime/helper/controller 搬运别人的状态。
  - 坏味道：`Result` 返回多组必须同步的字段，然后调用方逐个赋值。

- `complete-owner`：真正的 owner 必须覆盖自己的领域闭环，不做空心壳。
  - 关键点：owner 自己创建/持有核心对象，维护状态、不变量、生命周期和对外语义。
  - 关键点：上层只传 owner 无法自知的外部事实，例如用户输入、配置快照、环境路径、观测端口或明确策略。
  - 关键点：不要把 owner 应该会做的创建、路由、缓存、恢复、reload 逻辑拆成 `createXxx` / `resolveXxx` / `getXxx` 参数塞进去。
  - 坏味道：新 owner 的构造参数里塞满 factory/deps，而这些正是该 owner 的核心职责。

- `responsibility-surface-minimization`：先定义职责边界、感知范围和最小依赖，再暴露自定义能力。
  - 关键点：设计 owner 前先说清它负责什么、不负责什么、能感知哪些事实、不能感知哪些事实。
  - 关键点：owner 自己能稳定推导或决定的内部实现细节，不应作为上层参数暴露。
  - 关键点：上层只传跨边界外部事实、明确策略、用户选择、测试替身或真正需要开放的扩展点。
  - 关键点：可配置能力必须服务真实变化点，并保持最小、命名明确、语义完整。
  - 坏味道：把 `homeDir/workspace/configPath/sessionsDir/factory` 等不同层级的信息混在同一个 options 里，让下级 owner 感知超过职责边界的信息。

- `single-domain-owner`：同一领域只保留一个事实 owner。
  - 关键点：不能同时存在两个 `XxxManager` / `XxxRuntime` / `XxxRegistry` 都能管理同一能力。
  - 关键点：迁移时必须明确最终 owner、旧 owner 删除点和调用方切换路径。
  - 坏味道：新旧 manager 都能 resolve/create/mutate 同一领域对象。

- `direct-child-access`：下级 owner 已存在时，调用方应直接访问该职责 owner，不要让父级重复包一层。
  - 关键点：父级 owner 负责组合和生命周期编排，下级 owner 负责领域能力。
  - 关键点：不要写 `getPluginRegistry = () => this.plugins.getRegistry()` 这类同名透传。
  - 关键点：调用方需要领域能力时用 `runtime.plugins.getRegistry()`，而不是父级重新暴露一套 API。
  - 坏味道：父级继续写一批 forwarding 方法，或新增 `asOldManager()` / `getLegacyXxx()`。

- `constructor-builds-graph`：`constructor` 建立同步、确定、长期持有的对象图；生命周期方法驱动状态装配和副作用。
  - 关键点：顶层 owner 可以在 `constructor` 中创建并持有强内聚下级 owner。
  - 关键点：`load/reload/start/stop/dispose` 负责配置装载、状态恢复、订阅、进程、网络等副作用。
  - 坏味道：`hydrateXxx(...)` 说不清是 load、start、reload、warm 还是 sync。

- `no-compatibility-by-default`：兼容不是默认选项，内部重构不应为了少改调用方长期保留双入口。
  - 关键点：除非有外部契约约束，否则直接改调用方并删除旧路径。
  - 关键点：临时兼容必须有必要性、范围、owner、删除点。
  - 坏味道：getter alias、proxy、adapter、`asXxx()`、旧字段和新字段长期并存。

- `tell-dont-ask`：告诉对象你的意图，让它自己做；不要问出一堆数据后替它做。
  - 关键点：调用 owner 的业务方法，而不是读散字段后在外层拼流程。
  - 关键点：业务层之间优先传具体 owner 对象，不把 owner 拆成多个小参数。
  - 坏味道：业务对象之间传 `configPath`、`bus`、`sessionManager`、`getXxx` 等碎片参数，而调用方其实已有上级 owner。

- `high-cohesion-low-coupling`：强相关状态和变化原因放在同一 owner，调用方知道的内部细节越少越好。
  - 关键点：一个模块只有一个主要变化原因。
  - 关键点：生命周期编排、插件索引、进程监督、协议适配不要塞进同一个对象。
  - 坏味道：上层 controller/runtime 既加载数据、又派生索引、又启动进程、又处理 reload。

- `protected-variations`：把容易变化的点封装在稳定边界后面，不把变化扩散到主流程。
  - 关键点：新增能力应扩展明确 owner，而不是反复改主流程分支。
  - 关键点：非领域类只有在降低耦合、提高复用或隔离外部协议时才成立。
  - 坏味道：`Manager/Runtime/Host/Context/Options/Props` 只是换名承载同一批字段。

- `protocol-event-purity`：当事件名引用既有协议或领域事实时，payload 应保持该事实本体。
  - 关键点：路由上下文、展示字段、权限信息和派生 metadata 属于独立职责。
  - 关键点：不要把独立职责混入同名协议事件。
  - 坏味道：为了少传一个上下文对象，把 channel/account/display 字段塞进协议 payload。

- `request-bus-decoupling`：跨 owner 的请求/输出链路优先通过请求总线、事件总线或 subject 解耦，避免上游直接控制下游 runtime。
  - 关键点：新增总线前先查是否已有通用入口；NextClaw 内部请求默认优先复用 `Ingress`，运行输出默认优先复用已有 `EventBus` / `eventKeys.ncpEvent`。
  - 关键点：请求发起者只发布意图并按 `requestId/correlationId` 等稳定关联键等待结果；真正拥有 runtime/backend 的 owner 在生命周期中订阅请求并执行。
  - 关键点：不要为了当前请求再造一套 output event；如果已有协议事件完整表达输出，应直接监听既有事件并做关联。
  - 关键点：runtime owner 负责订阅请求、调用 backend、让 backend 发布既有 event stream，并在 dispose 时退订。
  - 坏味道：dispatcher/request manager 直接持有 `AgentRuntimeManager`、读取 `currentBackend`、或通过 `connectXxx()` 后补依赖来执行请求。

- `cqs-pure-read`：查询和命令分离，读状态的方法不应暗中改变状态。
  - 关键点：`read/get/list/status/discover/report` 路径应保持纯读。
  - 关键点：改变状态的方法应表达业务意图。
  - 坏味道：页面加载或 status 请求顺手注册能力、写状态或启动外部系统。

## 设计检查顺序

1. 先找可删路径：哪些旧实现、重复入口、兼容桥或无意义中间层可以直接删除？
2. 找不变量：哪些字段必须始终同步变化？它们通常属于同一个 owner。
3. 找 `information-expert`：谁最知道这些不变量如何产生、更新、校验和失效？
4. 查 `complete-owner`：新 owner 是否拥有领域闭环，还是空心注入？
5. 查 `responsibility-surface-minimization`：owner 的感知范围、最小依赖和自定义表面是否匹配职责边界？
6. 查 `single-domain-owner`：同一领域是否存在两个事实 owner？
7. 查 `direct-child-access`：父级是否在重复转发下级 owner 的能力？
8. 查 `request-bus-decoupling`：跨 owner 请求链路是否应该通过总线发布/订阅，而不是直接持有 runtime/backend。
9. 区分对象图创建和生命周期：`constructor` 建图，`load/reload/start/stop/dispose` 驱动副作用。
10. 检查兼容：旧入口是否应该删除，而不是保留 alias/proxy/adapter。
11. 检查命名：新名字是否对应真实职责，否则就是结构搬运。

## 推荐模式

### 状态 owner 模式

```ts
class PluginCatalog {
  private registry = createEmptyPluginRegistry();
  private extensionRegistry = toExtensionRegistry(this.registry);
  private channelBindings = getPluginChannelBindings(this.registry);

  reload = async (config: Config): Promise<void> => {
    const registry = await loadRegistry(config);
    this.registry = registry;
    this.extensionRegistry = toExtensionRegistry(registry);
    this.channelBindings = getPluginChannelBindings(registry);
  };

  getExtensionRegistry = () => this.extensionRegistry;
  getChannelBindings = () => this.channelBindings;
}
```

### 生命周期编排模式

```ts
class GatewayRuntime {
  private readonly plugins = new PluginCatalog(...);
  private readonly pluginGateways = new PluginGatewaySupervisor(...);

  start = async (): Promise<void> => {
    await this.plugins.reload(this.config);
    await this.pluginGateways.start(this.plugins);
  };
}
```

重点：上层调度生命周期，下层维护自身状态。不在上层搬运下层字段。

## 输出要求

讨论方案时先给出：

- 命中的原则 key，例如 `complete-owner` / `single-domain-owner`；
- 当前设计违反了什么原则；
- 正确 owner 是谁；
- 能删除哪些旧路径、重复入口、兼容桥或无意义中间层；
- constructor 负责什么，生命周期方法负责什么；
- 哪些名字、helper、result、setter 应该删除或改成职责对象。
- 为什么这个 owner 是完整闭环，而不是空心壳；
- 这个 owner 的职责边界、感知范围、最小依赖和可配置表面分别是什么；
- 哪些兼容/迁移桥不应该保留，旧路径删除点是什么。

写代码前必须用一句话确认：这次是在落实哪个经典原则，而不是新增包装层。
