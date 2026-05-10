# Gateway Runtime Ownership And Webhook Design

## 执行计划

- 当前落地计划：[Gateway Runtime Owner Execution Plan](../plans/2026-05-10-gateway-runtime-owner-execution-plan.md)

## 目标

本方案用于收敛 NextClaw gateway 启动链路的职责分配。

当前问题不是某个字段命名不好，而是 gateway 运行期能力被拆成多个零散 helper、context、factory、register 链路后，由外层函数手动拼装。结果是：

- owner 不清楚；
- 生命周期不清楚；
- 同一个 gateway 启动期能力在多处创建、传递、补齐；
- 类型上反复出现 optional、nullable、getter；
- 代码阅读时需要沿着多层 `createXxx` / `register` / context 对象追踪。

预期目标是：一次 gateway 启动对应一个明确的 runtime owner。上层只传入最本质依赖，具体 gateway 组件由 runtime owner 自己创建和持有。

## 核心判断

`NextclawServiceRuntime` 是长期存在的 CLI/service facade，不应该持有 gateway 运行期状态。

`NextclawGatewayRuntime` 应该表示一次具体 gateway 启动期间的 runtime owner。它不是散参数对象，不是 context bag，也不是一堆已经创建好的组件的容器。

UI server 不参与组装 gateway，也不维护单独的 gateway runtime / host / props 概念。生产链路里只有 `NextclawGatewayRuntime` 这一个 gateway owner。UI server 只在启动瞬间接收 runtime 投影出来的 server 入参：

```ts
await startUiServer({
  // 只包含 server 实际需要的能力。
});
```

这个入参不能被命名成 `ServiceGateway`、`GatewayShell`、`UiServerGateway` 或其他新模型；它不是领域对象，只是一次函数调用参数。

进入 server 的能力必须是确定的，不用 `?`，不用 `| undefined`，不靠调用顺序补字段。server 层如果需要 TypeScript 约束，只能约束 `startUiServer(...)` 的函数参数，不导出 `NextclawGatewayRuntime`、`ServiceGateway`、`ServiceGatewayShell`、`UiServerGateway`、`StartUiServerGateway` 这类独立 gateway 模型。

## 当前代码对齐状态

本节用于防止方案文档把“最终目标”误写成“当前已经完成”。

已经完成：

- server 侧导出的 gateway 换皮类型已删除；
- `packages/nextclaw-server/src/ui/server.types.ts` 已删除；
- `startUiServer(gateway)` 已改为接收单个 gateway 参数；
- server 包不再导出 `NextclawGatewayRuntime` / `UiServerGateway` / `StartUiServerGateway` 这类 gateway 模型。
- service 侧已落地 `NextclawGatewayRuntime` 作为 gateway 启动 owner；
- `GatewayConfigManager`、`GatewayWorkspaceManager`、`GatewayRemoteManager`、`GatewayMarketplaceManager`、`GatewayChannelManager`、`GatewayPluginManager` 已拆到独立 manager 文件；
- classless 运行期辅助模块已改为 `.utils.ts` 并移动到对应 `utils/` 角色目录；
- 私有启动阶段命名已从 `startUiShell` 收敛为 `startUiRuntime`。

仍是过渡债务：

- `startUiServer` 的参数当前仍结构性依赖 `UiRouterOptions`，而 `UiRouterOptions` 里仍有 optional capability；最终生产链路不应继承 router 测试/控制器层的 optional contract；
- webhook 必须收敛为 gateway runtime 内部创建的通用 `WebhookService`。server 的 `/webhook` 路由只负责 HTTP JSON 边界，直接调用传入的 `webhook.handleWebhook(...)`，不再引入 `WebhookController` 或 extension 专属装配层。

结论：当前已经完成的是“server 侧不再制造 gateway 换皮类型”。尚未完成的是“service 侧形成真正的 gateway runtime owner”。

## 预期层级

目标层级应该尽量少：

```txt
NextclawServiceRuntime
  -> NextclawGatewayRuntime
    -> UI Server / NCP Agent / Channel Runtime / Plugin Runtime / Webhook
```

`RuntimeCommandService` 可以作为命令执行协调者存在，但不应该继续成为 gateway 内部组件的主要装配者。

不期望继续扩散这些中间概念：

