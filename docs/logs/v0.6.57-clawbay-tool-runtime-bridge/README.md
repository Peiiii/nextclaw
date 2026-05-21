# v0.6.57-clawbay-tool-runtime-bridge

## 迭代完成说明（改了什么）

本次修复 `nextclaw agent` 直连路径下，OpenClaw 兼容插件工具读取配置失效的问题。

1. 在 CLI `agent` 运行链路中补齐插件运行时桥接：
   - 注入 `setPluginRuntimeBridge`；
   - `loadConfig` 映射为 `toPluginConfigView(...)`；
   - `writeConfigFile` 映射为 `mergePluginConfigView(...)` + `saveConfig(...)`。
2. 保证 `agent` 执行后清理桥接状态：
   - 使用 `try/finally` 在流程结束时 `setPluginRuntimeBridge(null)`。
3. 修复后，`clawbay_post` / `clawbay_publish_app` 在 CLI `agent` 模式下可正确读取 `plugins.entries.<id>.config` 映射后的频道配置，不再误报 `apiKey missing`。

## 测试 / 验证 / 验收方式

### 工程验证

- `pnpm build`
- `pnpm lint`
- `pnpm tsc`

结果：通过（仅历史 warning，无新增 error）。

### 功能验证（真实调用）

在真实环境使用 CLI 执行工具调用验证：

- `clawbay_post` 成功，返回 `id: bb1b43f1-9a14-4efc-bc0c-be7fd6aa0e15`
- `clawbay_publish_app` 成功，返回 `id: 6815d7bd-525e-495e-9815-1c210915bb11`

## 用户/产品视角验收步骤

1. 保持服务运行，确认 `clawbay-channel` 已启用并完成配对。
2. 在 CLI 执行 `nextclaw agent -m "...调用 clawbay_post ..."`。
3. 观察返回包含 `TOOL_OK` 且带 `id`，不出现 `apiKey missing`。
4. 再执行 `nextclaw agent -m "...调用 clawbay_publish_app ..."`。
5. 观察返回包含 `TOOL_OK` 且带 `id`。

通过标准：两个工具都能真实执行成功，并返回可追踪标识（id）。

## 发布 / 部署方式

1. 生成版本：`pnpm changeset version`
2. 发布 npm：`pnpm changeset publish`
3. 发布后复核：`pnpm build && pnpm lint && pnpm tsc`

说明：本次仅 CLI 运行时桥接逻辑修复，不涉及数据库迁移与后端 schema 变更。

## 相关文档

- [USAGE](../../../docs/USAGE.md)
- [Hot Plugin Runtime v1 清单](../../../docs/designs/2026-02-23-hot-plugin-runtime-v1-checklist.md)
