# v0.14.313-ncp-running-state-late-event-fix

## 迭代完成说明

- 修复 NCP 聊天里 AI 已完成后，前端过一会儿又重新出现“AI 正在回复”气泡、停止按钮再次激活但无法停止的问题。
- 修复左侧会话列表偶发持续转圈的问题，避免旧的 `running` summary 覆盖新的 `idle` summary。
- 收敛前端实时订阅触发条件，删除对 `session.updated` 和非运行态 summary 的自动 attach，只在当前会话收到 `running` 状态 summary 时接入实时流。
- 在 `agent-conversation-state-manager` 中为 run 终态增加护栏，防止同一个 run 已完成后又被晚到的 `run.started` 或 `run.metadata(kind=ready)` 重新点亮。
- 为上述行为补充回归测试，覆盖 stale summary、同时间戳状态冲突、late run started、late ready metadata 等场景。

## 测试/验证/验收方式

- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/ui exec vitest run src/api/ncp-session-query-cache.test.ts`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/ncp-toolkit exec vitest run src/agent/agent-conversation-state-manager.test.ts`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/ui exec tsc -p tsconfig.json --noEmit`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/ncp-toolkit exec tsc -p tsconfig.json --noEmit`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint:maintainability:guard`
- UI 手工验收建议：
  - 触发一次包含子 Agent 的会话，确认子 Agent 完成后父 Agent 能继续输出。
  - 父 Agent 回复完成后观察一段时间，确认不会再次凭空出现“AI 正在回复”气泡。
  - 确认右下角发送区不会重新回到可停止状态。
  - 确认左侧会话列表转圈在会话完成后消失。

## 发布/部署方式

- 本次仅包含前端与 NCP toolkit 代码修复，按常规前端/应用发布流程构建并发布受影响包。
- 若与其它待发布改动合并发布，需确保前端和 NCP toolkit 版本同时携带本修复。

## 用户/产品视角的验收步骤

1. 在聊天页发起一次会触发子 Agent 的请求。
2. 观察子 Agent 完成后，父 Agent 是否继续给出后续回复。
3. 等待父 Agent 完成，确认消息区底部不再新增“AI 正在回复”占位卡片。
4. 再等待一段时间，确认停止按钮不再假性复活。
5. 查看左侧会话列表，确认对应会话状态不再持续转圈。
