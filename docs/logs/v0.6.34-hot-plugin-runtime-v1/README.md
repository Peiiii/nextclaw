# v0.6.34-hot-plugin-runtime-v1

## 迭代完成说明（改了什么）

本次实现了 Hot Plugin Runtime v1（主网关进程零重启）：

1. `plugins.*` 从“必须重启”改为“热重载”路径
- 修改 `buildReloadPlan`，新增 `reloadPlugins`，并将 `plugins.*` 路径纳入热重载流程。

2. 配置重载器支持插件热重载钩子
- `ConfigReloader` 新增 `reloadPlugins` 回调。
- 应用顺序：插件热重载 → channel 重启（仅 channel 实例）→ provider/agent 热应用。

3. 网关运行态插件状态改为可变
- `ServiceCommands.startGateway` 使用可变的 `pluginRegistry` / `extensionRegistry` / `pluginChannelBindings`。
- 配置变更时自动：
  - 重新加载插件注册表；
  - 停止旧 plugin channel gateways；
  - 启动新 plugin channel gateways；
  - 热更新 `GatewayAgentRuntimePool` extension registry；
  - 热更新 `ChannelManager`（不重启主进程）。

4. 插件命令默认改为“热应用提示”
- `plugins install/enable/disable/uninstall` 不再主动触发 restart 流程。
- 统一提示：如果 gateway 正在运行，插件变更会自动热应用。

5. 文档更新
- 新增清单文档：[Hot Plugin Runtime v1 清单](../../designs/2026-02-23-hot-plugin-runtime-v1-checklist.md)
- 更新使用文档：[USAGE](../../USAGE.md)

## 测试 / 验证 / 验收方式

### 1) 工程验证（规则要求）

- `pnpm build`
- `pnpm lint`
- `pnpm tsc`

结果：全部通过（仅历史 warning，无新增 error）。

### 2) 热重载冒烟验证（隔离目录）

在隔离 `NEXTCLAW_HOME`（`/tmp`）中执行：

1. 启动 gateway：`start --ui-port 20891`
2. 记录 PID（before）
3. 执行：`config set plugins.entries.hot-demo.enabled true --json`
4. 再次记录 PID（after）
5. 检查日志关键字：
   - `Config reload: plugins reloaded.`
   - `Config reload: plugin channel gateways restarted.`
   - `Config reload: channels restarted.`

观察结果：

- `PID_UNCHANGED = true`
- 服务级别保持 `healthy`
- 插件热重载日志完整出现

### 用户/产品视角验收步骤

1. 用户在服务运行中执行插件操作（install/enable/disable/uninstall）。
2. 确认无需执行 `nextclaw restart`，主服务持续可用。
3. 观察服务日志，确认出现插件热重载日志（而非重启提示）。
4. 对话不中断：在插件操作前后发送消息，验证 gateway 持续响应。

通过标准：

- 插件变更可在线生效；
- 主网关进程不重启；
- 失败有日志可排查。

## 发布 / 部署方式

1. changeset：新增本次变更记录并覆盖联动包
2. version：`pnpm changeset version`
3. publish：`pnpm changeset publish`
4. 发布后回归：`build/lint/tsc` + 热重载冒烟

说明：

- 本次不涉及数据库/后端 schema 变更，远程 migration 不适用。
- 本次为运行态行为改进，已完成真实热重载链路验证。
