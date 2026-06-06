# Kernel Context Provider Target Architecture

> **For executor:** REQUIRED SKILLS: use `kernel-branch-owner-architecture`, `nextclaw-delivery-workflow`, `nextclaw-clean-implementation`, `nextclaw-validation-workflow`, `post-edit-maintainability-guard`, and `post-edit-maintainability-review`.

**Goal:** 一次性消灭 core 中的业务提示词组装，让 native 模型输入只通过 kernel context providers 获得 NextClaw 产品语义。

**Architecture:** `core` 只保留可复用的数据读取、解析、预算和 manifest 能力；所有用户可见行为策略、工具使用策略、消息路由策略、技能使用策略、自管理策略和回复格式策略都归 `kernel`。`ContextProviderManager` 是 native context 的唯一扩展入口，不再保留 `ContextBuilder` 这类 core 业务 prompt assembler 或 legacy 拼装层。

**Tech Stack:** TypeScript, Vitest, pnpm, NextClaw kernel/core packages, native NCP agent runtime.

---

## 落地状态

本方案已按“一次性目标架构”执行：

- 删除 `KernelContextProvider -> ContextBuilder` 旧路径。
- 删除 core `ContextBuilder`、core `BootstrapContextBuilder` prompt renderer、core execution prompt renderer 和 core skill prompt renderer。
- 新增 kernel context providers 并按迁移前 prompt 顺序注册。
- 通过 `ContextProviderContribution` assembled contract test 锁定 provider 聚合顺序。
- 通过临时旧 worktree 对比迁移前旧 prompt 与迁移后 provider prompt；标准化临时路径、行尾空格和空行后内容一致。
- 最终文件形态按 contribution 目录治理收敛为：
  - `providers/native-static-context.provider.ts`：无 run context 依赖的静态业务提示词 provider factories。
  - `providers/native-dynamic-context.provider.ts`：需要 run context / tool catalog / bootstrap / skills / memory 的 provider classes。
  - `providers/reply-format-context.provider.ts`：本地文件 Markdown 链接回复格式规则。

## 关键判断

用户判断是对的：当前 `ContextBuilder` 里的大部分内容不是 core 基础能力，而是 NextClaw 产品业务逻辑。

典型例子：

- `Tool Call Style` 是产品交互策略。
- `Messaging` / `Reply Tags` / `Silent Replies` 是 channel/session 产品语义。
- `Self-Management Guide` 是 NextClaw 自管理业务规则。
- `Skills mandatory` / `Skill Learning Loop` 是 agent 行为策略。
- `Reply Formatting` 是 UI/IDE 体验合同。

这些内容长期放在 `@nextclaw/core` 会造成三个问题：

1. `core` 看起来像可复用底座，实际却携带 NextClaw 产品决策。
2. kernel 虽然已有 `ContextProviderManager`，但真实 prompt owner 被 core 的 `ContextBuilder` 抢走。
3. 后续新增提示词时会继续纠结“放 core 还是 kernel”，链路不再自解释。

目标态不保留过渡层：删除 `ContextBuilder`，删除 core 里的业务 prompt renderer，kernel provider 直接拥有目标提示词。

## 目标架构

native prompt 主链路固定为：

```text
AgentRunRequestManager
  -> ContextProviderManager.buildContext(request)
  -> ordered kernel ContextProvider[]
  -> AgentRuntimeManager
  -> DefaultNcpAgentRuntime
  -> AgentRunModelInputBuilder
  -> ProviderManagerNcpLLMApi
```

职责边界：

- `ContextProviderManager`：只负责 provider 注册、顺序聚合、生命周期清理。
- `KernelContextProvider`：删除或重命名为只做 run context 解析的 coordinator；不得再调用 `ContextBuilder`。
- `kernel/contributions/context-provider/providers/*`：provider owner 拥有稳定业务语义块；为满足 contribution role directory 合同，静态块可在同一 provider 文件中以 factory 注册，动态块在同一 dynamic provider 文件中保留 class owner。
- `core`：只能导出非 prompt 的事实/能力，例如 config 类型、skill manifest loader、memory store、bootstrap 文件读取所需的低层服务；不得导出面向模型的业务提示词字符串。

## Provider 划分