- `GatewayShellContext`
- `GatewayStartupContext`
- `ServiceGateway`
- `ServiceGatewayShell`
- `GatewayRuntimeState` 作为外层主流程概念
- `createGateway()` / `createShellGateway()` / `initializeGateway()` 这种返回或填充 gateway bag 的伪生命周期
- `startGatewayUiShell`
- `startUiShell`
- server 侧 `NextclawGatewayRuntime` / `UiServerGateway` / `StartUiServerGateway` 之类换皮类型
- `createGatewayWebhook`
- `createServiceUiHosts`
- `createXxxHost` 薄工厂
- `new X(...).register(Y)` 反向装配链路

如果短期不能一次性删除全部 helper，也应该把它们收为 `NextclawGatewayRuntime` 的内部实现细节，而不是主流程概念。

## Constructor 与 Start 边界

`NextclawGatewayRuntime` 实例本身就是一次 gateway runtime。它不应该再创建或返回另一个 gateway 对象。

正确边界：

- `constructor` 建立同步、确定、长期持有的 runtime 能力；
- `start()` 执行真正启动副作用；
- 不要新增 `init()` / `initializeCoreComponents()` / `createGateway()` 这类伪 constructor；
- 不要让私有方法返回一坨 `gateway` 字段再被主流程传来传去；
- 如果一个能力属于 gateway 生命周期，就直接成为 `NextclawGatewayRuntime` 的字段。
- 外部 helper 不允许直接给 runtime 字段赋值，例如 `params.runtime.pluginRegistry = ...`。helper 只能返回计算结果；runtime 自己决定如何更新自己的字段。否则就是把 owner 状态泄漏给路过函数。

目标形态：

```ts
class NextclawGatewayRuntime {
  private readonly messageBus = new MessageBus();
  private readonly appEventBus = nextclaw.eventBus;
  private readonly sessionManager: SessionManager;
  private readonly cron: CronService;

  constructor(private readonly deps: GatewayRuntimeDeps) {
    this.sessionManager = new SessionManager(...);
    this.cron = new CronService(...);
  }

  start = async (): Promise<void> => {
    await this.startUiServer();
    await this.startDeferredRuntime();
  };
}
```

异步资源、外部监听、server 启动、channel 启动、NCP agent 启动、文件 watcher 启动都属于 `start()`，不是 constructor。

## 启动阶段归属

保留 shell-first 启动策略，但它应该是 `NextclawGatewayRuntime` 的内部阶段，不应该变成外部 context / props / host 类型。

目标形态：

```txt
new NextclawGatewayRuntime(...)
  -> constructor
     - 读取配置
     - 创建 workspace / session / cron / messageBus / appEventBus
     - 建立同步、确定、长期持有的 runtime 字段
  -> start()
     - 启动 UI server
     - 暴露 bootstrap status
     - 加载 plugin registry
     - 创建 provider / channel / extension / config reload 相关能力
     - 注册 webhook handlers
     - 连接现有 /ws 实时事件通道
     - 启动 NCP agent
     - 加载 plugins / 启动 deferred runtime 能力
     - 启动 plugin gateways / channels / extension processes
     - 唤醒 sentinel / deferred jobs
```

这些阶段可以是私有方法或内部状态机，但不能形成新的外部模型。不得导出 `GatewayShellContext`、`GatewayStartupContext`、`ServiceGateway`、`ServiceGatewayShell`、`StartUiServerGateway` 等临时概念。

## Gateway Runtime 职责

`NextclawGatewayRuntime` 应该自己创建并持有 gateway 启动期组件，但不应该把 constructor 变成所有字段的散装清单。

当前确定的职责收敛边界：

- `configManager`：拥有 `configPath`、启动配置快照、`uiConfig`、`uiStaticDir`、`loadGatewayConfig()`、`applyLiveConfigReload()` 与 `ConfigReloader`；
- `workspaceManager`：拥有 gateway workspace 与 `initializeAgentHomeDirectory`；
- `remoteManager`：拥有 `remoteModule` 与 `remoteAccess`；不包含 `runtimeControl` / `runtimeUpdate`；
- `marketplaceManager`：拥有 marketplace API 配置与 installer；
- `gatewayChannels`：拥有 deferred channel starter、dev hot reload 包装与 channel lifecycle start；
- `plugins`：拥有 plugin registry、extension registry、channel bindings、UI metadata 与 plugin gateway handles；
- `extensions`：拥有 extension process lifecycle 与 extension webhook handlers；
- `sessions`：拥有 NCP session API、deferred session service 与 session realtime publish；
- `webhook`：拥有通用 webhook handler registry / dispatch。

