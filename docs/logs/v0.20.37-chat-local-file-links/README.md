# v0.20.37-chat-local-file-links

## 迭代完成说明

本次补齐 Chat markdown 本地文件链接合同，让 AI 回复中的项目相对文件引用能够按当前会话项目根打开，而不是被降级为 `chat-link-invalid`。

根因：`ChatMessageMarkdown` 之前只把绝对路径、`./`、`../` 和少数安全协议当作可渲染链接。AI 在会话里常输出 Cursor / IDE 风格的项目相对链接，例如 `[AGENTS.md](AGENTS.md)`、`[cron](packages/nextclaw-ui/src/features/chat/components/workspace/session-cron-job-content.tsx)`，这些 href 没有 `./` 前缀，导致渲染成不可点击的 invalid span。

确认方式：读取目标会话 `ncp-mq24q944-575b304f` 的消息数据，确认 AI 实际输出了 `packages/...` 形式的 markdown 链接；用户进一步反馈页面里出现 `<span class="chat-link-invalid">AGENTS.md</span>`，确认单文件项目相对路径也未被合同覆盖。

修复方式：

- 新增设计文档 `docs/designs/2026-06-06-chat-local-file-link-contract.design.md`，明确项目相对文件链接以当前会话 `project_root` / `projectRoot` 为基准。
- 扩展 `ChatMessageMarkdown` 的本地文件 href 识别，支持 `AGENTS.md` 和 `packages/.../*.tsx` 这类 IDE 风格项目相对链接。
- 保持外链和危险协议边界：`https://...` 不触发文件预览，`example.com` 不误判成本地文件，`javascript:` 不生成 anchor。
- 补充 `chat-message-markdown.test.tsx` 覆盖绝对路径、项目相对路径、项目根文件、外链、裸域名和危险协议。
- 清理 native 提示词主干中的失效旧分支：删除未被 native kernel 消费的 `RuntimeUserPromptBuilder`、`ContextBuilder.buildMessages(...)` 与 attachment user-content 旧组装入口。
- 新增 `ReplyFormatContextProvider`：当 AI 在用户可见回复中提到本地项目文件时，优先输出 `[AGENTS.md](AGENTS.md)` / `[file](packages/example/file.ts)` 这类 Markdown 链接；项目内文件使用项目相对路径，项目外文件才使用绝对路径。该规则通过 `ContextProviderContribution -> ContextProviderManager` native 主链路注入，不再混入 `BootstrapContextBuilder`。
- 一次性完成 native prompt owner 目标架构：删除 core `ContextBuilder`、core `BootstrapContextBuilder` prompt renderer 和 core execution/skill prompt renderer；业务提示词全部由 kernel context providers 按原 prompt 顺序注入，core 只保留 loader、metadata reader、memory store、repo identity resolver 等数据能力。
- 补齐无项目根会话的相对文件链接基准：`NcpSessionSummary` 新增 `workingDir`，由 kernel `SessionWorkingDirResolver` 按 `projectRoot ?? agent workspace` 解析，并与 native exec 默认 cwd 对齐；前端文件预览使用 `sessionWorkingDir` 作为 `server-path-read` 的 `basePath`。
- 2026-06-09 后续微调：把 native 回复格式规则从“本地项目文件”扩展为“本地可打开文件”，项目内继续优先项目相对链接，项目外本地文件使用绝对路径 Markdown 链接；同步将设计文档改名为 `.design.md`，满足当前 docs/designs 命名治理。
- 2026-06-09 链接可点击性补充：真实会话数据确认模型源头可能把 `MEMORY.md` 输出成 inline code、粗体或纯文本，导致前端没有 anchor 可渲染；因此 `ReplyFormatContextProvider` 明确要求本地可打开文件引用必须输出为 Markdown link，且不能使用粗体、inline code、fenced code block 或纯文本替代。
- 2026-06-09 纠错会话补充：`ncp-mq5gwpr7-7ee7861c` 里模型已经在 reasoning 中引用了 `Reply Formatting`，说明规则已注入；但最终回复只给 `memory/` 子文件加了链接，主文件 `MEMORY.md` 仍以粗体/inline code/裸路径出现。修正方向不是前端猜链接，而是强化 `ReplyFormatContextProvider`：文件链接规则适用于标题、标签、段落第一处、纠错回复和 tool result 中复制出来的文件名；最终回复发送前必须自检裸文件名并改成 Markdown link。
- 2026-06-09 目录列表补充：`ncp-link-format-list-smoke-1780939472` 验证到主文件已链接，但模型在“比如”列表中仍把子文件名写成 inline code。继续强化 prompt：如果不准备逐个链接列表里的文件，就不要列具体文件名，只概括；最终自检时裸文件名要么改成链接，要么删掉文件名。
- 2026-06-09 反例补充：`ncp-mq5hi63x-ecb83eb0` 中模型仍输出 `**\`/Users/.../MEMORY.md\`**`、`` `memory/` `` 和 inline-code 子文件列表。继续强化 `ReplyFormatContextProvider`：本地文件引用是 output contract，不是 prose style；明确禁止 backticked file names、bold backticked paths、bare local paths、comma-separated inline-code file lists。
- 2026-06-09 正反例补充：`ncp-mq5hqmam-1ebf4d59` 中主文件已链接，但 `memory/` 目录和子文件列表继续使用 inline code。prompt 调整为结构化合同加少量成对正反例：文件、目录、目录内多个文件三类高频场景，避免继续堆随机坏样本。

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
- 2026-06-09 后续微调验证：
  - `pnpm -C packages/nextclaw-kernel test -- src/contributions/context-provider/providers/reply-format-context.provider.test.ts`
    - 结果：通过，`1` 个测试文件、`1` 个测试通过。
  - `pnpm -C packages/nextclaw-kernel tsc`
    - 结果：通过。
  - `pnpm exec eslint packages/nextclaw-kernel/src/contributions/context-provider/providers/reply-format-context.provider.ts packages/nextclaw-kernel/src/contributions/context-provider/providers/reply-format-context.provider.test.ts`
    - 结果：通过，无输出。
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-kernel/src/contributions/context-provider/providers/reply-format-context.provider.ts packages/nextclaw-kernel/src/contributions/context-provider/providers/reply-format-context.provider.test.ts docs/designs/2026-06-06-chat-local-file-link-contract.design.md docs/logs/v0.20.37-chat-local-file-links/README.md`
    - 结果：通过，Errors 0，Warnings 1；warning 为 `context-provider/providers` 目录已有文件数预算例外，`delta_count=+0`。最终 prompt 合同版本总代码 `+26 / -9 / net +17`，非测试代码 `+1 / -5 / net -4`。
  - `pnpm lint:new-code:governance`
    - 结果：本次 prompt 相关文件通过；全量 diff 检查被当前工作区无关 WIP 阻塞：`packages/nextclaw/src/cli/app/services/service-app-live-runtime.service.ts` 存在跨包 deep import。
  - `pnpm check:governance-backlog-ratchet`
    - 结果：通过，ratchet status OK。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`
  - 结果：通过，Errors 0，Warnings 0；总代码 `+351 / -685 / net -334`，非测试代码 `+231 / -470 / net -239`。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --no-fail`
  - 结果：源码非测试净增豁免记录；总代码 `+570 / -526 / net +44`，非测试代码 `+567 / -524 / net +43`。净增来自每个 provider class 独立文件后的显式 `implements ContextProvider`、显式 `Promise<readonly ContextBlock[]>` 返回合同和必要 import/constructor 样板。已按成本自适应范围检查 `context-provider` contribution、manager/type 边界和同类 truncate/helper；未发现低成本、同责任链、足以抵消 `43` 行且不伤害 contract 清晰度的真实减债点。
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
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-markdown.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/__tests__/chat-message-markdown.test.tsx docs/designs/2026-06-06-chat-local-file-link-contract.design.md`
  - 结果：Errors 0，Warnings 1。warning 为 `chat-message-list` 目录既有文件数预算提醒，`delta_count=+0`，本次未新增该目录文件。