本次不要拆得过碎。按业务语义 owner 拆成以下 provider/factory，全部由 `ContextProviderContribution.start()` 一次注册，注册顺序就是模型看到的 context 顺序。

### 1. `AgentIdentityContextProvider`

归属内容：

- `You are a personal assistant running inside NextClaw.`
- `Safety`
- `Runtime`
- time handling base rule

依赖：

- `APP_NAME`
- `SILENT_REPLY_TOKEN` 不放这里，归 `MessagingContextProvider`
- runtime platform/node version 可直接在 provider 内读取

说明：

- 这是产品身份和基础安全姿态，不属于 core。
- 如果未来多个产品复用 core，它们应提供自己的 identity provider。

### 2. `ToolingContextProvider`

归属内容：

- `Tooling`
- runtime tool catalog
- exact tool-name rule
- long wait / polling rule
- relative schedule time conversion rule
- sub-agent polling style
- `Tool Call Style`

依赖：

- `kernel.toolProviderManager.buildTools(request)`
- `buildToolCatalogEntries(...)` 可留在 core，前提是它只是工具元数据规范化，不包含业务提示词文本。

说明：

- 工具列表来自 kernel 当前请求策略，provider 应直接读取 kernel manager。
- 不再通过 `ContextBuilder.buildSystemPrompt(...availableTools)` 间接传入。

### 3. `ProjectContextProvider`

归属内容：

- `Project Context`
- active project directory
- session-bound project root
- repository identity rule
- bootstrap files loaded
- host workspace context
- workspace files injected 说明

依赖：

- `SessionProjectContextResolver`
- `DEFAULT_WORKSPACE_REPOSITORY_IDENTITY_RESOLVER`
- bootstrap file loading budget/config

目标处理：

- 删除 `BootstrapContextBuilder.buildWorkspaceProjectContextSection(...)` 这类 core prompt renderer。
- 若 core 仍需提供低层能力，只保留不产出 prompt 文本的数据 reader，例如 `BootstrapContextDataReader`：
  - 输入：project root、host workspace、context config、session key
  - 输出：结构化数据 `{ projectContext, repositoryIdentity, projectBootstrapFiles, hostBootstrapFiles }`
  - 不输出 `# Project Context` 等模型提示词文本。
- 如果低层 reader 只被 kernel 使用，也可以直接把它放到 kernel，彻底减少 core 表面。

### 4. `WorkspaceMemoryContextProvider`

归属内容：

- `# Memory`
- memory enabled/maxChars/truncation

依赖：

- `MemoryStore`
- `runContext.config.agents.context.memory`
- `runContext.profile.workspace` / `effectiveWorkspace`

说明：

- `MemoryStore` 可以暂留 core，因为它是数据存取能力。
- `# Memory` 的标题、截断提示、是否注入模型，属于 kernel provider。

### 5. `SkillsContextProvider`

归属内容：

- requested skills
- active skills
- available skills
- skill learning loop
- chat composer tokens

依赖：

- `SkillsLoader`
- `RequestedSkillsMetadataReader`
- `runContext.requestedSkills`
- `runContext.profile.workspace`
- `readSessionProjectRoot(runContext.sessionMetadata)`

目标处理：

- 删除或迁移 core 中这些 prompt renderer：
  - `buildRequestedSkillsSystemSection`
  - `buildActiveSkillsSystemSection`
  - `buildAvailableSkillsSystemSection`
  - `buildSkillLearningSystemSection`
- `SkillsLoader` 可以继续留 core，前提是只负责扫描和生成 manifest 数据。
- 如果 `SkillsLoader.buildSkillsManifest(...)` 当前直接输出 XML-ish prompt 片段，接受暂留，但 provider 必须拥有外层说明文案；后续若要进一步纯化 core，可把 manifest 输出改成结构化 skill data。

### 6. `MessagingContextProvider`

归属内容：

- `Reply Tags`
- `Messaging`
- `message tool`
- `Silent Replies`
- current session block

依赖：

- `runContext.channel`
- `runContext.chatId`
- `runContext.sessionKey`
- `runContext.runtimeThinking`
- `SILENT_REPLY_TOKEN`
- `APP_NAME`

说明：

- 这是最典型的 NextClaw 产品业务提示词，必须在 kernel。
- `Current Session` 不再由 `KernelContextProvider` 在末尾手工拼接；它也是 provider 的职责。