这些 owner 收的是原本散在 constructor 里的胶水职责。已经是明确组件的对象不再额外套一层，例如 `ProviderManager`、`GatewayControllerImpl`、`CronService`、`MessageBus`、`SessionManager`、`runtimeControl`、`runtimeUpdate` 继续作为 gateway runtime 的直接字段。

这些组件属于同一次 gateway runtime，不应该由外层函数分别创建后作为参数塞进来，也不应该通过 getter alias 保留重复公共入口。

构造参数只保留真正外部依赖，例如：

- `uiOverrides`
- `uiStaticDir`
- `allowMissingProvider`
- `requestRestart`
- `initializeAgentHomeDirectory`
- provider 创建策略
- service start/stop 控制能力
- marketplace 安装所需的 CLI 子命令执行能力

## MessageBus 归属

当前代码里的 bus 原本就是 `NextclawCore.MessageBus`，应该按原名叫 `messageBus`，不要 invent 新概念，也不要叫模糊的 `getBus`。

`MessageBus` 是 gateway 内部消息主干，用于 `publishInbound(...)` 等内部消息注入。它不是 webhook 专属，不是 UI server 能力，也不是 extension 专属。

预期归属：

```ts
class NextclawGatewayRuntime {
  readonly messageBus = new MessageBus();
}
```

Webhook 需要发布 inbound message 时，直接使用 gateway runtime 持有的 `messageBus`。不要再出现：

```ts
getBus: () => MessageBus | null
```

这类 getter + nullable 说明生命周期没有对齐。

## AppEventBus 归属

当前 `publish` 不是一个独立机制。代码里已经存在 `@nextclaw/kernel` 的 `nextclaw.eventBus`：

```txt
service/router 调 publish(UiServerEvent)
  -> server publishUiServerEvent()
  -> kernel nextclaw.eventBus.emitEnvelope(...)
  -> server 订阅 eventBus.subscribeAll(...)
  -> /ws 广播给前端
```

所以问题不是缺少一个新 bus，而是现有 `appEventBus` 被 `publish` 这个薄函数遮住了，导致它看起来像一个新的 UI realtime 能力。

目标形态：

```txt
gateway.messageBus
  - 入站消息队列
  - 用于 publishInbound(...)
  - 触发 agent / run / channel 主链路

gateway.appEventBus
  - 应用事件总线
  - 用于 config.updated / session.updated / session.run-status 等观察事件
  - 当前实现复用 kernel nextclaw.eventBus

UI server /ws
  - 只负责订阅 gateway.appEventBus 并广播给前端
  - 它是 transport，不是事件 owner
```

`appEventBus` 不应该合并进 `messageBus`。`messageBus` 表示“让系统做事”的入站消息队列，`appEventBus` 表示“系统发生了什么”的观察事件流。这两个职责不同，经典架构里应该分开。

不再引入 `ServiceUiRealtimeEvents` / `UiEventPublisher` 这类新名字。正确做法是把已有 `nextclaw.eventBus` 显式作为 `gateway.appEventBus`，并删除 `publish` / `publishUiEvent` 裸函数传递链。

## Webhook 设计

Webhook 是通用外部入口机制，类似“HTTP ingress 的事件分发器”。它不应该被设计成 extension channel 专属，也不应该被命名成 gateway 私有小能力。

但它也不应该直接叫 event bus，避免和系统内部 `EventBus` / `MessageBus` 混淆。

推荐 API：

```ts
class WebhookService implements UiWebhookHost {
  addHandler(type: string, handler: WebhookHandler): () => void;
  handleWebhook(envelope: UiWebhookEnvelope, context: UiWebhookContext): Promise<unknown>;
}
```

语义：

- `addHandler`：为某个 webhook envelope type 增加处理函数；
- `handleWebhook`：处理一次外部 webhook 请求；
- 内部实现可以是 `Map<type, handler>`；
- 不叫 `on/emit`，避免看起来像通用事件总线；
- 不叫 `route`，避免和 HTTP router 混淆；
- 不叫 `register`，避免继续出现 `new X().register(webhook)` 这种反向装配。

## Webhook Handler 归属

当前 extension channel webhook 只有两个类型：

- `extension.channel.config.get`
- `extension.channel.message.submit`

它们只是通用 webhook 上的两个 handler，不应该形成独立的外部装配链路。

不推荐：

```ts
new ExtensionChannelWebhookService(...).register(webhook);
```