- `pnpm -C packages/nextclaw-kernel test -- src/managers/__tests__/session.manager.test.ts`
  - 结果：通过，`1` 个测试文件、`6` 个测试通过；覆盖 `workingDir` 从 `project_root` 或 agent workspace 注入 session summary。
- `pnpm -C packages/nextclaw-ui test -- src/features/chat/utils/ncp-session-adapter.utils.test.ts src/features/chat/components/chat-session-workspace-file-preview.test.tsx src/features/chat/components/conversation/chat-conversation-panel.test.tsx`
  - 结果：通过，`3` 个测试文件、`35` 个测试通过；覆盖无 `projectRoot` 时用 `workingDir` 读取 `AGENTS.md`。
- `pnpm -C packages/ncp-packages/nextclaw-ncp tsc && pnpm -C packages/ncp-packages/nextclaw-ncp lint`
  - 结果：通过，`0` errors；保留 `reasoning-normalization.ts` 既有 `max-statements` warning。
- `pnpm -C packages/nextclaw-kernel tsc && pnpm -C packages/nextclaw-kernel lint`
  - 结果：通过。
- `pnpm -C packages/nextclaw-ui tsc && pnpm -C packages/nextclaw-ui lint`
  - 结果：通过，`0` errors；保留 `32` 个既有 warnings。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
  - 结果：通过，Errors 0，Warnings 4；总代码 `+225 / -40 / net +185`，非测试代码 `+116 / -36 / net +80`。`session.manager.ts` 从 `599` 行降到 `584` 行，新增 `workingDir` owner 未继续压大 manager。
