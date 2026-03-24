# 迭代完成说明

- 修复 `codex` 会话选择 `dashscope/qwen3-coder-next` 等 OpenAI-compatible 模型时仍直接打 `/responses` 导致失败的问题。
- 保留 `codex` 会话的真实运行时为 `codex-sdk`，不再通过 native runtime 冒充成功。
- 为 codex OpenAI bridge 补齐更完整的 Responses SSE 事件序列，确保 Codex CLI 能正确消费桥接后的流。
- 修复 Responses → `chat/completions` 的工具声明映射，支持 Codex 实际发出的顶层 `function` tools 格式。
- 将 bridge 触发条件从单纯依赖静态 provider registry，升级为“静态能力 + `wireApi` + 真实 `/responses` 探测”组合判定，并处理 `HTTP 200 + status=failed` 这类伪成功失败响应。

# 测试/验证/验收方式

- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm --filter @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk tsc`
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm --filter nextclaw tsc`
- 单测：
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm --filter nextclaw test -- --run src/cli/commands/ncp/create-ui-ncp-agent.test.ts src/cli/commands/ncp/codex-openai-responses-bridge.test.ts`
- 真实 codex-sdk 直连验证：
  - 通过本地 bridge 直连真实 DashScope，返回 `CODEX_BRIDGE_DIRECT_OK`
- 真实 NextClaw service 冒烟：
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm smoke:ncp-chat -- --session-type codex --model dashscope/qwen3-coder-next --base-url http://127.0.0.1:18936 --prompt "Reply with exactly NEXTCLAW_CODEX_BRIDGE_OK" --timeout-ms 180000 --json`
  - 实际结果：`ok=true`，`assistantText=NEXTCLAW_CODEX_BRIDGE_OK`
- 运行时归属校验：
  - `/tmp/nextclaw-codex-final-78ybTF/sessions/smoke-codex-mn4rs4jr-apzynrbt.jsonl` 中记录 `session_type=codex` 且 `codex_runtime_backend=codex-sdk`

# 发布/部署方式

- 本次只完成修复、验证与提交准备，未执行 npm 发布或正式上线。
- 若需要对外发布，应先按项目既有发布流程更新版本与 changeset，再执行对应包发布，并补一轮 registry 安装冒烟。
- 本地验证若要复现，应使用隔离 `NEXTCLAW_HOME`，并确保其中的 `nextclaw-ncp-runtime-plugin-codex-sdk` 指向本次 build 产物。

# 用户/产品视角的验收步骤

1. 启动本地 NextClaw 实例。
2. 进入 `codex` 类型会话。
3. 在模型选择器中选择 `dashscope/qwen3-coder-next`。
4. 发送一条简单消息，例如“Reply with exactly NEXTCLAW_CODEX_BRIDGE_OK”。
5. 确认会话正常返回真实模型回复，而不是报 `Unsupported model: qwen3-coder-next`。
6. 如需进一步确认运行时归属，可检查会话元数据中仍为 `codex_runtime_backend=codex-sdk`。
