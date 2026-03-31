# 迭代完成说明

- 修复 NCP subagent 完成后父 agent 的 follow-up 实时可见问题：当前页面不再依赖 `reloadSeed`，而是在当前 session 收到 realtime 通知后补开增量 `stream` attach，让父 agent 的后续回复直接流到前端。
- 修复 subagent 完成态的归位逻辑：不再生成独立 completion 气泡，而是把完成结果回写到原 `spawn` 工具调用上。
- 修复 subagent 完成回写时序问题：改为先等待父 run 进入 `idle`，再更新 `spawn` 工具结果并触发 follow-up，避免被主 run 的落盘结果覆盖回 `running`。
- 删除前端 NCP chat 的 realtime reload 旁支与旧 completion 可见消息分支，保留首屏 hydrate + 后续纯增量事件流。
- 为工具结果更新与 subagent 卡片展示补了更清晰的模块拆分，避免继续膨胀热点文件。
- 继续增强 `spawn` 工具卡片的信息密度：卡片摘要现在会展示 `label / runId / task`，展开输出会按 `Run ID / Label / Task / Result` 分段展示，避免 subagent 已完成但用户仍看不到关键上下文。

# 测试 / 验证 / 验收方式

- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm exec vitest run src/cli/commands/ncp/create-ui-ncp-agent.subagent-completion.test.ts src/cli/commands/ncp/nextclaw-ncp-context-builder.test.ts`（`packages/nextclaw`）
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/ncp-toolkit exec vitest run src/agent/in-memory-agent-backend.test.ts`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/ui exec vitest run src/components/chat/adapters/chat-message.adapter.test.ts src/components/chat/useHydratedNcpAgent.test.tsx`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter nextclaw exec tsc -p tsconfig.json --noEmit`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/ui exec tsc -p tsconfig.json --noEmit`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/ncp-toolkit exec tsc -p tsconfig.json --noEmit`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint:maintainability:guard`
- 本次续改额外验证：
  - `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/ui exec vitest run src/components/chat/adapters/chat-message.adapter.test.ts`
  - `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/ui exec tsc -p tsconfig.json --noEmit`
  - `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/components/chat/adapters/chat-message.subagent-tool-card.ts packages/nextclaw-ui/src/components/chat/adapters/chat-message.adapter.test.ts`

# 发布 / 部署方式

- 本次未执行发布。
- 若后续发布，按既有前端 / NCP 发布流程正常发布即可，无需额外 migration。

# 用户 / 产品视角验收步骤

1. 打开 NCP chat，会话中让主 agent 触发一次 `spawn`。
2. 确认 `spawn` 工具调用位置展示 subagent 运行卡片，而不是新增一条独立 completion 消息。
3. 展开 `spawn` 工具卡片，确认至少能看到 `Run ID`、`Label`、`Task`，并在完成后看到完整 `Result` 分段，而不是只剩一小段模糊摘要。
4. 等待 subagent 完成，不刷新页面，确认父 agent 会继续输出后续回复。
5. 确认父 agent 回复完成后，底部不会再残留额外的“AI 正在回复”气泡，发送按钮也会恢复可发送状态。
6. 刷新页面后再次确认消息历史一致：`spawn` 卡片保留完成结果，父 agent follow-up 回复已持久化。
