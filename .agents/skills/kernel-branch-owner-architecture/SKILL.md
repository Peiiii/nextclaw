---
name: kernel-branch-owner-architecture
description: 当设计或重构主干/分支架构、kernel、desktop main、runtime host、presenter-manager-store、manager/store/presenter、生命周期装配、多 service 初始化、owner 依赖关系、贡献点 contribution，或用户指出 factory/create 函数/registry/装配层过度抽象、owner 被方法参数临时传递、manager/service/store 懒创建导致生命周期不确定时使用。适用于判断主干该直接持有什么、分支之间是否能直接依赖、什么时候需要 contribution/registry，什么时候应该删除 createXxx/factory wrapper，什么时候应该把稳定 owner 依赖放回 constructor，以及长期 owner 是否应确定性创建。
---

# Kernel Branch Owner Architecture

## 核心判断

NextClaw 的 kernel 思想不是“多包一层 factory”，而是：

- 主干负责初始化、持有和启动各个长期分支。
- 分支是有真实业务闭环的 owner，例如 manager / service / presenter / store owner。
- 分支之间如果存在稳定语义依赖，可以直接依赖对方，不必绕 create 函数、factory、registry 或 callback。
- 稳定 owner 依赖应该进入 constructor，由对象长期持有；不要在每次方法调用时临时传入 manager / store / presenter，也不要把 owner 包成函数参数传递。
- 上级 owner 创建时，应尽量确定性创建自己的长期 manager / service / store 分支；避免 `ensureXxx()` 让稳定分支处于“可能存在也可能不存在”的不确定生命周期。
- 只有动态生态、外部扩展、插件贡献、跨边界注册才需要 contribution / registry。
- 有生命周期的分支必须显式暴露无参数 `start()` 和 `dispose()`，内部订阅、watcher、临时 stream、runtime dispose、IPC 注册、菜单/tray 注册等统一注册到 `cleanups` 数组。
- 分支命名优先使用 `manager`；更细分的外部连接/协议协作可按需使用 `service`，数据存储、缓存、持久化 owner 使用 `store`。
- `service` 和 `store` 通常由对应 `manager` 持有、创建和管理；不要把细分协作者平铺成主干一级分支。前端组件订阅 store 是视图连接例外，不代表 store 生命周期 owner 转移给组件。

这套思想也适用于前端 `presenter + manager + store`：presenter 是前端主干，manager 是业务分支，store 是状态 owner；业务组件连接最近的业务 owner，而不是把状态和动作层层透传。

## 目标结构

优先形成这种形状：

```ts
class ProductKernel {
  readonly eventBus = new EventBus();
  readonly configManager = new ConfigManager();
  readonly sessionManager = new SessionManager({ configManager: this.configManager });
  readonly runtimeManager = new RuntimeManager({
    configManager: this.configManager,
    sessionManager: this.sessionManager,
  });

  start = () => {
    this.runtimeManager.start();
  };

  dispose = () => {
    this.runtimeManager.dispose();
  };
}
```

前端对应形状：

```ts
class AppPresenter {
  readonly sessionManager = new SessionManager();
  readonly commandManager = new CommandManager({
    sessionManager: this.sessionManager,
  });
}
```

避免这种形状：

```ts
class RuntimeCommandService {
  resolve = async (bundleManager: BundleManager) => {
    await bundleManager.ensureReady();
  };
}
```

如果 `RuntimeCommandService` 的业务语义稳定依赖 `BundleManager`，应该改成：

```ts
class RuntimeCommandManager {
  constructor(private readonly bundleManager: BundleManager) {}

  resolve = async () => {
    await this.bundleManager.ensureReady();
  };
}
```

## 主干职责

主干可以直接做：

- 持有长期单例分支。
- 决定分支创建顺序。
- 在自身初始化阶段确定性创建长期分支，让对象图稳定可读。
- 传递外部事实，例如路径、配置入口、事件总线、环境能力、宿主 API。
- 调用 `start()` / `dispose()` 等标准生命周期入口。
- 暴露稳定分支给上层 controller / UI / contribution。

主干不应该做：