推荐由 gateway runtime owner 内部完成：

```ts
this.webhook.addHandler(
  "extension.channel.config.get",
  this.handleExtensionChannelConfigGet,
);

this.webhook.addHandler(
  "extension.channel.message.submit",
  this.handleExtensionChannelMessageSubmit,
);
```

`ExtensionChannelWebhookService`、`WebhookDispatchService`、`WebhookController` 都属于过度拆分。目标是一个通用 `WebhookService`，extension channel 逻辑作为 gateway runtime 内部 handler 存在；server router 直接接收 `webhook` 对象并调用。

## 禁止形态

不要把 runtime owner 做成这些形态：

```ts
const gateway = {
  messageBus,
  webhook,
  remoteAccess,
  runtimeControl,
};
```

如果当前代码里仍存在这种对象字面量，它只能被视为过渡债务，不能被继续包装、命名或“规范化”为新类型。

不要把 runtime class 写成一堆外部创建组件的容器：

```ts
new NextclawGatewayRuntime({
  messageBus,
  webhook,
  runtimeControl,
  runtimeUpdate,
});
```

不要继续使用薄工厂链：

```ts
createGatewayWebhook(...)
createServiceUiHosts(...)
createRuntimeControlHost(...)
createNpmRuntimeUpdateHost(...)
```

如果某个东西是有状态、有行为、有生命周期、或多个方法组成的能力，它应该是 class owner，并由 `NextclawGatewayRuntime` 直接创建。

不要通过重命名掩盖结构问题：

```ts
NextclawGatewayRuntime -> UiServerGateway -> StartUiServerGateway
NextclawGatewayRuntime -> ServiceGateway -> ServiceGatewayShell
```

如果新类型只是承载同一批字段，或者只是把散参数换成另一个字段清单，它不是新抽象，只是结构搬运。正确做法是删除重复 contract，让字段回到真正 owner。

不要把 runtime 自己再 `create` 成另一个 gateway：

```ts
private createGateway(): ServiceGateway {
  return { ... };
}
```

如果这段代码已经在 `NextclawGatewayRuntime` 里，正确做法是让对应字段直接属于 `this`。

不要使用反向注册装配：

```ts
new SomeWebhookHandler(...).register(webhook);
```

如果需要连接 handler，应由 webhook owner 或 gateway runtime owner 直接调用 `addHandler`。

## 确定性合同

传给 `startUiServer(gateway)` 的 gateway 必须是确定的完整对象。

不接受：

```ts
readonly runtimeUpdate?: UiRuntimeUpdateHost;
readonly runtimeUpdate: UiRuntimeUpdateHost | undefined;
```

应使用确定对象：

```ts
readonly runtimeUpdate: UiRuntimeUpdateHost;
```

如果某个能力在某种环境下不可用，也应该提供确定的 disabled implementation，而不是让字段消失或变成 `undefined`。

`UiRouterOptions` 可以继续服务 route/controller 单元测试和局部组合，但生产入口 `startUiServer(gateway)` 最终不应该直接继承 optional router contract。生产 gateway 对象必须来自 `NextclawGatewayRuntime`，并且在进入 server 前已经完成确定性创建。

## 实施方向

后续落地时按这个顺序推进：

0. 已完成：把 UI server 改为只消费传入的 `gateway` 对象，不维护单独 server-side gateway runtime/host 类型。
1. 定义 service 侧 `NextclawGatewayRuntime` class 和最小外部依赖。
2. 撤销 `ServiceGateway` / `ServiceGatewayShell` / `createGateway()` / `createShellGateway()` 这类中间模型。
3. 把 `MessageBus`、`SessionManager`、`CronService` 等同步确定组件放入 constructor。
4. 把 `ProviderManager`、config reload、plugin/channel/runtime state、UI server 启动等需要运行期副作用的能力放到 `start()` 私有步骤，但状态由 class 字段持有。
5. 把已有 kernel `nextclaw.eventBus` 显式作为 runtime 的 `appEventBus` 字段。
6. 删除 `publish` / `publishUiEvent` 裸函数传递链，router/service 统一使用 `appEventBus`。
7. 收敛 webhook 为一个 `WebhookService`，提供 `addHandler` / `handleWebhook`。
8. 删除 `getBus`，改为 runtime 内部直接使用 `messageBus`。
9. 删除 `createGatewayWebhook`、`WebhookDispatchService`、`WebhookController`、`ExtensionChannelWebhookService` 的外部装配链路。
10. 让生产 `startUiServer(...)` 不再继承 optional router contract。
11. 收敛薄工厂：能直接 `new Class` 的地方直接 `new`；有分支选择时放到 runtime 私有方法或明确 class owner 中。
12. 收敛 constructor 胶水职责：`configManager`、`workspaceManager`、`remoteManager`、`marketplaceManager`、`gatewayChannels` 分别拥有对应字段与生命周期入口；不要把 `runtimeControl` / `runtimeUpdate` 塞进 `remoteManager`。

