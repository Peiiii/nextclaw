# v0.14.267-codex-openai-gpt54-stream-contract-fix

## 迭代完成说明

- 修复 `codex` 会话在选择 `openai/gpt-5.4` 时的流式断连问题。
- 之前 `resolveCodexResponsesApiSupport()` 只要看到 `/responses` 探测请求返回 200，就会把上游当成可直接走 Codex Responses 流的提供方；这会把“非流式看起来可用、但流式并未真正跑完 `response.completed`”的上游误判为可直连，最终触发 `Reconnecting... 1/5 (stream disconnected before completion: stream closed before response.completed)`。
- 现在能力探测改为真正检查 SSE 流里是否到达 `response.completed`，只有完整流式终态被观察到，才算 Responses 路径可用；否则明确回退到 bridge。
- 同步修正 `@nextclaw/nextclaw-ncp-runtime-codex-sdk` 的构建入口，把 `codex-cli-env.ts` 纳入 `tsup` entry，避免重启或重新构建后 `dist/index.js` 引用不存在的 `codex-cli-env.js`。
- 新增回归测试，覆盖：
  - Responses 流被提前截断时应判定为不可用。
  - Responses 流完整到达 `response.completed` 时才判定为可用。

## 测试/验证/验收方式

- 单测：
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/codex-responses-capability.test.ts`
- 类型检查：
  - `pnpm -C packages/nextclaw tsc`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk tsc`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk tsc`
- 构建：
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk build`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk build`
- 真实 smoke：
  - `NEXTCLAW_HOME=/tmp/nextclaw-smoke-codex-openai pnpm smoke:ncp-chat -- --session-type codex --model openai/gpt-5.4 --base-url http://127.0.0.1:18795 --timeout-ms 180000 --prompt 'Reply exactly OK' --json`
- 观察点：
  - `Result: PASS`
  - `Assistant Text: OK`
  - 事件流最终包含 `run.finished`

## 发布/部署方式

- 已执行正式发布，发布结果包含：
  - `@nextclaw/nextclaw-engine-codex-sdk@0.3.9`
  - `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.7`
  - `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk@0.1.30`
  - `nextclaw@0.16.10`
  - `@nextclaw/agent-chat-ui@0.2.11`
  - `@nextclaw/openclaw-compat@0.3.41`
  - `@nextclaw/remote@0.1.58`
  - `@nextclaw/server@0.11.6`
  - `@nextclaw/ui@0.11.7`
- 发布流程已自动创建对应 git tag。
- 本地验证仍可直接重启 `nextclaw start` / `nextclaw serve`，或使用 `pnpm -C packages/nextclaw dev:build serve --ui-port <port>` 启动当前源码。

## 用户/产品视角的验收步骤

1. 启动包含本次修复的 NextClaw 服务。
2. 新建一个 `codex` 会话。
3. 在模型选择器中选择 `openai/gpt-5.4`。
4. 发送一条最小消息，例如 `Reply exactly OK`。
5. 确认不会再出现 `Reconnecting... 1/5 (stream disconnected before completion: stream closed before response.completed)`。
6. 确认最终能收到真实回复 `OK`，并且会话历史里保留完整的 assistant 消息。

## 相关实现

- [responses 能力探测](../../../packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-responses-capability.ts)
- [Codex 运行时打包入口](../../../packages/extensions/nextclaw-ncp-runtime-codex-sdk/tsup.config.ts)
