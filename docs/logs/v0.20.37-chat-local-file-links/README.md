# v0.20.37-chat-local-file-links

## 迭代完成说明

本次补齐 Chat markdown 本地文件链接合同，让 AI 回复中的项目相对文件引用能够按当前会话项目根打开，而不是被降级为 `chat-link-invalid`。

根因：`ChatMessageMarkdown` 之前只把绝对路径、`./`、`../` 和少数安全协议当作可渲染链接。AI 在会话里常输出 Cursor / IDE 风格的项目相对链接，例如 `[AGENTS.md](AGENTS.md)`、`[cron](packages/nextclaw-ui/src/features/chat/components/workspace/session-cron-job-content.tsx)`，这些 href 没有 `./` 前缀，导致渲染成不可点击的 invalid span。

确认方式：读取目标会话 `ncp-mq24q944-575b304f` 的消息数据，确认 AI 实际输出了 `packages/...` 形式的 markdown 链接；用户进一步反馈页面里出现 `<span class="chat-link-invalid">AGENTS.md</span>`，确认单文件项目相对路径也未被合同覆盖。

修复方式：

- 新增设计文档 `docs/designs/2026-06-06-chat-local-file-link-contract.md`，明确项目相对文件链接以当前会话 `project_root` / `projectRoot` 为基准。
- 扩展 `ChatMessageMarkdown` 的本地文件 href 识别，支持 `AGENTS.md` 和 `packages/.../*.tsx` 这类 IDE 风格项目相对链接。
- 保持外链和危险协议边界：`https://...` 不触发文件预览，`example.com` 不误判成本地文件，`javascript:` 不生成 anchor。
- 补充 `chat-message-markdown.test.tsx` 覆盖绝对路径、项目相对路径、项目根文件、外链、裸域名和危险协议。
- 清理 native 提示词主干中的失效旧分支：删除未被 native kernel 消费的 `RuntimeUserPromptBuilder`、`ContextBuilder.buildMessages(...)` 与 attachment user-content 旧组装入口。
- 新增 `ReplyFormatContextProvider`：当 AI 在用户可见回复中提到本地项目文件时，优先输出 `[AGENTS.md](AGENTS.md)` / `[file](packages/example/file.ts)` 这类 Markdown 链接；项目内文件使用项目相对路径，项目外文件才使用绝对路径。该规则通过 `ContextProviderContribution -> ContextProviderManager` native 主链路注入，不再混入 `BootstrapContextBuilder`。
- 一次性完成 native prompt owner 目标架构：删除 core `ContextBuilder`、core `BootstrapContextBuilder` prompt renderer 和 core execution/skill prompt renderer；业务提示词全部由 kernel context providers 按原 prompt 顺序注入，core 只保留 loader、metadata reader、memory store、repo identity resolver 等数据能力。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-message-list/__tests__/chat-message-markdown.test.tsx`
  - 结果：通过，`1` 个测试文件、`8` 个测试通过。
- `pnpm -C packages/nextclaw-agent-chat-ui tsc`
  - 结果：通过。
- `pnpm -C packages/nextclaw-agent-chat-ui exec eslint src/components/chat/ui/chat-message-list/chat-message-markdown.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-markdown.test.tsx`
  - 结果：通过，无输出。
- `pnpm -C packages/nextclaw-core test -- src/features/agent/features/tests/context.test.ts`
  - 结果：通过，`1` 个测试文件、`6` 个测试通过。
- `pnpm -C packages/nextclaw-core test -- src/features/agent/features/tests/context.test.ts src/features/agent/features/tests/skill-context.test.ts`
  - 结果：通过，`2` 个测试文件、`8` 个测试通过。
- `pnpm -C packages/nextclaw-core tsc`
  - 结果：通过。
- `pnpm -C packages/nextclaw-kernel test -- src/contributions/context-provider/providers/reply-format-context.provider.test.ts src/managers/__tests__/context-provider.manager.test.ts`
  - 结果：通过，`2` 个测试文件、`2` 个测试通过。
- `pnpm -C packages/nextclaw-kernel test -- src/contributions/context-provider/providers/context-provider-contract.provider.test.ts src/contributions/context-provider/providers/reply-format-context.provider.test.ts src/managers/__tests__/context-provider.manager.test.ts`
  - 结果：通过，`3` 个测试文件、`3` 个测试通过。
- `pnpm -C packages/nextclaw-kernel tsc`
  - 结果：通过。
- `pnpm -C packages/nextclaw-core lint`
  - 结果：通过，`0` errors；保留 `29` 个既有 warnings。
- `pnpm -C packages/nextclaw-kernel lint`
  - 结果：通过，无输出。
- `pnpm lint:new-code:governance`
  - 结果：通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过，ratchet status OK。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`
  - 结果：通过，Errors 0，Warnings 0；总代码 `+351 / -685 / net -334`，非测试代码 `+231 / -470 / net -239`。
- `rg -n "RuntimeUserPromptBuilder|buildBootstrapAwareUserPrompt|DEFAULT_RUNTIME_USER_PROMPT_BUILDER|buildSessionPromptContext|buildSkillLearningUserPromptSection|DefaultUserContentBuilder|ContextUserContent|ContextUserContentBuilder|buildDefaultUserContent|buildMessages\\(|addToolResult\\(|addAssistantMessage\\(" packages/nextclaw-core packages/nextclaw-kernel`
  - 结果：无命中，旧 prompt/message 组装入口已不再残留于 core/kernel。