### 7. `SessionOrchestrationContextProvider`

归属内容：

- 当前 `buildSessionOrchestrationSection()`
- `sessions_spawn` / `sessions_request` 编排规则
- child session continuation rule

依赖：

- 无重依赖，最多依赖 native runtime constants。

目标处理：

- 当前位置在 `kernel/features/native-runtime` 已经比 core 合理。
- 本轮把它改造成 provider，避免作为 `additionalSystemSections` 参数继续塞给 core builder。

### 8. `ExecutionPolicyContextProvider`

归属内容：

- 当前 `buildMinimalSystemExecutionPrompt(runContext.effectiveModel)`
- model-specific execution overlay

依赖：

- `runContext.effectiveModel`

目标处理：

- 若 `buildMinimalSystemExecutionPrompt` 在 core 只是纯模型执行策略，也仍然属于产品/runtime prompt，不应从 core 输出。
- 迁到 kernel provider；core 最多保留 model capability 解析数据。

### 9. `SelfManagementContextProvider`

归属内容：

- `NextClaw CLI Quick Reference`
- `NextClaw Self-Update`
- `NextClaw Self-Management Guide`

依赖：

- `APP_NAME`
- `resolveNextclawSelfManageGuidePaths()`

目标处理：

- `resolveNextclawSelfManageGuidePaths()` 可以留 core 或移到 kernel，取决于包资源归属。
- 所有面向模型的自管理提示词文案必须在 kernel provider。

### 10. `ReplyFormatContextProvider`

归属内容：

- 本地项目文件优先用 Markdown 链接。
- 项目内使用项目相对路径，项目外才用绝对路径。

现状：

- 已经在 kernel provider 中。

目标处理：

- 保留并纳入统一 provider 注册顺序。
- 不要回到 project/bootstrap context。

## 要删除的东西

本次目标不是保留 legacy，而是删除。

必须删除：

- `packages/nextclaw-core/src/features/agent/services/context.service.ts`
- `packages/nextclaw-core/src/features/agent/features/tests/context.test.ts`
- `ContextBuilder` 从 `packages/nextclaw-core/src/features/agent/index.ts` 的导出。
- `KernelContextProvider` 对 `ContextBuilder` 的 import 和调用。
- core 中只服务业务 prompt 文案的 renderer 函数：
  - `buildRequestedSkillsSystemSection`
  - `buildActiveSkillsSystemSection`
  - `buildAvailableSkillsSystemSection`
  - `buildSkillLearningSystemSection`
  - `buildMinimalSystemExecutionPrompt` 如果生产引用只剩 native provider。
- `BootstrapContextBuilder.buildWorkspaceProjectContextSection(...)` 这种直接返回模型 prompt 文本的 core API。

允许保留，但必须不产出业务 prompt 文本：

- `SkillsLoader`
- `MemoryStore`
- `RequestedSkillsMetadataReader`
- `SessionProjectContextResolver`
- repository identity resolver
- config 类型和 context budget 类型
- tool catalog entry normalization

如果某个 core API 返回的是一段给模型读的英文/中文提示词，它默认不应保留在 core。

## 一次性落地任务

### Task 1: 写目标输入快照测试

**Files:**

- Create: `packages/nextclaw-kernel/src/contributions/context-provider/providers/context-provider-contract.provider.test.ts`

**Steps:**

1. 构造 fake kernel，提供 session/config/tools/memory/skills 所需最小数据。
2. 通过 `ContextProviderContribution.start()` 注册真实 providers。
3. 调用 `contextProviderManager.buildContext(request)`。
4. 断言聚合 context 包含当前关键合同：
   - `You are a personal assistant running inside NextClaw.`
   - `Tool availability (filtered by policy):`
   - `# Project Context`
   - `# Active Skills`
   - `<available_skills>`
   - `# Skill Learning Loop`
   - `## Session Orchestration`
   - `## Current Session`
   - `## Reply Formatting`
   - `## NextClaw Self-Management Guide`
5. 断言 `ContextBuilder` 不参与测试夹具。

验收：

- 迁移前测试应通过，用它锁住实际影响。
- 迁移后同一测试继续通过。

### Task 2: 新增 provider 文件

**Files:**

