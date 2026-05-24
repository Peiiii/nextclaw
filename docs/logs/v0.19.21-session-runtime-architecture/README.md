# v0.19.21 Session Runtime Architecture

## 迭代完成说明

本迭代当前用于承接会话运行态与持久化架构渐进式落地讨论，并已开始落地第一批不接管旧链路的 agent run 核心运行态骨架。

本次补充落地了 `SessionRepository` throwing contract、`SessionRun.beginRun()` / `abortRun(...)` 最小运行控制，以及 `AgentRunRequestManager.send(...)` 的直流程收敛：request、session、本次入队 message 保持分离；`send(...)` 启动后台 RxJS runtime event pipeline 后返回，不阻塞等待 runtime stream 完整消费；`AgentRunRequestManager` 不维护 `activeRuns`，不创建 abort controller，不创建 `resolvedRequest`，不把 `firstMessage` 塞进 session 创建 API；abort request 只触发 `sessionRun.abortRun(...)`，不写事件、不广播，aborted 事实由 runtime 输出后再持久化。

本次继续把 `SessionRepository` 从 throwing skeleton 推进为当前存储适配 owner：它直接依赖现有 `NcpSessionManager` 完成 create/get/list messages/append event，不直接读写 journal 文件，也不迁移最终 `manifest.json + events.jsonl` 文件格式。runtime event 持久化归属同步校准为 `AgentRunRequestManager -> eventBus.emit(eventKeys.ncpEvent)`，再由 `SessionRepository.start()` 监听 event bus 后调用私有 `appendSessionEvent(...)`。

本次新增 `@nextclaw/ncp-agent-runtime-next` 临时隔离包，用终态命名实现新的 `DefaultNcpAgentRuntime` 运行循环。该包暂不接入 kernel，不导入 `SessionRun` 具体 class，只通过结构 contract 消费 session state；它临时依赖旧 `@nextclaw/ncp-agent-runtime` 复用 stream encoder、NCP message -> OpenAI message 转换、round collector、tool-call execution、tool result normalization 等稳定 primitives。模型输入组装通过外部 `AgentModelInputBuilder` contract 注入，runtime 包不依赖 `@nextclaw/core`。确认新实现后，再将该包内容合并回旧包并删除旧 runtime 实现与临时包。

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
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`

说明：agent-run 核心骨架仍在设计讨论期，本批次不保留细粒度行为测试，避免过早固化未稳定 API。

## 发布/部署方式

不涉及发布或部署。

## 用户/产品视角的验收步骤

用户可 review 两个临时方案。当前已优先推进 agent run 核心骨架：新增代码不替换旧运行链路，验收重点是新骨架的职责边界是否符合目标终态。

## 可维护性总结汇总

本批次新增的是隔离骨架，暂不从 kernel 根入口导出，避免和旧 manager 公共入口冲突。后续迁移必须以删除旧 `liveSession / activeExecution` 混合职责为闭环目标，避免新旧路径长期并行。

新增 `@nextclaw/ncp-agent-runtime-next` 是临时隔离包，不是长期平行 runtime 包。它用新 contract 重写 native runtime loop，避免在新架构里包装旧 `NcpAgentRunInput.metadata + stateManager` 边界。runtime-next 不直接拥有 context-window 预算裁剪实现；这部分由外部 model input builder owner 接入，避免协议层包反向依赖 `@nextclaw/core`。后续必须把该实现合并回 `@nextclaw/ncp-agent-runtime`，并删除临时包。

本次正向减债动作是职责收敛和复用收敛：运行取消控制收回 `SessionRun`，session 初始化 messages 读取收回 `SessionRunManager -> SessionRepository`，request manager 删除 `activeRuns`、`resolvedRequest`、runtime 消费 helper 和事件发布 helper 等中间状态/中间函数；native runtime next 不再复制消息转换、tool-call 收集和 tool-call 执行规则，而是复用旧 runtime 包拆出的公共 primitive。

维护性风险：当前阶段仍是新骨架接入前的正向代码增长。默认 maintainability guard 通过，但严格 `--non-feature` 行数门槛未通过；下一步必须通过接入新链路并删除旧 `liveSession / activeExecution` 混合职责来偿还这部分增长，不能让新旧路径长期并行。

## NPM 包发布记录

不涉及 NPM 包发布。
