# v0.19.21 Session Runtime Architecture

## 迭代完成说明

本迭代当前用于承接会话运行态与持久化架构渐进式落地讨论，并已开始落地第一批不接管旧链路的 agent run 核心运行态骨架。

本次补充落地了 `SessionRepository` throwing contract、`SessionRun.beginRun()` / `abortRun(...)` 最小运行控制，以及 `AgentRunRequestManager.send(...)` 的直流程收敛：request、session、本次入队 message 保持分离；`send(...)` 启动后台 RxJS runtime event pipeline 后返回，不阻塞等待 runtime stream 完整消费；`AgentRunRequestManager` 不维护 `activeRuns`，不创建 abort controller，不创建 `resolvedRequest`，不把 `firstMessage` 塞进 session 创建 API；abort request 只触发 `sessionRun.abortRun(...)`，不写事件、不广播，aborted 事实由 runtime 输出后再持久化。

本次继续把 `SessionRepository` 从 throwing skeleton 推进为当前存储适配 owner：它直接依赖现有 `NcpSessionManager` 完成 create/get/list messages/append event，不直接读写 journal 文件，也不迁移最终 `manifest.json + events.jsonl` 文件格式。runtime event 持久化归属同步校准为 `AgentRunRequestManager -> eventBus.emit(eventKeys.ncpEvent)`，再由 `SessionRepository.start()` 监听 event bus 后调用私有 `appendSessionEvent(...)`。

本次新增 `@nextclaw/ncp-agent-runtime-next` 临时隔离包，用终态命名实现新的 `DefaultNcpAgentRuntime` 运行循环。该包暂不接入 kernel，不导入 `SessionRun` 具体 class，只通过结构 contract 消费 session state；它临时依赖旧 `@nextclaw/ncp-agent-runtime` 复用 stream encoder、NCP message -> OpenAI message 转换、round collector、tool-call execution、tool result normalization 等稳定 primitives。模型输入组装通过外部 `AgentModelInputBuilder` contract 注入，runtime 包不依赖 `@nextclaw/core`。确认新实现后，再将该包内容合并回旧包并删除旧 runtime 实现与临时包。

追加修复：branch 链路接管后，新会话标题回退成固定 `Session`，没有继续沿用旧链路“首条用户消息作为会话名”的行为。确认根因是 branch `SessionRepository.createSession(...)` 固定传入 `task: "Session"`；修复后 `AgentRunRequestManager` 复用旧链路 `readMessageTask(...)` 从本次用户消息生成 task，再交给 `NcpSessionManager.createSession(...)` 写入 summary metadata，避免在前端或 summary 读取层做兜底补丁。

追加修复：branch 链路接管后，agent run 结束时侧边栏会话列表没有展示最终 assistant 回复预览，但工具完成状态能展示。确认根因是新 branch runtime event pipeline 只发布 `run.finished`，缺少旧链路在 `run.finished` 前合成发布的 `message.completed` 事件；而侧边栏 `last_activity_preview` 的最终回复正文来自 `message.completed.payload.message`，工具完成预览则直接来自 tool result/end 事件。修复后 `AgentRunRequestManager` 在发布 `run.finished` 前，如果本轮还没看到 `message.completed`，会从已结算的 `SessionRun` 快照中读取最终 assistant message 并补发 `message.completed`，恢复旧链路事件合同；同时删除 `SessionRun` 未被使用的订阅/notify 表面，避免 branch 运行态 owner 继续膨胀。

追加优化：`SessionActivityPreviewContribution` 现在会在工具开始事件中记录本轮 `sessionId + toolCallId -> toolName`，让后续不携带 `toolName` 的 `message.tool-call-end/result` 事件也能把侧边栏预览显示为 `工具调用完成：<toolName>`。同时 `run.started` 默认文案从 `正在处理...` 改为 `正在思考`，让 AI 思考态更贴近用户理解。

追加清理：删除 `SessionRun.applyAndPublishEvents(...)`、`SessionRunEventPublishMeta` 以及 `SessionRunManager` 对 event bus 的构造依赖。`SessionRun` 当前只负责会话 run 内存状态与 conversation state apply；NCP 事件发布仍由外层发布 owner 显式完成，避免在运行态状态 owner 内保留未生效的发布 API。

追加修复：`SessionRun` 现在暴露纯内存 `onStatusChange(...)` 订阅，`beginRun()` 进入 running 时触发 running，`applyEvents(...)` 吃到 `run.finished` / `run.error` 后触发 idle。`AgentRunRequestManager` 在每次 send 的 `beginRun()` 前订阅本次 run 状态变化，并通过既有 event bus 发布 `session.run-status`，让前端会话列表实时收到 running/idle overlay；`SessionRun` 本身仍不依赖 event bus。

