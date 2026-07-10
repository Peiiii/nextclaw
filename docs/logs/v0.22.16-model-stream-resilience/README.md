# v0.22.16 模型流式输出韧性修复

## 迭代完成说明

本次修复模型流式输出“文字到一半中断”的韧性问题，并补齐用户消息中的轻量运行调试信息。

根因分两层：OpenAI Responses API 的流式消费链路缺少成功终端事件 `response.completed` 校验；native runtime 缺少和 OpenCode session processor 同层的模型 stream retry。因此当上游网络、provider 或代理层在输出部分 delta 后提前断开时，系统能识别失败，但不能在 native 模型 round owner 发布 retry 状态并自动重试。

确认方式：

- 对比现有 Chat Completions 链路，成功依赖 `finish_reason`；Responses 链路缺少同等级的成功终端合同。
- 用定向测试复现：Responses SSE 输出部分文本后 EOF 且没有 `response.completed`，修复后会抛出缺少终端事件的错误，不再产出 `done`。
- 用定向测试验证：如果还没有向 UI 产生任何可见输出，缺少终端事件会作为 transient failure 重试。
- 用 native runtime 定向测试验证：如果 native runtime 已经产生半截文本后遇到 retryable stream failure，系统会发出 `run.metadata({ type: "retry" })`，按 2 秒起步指数退避后重跑模型 round。
- 用 wrapper 定向测试验证：外部 runtime 中途失败时，`NcpAgentRuntimeWrapper` 不新增二次 retry，只转发外部 runtime 的真实失败事件。
- 参考 OpenCode `session/processor.ts` 与 `session/retry.ts` 源码，确认同款机制是 session processor 包住 `llm.stream(...)`、发布 `{ type: "retry" }` 状态、按 2s/4s/8s...30s 退避重试，而不是引入 NextClaw 专属 recall 协议。

修复方式：

- Responses 流式消费必须看到 `response.completed` 才能产出最终 `done`。
- `response.incomplete` 明确进入错误路径，不再落入普通事件忽略。
- provider 只在“没有可见输出前”的 Responses stream transient failure 上做最多 3 次自动重试。
- 抽出共享 runtime stream retry 工具，统一 attempt 状态、可重试判定、retry metadata 和退避时间。
- native runtime 对 retryable stream failure 做 OpenCode-style retry：发布 `run.metadata({ type: "retry", attempt, message, action, next })`，按 2s/4s/8s...30s 退避重跑模型 stream；本层不设置最大尝试次数。
- `NcpAgentRuntimeWrapper` 删除 wrapper 级恢复语义，外部 runtime 自己负责自己的 retry，wrapper 只转发事件。
- `DefaultNcpAgentConversationStateManager` 对同一 assistant message 的多次 `message.text.start` 追加新的 text part，避免下一次 attempt 的 delta 拼进上一段 partial text part。
- 用户消息 `run_spec` 增加轻量 `execution` 字段，记录协议版本、终端合同和重试策略，不记录 API key、完整 headers 或请求正文。
- 新增设计文档：`docs/designs/2026-07-08-model-stream-resilience.design.md`。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-core test src/features/llm-providers/providers/__tests__/openai.provider.test.ts`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next test src/runtime/agent-runtime.service.test.ts`
- `pnpm -C packages/nextclaw-kernel test src/services/__tests__/ncp-agent-runtime-wrapper.service.test.ts src/managers/__tests__/agent-run-request-message-run-spec.manager.test.ts`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit test src/agent/agent-conversation-state-manager.test.ts src/agent/__tests__/agent-conversation-state-manager.retry.test.ts src/agent/agent-conversation-state-manager-settlement.test.ts src/agent/__tests__/agent-conversation-state-manager.abort-tool.test.ts src/agent/__tests__/agent-conversation-state-manager.batch.test.ts src/agent/__tests__/agent-conversation-state-manager.dedup.test.ts`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime tsc`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next tsc`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit tsc`
- `pnpm -C packages/nextclaw-core lint`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime lint`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next lint`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit lint`
- `pnpm lint:new-code:governance`
- `pnpm check:generated-clean`
- `git diff --check -- <本次触达文件>`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <本次触达文件>`
- `pnpm check:governance-backlog-ratchet`

当前验证已通过。package lint 仍有若干历史 warning，本次没有新增 lint error。

## 发布/部署方式

不涉及单独部署。该修复进入 `@nextclaw/core`、`@nextclaw/kernel` 与相关 NCP runtime/toolkit 包后，随下一次常规 NPM/桌面发布带出。

## 用户/产品视角的验收步骤

1. 使用配置为 OpenAI Responses API 的模型发起一次会话。
2. 模拟或遭遇上游 stream 提前 EOF 且没有 `response.completed` 的情况。
3. 如果尚未输出任何可见内容，provider 应自动重试。
4. 如果 native runtime 已经输出部分文本后遇到 retryable stream failure，系统应发布 retry metadata 并按 2 秒起步指数退避重启模型 stream。
5. 如果外部 runtime 中途失败，wrapper 不应二次重试，应保留外部 runtime 的真实失败语义。
6. 如果用户取消，系统不应自动重试，应保留取消语义。
7. 查看用户消息 metadata，应能看到 `run_spec.execution` 中的终端合同和重试策略，辅助判断本轮到底按什么运行参数执行。

## 可维护性总结汇总

本次是用户可见稳定性能力修复，允许必要的生产代码增长。实现没有新增平行 provider，也没有把重试逻辑放到 UI 或消息展示层；终端合同归 Responses stream parser，provider 未外泄重试归 OpenAI provider，native runtime stream retry 归共享 retry 工具与 `DefaultNcpAgentRuntime`，外部 runtime wrapper 保持转发，调试信息归消息 `run_spec`。

已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 做收尾检查。`openai.provider.ts` 和 `agent-run-request.manager.ts` 均保持在 600 行预算内；新增测试集中覆盖终端合同和重试边界。

## NPM 包发布记录

- 涉及包：`@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/ncp-agent-runtime`、`@nextclaw/ncp-agent-runtime-next`、`@nextclaw/ncp-toolkit`
- 发布状态：待下一次统一 NPM/桌面发布带出
- Changeset：`.changeset/model-stream-resilience.md`