这不是为了新增层，而是为了删掉散装层，让创建职责回到真正的 gateway runtime owner。

## 验收标准

已完成阶段验收：

- server 层不导出 `NextclawGatewayRuntime` / `UiServerGateway` / `StartUiServerGateway` 这类 gateway 换皮类型。
- `startUiServer(gateway)` 只接收单个 gateway 参数，不再接收 `{ host, port, staticDir, gateway }`。
- `packages/nextclaw-server/src/ui/server.types.ts` 不存在。

最终验收：

- `RuntimeCommandService.startGateway()` 不再手动创建 webhook、message bus、UI hosts 等 gateway 内部组件。
- service 侧存在真正的 `NextclawGatewayRuntime` owner，由它创建并持有 gateway 启动期组件。
- 不存在 `ServiceGateway` / `ServiceGatewayShell` / `createGateway()` / `createShellGateway()` 这类中间 gateway bag。
- constructor 只做同步确定组件创建，`start()` 只做启动副作用；不存在额外 init 生命周期层。
- gateway 显式持有 `appEventBus`，并复用已有 kernel `nextclaw.eventBus`。
- 不再有 `publish` / `publishUiEvent` 作为 gateway 内部裸函数传递链。
- `NextclawGatewayRuntime` 不含 optional capability 字段。
- 不再有 `getBus` / `MessageBus | null`。
- webhook API 使用 `addHandler` / `handleWebhook`。
- server `/webhook` 路由直接调用 `webhook.handleWebhook(...)`，不通过 `WebhookController`。
- 不再有 `new X().register(webhook)` 这种外部装配。
- 生产 `startUiServer(gateway)` 不再直接继承 optional router contract。
- `NextclawGatewayRuntime` 不再直接持有 `configPath`、`config`、`workspace`、`remoteModule`、`remoteAccess`、`marketplace`、`deferredChannelStarter` 这些散字段；它们分别归属到上面的 manager。

## 每次交付前检查

交付前必须把文档和代码做一次对照，不能只看文档。

必须检查：

- `rg "StartUiServerGateway|UiServerGateway|server\\.types" packages/nextclaw-server packages/nextclaw-service`
- `rg "ServiceGateway|ServiceGatewayShell|createGateway\\(|createShellGateway\\(|initializeGateway|initGateway" packages/nextclaw-service`
- `rg "const gateway = \\{|Parameters<typeof startUiServer>|createGatewayWebhook|getBus|\\.register\\(webhook|WebhookDispatchService|WebhookController|ExtensionChannelWebhookService" packages/nextclaw-service packages/nextclaw-server`
- `rg "ServiceUiRealtimeEvents|publishUiEvent|publish: \\(event: UiServerEvent\\)" packages/nextclaw-server packages/nextclaw-service`
- `rg "startUiServer\\(" packages/nextclaw-server packages/nextclaw-service`

判定规则：

- 如果 server 侧 gateway 换皮类型重新出现，本方案未完成；
- 如果 `const gateway = { ... }` 仍存在，必须在本方案中标为过渡债务，不能写成已完成；
- 如果 `getBus` / `register(webhook)` / `WebhookDispatchService` / `WebhookController` 仍存在，必须在本方案中标为 webhook 过渡债务；
- 如果 `ServiceUiRealtimeEvents` 或 `publishUiEvent` 出现，说明把 app event bus 又包装成了新概念，必须删除；
- 如果 router/service 还依赖 `publish` 裸函数，说明 `appEventBus` 没有显式进入 gateway，本方案未完成；
- 如果新增了 `*Gateway` / `*Host` / `*Runtime` / `*Options` / `*Props` 名字，必须证明它承担真实 owner / 生命周期 / 权限边界 / 协议转换 / 持久化责任，否则删除。
- 不再用薄 `createXxx()` 包一层 `new Xxx()`。
- TypeScript、ESLint、相关 gateway/server webhook 测试通过。
