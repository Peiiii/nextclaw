# v0.20.64 Codex NARP Thread Binding

## 迭代完成说明

本次修复 Codex NARP 会话在 `pnpm dev start` 重启后丢失 Codex thread 绑定，导致同一个 NextClaw 会话继续发送消息时，Codex 侧像新会话一样“不认识前文”的问题。

根因：

- NextClaw 会话 `ncp-mq7zjo2z-7f73b916` 的 metadata 里有 `session_type/runtime/agentRuntimeId`，但没有 `codex_thread_id`。
- 复验会话 `ncp-mq810u6d-9c4c6a03` 也复现同类问题：journal 中已有第一轮“你是谁”，但第二轮 assistant reasoning 明确判断“this is the first turn”，metadata 仍无 `codex_thread_id`。
- Codex SDK runtime 本身在收到 `thread.started` 后已有 `setSessionMetadata({ codex_thread_id })` 回调。
- NARP stdio 接入把 Codex runtime 放进子进程后，没有把这个 metadata 回写能力接回 host。
- 因此 `codex_thread_id` 只存在于子进程内存；dev 重启后 NextClaw 只能重新 start Codex thread。
- 真实 `pnpm dev start` 还暴露出第二层问题：`~/.nextclaw/bin/nextclaw-codex-narp` 只是 shell wrapper，实际转发到 nvm 全局安装的 `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.1.31`，导致源码补丁没有进入用户报告的 5174 dev 实例。

确认方式：

- 通过 `http://127.0.0.1:5174/api/ncp/sessions/ncp-mq7zjo2z-7f73b916` 确认真实会话 metadata 缺少 `codex_thread_id`。
- 通过 `http://127.0.0.1:5174/api/ncp/sessions/ncp-mq810u6d-9c4c6a03` 和 `.nextclaw/sessions/.ncp-agent-journal/ncp-mq810u6d-9c4c6a03.metadata.json` 确认新复现会话 metadata 也缺少 `codex_thread_id`。
- 通过消息记录确认同一 NextClaw 会话后续 assistant reasoning 明确认为这是第一条消息，说明不是 UI 显示错，而是 runtime 恢复上下文失败。
- 搜索 Codex 本地记录发现同一段测试对话分散在多个 Codex rollout/thread 中，符合“每轮都重新建 thread”的故障形态。
- 通过 `ps` 确认修复前真实 dev 子进程为 `/Users/peiwang/.nvm/versions/node/v22.16.0/bin/nextclaw-codex-narp`，不是仓库源码。

修复方式：

- NARP stdio wrapper 向 runtime context 注入 `setSessionMetadata`。
- 子进程通过 ACP `session_info_update._meta.nextclaw_narp.sessionMetadataPatch` 回传 metadata patch。
- host stdio client 将该 patch 翻译为 NCP `run.metadata`。
- SessionManager 在 session owner 内消费 `session_metadata_patch`，写入 metadata sidecar。
- Codex NARP wrapper 将该 writer 传给 Codex SDK runtime，使 `thread.started` 产生的 `codex_thread_id` 能持久化。
- Codex SDK runtime 在处理 `thread.started` 时等待异步 `setSessionMetadata` 完成，避免跨进程 writer 尚未发出就继续后续事件。
- `pnpm dev start` 通过 `NEXTCLAW_NARP_STDIO_COMMAND_OVERRIDES` 将 Codex NARP launcher 指到当前仓库源码 controller，避免真实开发态悄悄跑全局旧包；该覆盖只存在于 dev runner 的 backend 环境，不写用户配置。

追加修正：

- runtime-default 模型选择的思考档位能力从 Codex 特化逻辑改为通用 `runtimeDefaultThinking` 配置合同。
- `runtimeDefaultThinking` 由 runtime entry config 保存，经 NARP runtime provider descriptor、AgentRuntime session type listing、server/UI session type view 透传到 chat model option。
- 前端不再根据 `sessionType === "codex"` 计算思考档位，也不再从 agent/global `thinkingDefault` 为具体 runtime 拼默认值。
- host/kernel/server 同样不识别具体 agent runtime id；具体 runtime 若要支持 runtime-default thinking，只能通过 entry config 或自身 provider descriptor 声明。

cwd owner 修正：

- Codex/NARP 的执行工作目录对齐 native 会话语义：优先使用 session metadata 中的 `project_root`，没有时回退到 NextClaw workspace。
- `workingDir` 由 `SessionManager` 通过既有 `SessionWorkingDirResolver` 解析，随 `AgentRunSession` 进入 NCP run 的 `executionContext.cwd`。
- runtime factory/provider 不再感知 `workingDir`，agent runtime 也不持有 NextClaw session 数据；runtime 只消费本次 run 的执行上下文。
- stdio client 在 ACP `newSession` 时使用 `executionContext.cwd`，`config.cwd` 只保留为 runtime 子进程启动目录。
- Codex/Claude NARP wrapper 不再用 `process.cwd()` 补 `workingDirectory`；probe 路径使用中性的临时目录作为探测 cwd。

