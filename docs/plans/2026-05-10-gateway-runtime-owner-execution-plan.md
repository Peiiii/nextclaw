# Gateway Runtime Owner Execution Plan

## 关联文档

- 设计文档：[Gateway Runtime Ownership And Webhook Design](../designs/2026-05-10-gateway-runtime-ownership-and-webhook-design.md)

## 目标

把 gateway 启动期能力收回到 `NextclawGatewayRuntime` 这一个 owner 下，删除 `hydrate/apply/runtimeState` 这类外层搬运链路，让 constructor 负责确定对象图，生命周期方法只负责 load/start/reload/stop。

## 非目标

- 不继续推进真实微信新版渠道接入。
- 不新增新的 gateway/server/context/shell 换皮类型。
- 不把 webhook 做成 extension 专属机制。
- 不为通过类型检查增加 optional/undefined 字段。

## 设计原则

- GRASP Creator：`NextclawGatewayRuntime` 创建并持有本次 gateway runtime 的长期组件。
- GRASP Information Expert：插件 registry、extension registry、channel bindings、UI metadata 由插件目录 owner 自己维护。
- Tell, Don't Ask：外部流程调用 `runtime.plugins.load()` / `runtime.plugins.reloadForConfigChange()` / `runtime.plugins.startGateways()`，不拿出字段替 owner 赋值，也不让父级为子组件逐个包转发方法。
- Encapsulation：不再出现 `params.runtime.xxx = ...`、`applyXxx(result)` 或一坨 result 字段同步。
- Constructor / Lifecycle 分离：constructor 创建确定同步对象；`start/reload/stop` 处理外部副作用。
- Direct Parent Dependency：拆出去的子 owner 可以在 constructor 直接持有上级 owner，例如 `new GatewayPluginManager(this)`；不要为这种关系再发明 `Owner`、`Context`、`Shell` 这类中间类型。

## 目标结构

```txt
NextclawGatewayRuntime
  - messageBus
  - appEventBus
  - sessionManager
  - cron
  - configManager
  - workspaceManager
  - remoteManager
  - marketplaceManager
  - gatewayChannels
  - plugins
  - extensions
  - sessions
  - webhook
  - providerManager / gatewayController
  - runtimeControl / runtimeUpdate
```

`ProviderManager`、`GatewayControllerImpl`、`CronService`、`MessageBus`、`SessionManager`、`runtimeControl`、`runtimeUpdate` 已经是明确组件，不再额外包一层。
`remoteManager` 只收 `remoteModule` / `remoteAccess`，不收 `runtimeControl` / `runtimeUpdate`。

### `GatewayPluginManager`

职责：

- 拥有 plugin registry 及其派生状态；
- 加载和重载 plugin registry；
- 计算 channel gateway 是否需要重启；
- 拥有 plugin gateway handles；
- 启动、重启、停止 plugin channel gateways；
- 对外只提供查询方法和语义化生命周期方法。

不做：

- 不修改 `NextclawGatewayRuntime` 字段；
- 不返回 registry/bindings/extensionRegistry 让外部逐个赋值。
- 不把 `startPluginChannelGateways` 作为 service 层散函数暴露。

### `NextclawGatewayRuntime`

职责：

- 在 constructor 创建长期组件；
- 在 `start()` 内启动 UI server、配置 reload callback、启动 deferred runtime；
- 直接暴露 `plugins` 组件给内部编排使用，不为 `plugins` 的每个方法再写父级转发壳；
- 向 server 投影启动参数，但 server 不拥有 gateway 模型。
- 不直接持有 `configPath`、`config`、`workspace`、`remoteModule`、`remoteAccess`、`marketplace`、`deferredChannelStarter` 这类散字段。

### Constructor 胶水 owner

职责：

- `GatewayConfigManager`：配置路径、启动配置快照、UI 配置、静态目录、`ConfigReloader`、live config reload；
- `GatewayWorkspaceManager`：workspace 与 agent home 初始化能力；
- `GatewayRemoteManager`：remote module 与 remote access；
- `GatewayMarketplaceManager`：marketplace API 配置与 installer；
- `GatewayChannelManager`：deferred channel starter、dev hot reload 包装、channel lifecycle start。

不做：

- 不把已有明确组件再包一层；
- 不通过 getter alias 保留旧字段入口；
- 不把 owner class 继续塞在 `nextclaw-gateway-runtime.service.ts` 里。

## 实施步骤

1. 文档对齐
   - 创建本计划文件。
   - 在设计文档中链接本计划。

2. 收敛 plugin 子系统 owner
   - 新增 `packages/nextclaw-service/src/shared/services/gateway/managers/gateway-plugin.manager.ts`。
   - 删除 `service-plugin-runtime-loader.service.ts` 的 `hydrateServiceCapabilities` 链路。
   - 将测试迁移为 plugin manager owner 测试。
   - registry、extension registry、channel bindings、UI metadata、gateway handles 都只由 manager 维护。
   - 启动 plugin channel gateway 的逻辑归入 manager，不再作为 service 层散函数使用。

