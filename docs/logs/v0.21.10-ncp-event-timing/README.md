# NCP Event Timing

## 迭代完成说明

本轮把 Codex 风格“已处理 X”从假时间升级为 NCP 主链路上的真实时间事实。

协议层新增 `NcpEndpointEvent.occurredAt`，表示事件在 producer 领域发生的时间；`run.started` 写 `startedAt`，`run.finished` / `run.error` 写 `startedAt` 与 `endedAt`。按“不冗余”原则，协议和 message 都不持久化 `durationMs`，展示耗时由 `startedAt/endedAt` 派生。

消息层新增标准字段 `NcpMessage.lifecycle`，用于表达消息自身的生产生命周期，不使用内部味道较重的 `ncp_run_timing` metadata。conversation state manager 只在 settle streaming assistant message 时消费已有 run terminal facts，写入 message lifecycle，不在上层生成事件时间。

同批补齐第一方运行时生产者：默认 agent runtime、runtime-next、Codex SDK、Claude Code SDK、Stdio runtime、Hermes HTTP adapter、HTTP client/server、React hook 与 kernel 合成事件都会在创建事件时写入 `occurredAt`；run terminal 事件写入 `startedAt/endedAt`。Hermes `/send` 同时对齐 HTTP client 合同，返回标准 `NcpRunHandle`，避免 client 只能收到旧式 `{ ok: true }`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ncp run tsc`：通过。
- `pnpm --filter @nextclaw/ncp run build`：通过，用于刷新本地 package exports 的 `dist/index.d.ts`，供依赖包类型检查读取最新公共协议。
- `pnpm --filter @nextclaw/ncp-toolkit run tsc`：通过。
- `pnpm --filter @nextclaw/ncp-toolkit test -- agent-conversation-state-manager`：通过，覆盖 run timing facts 写入 message lifecycle。
- `pnpm --filter @nextclaw/ncp-agent-runtime run tsc`：通过。
- `pnpm --filter @nextclaw/ncp-agent-runtime test`：通过。
- `pnpm --filter @nextclaw/ncp-agent-runtime-next run tsc`：通过。
- `pnpm --filter @nextclaw/ncp-agent-runtime-next test`：通过，覆盖 event `occurredAt`、run `startedAt/endedAt`，并确认不写 `durationMs`。
- `pnpm --filter @nextclaw/ncp-http-agent-client run tsc`：通过。
- `pnpm --filter @nextclaw/ncp-http-agent-server run tsc`：通过。
- `pnpm --filter @nextclaw/ncp-react run tsc`：通过。
- `pnpm --filter @nextclaw/kernel run tsc`：通过。
- `pnpm --filter @nextclaw/kernel test -- agent-run-request.manager`：通过。
- `pnpm --filter @nextclaw/kernel test -- ncp-agent-session-journal`：通过。
- `pnpm --filter @nextclaw/ui test -- chat-message-process-summary.utils`：通过，覆盖从 `message.lifecycle.startedAt/endedAt` 派生展示耗时。
- `pnpm --filter @nextclaw/ui run tsc`：通过。
- `pnpm --filter @nextclaw/ui test -- chat-message-list.container`：通过，覆盖 process summary 组件展示 `已处理 3m 51s`。
- `pnpm --filter @nextclaw/ncp-agent-runtime exec tsx -e "void import('./src/runtime/stream-encoder.service.ts').then(() => console.log('import ok'))"`：通过，覆盖 `createStreamEvent` 迁移后的真实 ESM import 链路。
- `./node_modules/.bin/vitest run src/services/codex-sdk-runtime-thread-metadata.service.test.ts`（在 `packages/extensions/nextclaw-ncp-runtime-codex-sdk`）：通过，覆盖 app-server notification 永久 pending 时 abort 仍立即产出 `message.abort`。
- `./node_modules/.bin/tsc -p tsconfig.json`（在 `packages/extensions/nextclaw-ncp-runtime-codex-sdk`）：通过。
- `./node_modules/.bin/vitest run ...` Codex runtime 包完整测试：通过，7 个测试文件、19 个测试；同步覆盖 mapper 输出标准 `occurredAt` 的断言。
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-claude-code-sdk run tsc`：通过。
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-claude-code-sdk test`：通过。
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client run tsc`：通过。
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client test`：通过，2 个测试文件、17 个测试。
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http run tsc`：通过。
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http test`：通过，1 个测试文件、10 个测试，覆盖 `/send` handle 与流式事件桥接。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/extensions/nextclaw-ncp-runtime-codex-sdk/src/services/codex-app-server-ncp-agent-runtime.service.ts packages/extensions/nextclaw-ncp-runtime-codex-sdk/src/services/codex-sdk-runtime-thread-metadata.service.test.ts packages/extensions/nextclaw-ncp-runtime-codex-sdk/src/utils/codex-sdk-ncp-event-mapper.utils.test.ts`：通过，0 errors，1 warning；非测试净增 `-7` 行。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit exec vitest run src/agent/agent-conversation-state-manager.test.ts src/agent/agent-conversation-state-manager-settlement.test.ts`：通过，2 个测试文件、21 个测试；覆盖 replayed assistant settle 后仍停留在自身 timestamp 对应位置。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit tsc`：通过。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit lint`：通过，0 errors，3 warnings；warning 为既有超长测试文件、`ncp-reply-consumer` 相关可维护性提示。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-react tsc`：通过。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit build`：通过，用于刷新本地 ignored dist 后执行 dist 级 replay 验证。
- `node --input-type=module -e "import { NcpAgentSessionJournalStore } from './packages/nextclaw-kernel/dist/index.js'; ..."`：通过；读取真实 session `ncp-mr6cl72t-b565eb19` 的 journal 后返回 6 条消息，顺序为 `user 12:37`、`assistant 12:38`、`user 12:40`、`user 12:40`、`user 12:41`、`assistant 12:42`。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`：通过，0 errors，14 warnings；Hermes adapter service / message utils 与 Stdio service 均已从“超预算继续增长”收敛为净减少。
- `pnpm lint:new-code:governance`：未通过；被当前工作区已触达 legacy 文件命名/角色后缀规则挡住：`client.ts`、`agent-conversation-message-normalizer.ts`、`agent-conversation-state-manager.ts`、`types/events.ts`、`types/message.ts`。本轮新增文件命名与目录检查通过。
- `pnpm check:governance-backlog-ratchet`：通过。

