# Native Prompt Context Chain Cleanup Plan

> **For executor:** REQUIRED SKILLS: use `kernel-branch-owner-architecture`, `nextclaw-delivery-workflow`, `nextclaw-clean-implementation`, `nextclaw-validation-workflow`, `post-edit-maintainability-guard`, and `post-edit-maintainability-review`.

**Goal:** 清理 native 提示词主干链路中确定失效、未使用、或会干扰 owner 判断的旧 prompt/context 入口，让后续“本地文件 Markdown 链接”等提示词规则只能从 context provider 主干进入模型。

**Architecture:** native 主干以 `AgentRunRequestManager -> ContextProviderManager -> AgentRuntimeManager -> DefaultNcpAgentRuntime -> AgentRunModelInputBuilder -> ProviderManagerNcpLLMApi` 为事实链路。清理优先收敛到这个主干：context 来源由 context provider 负责，模型输入由 `AgentRunModelInputBuilder` 负责，旧 direct prompt/user-prompt builder 不再并行表达同一职责。

**Tech Stack:** TypeScript, Vitest, pnpm, NextClaw kernel/core/NCP packages.

---

## 范围与非范围

本轮只处理 native 主干提示词链路。

纳入范围：

- `packages/nextclaw-kernel/src/contributions/context-provider/*`
- `packages/nextclaw-kernel/src/managers/context-provider.manager.ts`
- `packages/nextclaw-kernel/src/managers/agent-run-request.manager.ts`
- `packages/nextclaw-kernel/src/services/agent-run-model-input-builder.service.ts`
- `packages/nextclaw-core/src/features/agent/services/context.service.ts`
- `packages/nextclaw-core/src/features/runtime-context/*`
- 与上述入口直接绑定的测试。

暂不纳入范围：

- NARP / Codex / Claude / OpenCode 分支的 context 传递。
- 旧 `@nextclaw/ncp-agent-runtime` 包对外导出清理。
- NARP / Codex / Claude / OpenCode 分支内的同类提示词规则。

当前工作区注意：

- 开始落地前先处理或隔离当前未提交 WIP，尤其是先前试探性加入 `BootstrapContextBuilder` 的 Markdown 链接提示词改动；该改动不应作为最终结构进入主干。
- 不要回滚并行会话改动，除非用户明确要求。若并行改动仍在工作区，先用 `git diff --name-only` 标明不属于本计划的文件。

## 当前 native 主干事实

native 模型输入主链路：

1. `AgentRunRequestManager.send` 接收 agent run 请求，创建/读取 session 和 session run。
2. `ContextProviderManager.buildContext(request)` 聚合 context providers，产出 `contextBlocks`。
3. `KernelContextProvider.provide(request)` 是当前默认 context provider。
4. `KernelContextProvider` 内部使用 `ContextBuilder.buildSystemPrompt(...)` 生成一个大 system prompt block。
5. `AgentRuntimeManager.getOrCreate(...)` 选择 native runtime。
6. `DefaultNcpAgentRuntime.run(...)` 调用 `AgentRunModelInputBuilder.build(...)`。
7. `AgentRunModelInputBuilder` 将 `contextBlocks` join 成 system message，并拼入会话消息、tools、budget prune。
8. `ProviderManagerNcpLLMApi.generate(...)` 调用 `LlmProviderManager.chatStream(...)`。
9. `OpenAICompatibleProvider` 发出 Chat Completions 或 Responses 请求。

主干 owner 判断：

- `ContextProviderManager`：context 扩展点 owner，只聚合 provider，不懂具体提示词。
- `KernelContextProvider`：当前默认 native context provider，负责把 kernel run context 映射成 context block。
- `ContextBuilder`：历史 system prompt assembler，目前被 `KernelContextProvider` 借用，不应继续扩张为新规则 owner。
- `BootstrapContextBuilder`：project/bootstrap section owner，只负责项目根、repo identity、bootstrap 文件等项目事实。
- `AgentRunModelInputBuilder`：native 模型输入 owner，负责 context block、会话消息、tools、预算的最终模型输入形状。