- `pnpm lint:new-code:governance`
  - 结果：通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过，ratchet status OK。

## 发布/部署方式

已执行正式 NPM 发布：

- 源码提交：`36c4e5636 Expose session working directories`
- 版本提交：`a5c344046 Version packages for stable release`
- 发布命令：`pnpm release:publish`
- 发布结果：`release:verify:published` 通过，`48/48` 个 package versions 已在 npm registry 可见。
- 核心稳定版：`nextclaw@0.21.6`，`latest` dist-tag 指向 `0.21.6`。
- 真实安装烟测：在 `/tmp/nextclaw-stable-install-FDRFlS` 临时前缀安装 `nextclaw@latest`，`nextclaw --version` 输出 `0.21.6`；隔离 `NEXTCLAW_HOME=/tmp/nextclaw-stable-home-jkljpk` 执行 `nextclaw update --check`，返回 `NextClaw runtime is already up to date (0.21.6)`。
- 包内容检查：临时安装包内存在 `resources/update-bundle-public.pem`、`dist/cli/launcher/index.js` 与 `dist/cli/app/index.js`。

## 用户/产品视角的验收步骤

1. 打开一个带 `project_root` 的 NextClaw chat 会话。
2. 让 AI 输出 markdown 链接 `[rules](AGENTS.md)`。
3. 确认 `AGENTS.md` 渲染为可点击链接，而不是 `<span class="chat-link-invalid">AGENTS.md</span>`。
4. 点击该链接，确认右侧 workspace file preview 打开 `AGENTS.md`。
5. 让 AI 输出 `[cron](packages/nextclaw-ui/src/features/chat/components/workspace/session-cron-job-content.tsx)`。
6. 点击链接，确认右侧文件预览按当前会话项目根解析并打开对应文件。
7. 确认 `[site](example.com)` 不被误判成本地文件链接，`[bad](javascript:alert(1))` 不生成可点击 anchor。
8. 打开一个没有 `project_root` 的 native 会话，让 AI 输出 `[rules](AGENTS.md)`。
9. 点击链接，确认右侧文件预览按当前 agent workspace，也就是会话 `workingDir`，解析相对路径，而不是报 `relative server path requires a base path`。
10. 让 AI 提到项目外本地文件时，确认回复使用绝对路径 Markdown 链接，例如 `[notes.md](/Users/example/Documents/notes.md)`，而不是裸路径文本。
11. 确认 AI 不把文件 Markdown 链接写成 `` `[notes.md](/Users/example/Documents/notes.md)` `` 这类 inline code，也不放进 fenced code block；链接应直接渲染为可点击 anchor。
12. 确认 AI 不把本地文件名只写成 `**MEMORY.md**` 或 `MEMORY.md` 纯文本；只要它引用的是已知本地可打开文件，就应生成 `[MEMORY.md](MEMORY.md)` 这类可点击 Markdown link。
13. 确认 AI 在纠错回复、列表标题或文件标签中提到主文件时也给链接，例如 `[MEMORY.md](MEMORY.md)` 或 `[MEMORY.md](/Users/peiwang/.nextclaw/workspace/MEMORY.md)`，不能只给子文件链接。
14. 确认 AI 在目录示例中如果列出具体 `.md` 文件名，就逐个给链接；如果不想逐个链接，则不要列具体文件名。

