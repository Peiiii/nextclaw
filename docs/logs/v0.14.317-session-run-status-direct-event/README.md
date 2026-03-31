# v0.14.317-session-run-status-direct-event

## 迭代完成说明

- 将聊天左侧会话列表的运行中状态从“通过 session summary 间接推导”改为“后端直接发布运行状态事件”。
- 新增全局 UI 事件 `session.run-status`，payload 为 `sessionKey + status(running|idle)`。
- 后端在 session execution 启动时直接发布 `running`，在 execution 收尾时直接发布 `idle`，不再要求前端等待 summary 持久化链路来间接感知会话状态变化。
- 前端 realtime bridge 收到 `session.run-status` 后，只更新 `ncp-sessions` query cache 里对应 session 的 `status` 字段。
- `NcpChatPage` 也改为只在收到 `session.run-status: running` 时触发实时流 attach，不再依赖 summary 的运行态事件触发。

## 测试/验证/验收方式

- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/ncp-toolkit exec vitest run src/agent/agent-backend-run-status.test.ts src/agent/agent-backend-finalize-status.test.ts src/agent/in-memory-agent-backend.test.ts src/agent/agent-conversation-state-manager.test.ts`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter nextclaw-ui exec vitest run src/api/ncp-session-query-cache.test.ts`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter nextclaw exec tsc -p tsconfig.json --noEmit`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/ui exec tsc -p tsconfig.json --noEmit`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/ncp-toolkit exec tsc -p tsconfig.json --noEmit`

## 发布/部署方式

- 本次涉及服务端 UI 事件类型、NCP toolkit backend、以及前端 realtime 状态更新逻辑，需要前后端相关产物一起发布。
- 若与前面几轮 session 状态修复一并发布，需确保服务端和前端同时升级，避免事件类型不一致。

## 用户/产品视角的验收步骤

1. 打开聊天页并发送一条消息。
2. 观察左侧会话列表，在 AI 开始回复时对应会话应立即进入运行中状态。
3. 在 AI 回复结束的当下，左侧运行中转圈应立即消失，不应再依赖刷新或等待很久。
4. 不刷新页面继续停留数秒，确认状态不会再次错误回到运行中。
