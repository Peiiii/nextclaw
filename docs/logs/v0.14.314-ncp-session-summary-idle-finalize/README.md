# v0.14.314-ncp-session-summary-idle-finalize

## 迭代完成说明

- 修复 NCP 会话在 AI 回复完成后，左侧会话列表仍继续显示运行中转圈的问题。
- 根因是后端在 run 结束前最后一次持久化时就触发了 session summary 更新，但当时 live session 的 `activeExecution` 还未清空，导致 UI bridge 发布出去的仍是 `running` 状态。
- 调整后端结束顺序：run 结束后先清理 `activeExecution`，再补一次持久化，让最终发布的 session summary 立即收敛为 `idle`。
- 新增回归测试，确保一次完整 run 结束后，最后一次发布到 session store 的状态为 `idle`。

## 测试/验证/验收方式

- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/ncp-toolkit exec vitest run src/agent/in-memory-agent-backend.test.ts src/agent/agent-conversation-state-manager.test.ts`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/ncp-toolkit exec tsc -p tsconfig.json --noEmit`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint:maintainability:guard`
- UI 手工验收建议：
  - 发起一次普通对话或包含子 Agent 的对话。
  - 等 AI 回复完成后，确认左侧该会话的转圈立即消失，而不是延迟一段时间。
  - 确认等待一段时间后不会再次凭空回到运行中状态。

## 发布/部署方式

- 本次涉及 NCP toolkit 后端执行收尾顺序修复，发布时需确保服务端/应用端带上新的 toolkit 代码。
- 若与前一轮前端状态修复合并发布，需一起发布前端与相关服务端产物。

## 用户/产品视角的验收步骤

1. 在聊天页发起一条消息，让 AI 完成一次完整回复。
2. 观察左侧会话列表，对应会话在回复结束时是否立即停止转圈。
3. 继续等待几秒，确认状态不会再次错误回到运行中。
4. 如该轮包含子 Agent，再确认子 Agent 完成后父 Agent 继续输出且最终也能立即收口为非运行态。