- 替分支执行业务规则。
- 把分支核心能力拆成一堆 `createXxx` / `resolveXxx` / `getXxx` 函数再传回分支。
- 在业务方法调用时反复把同一个稳定 owner 当参数传入，导致依赖关系藏在调用点而不是对象结构里。
- 为稳定分支写一堆 `ensureXxx()` 懒创建入口，导致调用顺序隐含创建顺序、生命周期不透明。
- 为了让 main 文件短而新增无语义的 factory / registry / service wrapper。
- 把纯装配 helper 冒充成架构 owner。

## 分支职责

分支 owner 应该自己拥有领域闭环：

- 自己持有内部状态、缓存、订阅、清理集合。
- 自己创建和管理私有 `service` / `store` 协作者，除非协作者是外部系统边界、共享单例或测试替身。
- 自己暴露意图级方法，而不是要求调用方传入内部中间态。
- 自己负责 dispose / cleanup，不把清理逻辑散回主干。

如果一个 class 只是 `new` 其他对象，或者只把 `createXxx()` 包起来，它通常不是分支 owner。

## 命名优先级

主干下的稳定业务分支，默认命名为 `XxxManager`：

- manager：业务能力、流程编排、状态迁移、生命周期、跨分支协作的 owner。
- service：更细分的外部系统连接、协议适配、IO 协作、无状态或弱状态能力；通常不作为主干一级业务分支的默认名字。
- store：数据层 owner，负责存储、缓存、持久化、索引、读写一致性。
- presenter：前端主干或面向视图的总协调 owner。

判断顺序：

1. 这个分支是否拥有业务闭环、生命周期或跨分支编排？是则优先 `manager`。
2. 是否主要连接外部系统、协议、进程、文件或网络，且自身不拥有核心业务状态？可以用 `service`。
3. 是否主要负责数据存储、缓存、持久化或索引？用 `store`。
4. 是否只是装配其他对象？不要新命名，回到主干直连或删除。
5. 如果 service/store 只服务于一个 manager，把它留在 manager 内部创建和管理。

不要因为目录叫 `services/` 就把主分支命名成 service；如果它是业务 branch owner，应优先调整目录或文件角色，而不是牺牲语义命名。

默认持有关系：

- 主干持有稳定业务 `manager`。
- manager 持有并管理自己需要的 `service` / `store`。
- service / store 不应因为被多个方法使用就升格为主干一级分支；只有跨多个 manager 共享同一个生命周期或公共数据 owner 时才考虑提升。
- 前端 React 组件可以直接订阅 store、调用 presenter/manager，这是视图响应式连接；组件不因此拥有 store 生命周期，也不负责创建/销毁 store。

## 生命周期模式

只要 manager / service / presenter 分支拥有订阅、watcher、后台任务、临时 stream、runtime 实例或外部资源，就必须使用统一生命周期表面：

```ts
type Cleanup = () => void;

class RuntimeManager {
  private readonly cleanups: Cleanup[] = [];
  private started = false;
  private disposed = false;

  start = (): void => {
    if (this.started) return;
    this.started = true;
    const unsubscribe = this.eventBus.on("event", this.handleEvent);
    this.cleanups.push(unsubscribe);
  };

  dispose = (): void => {
    if (this.disposed) return;
    this.disposed = true;
    while (this.cleanups.length > 0) {
      this.cleanups.pop()?.();
    }
  };
}
```

规则：

- 有生命周期就带 `start` 和 `dispose`，不要用隐式构造启动长期资源。
- `start` 和 `dispose` 必须无参数；依赖通过 constructor 持有，运行期输入通过业务方法传入。
- 主干只调用每个 owner 的 `start()` / `dispose()`；不要在主干里逐个调用 `registerIpcHandlers()`、`installTray()`、`installApplicationMenu()` 这类 owner 内部启动步骤。
- 所有清理函数统一进入 `cleanups` 数组，`dispose` 同步 drain。
- `start` 负责启动和注册清理，`dispose` 负责停止和释放；不要让主干逐个知道分支内部资源。
- 不要为同一类生命周期资源新增多个平行字段，例如 `unsubscribeXxx`、`stopYyy`、`disposeZzz`。
- 除非资源释放必须等待确认，例如子进程退出、文件 flush、网络连接关闭或事务完成，否则不要把 cleanup 设计成 async，也不要在 drain 时逐个 `await`，避免非必要阻塞拖慢关闭路径。
- 如果确实需要异步关闭，把它限定在对应资源 owner 内，并说明等待语义；不要把所有 cleanup 都提升成 async。
- 如果分支没有外部资源或长期订阅，可以不写 `start` / `dispose`，但不要假装有生命周期。
- 主干只按顺序调用各分支的 `start` / `dispose`，不直接操作分支内部 cleanup。
- 主干生命周期默认也保持同步调用；只有分支启动/关闭合同确实要求等待完成时，才对该具体分支使用 `await`，不要模板化 `async start` / `async dispose`。