已有坏会话说明：

- 已经丢失 `codex_thread_id` 的历史会话无法可靠自动恢复到单一 Codex thread，因为 Codex 侧已经生成了多个独立 thread。
- 修复生效后，后续新 thread id 会被写回 NextClaw session metadata，重启后可按 `codex_thread_id` resume。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/nextclaw-narp-stdio-runtime-wrapper tsc`
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-codex-sdk tsc`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client tsc`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-codex-sdk tsc`
- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-codex-sdk test -- src/services/codex-sdk-runtime-thread-metadata.service.test.ts`
- `pnpm --filter @nextclaw/nextclaw-narp-stdio-runtime-wrapper test -- src/services/narp-stdio-runtime-wrapper.service.test.ts`
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-codex-sdk test -- src/services/codex-narp-runtime-wrapper.service.test.ts`
- `pnpm --filter @nextclaw/kernel test -- src/managers/__tests__/session.manager.test.ts`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client lint`
- `pnpm --filter @nextclaw/nextclaw-narp-stdio-runtime-wrapper lint`
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-codex-sdk lint`
- `pnpm --filter @nextclaw/kernel lint`
- `node --check scripts/dev/dev-runner.mjs`
- `pnpm -C packages/nextclaw-kernel test src/features/runtime-registry/utils/agent-runtime-registry.utils.test.ts src/features/narp-runtime/services/builtin-narp-runtime-provider.service.test.ts`
- `pnpm -C packages/nextclaw-server test src/features/config/stores/server-config.store.runtime.test.ts`
- `pnpm -C packages/nextclaw-ui test ncp-chat-page.test.ts chat-session-preference-sync.manager.test.ts chat-input.manager.test.ts chat-run.manager.test.ts`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-core lint`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-server lint`
- `pnpm -C packages/nextclaw-ui lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm check:generated-clean`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths $(git diff --name-only | tr '\n' ' ')`
- `pnpm --filter @nextclaw/kernel test -- src/services/__tests__/ncp-agent-runtime-wrapper.service.test.ts`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client test -- src/stdio-runtime.test.ts src/stdio-runtime-abort.test.ts`
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-codex-sdk test -- src/services/codex-narp-runtime-wrapper.service.test.ts`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-claude-code-sdk tsc`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-claude-code-sdk test -- src/utils/claude-code-query-runtime.utils.test.ts src/index.test.ts`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-claude-code-sdk lint`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-claude-code-sdk build`
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-claude-code-sdk tsc`
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-claude-code-sdk test -- src/services/claude-code-narp-runtime-wrapper.service.test.ts`
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-claude-code-sdk lint`
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-claude-code-sdk build`
- 源码 Codex NARP ACP probe：
  - 配置 command 为 `/Users/peiwang/.nextclaw/bin/nextclaw-codex-narp`。
  - 通过 `NEXTCLAW_NARP_STDIO_COMMAND_OVERRIDES` 解析到 `packages/nextclaw/node_modules/.bin/tsx --tsconfig scripts/dev/dev-runtime.tsconfig.json packages/extensions/nextclaw-narp-runtime-codex-sdk/src/controllers/codex-narp.controller.ts`。
  - `probeStdioRuntime(config)` 通过。
- 真实 5174 重启冒烟：
  - 启动 `pnpm dev start --package-watch`。
  - 第一轮 session `ncp-codex-restart-smoke-mq81d562` 发送 marker `restart-smoke-20260610-alpha`。
  - 第一轮后 metadata 出现 `codex_thread_id=019eb179-424e-79c2-a31d-2acf3c72adcf`。
  - 停止并重新启动 `pnpm dev start --package-watch`。
  - 第二轮同 session 追问上一轮测试短语，assistant 回复 `[我严格遵守规则] restart-smoke-20260610-alpha`。
  - 重启后 metadata 仍保留同一 `codex_thread_id`。
  - `ps` 确认真实 Codex NARP 子进程来自仓库源码 `tsx .../packages/extensions/nextclaw-narp-runtime-codex-sdk/src/controllers/codex-narp.controller.ts`，没有再走全局 `nextclaw-codex-narp`。

未完成验证：

- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client test -- src/stdio-runtime.test.ts` 未能执行测试体，原因是当前工作区已有无关导入问题：`@core/features/agent/tools/registry.tools.js` 找不到。
- maintainability guard 未通过，原因见可维护性总结。

## 发布/部署方式

本次只修改源码、测试、changeset 和迭代记录，不执行发布。后续随统一 NPM patch 发布。

