# ExtensionManager Facade 设计

## 背景

当前 plugin / extension 链路里，`ExtensionManager` 已经持有 extension registry、channel bindings、UI metadata 等事实，但外部 service 仍能感知并传递多个内部中间概念：

- `PluginRegistry`
- `ExtensionRegistry`
- `ExtensionManifestContributions`
- `loadContributions`
- `installHost`
- `extensionManagerDeps`
- `ServiceExtensionRuntime`
- registry 到 snapshot 的合并/去重规则

这导致 `ExtensionManager` 看起来像 owner，实际却只是一个 snapshot 容器。外部仍然知道 extension 子系统内部如何发现、转换和合并能力事实。

## 目标

`ExtensionManager` 应成为 extension 子系统的统一门面。外部只表达意图：

- 加载 extension 能力
- 配置变化后刷新 extension 能力
- 查询当前 extension registry / channel bindings
- 用当前 extension 能力生成 config view

外部不应直接传入或组装：

- `PluginRegistry`
- `ExtensionRegistry`
- `ExtensionManifestContributions`
- snapshot 对象
- extension host
- plugin registry loader
- manifest contribution loader
- extension runtime lifecycle

构造参数也不能成为职责泄露的新藏身处。若一个依赖代表的是 extension 子系统本应内聚的加载、发现、合并、启动、停止或 request bridge 能力，它应该进入 `ExtensionManager` 的内部协作者，而不是由 service 注入。

## 边界

### Kernel ExtensionManager 负责

- 调用 kernel 内部 `ExtensionPluginRegistryService` 加载 plugin registry。
- 调用 kernel 内部 `ExtensionRuntimeService` 发现 extension manifest contributions。
- 构建 `ExtensionSnapshot`。
- 合并 plugin registry channels 与 extension manifest channels。
- 维护 channel bindings、UI metadata、extension registry 的一致性。
- 根据配置变更判断 channel 是否需要重建。
- 注册 extension ingress handlers。
- 启停 extension stdio runtime。

### Kernel 内部协作者

- `ExtensionPluginRegistryService`：拥有 plugin registry loading、dev first-party plugin path、explicit dev override、excludeRoots 与 reserved provider/tool 规则。
- `ExtensionRuntimeService`：拥有 extension manifest discovery、channel contribution 构建、extension process lifecycle、ingress request/response bridge。

### Service 负责

- 展示 bootstrap 进度。
- 启停 plugin channel gateway handles。
- 在 gateway 生命周期中调用 `kernel.extensions.load/reloadForConfigChange/registerIngressHandlers/start/stop`。

service 不再传入 plugin registry loader、manifest contribution loader 或 extension host；这些是 extension manager 的内部实现细节。

## API 目标

推荐 `ExtensionManager` 对外保留：

```ts
load({ config, onLoadStart, onPluginProcessed })
reloadForConfigChange({ config, changedPaths })
registerIngressHandlers()
start({ endpoint })
stop()
getExtensionRegistry()
getChannelBindings()
getUiMetadata()
toConfigView(config)
mergeConfigView(current, nextConfigView)
```

删除或避免：

```ts
loadExtensionRegistry(...)
loadPluginRegistrySnapshot(...)
loadContributions(...)
installHost(...)
extensionManagerDeps
```

`NextclawKernel` 只向 `ExtensionManager` 提供它无法自知的基础设施端口，例如 config manager、event bus、ingress、message bus。领域加载动作不能再通过 constructor deps 外包给 service。

## 迁移步骤

1. `ExtensionManager` 在 constructor 中接收基础设施端口，并内部实例化 plugin registry/runtime 协作者。
2. 将 channel restart 判断规则从 service `plugin-reload.ts` 收回 kernel。
3. `GatewayPluginManager` 改为调用 `kernel.extensions.load/reloadForConfigChange`，不再感知 registry/contributions。
4. CLI agent 链路改为调用 `kernel.extensions.load(...)`，不再传 `extensionRegistry`。
5. 删除 `loadExtensionRegistry`、`loadPluginRegistrySnapshot`、`installHost`、单独 `countEnabledPlugins` 等半成品入口。
6. 删除 service `ServiceExtensionRuntime` 与 `ExtensionLifecycleService`，将 lifecycle / ingress / request bridge 收回 kernel `ExtensionRuntimeService`。
7. 将 dev plugin loading context 与 first-party override 规则上移 kernel，避免 gateway 主链路丢失旧 loader 语义。

## 验收

- service 中不再出现 `kernel.extensions.loadExtensionRegistry`。
- service 中不再出现 `kernel.extensions.loadPluginRegistrySnapshot`。
- `GatewayPluginManager` 不再调用 `gateway.extensions.loadContributions()`。
- `ExtensionManager` 是 `ExtensionSnapshot` 的唯一构建者和写入者。
- service 中不再存在 `ServiceExtensionRuntime`。
- service 不再向 kernel 构造 `extensionManagerDeps`。
- `NEXTCLAW_DEV_PLUGIN_OVERRIDES` 与 first-party dev path/excludeRoots 语义继续可用。
- gateway plugin manager 定向测试通过。
- kernel extension manager 定向测试通过。
