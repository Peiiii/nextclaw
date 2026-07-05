# v0.22.4 Backend Copy Defaults

## 迭代完成说明

本次修复后端、kernel、runtime 和协议事件中直接生成中文用户可见文案的问题。根因是 session activity preview、abort reason、idle session fallback 和 context compaction timeline message 这些链路把“展示文案”直接写进 API / NCP event / session metadata，而不是把展示语言交给前端 i18n owner。

同批次把 abort 的 `messageId` / `runId` / `correlationId` / `reason` 从 UI hook、HTTP agent server、NCP event、kernel run manager 到 session activity preview 串成一条可观察链路，避免前端只看到通用 network/abort 错误却无法定位是哪次运行、哪条消息、哪个原因。

本次不引入重型后端国际化系统，采用轻量统一策略：协议/API/session metadata 中由系统生成的默认状态和错误 fallback 改为英文；真正需要本地化的 UI 展示继续由前端 i18n key、code、kind 或 metadata 映射。用户原文、测试输入、中文文档、中文 locale 和明确的中文 fallback 资源不属于本次清理范围。

同时把规则沉淀进 `.agents/skills/nextclaw-clean-implementation/SKILL.md`：后端、kernel、runtime、server、协议事件、API 响应、session metadata 和持久化消息不得生成中文用户可见默认文案；暂未 i18n 的协议字符串默认英文。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel exec vitest run src/contributions/session-activity-preview/utils/session-activity-preview-ncp-event.utils.test.ts src/contributions/session-activity-preview/utils/session-activity-preview-metadata.utils.test.ts src/features/context-compaction/services/context-compaction-preflight.service.test.ts src/stores/ncp-agent-session-journal.store.test.ts src/managers/__tests__/session.manager.test.ts`
- `pnpm --filter @nextclaw/ncp-agent-runtime-next exec vitest run src/runtime/agent-runtime.service.test.ts`
- `pnpm --filter @nextclaw/ncp-http-agent-server exec vitest run src/__tests__/index.test.ts`
- `pnpm -C packages/nextclaw-server exec vitest run src/app/__tests__/router-ncp-session-list-route.test.ts`
- `pnpm -C packages/nextclaw-ui exec vitest run src/features/chat/features/ncp/hooks/__tests__/use-ncp-agent-runtime.test.tsx src/features/chat/features/session/utils/__tests__/ncp-session-adapter.utils.test.ts src/features/chat/features/conversation/components/__tests__/session-conversation-area.test.tsx src/features/chat/features/message/components/__tests__/chat-message-list.container.test.tsx`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm --filter @nextclaw/ncp-agent-runtime-next tsc`
- `pnpm --filter @nextclaw/ncp tsc`
- `pnpm --filter @nextclaw/ncp-http-agent-server tsc`
- `pnpm --filter @nextclaw/ncp-react tsc`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-server lint`
- `pnpm -C packages/nextclaw-ui lint`
- `pnpm --filter @nextclaw/ncp-agent-runtime-next lint`
- `pnpm --filter @nextclaw/ncp lint`
- `pnpm --filter @nextclaw/ncp-http-agent-server lint`
- `pnpm --filter @nextclaw/ncp-react lint`
- `git diff --check`
- `pnpm clean:generated`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`：通过，保留 5 个热点 warning。
- `pnpm check:governance-backlog-ratchet`：通过。
- 全量 `pnpm lint:new-code:governance`：未通过。文件命名/角色边界已通过；提交前顺手把本批次触达的 `router.ts`、`parsers.ts`、`agent-client-endpoint.ts`、`agent-server-endpoint.ts`、`agent-conversation-state-manager.ts`、`conversation-state.ts`、`endpoint.ts`、`events.ts` 和 `run.ts` 收敛为点分角色后缀。剩余阻塞是 NCP / NCP HTTP agent server 的 legacy module-structure debt：`controller.ts`、`agent-backend/`、`endpoint/`、`toolkit/agent/` 等旧结构一旦被触碰就会被全量治理要求独立迁移。
- `rg` 检查确认 session/abort/context 这类生产链路中的目标中文状态短语已清理；剩余命中为中文文档、`zh` 本地化字段、中文测试输入或明确中文 fallback 资源。

## 发布/部署方式

无需单独部署。该修复进入相关包后，随下一次统一 NPM/桌面发布带出。

## 用户/产品视角的验收步骤

1. 触发会话运行、工具调用、运行失败、手动停止或 idle running preview 兜底。
2. API / NCP event / session metadata 中系统生成的默认状态文案应为英文，例如 `Thinking`、`Calling tool: ...`、`Run failed: ...`、`Run interrupted: ...`。
3. 中文界面需要展示本地语言时，应由前端 i18n owner 根据 code/kind/metadata 或现有 UI 文案映射完成，而不是依赖后端中文字符串。
4. 用户消息、assistant 回复原文、中文 locale、中文文档和明确中文资源不受影响。

## 可维护性总结汇总

本次最佳减债动作是职责收敛：把后端/协议层的语言默认统一成英文 fallback，并把“真正本地化”重新归还给前端 i18n owner。没有新增后端 locale resolver、双语表或运行时语言参数，避免为了局部文案问题引入重型国际化链路。

本轮实际文案替换本身不增加生产代码；abort observability 是本次错误可观测性修复的必要补齐。为避免新增复杂度失控，本次没有引入独立调试存储或新国际化 resolver，只沿既有 NCP event 与 session activity preview 链路补充必要字段，并通过文件角色重命名消除本批次触达的文件命名/角色边界阻塞。剩余全量治理问题属于 NCP legacy module-structure 专项债务，不在本次提交里继续扩大迁移。

已做的局部减债：`SessionManager` 测试从一个超长 `describe` 拆成更明确的三个职责块，消除了本次触达导致的函数预算阻塞。剩余 warning 是相关文件仍接近预算，应在后续测试治理中继续拆 fixture/builder。

## NPM 包发布记录

- 涉及包：`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/ncp`、`@nextclaw/ncp-http-agent-server`、`@nextclaw/ncp-agent-runtime-next`、`@nextclaw/ncp-react`
- 发布状态：待下一次统一 NPM/桌面发布带出
- Changeset：`.changeset/backend-copy-defaults.md`