3. 改造 `NextclawGatewayRuntime`
   - constructor 创建 `plugins: GatewayPluginManager`。
   - `GatewayPluginManager` constructor 直接接收 `NextclawGatewayRuntime`。
   - 删除 `hydrateCapabilities`、`applyPluginRuntimeCapabilities`。
   - 删除 `pluginRegistry`、`extensionRegistry`、`pluginChannelBindings` 这类可由 plugin manager 查询的 runtime 重复字段。
   - 删除 `getPluginRegistry`、`getExtensionRegistry`、`getPluginChannelBindings`、`getPluginUiMetadata`、`loadPlugins`、`reloadPluginsForConfigChange`、`startPluginGateways`、`stopPluginGateways` 这类父级转发壳，使用处改为直接访问 `runtime.plugins`。

4. 改造 deferred startup
   - 将 `hydrateCapabilities` 命名与指标改为 `loadPlugins`。
   - `NextclawApp` 只调用语义化生命周期 callback，不维护 plugin runtime state。

5. 改造 UI shell 和 runtime bridge
   - UI shell 从 `runtime.plugins` 查询 plugin metadata。
   - runtime bridge 通过 `runtime.plugins` 读取 bindings。

6. 清理坏味道
   - 删除 `GatewayRuntimeState` 作为外层字段包。
   - 删除 `ServiceCapabilityHydration*` 命名。
   - 删除 `params.runtime.xxx = ...` 这类外部 owner 赋值。

7. 收敛 constructor 胶水 owner
   - 拆出 `packages/nextclaw-service/src/shared/services/gateway/managers/gateway-config.manager.ts`。
   - 拆出 `packages/nextclaw-service/src/shared/services/gateway/managers/gateway-workspace.manager.ts`。
   - 拆出 `packages/nextclaw-service/src/shared/services/gateway/managers/gateway-remote.manager.ts`。
   - 拆出 `packages/nextclaw-service/src/shared/services/gateway/managers/gateway-marketplace.manager.ts`。
   - 拆出 `packages/nextclaw-service/src/shared/services/gateway/managers/gateway-channel.manager.ts`。
   - `NextclawGatewayRuntime` 只负责创建这些 owner 并协调生命周期。

8. 角色命名收敛
   - classless 运行期辅助模块使用 `.utils.ts`。
   - 位于 `services/` 树下的 utils 模块落到本 feature 的 `utils/` 子目录。
   - 私有 UI 启动阶段命名使用 `startUiRuntime`，不继续保留 `startUiShell`。

## 验收标准

- `rg "hydrateCapabilities|applyPluginRuntimeCapabilities|ServiceCapabilityHydration|hydrateServiceCapabilities" packages/nextclaw-service/src/shared/services/gateway` 无命中。
- `rg "params\\.[a-zA-Z0-9_]*(runtime|Runtime|gateway|Gateway|owner|Owner)\\.[a-zA-Z0-9_]+\\s*=" packages/nextclaw-service/src/shared/services/gateway` 无外部 owner 赋值命中。
- `NextclawGatewayRuntime` constructor 创建 `GatewayPluginManager`。
- `GatewayPluginManager` 直接依赖 `NextclawGatewayRuntime`，不存在 `GatewayPluginManagerOwner` / `GatewayPluginContext`。
- `NextclawGatewayRuntime` 不再提供插件子组件的逐个转发方法，使用处直接走 `runtime.plugins.*`。
- plugin registry 派生状态只由 `GatewayPluginManager` 维护。
- plugin gateway handles 只由 `GatewayPluginManager` 维护。
- `NextclawApp` 使用 `loadPlugins`，不再出现 hydrate 语义。
- `GatewayConfigManager`、`GatewayWorkspaceManager`、`GatewayRemoteManager`、`GatewayMarketplaceManager`、`GatewayChannelManager` 各自位于独立文件。
- `GatewayConfigManager`、`GatewayWorkspaceManager`、`GatewayRemoteManager`、`GatewayMarketplaceManager`、`GatewayChannelManager` 各自位于 `gateway/managers/` 下的独立文件。
- `NextclawGatewayRuntime` 不再直接持有 `configPath`、`config`、`workspace`、`remoteModule`、`remoteAccess`、`marketplace`、`deferredChannelStarter`。
- `runtimeControl` / `runtimeUpdate` 不归入 `remoteManager`。
- `rg "startUiShell|service.start_ui_shell" packages/nextclaw-service/src/shared/services/gateway` 无命中。
- 运行 `pnpm --filter @nextclaw-service tsc --noEmit`。
- 运行相关 gateway/service 单测。
- 运行 lint 或最小相关 lint 验证。
