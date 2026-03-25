# 迭代完成说明

- 修复 NCP 前端发送复合消息时的顺序丢失问题：输入框中的 `text/file/text/...` 现在会按原顺序序列化为一条用户消息的有序 `parts`。
- 扩展 `buildNcpRequestEnvelope`，支持显式传入有序 `parts`，不再被 `text + attachments` 的扁平拼接强制改写顺序。
- 修复 NextClaw NCP 当前 turn 的上下文构建，当前轮发送给模型的用户内容也会保持原始片段顺序，不再把文本和图片拆成两堆后重排。
- 补充回归测试，覆盖 composer 序列化顺序、NCP 会话适配顺序，以及 NextClaw NCP context builder 的当前轮顺序保留。

# 测试/验证/验收方式

- `NODE_PATH=/Users/peiwang/Projects/nextbot/node_modules/.pnpm/loupe@3.2.1/node_modules PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/nextclaw-ncp-context-builder.test.ts src/cli/commands/ncp/nextclaw-agent-session-store.test.ts`
- `NODE_PATH=/Users/peiwang/Projects/nextbot/node_modules/.pnpm/loupe@3.2.1/node_modules PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test -- --run src/components/chat/chat-composer-state.test.ts src/components/chat/ncp/ncp-session-adapter.test.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-react tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-react build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-react lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/ncp-demo build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/ncp-demo exec node scripts/smoke-ui.mjs`
- `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/components/chat/chat-composer-state.ts packages/nextclaw-ui/src/components/chat/chat-composer-state.test.ts packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-input.manager.ts packages/nextclaw-ui/src/components/chat/ncp/NcpChatPage.tsx packages/nextclaw-ui/src/components/chat/ncp/ncp-session-adapter.test.ts packages/ncp-packages/nextclaw-ncp-react/src/attachments/ncp-attachments.ts packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-current-turn.ts packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-context-builder.ts packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-context-builder.test.ts packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-message-bridge.ts`

# 发布/部署方式

- 本次未执行正式发布。
- 若后续发布 NCP 前端或 CLI，请复跑上述测试与 smoke，并重点验收“单条消息内多段文本/图片顺序一致”。

# 用户/产品视角的验收步骤

1. 在 NCP 聊天输入框中输入一段文本，例如 `before `。
2. 粘贴或上传一张图片，让图片 token 出现在文本后。
3. 继续在同一条消息里输入第二段文本，例如 ` after`。
4. 发送后确认用户消息卡片中的内容顺序仍是 `before` → 图片 → `after`，而不是被重排。
5. 再继续追问图片内容，确认模型仍能感知这张图片，且不发生隐式切换模型。
