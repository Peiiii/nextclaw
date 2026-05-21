# Hot Plugin Runtime v1 清单（主网关零重启）

## 目标

- 插件安装/启用/禁用/卸载时不重启主网关进程。
- 以 `channel plugin`（如 `@clawbay/clawbay-channel`）为 v1 首要支持对象。
- 失败可回退，日志可观测，用户可验收。

## 设计清单

1. `plugins.*` 从 `restart-required` 改为 `reload-plugins`。
2. `ConfigReloader` 增加 `reloadPlugins` 钩子。
3. 网关维护可变插件运行态：`pluginRegistry` / `extensionRegistry` / `pluginChannelBindings`。
4. 插件热重载链路：
   - 重新发现/加载插件
   - 重建 extension registry
   - 停止旧 plugin channel gateways
   - 启动新 plugin channel gateways
   - 热更新 `ChannelManager`（按当前实现走 channels restart，但不重启进程）
   - 热更新 `GatewayAgentRuntimePool` 的 extension registry
5. 插件桥接能力始终读取最新绑定（`toPluginConfigView` / `mergePluginConfigView` / messageToolHints）。
6. `plugins` CLI 行为调整为“保存配置 + 热应用提示”，不再主动请求重启。
7. 文档更新：`USAGE` 明确 `plugins.*` 改为热应用。
8. 验证清单：
   - `build/lint/tsc` 通过
   - 热重载路径冒烟通过
   - 插件命令不再触发 restart 提示
9. 发布清单：
   - changeset
   - version
   - publish
   - 迭代日志沉淀（含用户/产品视角验收步骤）

## 约束说明（v1 边界）

- v1 保持“主进程零重启”，但 channel 层会按当前实现重建（`ChannelManager` 重启 channel 实例）。
- v1 不做独立 Plugin Host 进程隔离（该项属于 v2/vNext）。
- v1 优先保证可维护性与可回退，避免一次性引入过重架构。

## 相关文档

- [USAGE](../USAGE.md)
- [Multi-Agent Architecture](https://docs.nextclaw.io/en/guide/multi-agent)
- [OpenClaw Alignment Gap Report](./2026-02-21-openclaw-alignment-gap-report.md)