追加修正：通过本地开发入口 `http://127.0.0.1:5173` 的真实 HTTP + WS 链路复现了会话列表 spinner 提前消失。证据显示 `session.run-status running` 在约 280ms 推送，但随后约 459ms 收到的 `session.summary.upsert` 携带持久 summary 的 `status: "idle"`；真正的 `session.run-status idle` 直到约 8032ms、接近 `run.finished` 才出现。根因是前端 query cache 把持久 summary 的 idle 覆盖了运行时 running overlay。修复后 summary upsert 仍更新消息数、metadata、排序字段等持久信息，但不会把已有 running overlay 改回 idle；只有显式 `session.run-status idle` 才结束 spinner。

关联大方案：[会话运行态与持久化架构设计草案](../../designs/2026-05-23-session-runtime-architecture-design.md)。

临时小方案：

- [session-summary-context-window-plan.md](work/session-summary-context-window-plan.md)
- [2026-05-24-agent-run-core-skeleton-plan.md](work/2026-05-24-agent-run-core-skeleton-plan.md)

## 测试/验证/验收方式

本批次新增 `packages/nextclaw-kernel/src/features/agent-run/` 隔离骨架，覆盖 `SessionRun`、`MessageInbox`、provider managers、runtime manager 与 request manager 初始形状。

本批次同时新增 `packages/ncp-packages/nextclaw-ncp-agent-runtime-next/`，用于单独 review 新 native runtime 实现。

验证方式：