## 发布/部署方式

本轮没有执行部署或发布。

已新增 `.changeset/ncp-event-timing-lifecycle.md`：`@nextclaw/ncp` 为 minor，runtime、toolkit、HTTP/react、kernel 与 UI 相关包为 patch，后续随统一 NPM 发布流程进入 changelog。

## 用户/产品视角的验收步骤

1. 发送一条会触发 assistant reasoning/tool process 的消息。
2. 等 assistant 完成后，过程内容自动折叠成 `已处理 X`。
3. 展开折叠区仍可看到 reasoning/tool 过程。
4. 没有 lifecycle timing 的历史消息仍只显示 `已处理`，不会根据消息 timestamp 猜耗时。

## 可维护性总结汇总

本轮是协议与可观察体验改造，允许必要生产代码增长。关键取舍是把事实放在事件 producer 与标准 message lifecycle，而不是 metadata 私有 key、EventBus/journal 兜底器或 UI 时间差估算。

为压住超大 runtime 文件增长，本轮将 Hermes 标准 NCP 事件构造迁入 `hermes-http-adapter-events.utils.ts`，将 Hermes inline tool trace 解析迁入 `hermes-inline-tool-trace.utils.ts`，并把 Stdio service 里的 session metadata patch 读取迁到已有 recovery utils。结果是新增 timing 覆盖更广，但 Hermes/Stdio 原超预算主文件均净减少。

## NPM 包发布记录

涉及 NPM 包发布记录，但本轮不直接发布：

- `@nextclaw/ncp`：需要 minor，原因是新增可选 event timing 与 message lifecycle 协议字段。
- `@nextclaw/ncp-agent-runtime` / `@nextclaw/ncp-agent-runtime-next`：需要 patch，原因是第一方 runtime 在事件出生时写入 `occurredAt` 与 run lifecycle facts。
- `@nextclaw/ncp-toolkit`：需要 patch，原因是 conversation state manager 将 run terminal facts 写入 message lifecycle。
- `@nextclaw/ncp-http-agent-client` / `@nextclaw/ncp-http-agent-server` / `@nextclaw/ncp-react`：需要 patch，原因是各自创建的 NCP events 写入 `occurredAt`。
- `@nextclaw/kernel`：需要 patch，原因是合成事件与 replay 保留时间事实。
- `@nextclaw/ui`：需要 patch，原因是 process summary 从 message lifecycle 派生真实耗时展示。
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk`：需要 patch，原因是 Codex app-server abort 现在会及时发出标准 NCP abort event，避免当前会话停留在 running UI 状态。
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk`：需要 patch，原因是 Claude Code SDK 生产的 NCP events 写入 `occurredAt` 与 run lifecycle facts。
- `@nextclaw/nextclaw-ncp-runtime-stdio-client`：需要 patch，原因是 Stdio runtime 在唯一事件发射出口标准化 `occurredAt`，run lifecycle 由 run producer 写入。
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http`：需要 patch，原因是 Hermes adapter 写入标准 event/run timing，并对齐 `/send` 的 `NcpRunHandle` 响应合同。

状态：待后续统一发布流程处理。