- Create: `packages/nextclaw-kernel/src/contributions/context-provider/providers/native-static-context.provider.ts`
- Create: `packages/nextclaw-kernel/src/contributions/context-provider/providers/native-dynamic-context.provider.ts`
- Keep: `packages/nextclaw-kernel/src/contributions/context-provider/providers/reply-format-context.provider.ts`

**Steps:**

1. 每个注册项都实现 `ContextProvider`。
2. 每个注册项只返回自己的业务语义块，不接收 `additionalSystemSections` 这种拼装型参数。
3. 需要 run context 的 provider 直接用共享 run-context resolver 或由 contribution 注入稳定 kernel owner。
4. 不新增 generic prompt-builder 抽象；provider class / provider factory 本身就是 owner。

验收：

- provider 文件名满足角色命名。
- provider 不 deep import 其它 package 内部路径。
- provider 输出可以被单测独立断言。

### Task 3: 改造 `ContextProviderContribution`

**Files:**

- Modify: `packages/nextclaw-kernel/src/contributions/context-provider/index.ts`

**Steps:**

1. 删除 `KernelContextProvider` 注册，或者把它重命名为只负责 shared run context 的非 prompt helper。
2. 按目标顺序注册 providers：
   1. `AgentIdentityContextProvider`
   2. `ToolingContextProvider`
   3. `ProjectContextProvider`
   4. `WorkspaceMemoryContextProvider`
   5. `SkillsContextProvider`
   6. `SessionOrchestrationContextProvider`
   7. `ExecutionPolicyContextProvider`
   8. `MessagingContextProvider`
   9. `SelfManagementContextProvider`
   10. `ReplyFormatContextProvider`
3. 保留 `cleanups` collection。
4. 不保留 `KernelContextProvider -> ContextBuilder` 过渡路径。

验收：

- `rg -n "ContextBuilder|buildSystemPrompt" packages/nextclaw-kernel/src packages/nextclaw-core/src` 不应命中生产代码。
- `ContextProviderManager` 仍是唯一 context 聚合入口。

### Task 4: 删除 core prompt assembler

**Files:**

- Delete: `packages/nextclaw-core/src/features/agent/services/context.service.ts`
- Delete: `packages/nextclaw-core/src/features/agent/features/tests/context.test.ts`
- Modify: `packages/nextclaw-core/src/features/agent/index.ts`
- Modify: `packages/nextclaw-core/src/features/agent/utils/skill-context.utils.ts`
- Modify/Delete: `packages/nextclaw-core/src/features/runtime-context/services/bootstrap-context.service.ts`
- Modify: `packages/nextclaw-core/src/features/runtime-context/index.ts`

**Steps:**

1. 删除 `ContextBuilder` 和测试。
2. 移除 `ContextBuilder` 导出。
3. 把 skill prompt renderer 搬到 `SkillsContextProvider`，core 只留下 metadata reader 和 loader。
4. 把 project prompt renderer 搬到 `ProjectContextProvider`。
5. 若 `bootstrap-context.service.ts` 迁移后只剩 provider 私用逻辑，直接移动到 kernel 并从 core 删除。
6. 跑引用确认：
   `rg -n "ContextBuilder|buildSystemPrompt|buildWorkspaceProjectContextSection|buildSkillLearningSystemSection|buildAvailableSkillsSystemSection|buildActiveSkillsSystemSection|buildRequestedSkillsSystemSection" packages -g '*.ts' -g '*.tsx'`

验收：

- core 不再导出任何业务 prompt assembler。
- core 没有面向模型的业务提示词段落。
- 删除不是通过 alias/getter/proxy 伪装完成。

### Task 5: 更新测试归属

**Files:**

- Delete: `packages/nextclaw-core/src/features/agent/features/tests/context.test.ts`
- Create/Modify: provider tests under `packages/nextclaw-kernel/src/contributions/context-provider/providers/*.test.ts`
- Modify: `packages/nextclaw-kernel/src/managers/__tests__/context-provider.manager.test.ts`

**Steps:**

1. 把原 `ContextBuilder` 关键断言搬到 provider contract：
   - tool catalog / schedule time rule -> `context-provider-contract.provider.test.ts`
   - skill list / chat composer tokens -> `context-provider-contract.provider.test.ts`
   - messaging route discovery / self-management guide -> `context-provider-contract.provider.test.ts`
