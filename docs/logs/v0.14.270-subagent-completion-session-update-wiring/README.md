# v0.14.270-subagent-completion-session-update-wiring

## 迭代完成说明

- 给子 Agent 完成后的系统回传补了一层显式 wiring：`GatewayAgentRuntimePool` 处理系统会话更新时，会转发为 UI 的 `session.updated` 事件。
- 在 `packages/nextclaw/src/cli/commands/service.ts` 中接入这条桥接，确保子 Agent 完成后，主会话能被唤醒并触发前端刷新。
- 新增 `wireSystemSessionUpdatedPublisher` 的单测，固定住这条“系统完成事件 -> UI 会话更新”链路。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw exec vitest run src/cli/commands/service-gateway-startup.test.ts src/cli/commands/agent-runtime-pool.command.test.ts`
- `pnpm -C packages/nextclaw tsc`
- `pnpm -C packages/nextclaw lint`
- `pnpm -C packages/nextclaw build`
- `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw/src/cli/commands/service.ts packages/nextclaw/src/cli/commands/service-gateway-startup.ts packages/nextclaw/src/cli/commands/service-gateway-startup.test.ts`

## 发布/部署方式

- 本次未单独执行发布。
- 该变更随 `packages/nextclaw` 的下一次正常构建/发布流程即可生效。
- 无数据库 migration，不涉及远程部署动作。

## 用户/产品视角的验收步骤

1. 在支持子 Agent 的会话里发起一次 `spawn`。
2. 等待子 Agent 完成，确认主会话能继续收到后续更新，而不是只停留在“已派发任务”的状态。
3. 打开会话列表或消息页，确认完成后能刷新到最新会话状态和最新消息。
4. 再次触发一次子 Agent 任务，确认完成后依然能稳定唤醒主会话和 UI 刷新。