## 依赖规则

稳定业务依赖可以直连：

- `SessionRunManager` 依赖 `NcpSessionManager`。
- `AgentRunRequestManager` 依赖 `SessionRunManager`。
- `CommandManager` 依赖 `SessionManager`。
- 前端 `CommandManager` 可以依赖 `SessionManager` 或 store owner。

稳定 owner 依赖默认放在 constructor：

- 如果 A 的多个业务方法都需要 B，A 应该在 constructor 里依赖 B。
- 如果 A 的核心业务语义离不开 B，即使只有一个方法使用，也优先在 constructor 里依赖 B。
- 方法参数用于每次调用真正变化的业务输入，例如 command、payload、snapshot、request、options。
- 不要把 manager / store / presenter 作为普通业务方法参数传来传去；这会让依赖拓扑从对象图退化成调用栈偶然性。
- 不要把 owner 包成 `() => owner`、`getOwner()`、`resolveOwner()` 传入，除非确实存在懒加载、循环依赖解除、跨边界能力查询或测试替身需求。

不要为了“解耦”把清晰依赖改成：

- `createSessionManager()`
- `createBundleService()`
- `resolveRuntimeScript()`
- `getManagerSnapshot()`
- `factory.create(...)`

这些只有在承接外部策略、动态插件、环境差异或测试替身时才合理。

这条规则只约束业务代码组织。若模块定位是可复用的业务无关 library，函数参数式依赖可以是合理 API 设计；判断依据是它是否拥有产品业务 owner 语义，而不是文件名或 class 名。

## 确定性生命周期

长期 owner 默认应该在上级 owner 创建时一起创建：

```ts
class DesktopApplication {
  private readonly bundleManager = new DesktopBundleManager(...);
  private readonly presenceManager = new DesktopPresenceManager(...);
  private readonly updateManager = new DesktopUpdateManager({
    bundleManager: this.bundleManager,
    presenceManager: this.presenceManager,
  });
}
```

避免这种形状：

```ts
private updateManager: DesktopUpdateManager | null = null;

private ensureUpdateManager = () => {
  this.updateManager ??= new DesktopUpdateManager(...);
  return this.updateManager;
};
```

原因：

- 对象图应该能从 constructor / field 初始化直接读出来。
- 稳定分支是否存在不应取决于哪个业务方法先被调用。
- 生命周期 owner 的启动、注册、清理顺序应该显式，而不是藏在 `ensureXxx()` 的调用顺序里。

允许 lazy 的情况：

- 资源确实昂贵，且常见路径不会使用。
- 能力是可选插件、动态贡献或环境能力，启动时无法静态决定。
- 创建必须等待异步结果或用户授权。
- 为打破真实循环依赖而采用延迟绑定，但应优先重新审视 owner 边界；保留时要让 lazy 表面尽量小。
- 缓存一次性计算结果或外部资源结果，例如 `commandSurface` 的 ensure 结果；这不是长期 owner 本身。
- 测试替身、业务无关 library、纯函数 API 的参数化构造。

## Contribution / Registry 适用条件

只有满足下面任一条件，才引入 contribution / registry：

- 能力来自插件、扩展、marketplace 或运行时动态发现。
- 多个独立模块需要向主干注册同一类能力。
- 注册/注销本身有生命周期。
- 主干不应该静态 import 具体实现。

如果能力是产品内稳定分支，主干直接 `new` 并持有即可。

## create / factory 使用边界

默认不要新增生产代码 `createXxx` 或 `XxxFactory`。

允许的情况：

- 测试数据构造。
- 纯函数式值转换，且没有长期 owner 语义。
- 根据真实外部环境选择不同实现。
- 隔离不可直接依赖的外部系统边界。
- 插件/贡献机制需要统一实例化协议。

不允许的情况：

