# v0.14.264-codex-bridge-reasoning-normalization

## 迭代完成说明

- 复现了 Codex 会话在真实接口层的异常：`/api/ncp/agent/send` 返回的事件流只有 `message.text-*`，没有 `message.reasoning-*`，assistant 文本里直接夹带 `<think>...</think>`。
- 根因定位到 `packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk` 的 OpenAI-compatible bridge：
  - bridge 只把 upstream chat/completions 的 assistant `content/output_text` 转成 Responses `output_text`
  - 没有处理 `reasoning_content`
  - 也没有对 `<think>` / `<final>` 标签做 reasoning 归一化
- 已修复 bridge assistant 输出映射：
  - 当 upstream 返回 `reasoning_content` 时，bridge 生成结构化 reasoning output item
  - 当 upstream assistant 文本以 `<think>...</think><final>...` 形式返回时，bridge 先归一化为 `reasoning` + 可见 `text`
  - reasoning 不再混入 `output_text`
- 为避免单文件继续膨胀，将 assistant output / reasoning SSE 逻辑拆分到独立模块。

## 测试/验证/验收方式

- 实时复现（修复前 live 服务）：
  - `pnpm smoke:ncp-chat -- --session-type codex --model minimax/MiniMax-M2.7 --thinking high --prompt "Solve 13*17 mentally, show your reasoning if supported, then end with FINAL=221" --base-url http://127.0.0.1:18794 --json`
  - 观察到 `eventTypes` 只有 `message.text-*`，`reasoningText` 为空，assistant text 内含 `<think>...</think>`
- 历史接口复现（修复前 live 服务）：
  - `GET /api/ncp/sessions/smoke-codex-mn9x24v2-p9jki5k9/messages`
  - 观察到 assistant `parts` 仅为 `text` + `tool-invocation` + `text`，其中 `text` 仍包含 `<think>`
- 代码验证：
  - `pnpm -C packages/nextclaw test -- run src/cli/commands/ncp/codex-openai-responses-bridge.test.ts`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk tsc`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk build`
- 可维护性自检：
  - `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-openai-responses-bridge-stream.ts packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-openai-responses-bridge-assistant-output.ts packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-openai-responses-bridge-shared.ts packages/nextclaw/src/cli/commands/ncp/codex-openai-responses-bridge.test.ts`
- 发布后验收：
  - `pnpm smoke:ncp-chat -- --session-type codex --model minimax/MiniMax-M2.7 --thinking high --prompt "Solve 13*17 mentally, show your reasoning if supported, then end with FINAL=221" --base-url http://127.0.0.1:18794 --json`
  - 结果：`PASS`
  - 观察到 `assistantText` 为干净正文 `13 × 17 ... FINAL=221`
  - 观察到 `reasoningText` 为空，`eventTypes` 未出现 `message.reasoning-*`
  - 进一步查询 `GET /api/ncp/sessions/smoke-codex-mn9y6t3z-0ysrw7g1/messages`，历史消息里 assistant `parts` 仅包含可见 `text`，没有 `<think>` 泄漏

## 发布/部署方式

- 本次已执行正式发布与打 tag。
- 已发布版本：
  - `@nextclaw/nextclaw-engine-codex-sdk@0.3.7`
  - `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk@0.1.28`
  - `nextclaw@0.16.8`
  - `@nextclaw/openclaw-compat@0.3.39`
  - `@nextclaw/remote@0.1.56`
  - `@nextclaw/server@0.11.4`
- 对于本地运行中的 Codex 会话，要让新行为生效，需要重启加载 `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk` 的 NextClaw 进程；已安装包环境则需升级到上述版本后重启服务。

## 用户/产品视角的验收步骤

1. 启动或重启带 `codex` session type 的 NextClaw 服务。
2. 新建一个 `Codex` 会话，选择走 OpenAI-compatible bridge 的模型。
3. 发送一条会触发 thinking 的消息，例如：`Solve 13*17 mentally, then answer FINAL=221`
4. 观察实时消息流：
   - 不应再把 `<think>...</think>` 当普通正文直接显示
   - 若 upstream 提供 reasoning，应显示为结构化 reasoning，而不是普通 text
5. 刷新页面后重新进入同一会话。
6. 观察历史消息：
   - assistant 可见正文应保持干净
   - 不应再在 text part 中看到 `<think>` 标签泄漏
