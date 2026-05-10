---
name: classic-software-design-principles
description: 当讨论或修改架构、模块职责、owner、生命周期、对象边界、状态归属、helper/service/class 拆分、重构方案，或用户要求“编程原则”“最佳实践”“底层思想”“不要张口就来”时使用。用于用 GRASP、SOLID、Tell Don't Ask、Law of Demeter、封装、高内聚低耦合等经典原则先校准设计，再进入代码。
---

# Classic Software Design Principles

## 目标

用成熟软件工程原则约束设计判断，避免临时发明概念、换名包装、字段搬运、setter 包装和过度拆层。

使用本 skill 时，先做原则校准，再写方案或代码。用户指出“偏航、过度设计、职责不清、最佳实践是什么”时，必须暂停实现，先用本 skill 复盘。

## 核心原则

### GRASP

- **Information Expert**：职责交给拥有完成该职责所需信息的对象。不要让路过的 runtime/helper/controller 搬运别人的状态。
- **Creator**：如果一个对象聚合、持有、初始化或强依赖另一个对象，由它创建这个对象。不要由外层拼好再塞入。
- **Controller**：入口 controller 只接住系统事件并委派，不变成所有业务状态的专家。
- **High Cohesion / Low Coupling**：强相关状态和不变量放在同一 owner；调用方知道的内部细节越少越好。
- **Protected Variations**：把容易变化的点封装在稳定边界后面，不把变化扩散到主流程。
- **Pure Fabrication**：只有为降低耦合、提高复用或隔离外部协议时才创建非领域类；不能为了换名或藏字段而创建。

### SOLID

- **SRP**：一个模块只有一个主要变化原因。生命周期编排、插件索引、进程监督、协议适配不要塞进同一个对象。
- **OCP**：新增能力应通过扩展明确 owner，而不是反复改主流程分支。
- **LSP**：替代实现必须保持调用方依赖的行为契约。
- **ISP**：调用方只依赖它真正需要的接口，避免传入大包对象再只用几个字段。
- **DIP**：高层策略依赖稳定抽象或职责对象，不依赖低层散字段和内部数据形状。

### 其他经典原则

- **Encapsulation / Information Hiding**：封装不是 `private` 字段，而是让外部不需要知道内部状态如何同步。
- **Tell, Don't Ask**：告诉对象你的意图，让它自己做；不要问出一堆数据后替它做。
- **Law of Demeter**：少知道原则。避免 `a.b.c.d` 或多层透传。
- **Composition over Inheritance**：用组合表达职责模块和生命周期，不用继承或平铺字段承载所有变化。
- **CQS**：查询和命令分离。读状态的方法不应暗中改变状态，改变状态的方法应表达业务意图。

### Owner 组合规则

- 顶层 owner 可以在 `constructor` 中创建并持有下级 owner；下级 owner 承担某一块内聚职责。
- 在职责拆分场景中，下级 owner 可以持有上级 owner 引用，用于访问同一启动周期内的共享组件、生命周期状态和协作能力；这比给下级 owner 的每个方法传一堆参数更清晰。
- 如果下级 owner 已经存在，父级不要再为它的每个方法写同名透传，例如 `getPluginRegistry = () => this.plugins.getRegistry()`。调用方应直接通过 `runtime.plugins.getRegistry()` 访问该职责 owner。
- 删除重复表面不能用 getter / proxy / alias 假装完成。例如把字段改成 `get cronService() { return this.cron; }` 仍然保留了两个公共入口；必须改调用方使用唯一语义入口，或承认底层 contract 名称应保留。
- 父级只负责协调大生命周期；属于下级职责的 load/reload/start/stop/apply/publish 不应散落在父级。
- 业务层之间优先传递具体 owner 对象，而不是把 owner 拆成多个小参数再到处传。小参数只适合纯工具函数、纯计算函数或明确的跨业务解耦协议边界。

## 设计检查顺序

1. **先找不变量**
   哪些字段必须始终同步变化？这些字段通常属于同一个 owner。

2. **再找 Information Expert**
   谁最知道这些不变量如何产生、更新、校验和失效？它就是首选 owner。

3. **区分对象图创建和生命周期**
   `constructor` 建立同步、确定、长期持有的对象图；`start/stop/reload/dispose` 只驱动生命周期副作用。

4. **区分职责对象和数据包**
   好的依赖是职责对象：`catalog.reload(config)`。
   坏的依赖是数据搬运：`const result = load(); this.a = result.a; this.b = result.b`。

5. **判断 helper 是否越界**
   helper 只能做纯计算、纯转换、纯协议适配。只要它改状态、维护生命周期、缓存或协调多个对象，就应该回到 owner class。

6. **检查命名是否有真实语义**
   新名字必须对应真实职责：生命周期 owner、协议边界、持久化边界、权限边界、外部系统适配或稳定变化点。否则是结构搬运。

## 常见坏味道

- `params.runtime.xxx = ...`、`params.gateway.xxx = ...`：外部函数在改 owner 状态。
- `applyXxx(...)` 只包一堆字段赋值：setter 包装，不是业务行为。
- `hydrateXxx(...)` 说不清是 load、start、reload、warm 还是 sync：生命周期语义模糊。
- `createXxx()` 返回一坨字段给主流程继续传：对象图没有 owner。
- `Result` 里有多组必须同步的字段，然后调用方逐个赋值：不变量泄漏。
- 下级 owner 已存在，但父级继续写一批同名 forwarding 方法：多此一举，职责没有真正归位。
- 用 getter alias 隐藏重复 contract：`get xxxService() { return this.xxx; }`、`get foo() { return this.bar.foo; }` 如果只是兼容旧名字或满足另一个散字段 contract，就不是收敛，而是重复表面换皮。
- 下级 owner 每个方法都要求父级传入相同上下文参数：说明 owner 没有在 constructor 获得它的稳定依赖。
- 业务对象之间传 `configPath`、`bus`、`sessionManager`、`getXxx` 等碎片参数，而调用方其实已经拥有上级 owner：说明对象边界被拆散，应改为依赖 owner。
- `Manager/Runtime/Host/Context/Options/Props` 只是换名承载同一批字段：结构搬运。
- 上层 controller/runtime 既加载数据、又派生索引、又启动进程、又处理 reload：违反 SRP 和 High Cohesion。

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

- 命中的经典原则；
- 当前设计违反了什么原则；
- 正确 owner 是谁；
- constructor 负责什么，生命周期方法负责什么；
- 哪些名字、helper、result、setter 应该删除或改成职责对象。

写代码前必须用一句话确认：这次是在落实哪个经典原则，而不是新增包装层。