## 已识别问题

1. `KernelContextProvider` 虽然接入 provider 主干，但内部仍把 `ContextBuilder` 当成完整 prompt 生成器，导致 provider 架构存在、provider 粒度却没有拆开。
2. `ContextBuilder` 同时包含 identity、tool catalog、safety、workspace、reply tags、messaging、memory recall、silent replies、runtime、自管理 guide、project context、memory、skills、skill learning 等多类职责，已经不是单一 owner。
3. `BootstrapContextBuilder` 是项目上下文 owner；把 reply formatting 规则塞进去会造成职责错乱。
4. `RuntimeUserPromptBuilder / buildBootstrapAwareUserPrompt` 看起来是旧 runtime user prompt 方案，在 native 主干没有消费点，容易误导后续修改。
5. `ContextBuilder.buildMessages(...)` 看起来是旧 direct agent path，native kernel 只使用 `buildSystemPrompt(...)`。
6. 旧 `DefaultNcpContextBuilder` 属于 `@nextclaw/ncp-agent-runtime` 包内部和对外导出；它不是 native kernel 主干 owner，但可能有包兼容约束，不能和 native 主干清理混为一谈。

## 可删候选与处理策略

### 候选 A：`RuntimeUserPromptBuilder`

文件：

- `packages/nextclaw-core/src/features/runtime-context/utils/runtime-user-prompt.utils.ts`
- `packages/nextclaw-core/src/features/agent/features/tests/runtime-user-prompt.test.ts`
- `packages/nextclaw-core/src/features/runtime-context/index.ts`
- `packages/nextclaw-core/src/features/agent/utils/skill-context.utils.ts`

初步证据：

- `RuntimeUserPromptBuilder`、`buildBootstrapAwareUserPrompt`、`DEFAULT_RUNTIME_USER_PROMPT_BUILDER` 主要出现在自身文件、测试和导出中。
- Codex SDK 包里存在 `RuntimeAgentPromptBuilder` 类型，但当前 live kernel native 主干不走它。

计划处理：

1. 再跑一次引用确认：
   `rg -n "RuntimeUserPromptBuilder|buildBootstrapAwareUserPrompt|DEFAULT_RUNTIME_USER_PROMPT_BUILDER|buildSkillLearningUserPromptSection" packages -g '*.ts' -g '*.tsx'`
2. 若只有测试/导出/旧分支引用，删除 `runtime-user-prompt.utils.ts` 和对应测试。
3. 从 `runtime-context/index.ts` 移除导出。
4. 若 `buildSkillLearningUserPromptSection` 只服务该旧路径，同步删除。
5. 跑 `pnpm -C packages/nextclaw-core tsc`，确认没有公共导出使用方。

### 候选 B：`ContextBuilder.buildMessages(...)`

文件：

- `packages/nextclaw-core/src/features/agent/services/context.service.ts`
- `packages/nextclaw-core/src/features/agent/features/tests/context.test.ts`
- `packages/nextclaw-core/src/features/agent/features/content/user-content.ts`

初步证据：

- native kernel 只调用 `ContextBuilder.buildSystemPrompt(...)`。
- `buildMessages(...)` 及 `ContextUserContentBuilder` 目前主要被旧测试覆盖。

计划处理：

1. 再跑引用确认：
   `rg -n "buildMessages\\(|ContextUserContent|ContextUserContentBuilder|DefaultUserContentBuilder|buildNcpUserContent" packages -g '*.ts' -g '*.tsx'`
2. 若 `buildMessages(...)` 无生产引用，删除 `buildMessages`、`resolveUserContent`、`customUserContentBuilder`、`DefaultUserContentBuilder` 依赖。
3. 删除只验证 `buildMessages` override 的测试。
4. 保留 `buildNcpUserContent` / `DefaultUserContentBuilder` 仅在确有其它生产引用时；否则另列独立清理。
5. 跑 targeted test：`pnpm -C packages/nextclaw-core test -- src/features/agent/features/tests/context.test.ts`。

