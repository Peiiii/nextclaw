# Provider Kernel Assembly Plan

## 目标

把 provider 领域收敛到 `kernel.llmProviders`，让 kernel 成为唯一装配层。`@nextclaw/core` 只保留可复用的协议、类型和纯组件；`@nextclaw/runtime` 只提供 builtin provider catalog 这类材料；service/server/NCP 调用方直接访问 `kernel.llmProviders`，不再自己实例化 provider manager 或具体 provider。

## 命中的原则

- `deletion-first`：先删除分散的 `new ProviderManager`、`new LiteLLMProvider`、global registry 写入和旧创建 helper。
- `complete-owner`：`LlmProviderManager` 自己拥有 provider catalog、config、cache、provider 创建、reload 和 probe。
- `single-domain-owner`：provider 领域最终只保留 `kernel.llmProviders` 一个事实 owner。
- `direct-child-access`：调用方直接使用 `kernel.llmProviders`，不在 kernel 父级再包一层转发 API。
- `constructor-builds-graph`：constructor 创建长期持有的 manager/catalog/cache；`load/reload` 执行配置装载和状态更新。
- `no-compatibility-by-default`：内部调用方迁移时直接改到新 owner；临时保留的旧路径必须有删除点。

## 理想结构

```ts
class NextclawKernel {
  readonly llmProviders = new LlmProviderManager();
}

await kernel.llmProviders.load(config);
await kernel.llmProviders.reload(nextConfig);

await kernel.llmProviders.chat(params);
await kernel.llmProviders.chatStream(params);
await kernel.llmProviders.testConnection(params);
```

`NextclawKernel` 只负责组合对象图；provider 领域能力都属于 `LlmProviderManager`。

## 职责边界

### kernel

- 在 constructor 中实例化 `LlmProviderManager`。
- 持有唯一 provider owner。
- 不提供 `getProviderManager()`、`asProviderManager()` 或父级 forwarding。

### LlmProviderManager

- 持有 builtin provider catalog。
- 持有当前 config 和 provider cache。
- 负责 model -> provider route 解析。
- 负责创建 concrete provider。
- 负责 `load/reload/dispose` 生命周期。
- 负责 `chat/chatStream/testConnection`。

### runtime

- 只导出 builtin provider catalog 材料，例如 `BUILTIN_PROVIDER_PLUGINS`。
- 不再作为事实 owner 写入 core global registry。

### core

- 保留 `LLMProvider`、`LLMResponse`、`ProviderSpec`、`ProviderRegistry`、`LiteLLMProvider` 等可复用组件。
- provider 解析和 concrete provider 应支持显式 catalog，避免新路径依赖 global registry。
- 最终删除 core `ProviderManager` 和 global registry facade。

## 第一刀纵向切片

本轮先做一个小而真实的生产路径：

1. `runtime` 导出 `BUILTIN_PROVIDER_PLUGINS`，作为材料。
2. `kernel.llmProviders` 持有自己的 `ProviderRegistry(BUILTIN_PROVIDER_PLUGINS)`。
3. `LiteLLMProvider` 支持显式 provider registry，新路径不读 core global registry。
4. `server` 的 provider connection test 不再 `new LiteLLMProvider`，改为 `nextclaw.llmProviders.testConnection(...)`。

这个切片先删除一个分散创建点，展示最终形态。

## 已推进删除项

- 已删除 `RuntimeCommandService.createProvider` / `createMissingProvider` 作为 gateway deps。
- 已删除 `NextclawGatewayRuntime.createProviderManager`。
- 已删除 `ConfigReloader.makeProvider` 调用链。
- 已删除 `installBuiltinProviderRegistry()`。
- 已删除 service 里的 `MissingProvider`。
- 已删除 core 旧 `ProviderManager` class。
- 已删除 kernel 里未接入的 provider record CRUD、`LlmProviderRecord` 类型出口、provider id 字段和重复 `reload()` 别名。
- gateway runtime 已直接使用 `nextclaw.llmProviders`。
- CLI agent 和 NCP/telemetry 调用方已收敛为依赖 kernel provider runtime 能力。

## 后续删除清单

- 删除 core global provider registry facade：`setProviderRegistry`、`configureProviderCatalog`、`findProviderByName`、`findGateway` 等全局入口。
- 删除 core 结构化 `ProviderManager` 过渡类型名，服务侧测试改用 kernel `LlmProviderRuntime`。
- 将 config schema/provider metadata 解析改为显式 catalog 输入，消掉对 core global registry 的读依赖。

## 验收条件

- provider connection test 路径不再直接实例化 `LiteLLMProvider`。
- 新 provider owner 不接收 `createProvider` / `resolveProvider` factory。
- 新 provider owner 使用自己的 provider registry，不依赖 core global registry。
- TypeScript 通过 touched packages 的 `tsc`。
- 非功能改造优先删旧创建点，后续继续把非测试代码净增压到 `<= 0`。
