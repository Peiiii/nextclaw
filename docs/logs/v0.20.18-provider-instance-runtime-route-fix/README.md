# v0.20.18 Provider Instance Runtime Route Fix

## 迭代完成说明

根因：0.20.5 引入 provider template / provider instance 后，UI 侧按合同把模型 route 写成 `<providerId>/<providerModel>`，但普通 LLM 主链在 `LlmProviderManager.chat()` / `chatStream()` 调用 provider 时仍保留原始 `params.model`。当 provider instance 的 `providerId` 与 `providerType` 不同，例如 `deepseek-2` / `deepseek`，下游 `LiteLLMProvider` 会看到内置 `providerName = deepseek`，不再剥离 `deepseek-2/` 前缀，最终上游 API 收到 `deepseek-2/deepseek-v4-flash` 并返回 model not found。

确认方式：用 mock provider client 截获普通 LLM 主链即将发给上游的 `model` 字段。修复前，同一输入会把 `deepseek-2/deepseek-v4-flash` 传给上游；修复后，上游收到 `deepseek-v4-flash`。

修复方式：在 `LlmProviderManager` 解析出 runtime route 后，调用 provider 时显式使用 `route.model` 覆盖原始请求模型；原始 `params.model` 只作为用户选择输入，不再直接穿透到上游 API。并同步新增方案文档 `docs/designs/2026-06-03-provider-instance-runtime-route-fix.md`。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel exec vitest run src/managers/__tests__/llm-provider.manager.test.ts`：通过，4 个测试。
- `pnpm -C packages/nextclaw-kernel tsc --pretty false`：通过。
- `pnpm -C packages/nextclaw-kernel lint`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-kernel/src/managers/llm-provider.manager.ts packages/nextclaw-kernel/src/managers/__tests__/llm-provider.manager.test.ts`：通过，无错误、无警告；非测试代码净变化 `-1`。
- `pnpm lint:new-code:governance -- packages/nextclaw-kernel/src/managers/llm-provider.manager.ts packages/nextclaw-kernel/src/managers/__tests__/llm-provider.manager.test.ts docs/designs/2026-06-03-provider-instance-runtime-route-fix.md`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。

补充说明：全量 `pnpm lint:new-code:governance` 当前被既有工作区 UI 改动阻塞，阻塞点是 `packages/nextclaw-ui/src/features/chat/managers/ncp-chat-input.manager.ts` 的 `context-destructuring`，不属于本次触达文件。

## 发布/部署方式

本次未执行发布或部署。修复涉及 `@nextclaw/kernel` 源码，后续随统一 NPM 发布批次进入包版本。

## 用户/产品视角的验收步骤

1. 配置一个 provider instance，例如 `providerId = deepseek-2`、`providerType = deepseek`。
2. 在模型选择器选择 `deepseek-2/deepseek-v4-flash`。
3. 发送普通聊天请求。
4. 预期运行时命中 `providers["deepseek-2"]`，上游 API 收到的模型名不包含 `deepseek-2/`，不再出现由 instance 前缀穿透导致的 model not found。

## 可维护性总结汇总

本次遵守非功能 bugfix 的零净增要求：生产代码通过就近简化 `normalizedModel()` 抵消新增 route 覆盖行，非测试代码净变化为 `-1`。修复没有新增 fallback、provider 特判或第二条路由链，而是在 `LlmProviderManager` 主链把已解析的 `route.model` 作为唯一上游模型事实。

可维护性复核结论：通过。正向减债动作：简化。质量与可维护性提升证明：普通 LLM 上游模型字段现在来自 runtime route 解析结果，减少了原始 UI route 穿透这一隐式双事实来源。

## NPM 包发布记录

不涉及 NPM 包发布。