### 候选 C：旧 `DefaultNcpContextBuilder`

文件：

- `packages/ncp-packages/nextclaw-ncp-agent-runtime/src/runtime/context-builder.service.ts`
- `packages/ncp-packages/nextclaw-ncp-agent-runtime/src/runtime/agent-runtime.service.ts`
- `packages/ncp-packages/nextclaw-ncp-agent-runtime/src/index.ts`
- `packages/ncp-packages/nextclaw-ncp/src/types/agent-runtime.types.ts`

初步判断：

- 当前 native kernel 主干不使用它。
- 它属于旧 `@nextclaw/ncp-agent-runtime` 包内部合同和对外导出，可能存在外部兼容风险。

本轮处理：

- 不直接删除。
- 在方案落地时只标注为“native 主干外旧包兼容入口”。
- 如果要删，另开包级 breaking cleanup 方案，先查 NPM 包对外契约和 workspace dependents。

## 一次性落地任务

落地时将“本地文件 Markdown 链接”提示词规则纳入本轮执行，但只允许通过 native context provider 主链路进入模型；不得继续放在 `BootstrapContextBuilder` 这类项目事实 owner 中。

### Task 1: 冻结 native 主干测试

**Files:**

- Modify: `packages/nextclaw-kernel/src/contributions/context-provider/providers/kernel-context.provider.test.ts`（若不存在则新建）
- Modify/Test: `packages/nextclaw-kernel/src/services/agent-run-model-input-builder.service.test.ts`（若已有则扩展）

**Steps:**

1. 写测试证明 `ContextProviderManager -> KernelContextProvider -> contextBlocks -> AgentRunModelInputBuilder` 会把 provider 产物放进 system message。
2. 断言 system message 包含来自 `KernelContextProvider` 的 session/project/tool catalog 片段。
3. 运行：
   `pnpm -C packages/nextclaw-kernel test -- src/contributions/context-provider/providers/kernel-context.provider.test.ts src/services/agent-run-model-input-builder.service.test.ts`
4. 预期：新增测试通过或先失败后实现最小补齐。

### Task 2: 删除 `RuntimeUserPromptBuilder` 旧路径

**Files:**

- Delete: `packages/nextclaw-core/src/features/runtime-context/utils/runtime-user-prompt.utils.ts`
- Delete or modify: `packages/nextclaw-core/src/features/agent/features/tests/runtime-user-prompt.test.ts`
- Modify: `packages/nextclaw-core/src/features/runtime-context/index.ts`
- Modify: `packages/nextclaw-core/src/features/agent/utils/skill-context.utils.ts`

**Steps:**

1. 跑引用确认命令，保存输出到实现记录或最终汇报。
2. 删除旧 runtime user prompt 文件和专属测试。
3. 移除 `runtime-context/index.ts` 对该文件的导出。
4. 如果 `buildSkillLearningUserPromptSection` 没有其它引用，同步删除。
5. 运行：
   `pnpm -C packages/nextclaw-core tsc`
   `pnpm -C packages/nextclaw-core test -- src/features/agent/features/tests/context.test.ts`

### Task 3: 删除 `ContextBuilder.buildMessages(...)` 旧 direct path

**Files:**

- Modify: `packages/nextclaw-core/src/features/agent/services/context.service.ts`
- Modify: `packages/nextclaw-core/src/features/agent/features/tests/context.test.ts`
- Possibly modify/delete: `packages/nextclaw-core/src/features/agent/features/content/user-content.ts`

**Steps:**

