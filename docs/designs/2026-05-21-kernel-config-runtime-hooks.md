# Kernel Config Runtime Hooks 设计

## 背景

`NextclawGatewayRuntime` 目前通过 `installConfigRuntimeHooks` 给 kernel `ConfigManager` 注入多类 hook：

- channel config view 生成。
- extension channel registry 读取。
- plugin / extension reload。
- MCP reload。
- companion reload。
- restart required 通知。

其中 channel config、extension channels、MCP reload 都是 kernel 内部 manager 协作；service 不应该知道这些细节。companion reload、plugin gateway handle restart、restart 通知仍涉及 service 宿主进程、UI/runtime companion、长运行 gateway handle 和 restart 策略，暂时不应硬搬进 kernel。

## 目标

- kernel 自己安装能完全负责的 config runtime hooks。
- service 只补宿主端口，不再传递 channel config / extension registry / MCP reload 这些 kernel 内部协作。
- 不新增单方法 fake service / fake manager。
- 不把 service 进程资源强塞进 kernel。

## 方案

1. `ConfigManager.installRuntimeHooks` 改为合并式安装，后安装的同名 hook 覆盖旧 hook。
2. `NextclawKernel` 构造完成 `extensions` 与 `mcpManager` 后，安装 kernel-owned hooks：
   - `resolveChannelConfig`: 使用 `extensions.toConfigView(config)`。
   - `getExtensionChannels`: 使用 `extensions.getExtensionRegistry().channels`。
   - `reloadMcp`: 使用 `mcpManager.applyConfig(config)`。
3. `NextclawGatewayRuntime` 保留 host hooks：
   - `reloadCompanion`。
   - `reloadPlugins`，因为当前仍负责 plugin gateway handles restart 与 config updated events。
   - `onRestartRequired`。

## 暂不处理

- `GatewayPluginManager` 生命周期整体迁入 kernel：需要下一阶段单独处理 gateway handle owner。
- `GatewayControllerImpl` 拆分：config/status 与 restart/update 混合，需要单独拆。
- deferred startup 编排迁移：涉及 bootstrap status 与 UI endpoint，需要下一阶段评估。

## 验收

- `NextclawGatewayRuntime` 不再 import 或调用 `resolveChannelConfigView`。
- `NextclawGatewayRuntime` 不再通过 hook 暴露 `getExtensionChannels` / `reloadMcp`。
- config reload 后 channel view、extension channel、MCP reload 行为保持。
- kernel/service TypeScript 与相关测试通过。
