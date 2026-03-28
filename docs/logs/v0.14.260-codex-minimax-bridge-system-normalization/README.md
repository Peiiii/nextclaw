# 迭代完成说明

- 修复 `codex` OpenAI-compatible bridge 的 system prompt 归一化缺陷。
- 之前 bridge 会把 `instructions` 和 `developer` message 同时下发为两个 `system` message；MiniMax `chat/completions` 会直接拒绝这种请求并返回 `invalid params, invalid chat setting (2013)`。
- 现在 bridge 会把 `instructions` 与 `developer` 输入合并成单一 `system` message，再继续转发到 upstream `chat/completions`。
- 为避免继续把主文件堆大，新增 `codex-openai-responses-bridge-message-content.ts`，把 message/content 归一化与合并逻辑从 `codex-openai-responses-bridge-request.ts` 中拆出。
- 新增回归测试，锁定“`instructions + developer` 只能生成一个 `system` message”的契约。

# 测试/验证/验收方式

- 单测：
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/codex-openai-responses-bridge-request.test.ts`
- 编译：
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk build`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk tsc`
- 可维护性自检：
  - `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-openai-responses-bridge-request.ts packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-openai-responses-bridge-message-content.ts packages/nextclaw/src/cli/commands/codex-openai-responses-bridge-request.test.ts`
- 冒烟：
  - `pnpm -C packages/nextclaw dev serve --ui-port 18804`
  - `pnpm smoke:ncp-chat -- --session-type codex --model minimax/MiniMax-M2.7 --port 18804 --prompt 'Reply exactly OK' --json`
- 观察点：
  - `codex + minimax/MiniMax-M2.7` 不再出现 `stream closed before response.completed`
  - 冒烟链路能够产出 `run.finished` 与非空 assistant 文本

# 发布/部署方式

- 本次未执行发布或部署。
- 如果后续需要发布，至少应包含 `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk` 对应版本更新，并重新执行上述单测、编译与 `codex + minimax` 冒烟。

# 用户/产品视角的验收步骤

1. 启动本地 NextClaw 服务。
2. 在 NextClaw UI 中新建 `codex` 会话。
3. 选择 `minimax/MiniMax-M2.7`。
4. 发送一条简单消息，例如 `Reply exactly OK`。
5. 确认会话能正常返回内容，不再出现 `Reconnecting...` / `stream disconnected before completion`。
