# v0.6.51-ui-context-tokens-release

## 迭代完成说明（改了什么）

本次完成 `contextTokens` 前端适配后的发布闭环，将可视化配置能力正式上线。

- 发布组件：
  - `nextclaw@0.6.28`
  - `@nextclaw/server@0.4.11`
  - `@nextclaw/ui@0.3.13`
- 联动说明：`nextclaw` 依赖 `@nextclaw/server`，已同步版本并发布。

## 测试 / 验证 / 验收方式

- 发布前工程验证（已通过）：
  - `pnpm build`
  - `pnpm lint`
  - `pnpm tsc`
- 发布后线上版本核验（已通过）：
  - `npm view nextclaw version` → `0.6.28`
  - `npm view @nextclaw/server version` → `0.4.11`
  - `npm view @nextclaw/ui version` → `0.3.13`

### 用户/产品视角验收步骤

1. 用户在 UI 的 `Routing & Runtime` 页面可以直接设置默认 `contextTokens`。
2. 用户可为具体 Agent 设置 `contextTokens` 覆盖值，并保存成功。
3. 刷新 UI 后配置回显一致，且 `~/.nextclaw/config.json` 中配置落盘。
4. 验收标准：配置可发现、可保存、可回显，且无需手改 JSON。

## 发布 / 部署方式

- 发布流程文档：[`docs/workflows/npm-release-process.md`](../../../docs/workflows/npm-release-process.md)
- 本次执行命令：
  1. `pnpm release:version`
  2. `pnpm release:publish`
- 远程 migration：不适用（仅 npm 包发布，无后端数据库结构变更）。
