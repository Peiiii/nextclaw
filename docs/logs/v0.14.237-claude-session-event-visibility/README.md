# 迭代完成说明

- 为 `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk` 新增 Claude SDK -> NCP 事件映射层，补齐 `message.reasoning-*`、`message.tool-call-*`、`message.tool-call-result`、文本流和 flush 收尾事件。
- 调整 Claude runtime 主链路，统一改为经由 NCP 事件映射器发事件，不再只透传纯文本 delta。
- 补充 Claude 事件映射回归测试，覆盖 thinking stream、tool_use + synthetic tool_result，以及 assistant snapshot fallback。
- 为通过 maintainability guard，将事件映射器拆分为 shared / stream / snapshots / facade 四层，避免新文件直接超预算。

# 测试/验证/验收方式

- 单测：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw exec vitest run src/cli/commands/ncp/claude-sdk-event-mapper.test.ts src/cli/commands/ncp/codex-sdk-event-mapper.test.ts`
- Claude runtime 包验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk build`
- Claude plugin 包验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk build`
- 可维护性自检：
  - `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/src/index.ts packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/src/claude-sdk-ncp-event-mapper.ts packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/src/claude-sdk-event-mapper-shared.ts packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/src/claude-sdk-event-mapper-snapshots.ts packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/src/claude-sdk-event-mapper-stream.ts packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/src/claude-code-sdk-types.ts packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/src/claude-code-runtime-utils.ts packages/nextclaw/src/cli/commands/ncp/claude-sdk-event-mapper.test.ts`
- 真实 Claude 冒烟：
  - 以隔离 `NEXTCLAW_HOME=/tmp/nextclaw-claude-smoke-home.CAvsJL` 启动 `pnpm dev start`
  - 通过 `pnpm smoke:ncp-chat -- --session-type claude --model minimax/MiniMax-M2.7 --port 18810 --thinking medium --prompt "Use your available tools to read ./package.json. Reply with only the exact top-level name field from that file." --json`
  - 观察 `eventTypes` 中出现 `message.reasoning-start` / `message.reasoning-delta` / `message.tool-call-start` / `message.tool-call-args-delta` / `message.tool-call-args` / `message.tool-call-end` / `message.tool-call-result`

# 发布/部署方式

- 创建 changeset：`.changeset/claude-session-event-visibility.md`
- 执行版本提升：
  - `NPM_CONFIG_USERCONFIG=/Users/tongwenwen/Projects/Peiiii/nextclaw/.npmrc PATH=/opt/homebrew/bin:$PATH pnpm release:version`
- 执行发布：
  - `NPM_CONFIG_USERCONFIG=/Users/tongwenwen/Projects/Peiiii/nextclaw/.npmrc PATH=/opt/homebrew/bin:$PATH pnpm release:publish`
- 若整仓发布检查被无关改动阻塞，需在验收中明确阻塞项，并改走符合仓库流程约束的最小替代发布方案。

# 用户/产品视角的验收步骤

1. 启动包含 Claude runtime 的 NextClaw 服务。
2. 在会话类型中选择 `Claude`，发送一个会触发工具调用的请求，例如要求读取工作区里的文件。
3. 确认会话流里不再只显示最终文本，而是能像普通 NextClaw 会话一样看到 thinking、tool call、tool result 的完整过程。
4. 确认最终回答仍能正常完成，且 Claude session 没有因为新增事件映射而退化成报错或空白消息。
