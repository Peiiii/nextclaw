# 迭代完成说明

- Claude engine plugin 改为统一使用 bootstrap-aware user prompt，补齐 workspace bootstrap 上下文与 requested skills 注入。
- Claude NCP runtime plugin 的 input builder 同步切到同一套 bootstrap-aware prompt 构造逻辑，并显式传入 `agents.context`。
- shared `@nextclaw/agent-chat-ui` 更新工具卡片与文件卡片表现，移除已废弃的 call-id / input-label 展示，统一当前工具生命周期 UI。

# 测试/验证/验收方式

- Claude engine plugin：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-engine-plugin-claude-agent-sdk lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-engine-plugin-claude-agent-sdk tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-engine-plugin-claude-agent-sdk build`
- Claude NCP runtime plugin：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk build`
- Prompt 契约：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec vitest run src/agent/runtime-user-prompt.test.ts`
- Agent chat UI：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui build`
- Claude 真实冒烟：
  - `PATH=/opt/homebrew/bin:$PATH pnpm smoke:ncp-chat -- --session-type claude --model minimax/MiniMax-M2.7 --port 18793 --thinking medium --prompt "Reply exactly CLAUDE_OK" --json`

# 发布/部署方式

- 创建 changeset：`.changeset/claude-bootstrap-ui-prompt.md`
- 版本提升：
  - `NPM_CONFIG_USERCONFIG=/Users/tongwenwen/Projects/Peiiii/nextclaw/.npmrc PATH=/opt/homebrew/bin:$PATH pnpm release:version`
- 正式发布：
  - `NPM_CONFIG_USERCONFIG=/Users/tongwenwen/Projects/Peiiii/nextclaw/.npmrc PATH=/opt/homebrew/bin:$PATH pnpm release:publish`
- 若整仓 `release:check` 被与本次无关的工作区改动阻塞，则改走受影响包的最小替代发布方案，并在验收里写明阻塞点。

# 用户/产品视角的验收步骤

1. 启动带 Claude runtime 的 NextClaw 服务。
2. 发起 Claude 会话，确认首轮 prompt 能按 workspace bootstrap 规则工作，不再丢失 requested skills / project context 注入。
3. 在聊天界面触发工具调用或文件附件展示，确认工具卡片只保留当前状态与输出信息，不再展示过时的 call-id / input-label。
4. 确认 Claude 会话仍能正常完成响应，UI 没有因为卡片重构出现空白、错位或类型报错。
