# Plugins 真热插拔最小生命周期设计稿（.plan）

## 目标

在不引入高复杂度的前提下，让 `plugins.*` 配置和启停从“重启生效”升级为“运行时热插拔生效”，并保持当前 NextClaw 的可维护性优先原则。

## 设计原则（面向可维护性）

- **单入口**：插件生命周期统一由 `PluginRuntimeManager` 管理，禁止分散在 CLI/runtime/controller 多点调用。
- **显式状态机**：每个插件只能在定义状态间迁移，禁止隐式副作用。
- **最小能力面**：Phase 1 只做 `enable/disable/config patch` 热生效，不做“动态安装包解析执行”。
- **失败可回退**：热插拔失败不影响主 AgentLoop；单插件失败可隔离。
- **先管生命周期，再管能力扩展**：先解耦“注册/反注册”，再扩能力。

## 最小生命周期模型

插件实例状态（每插件一份）：

- `discovered`：已发现元数据，未激活
- `loading`：正在创建 runtime 实例
- `active`：已注册工具/通道/hooks，可响应请求
- `stopping`：正在反注册与资源释放
- `inactive`：已停用（可再次 activate）
- `error`：激活/停用失败，等待人工干预或重试

状态迁移（最小集）：

- `discovered -> loading -> active`
- `active -> stopping -> inactive`
- `loading -> error`
- `stopping -> error`
- `error -> loading`（手动重试）

## 运行时结构（最小实现）

新增组件：

1. `PluginRuntimeManager`
   - 职责：状态机驱动、并发串行化、超时/回滚、事件广播。
2. `PluginRuntimeHandle`
   - 每个插件一个 handle，持有：
     - 注册的 tools/channels/hooks 列表
     - 启动/停止 token（防并发重复）
     - 清理函数集合（disposer）
3. `RuntimeRegistryOverlay`
   - 在现有 `ExtensionRegistry` 上加一层“可撤销注册”能力：
     - `register()` 返回 `dispose()`
     - `dispose()` 幂等

## 与现有架构的最小接缝

当前现状：

- 插件在 gateway 启动时一次性加载（`loadPluginRegistry` + `toExtensionRegistry`）。
- `ConfigReloader` 对 `plugins.*` 仍标记为 `restart-required`。

最小改造路径：

1. `ConfigReloader` 增加 `reloadPlugins` 分支（先不替换现有 restart 逻辑，灰度开关控制）。
2. 在 `startGateway` 中注入 `PluginRuntimeManager`，由它接管 `enable/disable` 热动作。
3. `GatewayController` 的 config apply/patch/update 在命中 `plugins.*` 时改为调用 runtime manager。
4. 保留兜底：热插拔失败时自动退回“请求重启”策略（兼容现有 `RestartCoordinator`）。

## 最小 API 草案

```ts
type PluginRuntimeManager = {
  applyConfigDiff(diff: string[]): Promise<{ ok: boolean; fallbackRestart?: boolean; reason?: string }>;
  enable(pluginId: string): Promise<void>;
  disable(pluginId: string): Promise<void>;
  reload(pluginId: string): Promise<void>;
  listStates(): Array<{ pluginId: string; state: string; error?: string }>;
};
```

## 并发与一致性策略

- 插件级互斥：同一插件的生命周期操作串行。
- 全局有序：`config reload` 期间插件动作入队，防止与 channels/provider reload 竞态。
- 幂等约束：
  - `enable(active)` => no-op
  - `disable(inactive)` => no-op
- 超时保护：`loading/stopping` 超时进入 `error`，并产生日志事件。

## 可观测性（必需）

新增事件：

- `plugin.runtime.loading`
- `plugin.runtime.active`
- `plugin.runtime.stopping`
- `plugin.runtime.inactive`
- `plugin.runtime.error`

新增诊断接口：

- `gateway config.get` 返回 `pluginsRuntime.states` 快照（只读）

## 复杂度评估（先评估，不实现）

- **Phase 1（最小可用）**：中等复杂度
  - 主要成本：可撤销注册与状态机落地
  - 风险：插件自身未实现 `dispose` 时可能资源泄漏
- **Phase 2（增强）**：中高复杂度
  - 包含动态安装后即热加载、插件间依赖拓扑、失败补偿策略

## 可维护性结论

在当前 NextClaw 代码结构下，**最优路径不是“一步到位全热插拔”**，而是：

- 先做 `enable/disable/config` 的生命周期热应用（最小状态机 + 可撤销注册）；
- 安装/卸载仍保留“需要重启”边界；
- 通过运行时事件与诊断把复杂度暴露为可观测问题。

该路径在长期上最稳：

- 不破坏现有 `RestartCoordinator` 兜底模型；
- 能将复杂度控制在单组件（`PluginRuntimeManager`）内；
- 后续扩展时可分阶段演进，不会把不可控状态扩散到 CLI/UI/Core。

## 验收标准（Phase 1）

- `plugins enable <id>` 在运行中生效，不触发进程重启。
- `plugins disable <id>` 在运行中失效，不触发进程重启。
- 修改 `plugins.entries.<id>.config` 后，目标插件可热重载。
- 任一插件热操作失败时，主网关保持可用，并给出可诊断错误与“可选重启兜底”。