2. 增加一个 manager 聚合测试，验证 provider 顺序。
3. 保留 `RequestedSkillsMetadataReader` 的 core 测试，因为它是 metadata reader，不是 prompt renderer。

验收：

- 测试语义归属和 provider owner 对齐。
- core 测试不再验证业务 prompt 文案。

### Task 6: 更新 release/log/docs

**Files:**

- Modify: `.changeset/chat-local-file-link-prompt.md`
- Modify: `docs/logs/v0.20.37-chat-local-file-links/README.md`

**Steps:**

1. changeset 补充 `@nextclaw/core` 删除业务 prompt assembler、`@nextclaw/kernel` 承接 native providers。
2. 迭代记录说明本次不是逐步迁移，而是一次性完成目标架构。
3. 记录最终 `rg` 无残留证据。

验收：

- 发布说明不夸大为 UI 新能力之外的用户文案。
- 迭代记录说清楚 core/kernel owner 边界。

## 验证命令

必须运行：

```bash
pnpm -C packages/nextclaw-core tsc
pnpm -C packages/nextclaw-kernel tsc
pnpm -C packages/nextclaw-core test -- src/features/agent/features/tests/skill-context.test.ts
pnpm -C packages/nextclaw-kernel test -- src/contributions/context-provider/providers/context-provider-contract.provider.test.ts
pnpm -C packages/nextclaw-kernel test -- src/contributions/context-provider/providers/*.test.ts src/managers/__tests__/context-provider.manager.test.ts
pnpm -C packages/nextclaw-core lint
pnpm -C packages/nextclaw-kernel lint
pnpm lint:new-code:governance
pnpm check:governance-backlog-ratchet
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature
```

必须运行残留扫描：

```bash
rg -n "ContextBuilder|buildSystemPrompt|buildWorkspaceProjectContextSection|buildSkillLearningSystemSection|buildAvailableSkillsSystemSection|buildActiveSkillsSystemSection|buildRequestedSkillsSystemSection" packages/nextclaw-core/src packages/nextclaw-kernel/src -g '*.ts' -g '*.tsx'
```

预期：

- 不命中生产代码。
- 允许命中文档或删除前的测试快照，最终提交前测试也应改名/迁移到 provider owner。

## 可维护性门槛

这是非功能架构清理，不是新增用户能力。

硬门槛：

- 非测试代码净增必须 `<= 0`。
- 如果新增 provider 文件导致生产代码短期增长，必须用删除 `ContextBuilder`、core prompt renderer、旧测试和无用导出抵消。
- 不允许为了过行数门槛压缩清晰代码；必须通过真实删除旧路径和职责收敛达成。

正向减债证明：

- 删除 core 业务 prompt assembler。
- context owner 从单个大字符串 builder 变为 kernel provider owners。
- `ContextProviderManager` 成为唯一主链路。
- 每个 provider 的测试只覆盖自己的业务语义，不再用一个 core 测试覆盖所有产品 prompt。

## 不允许的方案

- 不允许保留 `KernelContextProvider -> ContextBuilder` 作为 legacy path。
- 不允许新增 `LegacyContextProvider`、`CorePromptContextProvider`、`DefaultSystemPromptProvider` 这类换皮壳。
- 不允许把 `ContextBuilder` 改名后留在 core。
- 不允许通过 `additionalSystemSections` 继续把业务 prompt 从外部塞进 core builder。
- 不允许让 core provider 直接注册到 kernel 主链路。
- 不允许用兼容 alias/getter/export 假装删除。

## 最终验收标准

1. `ContextProviderContribution` 注册的 provider 列表就是 native prompt 架构图。
2. `@nextclaw/core` 不再有 `ContextBuilder`。
3. `@nextclaw/core` 不再导出面向模型的业务 prompt section builder。
4. `@nextclaw/kernel` 的 provider tests 覆盖原 `ContextBuilder` 的全部关键文案合同。
5. `AgentRunModelInputBuilder` 收到的 `contextBlocks` 内容与迁移前关键语义一致。
6. `rg` 残留扫描证明没有旧 assembler。
7. 非测试代码净增 `<= 0`，且减债来自真实删除和职责收敛。

## 推荐提交信息

```bash
git commit -m "Move native prompt ownership to kernel providers"
```
