# 2026-02-18 Config live apply (no manual restart)

## 背景 / 问题

- 在 VPS 首次 `nextclaw start` 后，用户在 UI 里补全 provider/model/channel 配置，Discord 有概率暂时不回消息。
- 现状常常需要手动 `nextclaw restart`，与“配置即生效”的体验目标冲突。

## 决策

- 扩展现有 config reloader，不引入第二套运行时；继续沿用单一 reload pipeline。
- 将“可热应用”边界明确化：`providers.*`、`channels.*`、`agents.defaults.model`、`agents.defaults.maxToolIterations`、`agents.context.*`。
- 对缺失 provider 的启动路径使用占位 provider，保持网关进程可运行，后续通过配置热更新转正。

## 变更内容

- 用户可见变化：
  - 运行中的网关现在会自动应用 provider/channel/model/context 变更，无需手动重启。
  - 日志会输出 `Config reload: channels restarted.`、`Config reload: provider settings applied.`、`Config reload: agent defaults applied.`。
- 关键实现点：
  - `packages/nextclaw-core/src/config/reload.ts` 新增 `reloadAgent` 规则。
  - `packages/nextclaw-core/src/agent/loop.ts` 增加 `applyRuntimeConfig`，动态更新 model/max iterations/context/tool runtime options。
  - `packages/nextclaw-core/src/agent/context.ts` 新增 `setContextConfig`，复用统一 merge 逻辑。
  - `packages/nextclaw-core/src/agent/subagent.ts` 新增 `updateRuntimeOptions`。
  - `packages/nextclaw/src/cli/runtime.ts` 的 `ConfigReloader` 支持 agent runtime 回调；并引入 `MissingProvider`，避免“无 provider 时网关挂起不可热恢复”。

## 验证（怎么确认符合预期）

```bash
pnpm -C packages/nextclaw-core tsc
pnpm -C packages/nextclaw tsc
```

验收点：

- 运行网关后，修改 provider API key，日志出现 `Config reload: provider settings applied.`。
- 修改 channel 启用状态或 token，日志出现 `Config reload: channels restarted.`。
- 修改 `agents.defaults.model` 或 `agents.context`，日志出现 `Config reload: agent defaults applied.`。
- 在“初始无 provider key”的情况下启动网关，后续补全 key 后可直接恢复可用，不需要重启。

## 发布 / 部署

- 若本次改动随 npm 包发布，按 `docs/workflows/npm-release-process.md` 执行 changeset + version + release。

## 影响范围 / 风险

- Breaking change? 否
- 已知边界：`tools.*`、`plugins.*`、`agents.defaults.maxTokens`、`agents.defaults.temperature`、UI bind 参数仍需要重启。
