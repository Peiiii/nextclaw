# 迭代完成说明

- 修复 NCP chat 中 subagent completion 结果没有稳定写回当前会话的问题。
- 为 `DefaultNcpAgentBackend` 增加正式的 `appendMessage` 入口，让 NCP-originated completion 直接写入当前 live session 并持久化，而不是回弹到 legacy `MessageBus.publishInbound(system)`。
- 为 `SubagentManager` 增加可注入的 completion sink；NCP 路径改为走 NCP-native sink，legacy 路径仍保留原有 bus 行为，避免误伤 CLI/gateway/cron 等尚未迁移入口。
- 在 UI NCP runtime 中新增 subagent completion message builder，当前先以可见 `service` 消息 + `nextclaw.subagent.completion` extension part 落盘，为后续 task card 视图留接口。
- 前端聊天页补上当前 active session 的 realtime reload：命中 `session.summary.upsert` / `session.updated` 且当前 run 空闲时，自动 `reloadSeed()`，保证当前页能看到异步 completion。
- 新增回归测试，锁定“completion 写回当前 NCP session 且不再走 legacy relay”的行为。

相关方案：
- [Subagent Completion And Visibility Plan](../../../plans/2026-03-31-subagent-completion-and-visibility-plan.md)
- [NCP Cutover Strategic Gap Analysis](../../../plans/2026-03-31-ncp-cutover-strategic-gap-analysis.md)

# 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/cli/commands/ncp/create-ui-ncp-agent.subagent-completion.test.ts src/cli/commands/ncp/create-ui-ncp-agent.test.ts`
  - 工作目录：`packages/nextclaw`
- `PATH=/opt/homebrew/bin:$PATH packages/nextclaw-core/node_modules/.bin/vitest run src/agent/subagent.test.ts`
  - 工作目录：仓库根目录
- `PATH=/opt/homebrew/bin:$PATH packages/ncp-packages/nextclaw-ncp-toolkit/node_modules/.bin/tsc -p packages/ncp-packages/nextclaw-ncp-toolkit/tsconfig.json --noEmit`
- `PATH=/opt/homebrew/bin:$PATH packages/nextclaw/node_modules/.bin/tsc -p packages/nextclaw/tsconfig.json --noEmit`
- `PATH=/opt/homebrew/bin:$PATH packages/nextclaw-core/node_modules/.bin/tsc -p packages/nextclaw-core/tsconfig.json --noEmit`
- `PATH=/opt/homebrew/bin:$PATH packages/nextclaw-ui/node_modules/.bin/tsc -p packages/nextclaw-ui/tsconfig.json --noEmit`
- `PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
- 本轮未额外执行真实联网 provider 的 UI smoke；当前可复现闭环主要通过新增的 in-process NCP session 回归测试覆盖。

# 发布/部署方式

- 已执行：
  - `PATH=/opt/homebrew/bin:$PATH pnpm release:version`
  - `PATH=/opt/homebrew/bin:$PATH pnpm release:publish`
- `release:publish` 过程中，release guard 自动扩大到 companion packages；最终成功发布并打 tag 的主要包包括：
  - `@nextclaw/core@0.11.10`
  - `@nextclaw/ncp-toolkit@0.4.8`
  - `@nextclaw/mcp@0.1.57`
  - `@nextclaw/server@0.11.15`
  - `@nextclaw/ui@0.11.13`
  - `nextclaw@0.16.23`
- 另外还有若干由 release guard 带出的 companion packages 一并完成发布与 tag。

# 用户/产品视角的验收步骤

1. 打开 NCP chat，会话类型使用 `native`。
2. 让主 agent 调用 `spawn` 创建一个子 agent。
3. 观察主对话先正常结束；稍后当前会话内应新增一条可见的 subagent completion 消息。
4. 刷新页面后重新进入同一会话，completion 消息仍然存在。
5. 确认不需要依赖 legacy system message relay 才能看到这条结果。