## 可维护性总结汇总

本次把本地文件链接规则沉淀到设计文档和单元测试中，避免继续依赖口头约定或零散正则补丁。实现仍集中在 `ChatMessageMarkdown` 这个现有 markdown href owner 中，没有新增平行打开链路；宿主仍通过既有 `onFileOpen -> workspace file preview -> server-path-read(basePath=sessionWorkingDir)` 链路解析文件。

`post-edit-maintainability-review` 结论：通过。总代码和测试行数有净增，原因是本次属于用户可见能力补齐，并新增了覆盖安全边界的测试与设计文档。未新增生产文件，未扩大目录平铺度；维护性剩余关注点是 `chat-message-list` 目录已有文件数超预算，后续应按既有 seam 拆分，但本次 delta 为 0。

native prompt 链路清理的 `post-edit-maintainability-review` 结论：通过。本轮属于非功能清理，总代码 `net -334`，非测试代码 `net -239`；正向减债动作是删除失效旧路径与职责收敛：`RuntimeUserPromptBuilder`、`ContextBuilder.buildMessages(...)`、attachment user-content 旧入口不再干扰 native provider 主链路，新增 reply-format 规则落到独立 kernel context provider。

kernel context provider 目标架构清理的 `post-edit-maintainability-review` 结论：通过。本轮属于非功能目标架构清理，总代码 `+1078 / -1035 / net +43`，非测试代码 `+893 / -898 / net -5`，满足非测试代码净增 `<= 0`。正向减债动作是删除 core `ContextBuilder`、core `BootstrapContextBuilder` prompt renderer、core execution/skill prompt renderer 和旧 `KernelContextProvider -> ContextBuilder` 路径；业务提示词 owner 收敛到 kernel context provider 注册链。

bootstrap context 语义纠偏的 `post-edit-maintainability-review` 结论：通过。本轮属于非功能 owner 修正，总代码 `+90 / -89 / net +1`，非测试代码 `+87 / -87 / net +0`。正向减债动作是把启动设定文件从 `ProjectContextProvider` 拆到 `AgentBootstrapContextProvider`：`ProjectContextProvider` 只保留 active project、session project root 和 repository identity；`AGENTS.md` / `SOUL.md` / `USER.md` / `IDENTITY.md` / `TOOLS.md` / `BOOT.md` / `BOOTSTRAP.md` 这类项目、workspace、用户、身份、工具、启动或 agent operating instructions 由 `AgentBootstrapContextProvider` 读取和注入。