- 只是为了减少 main 行数。
- 只是把 `new Xxx()` 换到另一个文件。
- 只是为了绕过治理命名。
- 只是为了隐藏分支之间本来清晰的依赖。
- 只是为了让一个空心 service 看起来像 owner。

## 重构步骤

1. 找主干：谁负责启动、持有和关闭这一组长期能力。
2. 列分支：哪些对象是真正业务 owner，哪些只是装配壳。
3. 校准命名：业务 branch owner 优先 manager，外部连接/协议协作用 service，数据存储/缓存/持久化用 store。
4. 校准持有关系：主干持有 manager，manager 持有自己需要的 service/store。
5. 删除空壳：优先删除无语义 factory、create wrapper、proxy、registry。
6. 直连稳定依赖：让分支通过构造参数依赖真实 owner。
7. 消除方法参数式 owner：把稳定 manager/store/presenter 依赖从业务方法参数移到 constructor；方法只接收本次调用变化的数据。
8. 确定性创建长期分支：把稳定 manager/service/store 从 `ensureXxx()` 懒创建移到上级 owner 初始化阶段；只对真正可选、昂贵、异步、动态或结果缓存保留 lazy。
9. 收回闭环：把状态、缓存、订阅、dispose 留在分支 owner 内。
10. 统一生命周期：有长期资源的分支补齐 `start` / `dispose`，并把清理职责收敛到同步 `cleanups` 数组；只有必要等待的资源才使用 async cleanup。
11. 保留 contribution：只给动态扩展点、插件和多方注册保留注册机制。
12. 验证主干可读性：主干应像系统目录，能看出有哪些分支和生命周期顺序。
13. 验证分支内聚性：每个分支应能说明自己负责的业务闭环。

## Review 检查

收尾前检查：

- 有没有新增 `Factory` / `Registry` / `createXxx`，但没有动态注册、环境选择、外部边界或测试意义。
- 有没有为了压主干行数，把清晰依赖搬到抽象装配层。
- 主干一级业务分支是否优先使用 manager 命名，而不是泛化成 service/factory。
- service 是否真的在做外部连接、协议适配、IO 协作或无状态细分能力。
- store 是否只用于数据存储、缓存、持久化和索引 owner。
- service/store 是否由对应 manager 持有和管理，而不是无理由平铺到主干。
- 前端组件直接订阅 store 时，是否只是视图连接，而没有接管 store 创建、销毁或业务生命周期。
- 主干是否仍能一眼看出系统有哪些长期分支。
- 分支之间的稳定语义依赖是否被不必要地 callback 化。
- 稳定 owner 依赖是否被放在 constructor，而不是作为每次方法调用参数传入。
- 方法参数是否只代表本次调用变化的业务数据，而不是隐藏对象拓扑的 manager/store/presenter。
- 如果存在 `() => owner`、`getOwner()`、`resolveOwner()`，是否确实有懒加载、循环依赖解除、跨边界查询或测试替身需求。
- 长期 manager/service/store 是否在上级 owner 初始化阶段确定性创建，而不是靠 `ensureXxx()` 随调用顺序创建。
- 保留的 lazy 是否属于可选/昂贵/异步/动态能力或结果缓存，而不是稳定业务分支。
- 有生命周期的分支是否暴露无参数 `start()` / `dispose()`，并用同步 `cleanups` 数组统一清理。
- 主干是否只调用标准生命周期，而没有直接操作 `register*` / `install*` / `attach*` 等分支内部步骤。
- cleanup 是否避免了非必要 async / await；若存在 await，是否有明确等待语义。
- 是否存在多个平行 cleanup 字段，导致主干或调用方需要理解分支内部资源。
- 前端组件是否把 presenter/manager/store 的能力层层透传，而不是连接最近业务 owner。
- 新增抽象是否减少真实复杂度，而不是只让路径变长、名字更正式。

## 与其他 skill 的关系

- 涉及前端 view/business/state 分层时，同时使用 `mvp-view-logic-decoupling`。
- 涉及目录和文件角色时，同时使用 `role-first-file-organization` / `file-naming-convention`。
- 涉及 fallback 或兼容路径时，同时使用 `predictable-behavior-first`。
- 用户指出无意义抽象、create/factory wrapper 或 owner 误判时，同时使用 `learning-from-failures`，并判断是否需要把教训继续沉淀到规则或治理脚本。