- `pnpm lint:new-code:doc-file-names`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-kernel exec eslint src/features/agent-run src/managers/config.manager.ts`
- `pnpm -C packages/nextclaw-kernel exec eslint src/features/agent-run/repositories/session.repository.ts`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next tsc`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next lint`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next build`
- `pnpm -C packages/nextclaw-kernel test -- src/features/agent-run/managers/agent-run-request.manager.test.ts src/managers/__tests__/agent-run-request.manager.test.ts`
- `pnpm -C packages/nextclaw-kernel test -- src/features/agent-run/managers/agent-run-request.manager.test.ts`
- `pnpm -C packages/nextclaw-kernel test -- src/features/agent-run/managers/agent-run-request.manager.test.ts src/contributions/session-activity-preview/utils/session-activity-preview-contribution.utils.test.ts`
- `pnpm -C packages/nextclaw-kernel lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-kernel/src/features/agent-run/managers/agent-run-request.manager.ts packages/nextclaw-kernel/src/features/agent-run/repositories/session.repository.ts packages/nextclaw-kernel/src/features/agent-run/managers/agent-run-request.manager.test.ts`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm -C packages/nextclaw-kernel test -- src/contributions/session-activity-preview/utils/session-activity-preview-ncp-event.utils.test.ts src/contributions/session-activity-preview/utils/session-activity-preview-contribution.utils.test.ts src/contributions/session-activity-preview/utils/session-activity-preview-metadata.utils.test.ts`
- `pnpm -C packages/nextclaw-kernel exec eslint src/contributions/session-activity-preview/index.ts src/contributions/session-activity-preview/utils/session-activity-preview-ncp-event.utils.ts src/contributions/session-activity-preview/utils/session-activity-preview-ncp-event.utils.test.ts src/contributions/session-activity-preview/utils/session-activity-preview-contribution.utils.test.ts`
- `pnpm -C packages/nextclaw-kernel exec tsc --noEmit`
- `pnpm -C packages/nextclaw-kernel lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-kernel/src/contributions/session-activity-preview/index.ts packages/nextclaw-kernel/src/contributions/session-activity-preview/utils/session-activity-preview-ncp-event.utils.ts packages/nextclaw-kernel/src/contributions/session-activity-preview/utils/session-activity-preview-ncp-event.utils.test.ts packages/nextclaw-kernel/src/contributions/session-activity-preview/utils/session-activity-preview-contribution.utils.test.ts`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm -C packages/nextclaw-kernel test -- src/managers/__tests__/agent-run-request.manager.test.ts`
- `pnpm -C packages/nextclaw-kernel exec eslint src/managers/session-run.manager.ts src/managers/__tests__/agent-run-request.manager.test.ts src/app/nextclaw-kernel.ts`
- `pnpm -C packages/nextclaw-kernel exec tsc --noEmit`
- `pnpm -C packages/nextclaw-kernel lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-kernel/src/managers/session-run.manager.ts packages/nextclaw-kernel/src/managers/__tests__/agent-run-request.manager.test.ts packages/nextclaw-kernel/src/app/nextclaw-kernel.ts`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm -C packages/nextclaw-kernel test -- src/managers/__tests__/agent-run-request.manager.test.ts`
- `pnpm -C packages/nextclaw-kernel exec eslint src/managers/session-run.manager.ts src/managers/agent-run-request.manager.ts src/managers/__tests__/agent-run-request.manager.test.ts`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next exec eslint src/runtime/agent-runtime.service.ts`
- `pnpm -C packages/nextclaw-kernel exec tsc --noEmit`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next tsc`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-kernel/src/managers/session-run.manager.ts packages/nextclaw-kernel/src/managers/agent-run-request.manager.ts packages/nextclaw-kernel/src/managers/__tests__/agent-run-request.manager.test.ts packages/ncp-packages/nextclaw-ncp-agent-runtime-next/src/runtime/agent-runtime.service.ts`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm -C packages/nextclaw-kernel test -- src/managers/__tests__/agent-run-request.manager.test.ts`
- `pnpm -C packages/nextclaw-kernel exec eslint src/managers/session-run.manager.ts src/managers/__tests__/agent-run-request.manager.test.ts`
- `pnpm -C packages/nextclaw-kernel exec tsc --noEmit`
- `pnpm -C packages/nextclaw-kernel lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-kernel/src/managers/session-run.manager.ts packages/nextclaw-kernel/src/managers/__tests__/agent-run-request.manager.test.ts`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `NEXTCLAW_DEV_FRONTEND_PORT=5173 pnpm dev start`
- 真实接口验证：连接 `ws://127.0.0.1:5173/ws`，请求 `POST http://127.0.0.1:5173/api/ncp/agent/send`，读取 `GET http://127.0.0.1:5173/api/ncp/agent/stream?sessionId=...`；观测到 `session.run-status running` 约 280ms、summary idle 约 459ms、真正 `session.run-status idle` 约 8032ms、`run.finished` 约 8050ms。
- `pnpm -C packages/nextclaw-ui test -- src/shared/lib/api/ncp-session-query-cache.utils.test.ts`
- `pnpm -C packages/nextclaw-ui exec eslint src/shared/lib/api/ncp-session-query-cache.utils.ts src/shared/lib/api/ncp-session-query-cache.utils.test.ts src/shared/lib/api/index.ts`
- `pnpm -C packages/nextclaw-ui exec tsc --noEmit`
- `pnpm -C packages/nextclaw-ui lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-kernel/src/managers/session-run.manager.ts packages/nextclaw-kernel/src/managers/agent-run-request.manager.ts packages/nextclaw-kernel/src/managers/__tests__/agent-run-request.manager.test.ts packages/ncp-packages/nextclaw-ncp-agent-runtime-next/src/runtime/agent-runtime.service.ts packages/nextclaw-ui/src/shared/lib/api/ncp-session-query-cache.utils.ts packages/nextclaw-ui/src/shared/lib/api/ncp-session-query-cache.utils.test.ts packages/nextclaw-ui/src/shared/lib/api/index.ts`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`

说明：agent-run 核心骨架初始批次不保留细粒度行为测试，避免过早固化未稳定 API；branch 链路接管后的用户可见回归必须补定向行为测试。

## 发布/部署方式

不涉及发布或部署。

## 用户/产品视角的验收步骤

用户可 review 两个临时方案。当前已优先推进 agent run 核心骨架；branch 链路接管后，新会话首发消息应继续把会话名显示为用户第一句话，而不是固定显示 `Session`。

branch 链路接管后，agent run 完成时侧边栏会话列表预览应展示最终 assistant 回复；如果本轮发生工具调用，工具完成中的运行态预览仍可在最终回复完成前展示，但 run 完成后的 completed 预览应优先显示最终回复正文。

AI 思考中时，侧边栏 activity preview 应显示 `正在思考`。工具调用完成但最终回复尚未完成时，侧边栏 activity preview 应保留工具名，例如 `工具调用完成：read_file`。

本次运行态 API 清理后，代码中不应再存在 `SessionRun.applyAndPublishEvents(...)`；构造 `SessionRunManager` 时也不应再传入 event bus。

会话开始运行后，会话列表应通过 realtime `session.run-status` 立即展示 running。运行期间即使收到更新后的 `session.summary.upsert` 且 summary status 仍为 idle，列表也应保留 running overlay；只有收到 `session.run-status idle` 后才回到 idle。

## 可维护性总结汇总

本批次新增的是隔离骨架，暂不从 kernel 根入口导出，避免和旧 manager 公共入口冲突。后续迁移必须以删除旧 `liveSession / activeExecution` 混合职责为闭环目标，避免新旧路径长期并行。

新增 `@nextclaw/ncp-agent-runtime-next` 是临时隔离包，不是长期平行 runtime 包。它用新 contract 重写 native runtime loop，避免在新架构里包装旧 `NcpAgentRunInput.metadata + stateManager` 边界。runtime-next 不直接拥有 context-window 预算裁剪实现；这部分由外部 model input builder owner 接入，避免协议层包反向依赖 `@nextclaw/core`。后续必须把该实现合并回 `@nextclaw/ncp-agent-runtime`，并删除临时包。

本次正向减债动作是职责收敛和复用收敛：运行取消控制收回 `SessionRun`，session 初始化 messages 读取收回 `SessionRunManager -> SessionRepository`，request manager 删除 `activeRuns`、`resolvedRequest`、runtime 消费 helper 和事件发布 helper 等中间状态/中间函数；native runtime next 不再复制消息转换、tool-call 收集和 tool-call 执行规则，而是复用旧 runtime 包拆出的公共 primitive。

维护性风险：当前阶段仍是新骨架接入前的正向代码增长。默认 maintainability guard 通过，但严格 `--non-feature` 行数门槛未通过；下一步必须通过接入新链路并删除旧 `liveSession / activeExecution` 混合职责来偿还这部分增长，不能让新旧路径长期并行。

追加修复的正向减债动作是复用和简化：branch request manager 复用旧链路已有 `readMessageTask(...)`，避免复制标题推导规则；同时删除 `SessionRepository` 中两个只调用一次的薄 wrapper。追加修复 strict non-feature touched-scope 结果为非测试代码净增 `-4` 行，并补了 branch 专属行为测试。

本次预览修复的正向减债动作是职责收敛和删除：最终回复预览合同恢复到 agent-run event publisher 边界，而不是前端预览层或 metadata 层兜底读取消息；同时删除 `SessionRun` 未使用的订阅、notify、snapshot `activeRunId` 表面和未调用的 inbox 转事件方法。当前 touched-scope 非测试代码净增为负数，并新增 branch 专属测试覆盖 `message.completed` 必须先于 `run.finished` 发布。

本次 activity preview 文案优化属于用户可见行为增强，生产代码净增来自必要的短生命周期工具名索引：NCP 工具完成/结果事件合同只有 `toolCallId`，因此 preview owner 必须在同一 contribution 内记录工具开始事件的名称，再在完成事件投影中复用。maintainability guard 检查 4 个文件，Errors 0，Warnings 0；总计新增 129 行、删除 6 行、净增 123 行；非测试代码新增 75 行、删除 5 行、净增 70 行。未新增平行 preview 链路，状态仍归 `SessionActivityPreviewContribution` 单一 owner。

本次运行态 API 清理的正向减债动作是删除和职责收敛：移除未被生产链路调用的 `SessionRun.applyAndPublishEvents(...)` 及 event bus 依赖，让 `SessionRun` 不再承担发布职责。maintainability guard 检查 3 个文件，Errors 0，Warnings 0；总计新增 11 行、删除 35 行、净增 -24 行；非测试代码新增 3 行、删除 32 行、净增 -29 行。

本次 session run status 修复的正向动作是职责收敛和删除：状态变化由 `SessionRun` 这个事实 owner 通知，事件发布由 `AgentRunRequestManager` 这个既有发布 owner 完成；同时删除 runtime-next 中残留的 `applyAndPublishEvents` optional contract、未使用的 inbox `isEmpty()` contract，以及 `SessionRun` 中未被外部使用的导出类型表面。maintainability guard 检查 4 个文件，Errors 0，Warnings 0；总计新增 167 行、删除 74 行、净增 93 行；非测试代码新增 65 行、删除 71 行、净增 -6 行。

本次提前 idle 修正的正向动作是职责收敛和命名治理：运行态由 `session.run-status` overlay 表达，持久 summary upsert 不再覆盖该 overlay；同时将前端 query cache 文件重命名为 `ncp-session-query-cache.utils.ts`，满足当前角色后缀治理。maintainability guard 检查 7 个文件，Errors 0，Warnings 1；总计新增 210 行、删除 89 行、净增 121 行；非测试代码新增 81 行、删除 86 行、净增 -5 行。目录预算 warning 来自 `shared/lib/api` 既有例外，本次未新增直接文件数。

## NPM 包发布记录

本批次新增 `.changeset/session-run-status-events.md`，待统一发布：

- `@nextclaw/kernel` patch：恢复 agent run 期间 `session.run-status` realtime 推送。
- `@nextclaw/ncp-agent-runtime-next` patch：删除未使用的 `applyAndPublishEvents` session state optional contract。
- `@nextclaw/ui` patch：避免持久 summary 的 idle 覆盖 realtime running overlay，修复会话列表 spinner 提前消失。