provider class 文件组织纠偏的 `post-edit-maintainability-review` 结论：源码净增豁免后通过。每个 `ContextProvider` class 已拆成自己的 `providers/*-context.provider.ts` 文件，删除 `native-dynamic-context.provider.ts` 聚合大文件；`native-static-context.provider.ts` 仅保留非 class 的静态 provider factories。恢复显式 `implements ContextProvider` 与显式 provider 返回合同后，本轮源码总代码 `+570 / -526 / net +44`，非测试源码 `+567 / -524 / net +43`；该净增是独立 provider 文件表达 owner 与 contract 的必要结构成本。按成本自适应半径检查了 `context-provider` contribution、manager/type 边界和同类 helper，未发现低成本、同责任链、足以抵消净增且不削弱结构清晰度的减债点；继续压缩会回到删除 contract、揉回聚合文件或降低可读性的错误方向。维护性剩余关注点：`context-provider/providers/` 达到目录文件数硬预算，已在 `providers/README.md` 记录豁免；后续再增加 provider 前必须优先评估新的 contribution owner 或治理合同调整。

session `workingDir` 链路补齐的 `post-edit-maintainability-review` 结论：通过。本轮属于用户可见能力补齐，总代码净增来自 NCP 类型、kernel summary enrich、UI 文件预览消费与测试覆盖。正向减债动作是职责收敛：`SessionWorkingDirResolver` 独立拥有 `projectRoot ?? agent workspace` 解析，`SessionManager` 不再堆路径解析 helper；纯 helper 移入 `session-manager.utils.ts` 后，`session.manager.ts` 从 `599` 行降到 `584` 行，避免新能力继续压大 session 生命周期 owner。

2026-06-09 回复格式规则后续微调的 `post-edit-maintainability-review` 结论：通过。本轮属于 prompt 合同修正，最终版本总代码 `+26 / -9 / net +17`，非测试代码 `+1 / -5 / net -4`；正向动作是职责收敛与命名治理：仍由既有 `ReplyFormatContextProvider` 作为唯一回复格式 owner，没有新增第二条 prompt 链路，同时把触达的设计文档收敛到 `.design.md` 命名合同。维护性剩余关注点仍是 `context-provider/providers/` 目录已有文件数预算例外，本次未新增文件，`delta_count=+0`。

2026-06-09 链接可点击性补充仍属于同一 prompt 合同微调：规则继续落在 `ReplyFormatContextProvider`，补充禁止把本地文件引用输出为粗体、inline code、code block 或纯文本，并要求最终回复发送前自检所有可见文件名；没有新增链路或渲染分支。

## NPM 包发布记录

本次已发布 NPM 正式版。

2026-06-09 回复格式规则后续微调已添加 changeset：`@nextclaw/kernel` patch，待后续统一发布批次带出；本次提交不执行 NPM 发布。

关键包版本：

- `nextclaw@0.21.6`
- `@nextclaw/ncp@0.6.1`
- `@nextclaw/kernel@0.4.2`
- `@nextclaw/ui@0.13.12`
- `@nextclaw/service@0.2.12`
- `@nextclaw/core@0.14.2`
- `@nextclaw/agent-chat-ui@0.4.11`

发布范围：full public workspace batch，共 `48` 个 package versions。

发布验证：

- `npm view nextclaw version dist-tags --json`：`latest` 指向 `0.21.6`，`beta` 保持 `0.21.5-beta.0`。
- `npm view @nextclaw/ncp version --json`：`0.6.1`。
- `npm view @nextclaw/kernel version --json`：`0.4.2`。
- `npm view @nextclaw/ui version --json`：`0.13.12`。
- `npm view @nextclaw/service version --json`：`0.2.12`。
- `npm install --prefix /tmp/nextclaw-stable-install-FDRFlS nextclaw@latest`：成功安装 published package。
- `/tmp/nextclaw-stable-install-FDRFlS/node_modules/.bin/nextclaw --version`：`0.21.6`。
- `NEXTCLAW_HOME=/tmp/nextclaw-stable-home-jkljpk /tmp/nextclaw-stable-install-FDRFlS/node_modules/.bin/nextclaw update --check`：确认运行时已是 `0.21.6`，且不需要本地源码或公钥环境变量。