1. 跑引用确认命令，确认 `buildMessages(...)` 无生产调用。
2. 从 `ContextBuilder` 删除 `buildMessages`、`addToolResult`、`addAssistantMessage` 中只服务旧 direct message assembly 的方法；若 `addToolResult/addAssistantMessage` 还有外部引用则保留。
3. 删除 `ContextBuilderOptions.buildUserContent`、`customUserContentBuilder`、`resolveUserContent`。
4. 删除对应测试用例。
5. 如果 `DefaultUserContentBuilder` 只剩无效引用，删除 `features/content/user-content.ts` 及导出；否则保留并标注实际 owner。
6. 运行：
   `pnpm -C packages/nextclaw-core tsc`
   `pnpm -C packages/nextclaw-core test -- src/features/agent/features/tests/context.test.ts`

### Task 4: 拆出 native reply-format provider 落点

**Files:**

- Create: `packages/nextclaw-kernel/src/contributions/context-provider/providers/reply-format-context.provider.ts`
- Modify: `packages/nextclaw-kernel/src/contributions/context-provider/index.ts`
- Test: `packages/nextclaw-kernel/src/contributions/context-provider/providers/reply-format-context.provider.test.ts`

**Steps:**

1. 新增 `ReplyFormatContextProvider`，只输出用户可见回复格式规则。
2. 第一条规则写入：本地项目文件引用优先输出 Markdown 链接；项目内使用项目相对路径，项目外才用绝对路径。
3. 在 `ContextProviderContribution.start()` 注册该 provider。
4. 从 `BootstrapContextBuilder` 移除任何 reply-format 文案。
5. 测试 provider 单独输出和通过 manager 聚合后的顺序。
6. 运行：
   `pnpm -C packages/nextclaw-kernel test -- src/contributions/context-provider/providers/reply-format-context.provider.test.ts`

### Task 5: 收尾验证

**Commands:**

- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-core test -- src/features/agent/features/tests/context.test.ts`
- `pnpm -C packages/nextclaw-kernel test -- src/contributions/context-provider/providers/reply-format-context.provider.test.ts src/services/agent-run-model-input-builder.service.test.ts`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <changed files>`

**验收标准:**

- native 主干只有 `ContextProviderManager` 负责注入 context。
- `RuntimeUserPromptBuilder` 不再存在或不再从公共入口导出。
- `ContextBuilder` 不再负责构造完整 chat messages，只保留当前 native provider 仍需要的 system prompt section 生成能力。
- 本地文件 Markdown 链接规则位于独立 reply-format provider，而不是 bootstrap context。
- 旧 `DefaultNcpContextBuilder` 在本轮不被误删，并在最终汇报中标注为 native 主干外兼容入口。

## 风险与防线

- 公共导出风险：`@nextclaw/core` 和 `@nextclaw/ncp-agent-runtime` 可能有外部用户。删除导出前必须跑 workspace tsc，并在 changeset 中标注内部清理；如果发现外部包契约风险，改为 deprecate 而非删除。
- 并行改动风险：当前工作区可能含有并行会话改动。落地前先记录 `git status --short`，只处理本计划路径。
- 误删旧包风险：`DefaultNcpContextBuilder` 不是 native 主干，但属于旧包合同，本轮不删。
- 行数门槛：这是非功能清理 + 一个小的提示词落点修正，非测试生产代码应净减少；若净增，必须继续删减或说明用户认可的豁免。

## 落地结果记录

- 已删除 `RuntimeUserPromptBuilder` 旧路径、`ContextBuilder.buildMessages(...)` 旧 direct path、以及只服务这些旧路径的测试和导出。
- 已新增 `ReplyFormatContextProvider`，并由 `ContextProviderContribution` 统一注册到 native context provider 主链路。
- 已保留旧 `DefaultNcpContextBuilder`，本轮只标注为 native 主干外兼容入口，不误删旧包合同。

## 发布与记录

- 需要 changeset：若删除或改变 `@nextclaw/core` 公共导出，给 `@nextclaw/core` patch；若仅 kernel 内部清理且未发布独立包，再按实际 package 判断。
- 需要迭代记录：触达运行链路和核心提示词主干，落地后更新最近相关 `docs/logs` 或新建迭代记录，按 `nextclaw-iteration-log-governance` 判断。