## 用户/产品视角的验收步骤

1. 使用 Codex/NARP runtime 新建或继续一个 NextClaw 会话。
2. 发送第一条消息后，检查会话 metadata 应出现 `codex_thread_id`。
3. 重启 `pnpm dev start`。
4. 回到同一 NextClaw 会话继续发送消息。
5. 预期 Codex 通过 `codex_thread_id` resume 原 thread，不再表现为“这是第一条消息”。

本轮已按以上步骤在真实 5174 dev 实例完成通过，session 为 `ncp-codex-restart-smoke-mq81d562`。

runtime-default thinking 配置化验收：

1. 在 runtime entry `config.runtimeDefaultThinking` 写入 `supported/default`。
2. 调用 session type listing，预期对应 option 带出同一份 `runtimeDefaultThinking`。
3. 前端选择该 session type 且模型为“运行时默认”时，预期 runtime-default model option 的 `thinkingCapability` 来自 listing，而不是来自 Codex 分支或 agent 默认值。

## 可维护性总结汇总

本次修复遵循正确 owner：

- 子进程 runtime 只负责产生 metadata patch。
- stdio transport 只负责跨进程传输和协议翻译。
- SessionManager 作为 session owner 负责持久化 metadata。
- Codex wrapper 只接通已有 Codex SDK runtime 的 `setSessionMetadata` 合同。

maintainability guard 结果：

- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- 结果未通过。
- 最新 scoped 总增减：`+445 / -32 / net +413`。
- 最新 scoped 非测试增减：`+203 / -28 / net +175`。
- 原因：本次 bugfix 需要补齐此前缺失的通用跨进程 metadata 回写通道、Codex SDK 异步 writer 等待、以及开发态 launcher 源码覆盖，无法在不削弱协议清晰度和真实 dev 验证可靠性的前提下做到非测试净增 `<= 0`。

需要 line-growth exemption：

- `packages/nextclaw-kernel/src/managers/session.manager.ts` 从 584 行增至 609 行，跨过 600 行预算。
- `packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.service.ts` 从 913 行增至 958 行，已超预算且本次继续增长。
- `packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.test.ts` 本次增长 136 行。
- `scripts/dev/dev-runner.mjs` 接近预算，本次增长 39 行。
- 后续减债方向：从 `stdio-runtime.service.ts` 拆出 ACP update -> NCP event translator；从 `session.manager.ts` 拆出 runtime metadata patch projector。

追加修正 maintainability 结果：

- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths $(git diff --name-only | tr '\n' ' ')`
- 结果通过，`Errors: 0`。
- 最新 scoped 总增减：`+445 / -22 / net +423`。
- 最新 scoped 非测试增减：`+205 / -9 / net +196`。
- 警告均为既有或接近预算信号：`builtin-narp-runtime-provider.service.ts` 接近 600 行预算，`shared/lib/api` 根目录已有记录例外，`api/types.ts` 接近预算。
- 正向维护动作：删除前端 Codex 特化 resolver 与 agent 默认值拼接路径，将能力归属收敛到 runtime entry config/session type listing 这一条通用链路。

cwd owner 修正 maintainability 结果：

- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- 结果未通过。
- 最新 scoped 总增减：`+704 / -140 / net +564`。
- 最新 scoped 非测试增减：`+392 / -123 / net +269`。
- 直接原因：当前工作区已有大量 staged 的 Codex app-server/streaming 前序改动被一并计入 scoped 路径；本轮 cwd owner 的 unstaged 核心修正为 `+44 / -13`。
- 本轮正向维护动作：删除 runtime factory/provider 的 `workingDir` 感知，把工作目录归属收敛为 `SessionManager -> AgentRunSession.workingDir -> NCP executionContext.cwd -> ACP newSession.cwd` 单一路径。

## NPM 包发布记录

需要随下一批 NPM patch 发布：

- `@nextclaw/kernel`：待统一发布。原因是 session metadata patch 持久化。
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk`：待统一发布。原因是等待异步 metadata writer，避免 thread id 回写丢失。
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper`：待统一发布。原因是注入并回传 runtime metadata writer。
- `@nextclaw/nextclaw-narp-runtime-codex-sdk`：待统一发布。原因是把 writer 接入 Codex SDK runtime。
- `@nextclaw/nextclaw-ncp-runtime-stdio-client`：待统一发布。原因是 host 侧翻译 ACP session metadata patch。
- `@nextclaw/core`：待统一发布。原因是新增通用 model thinking capability 归一化工具。
- `@nextclaw/server`：待统一发布。原因是 runtime entry config 保存 `runtimeDefaultThinking`。
- `@nextclaw/ui`：待统一发布。原因是 runtime-default 模型选项按 session type listing 显示思考档位能力。