- `rg -n "ContextBuilder|buildSystemPrompt|buildWorkspaceProjectContextSection|buildSkillLearningSystemSection|buildAvailableSkillsSystemSection|buildActiveSkillsSystemSection|buildRequestedSkillsSystemSection|buildMinimalSystemExecutionPrompt|buildMinimalRuntimeExecutionPrompt|buildSessionOrchestrationSection" packages/nextclaw-core/src packages/nextclaw-kernel/src -g '*.ts' -g '*.tsx'`
  - 结果：无命中，core/kernel 生产代码不再残留旧 prompt assembler 和旧 section builder 名称。
- 迁移前后 prompt 内容无损对比：
  - 方法：用 `HEAD` 临时 worktree 生成迁移前旧 `ContextBuilder` prompt，用当前 kernel provider chain 生成迁移后 prompt；标准化临时路径、行尾空格和空行后比较。
  - 结果：`PROMPT_CONTENT_MATCH`，有效内容 `296` 行一致。
- static provider factory 压缩前后 prompt 内容对比：
  - 方法：保留压缩前 kernel provider prompt 快照，压缩后重新生成当前 provider prompt；标准化行尾和连续空行后比较。
  - 结果：`STATIC_FACTORY_PROMPT_MATCH`，说明通过 factory 降低样板代码没有改变模型输入文本。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-markdown.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/__tests__/chat-message-markdown.test.tsx docs/designs/2026-06-06-chat-local-file-link-contract.md`
  - 结果：Errors 0，Warnings 1。warning 为 `chat-message-list` 目录既有文件数预算提醒，`delta_count=+0`，本次未新增该目录文件。

## 发布/部署方式

本次未执行部署或发布。

改动位于 `@nextclaw/agent-chat-ui` 源码与测试；本地开发环境通过 workspace source consumption 生效。若需要交付到已发布包，需要后续统一发布 `@nextclaw/agent-chat-ui` 并同步依赖方版本。

## 用户/产品视角的验收步骤

1. 打开一个带 `project_root` 的 NextClaw chat 会话。
2. 让 AI 输出 markdown 链接 `[rules](AGENTS.md)`。
3. 确认 `AGENTS.md` 渲染为可点击链接，而不是 `<span class="chat-link-invalid">AGENTS.md</span>`。
4. 点击该链接，确认右侧 workspace file preview 打开 `AGENTS.md`。
5. 让 AI 输出 `[cron](packages/nextclaw-ui/src/features/chat/components/workspace/session-cron-job-content.tsx)`。
6. 点击链接，确认右侧文件预览按当前会话项目根解析并打开对应文件。
7. 确认 `[site](example.com)` 不被误判成本地文件链接，`[bad](javascript:alert(1))` 不生成可点击 anchor。

## 可维护性总结汇总

本次把本地文件链接规则沉淀到设计文档和单元测试中，避免继续依赖口头约定或零散正则补丁。实现仍集中在 `ChatMessageMarkdown` 这个现有 markdown href owner 中，没有新增平行打开链路；宿主仍通过既有 `onFileOpen -> workspace file preview -> server-path-read(basePath=sessionProjectRoot)` 链路解析文件。

`post-edit-maintainability-review` 结论：通过。总代码和测试行数有净增，原因是本次属于用户可见能力补齐，并新增了覆盖安全边界的测试与设计文档。未新增生产文件，未扩大目录平铺度；维护性剩余关注点是 `chat-message-list` 目录已有文件数超预算，后续应按既有 seam 拆分，但本次 delta 为 0。

native prompt 链路清理的 `post-edit-maintainability-review` 结论：通过。本轮属于非功能清理，总代码 `net -334`，非测试代码 `net -239`；正向减债动作是删除失效旧路径与职责收敛：`RuntimeUserPromptBuilder`、`ContextBuilder.buildMessages(...)`、attachment user-content 旧入口不再干扰 native provider 主链路，新增 reply-format 规则落到独立 kernel context provider。

kernel context provider 目标架构清理的 `post-edit-maintainability-review` 结论：通过。本轮属于非功能目标架构清理，总代码 `+1078 / -1035 / net +43`，非测试代码 `+893 / -898 / net -5`，满足非测试代码净增 `<= 0`。正向减债动作是删除 core `ContextBuilder`、core `BootstrapContextBuilder` prompt renderer、core execution/skill prompt renderer 和旧 `KernelContextProvider -> ContextBuilder` 路径；业务提示词 owner 收敛到 kernel context provider 注册链。维护性剩余关注点：`native-dynamic-context.provider.ts` 当前 `508` 行，接近 `600` 行预算但未超限；后续若继续扩展 dynamic provider，应先拆新的 contribution owner 或继续压缩现有动态读取逻辑。

## NPM 包发布记录

本次未发布 NPM 包。

涉及包：

- `@nextclaw/agent-chat-ui`
- `@nextclaw/core`
- `@nextclaw/kernel`

发布判断：需要随下一次统一 NPM 发布批次带出，否则已安装的外部包不会获得该链接合同修复。本轮未执行发布，状态为待后续统一发布。
