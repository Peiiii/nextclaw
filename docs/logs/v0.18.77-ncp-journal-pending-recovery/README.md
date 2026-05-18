# v0.18.77 NCP Journal Pending Recovery

## 迭代完成说明

- 根因：NCP backend 先发布事件再落盘 journal，`session-activity-preview` 监听到完成事件后可能立刻触发 metadata 更新；该更新通过 `replaceSession` 重写 journal，存在用尚未包含完成事件的 pending 快照覆盖历史消息的竞态。
- 确认证据：问题会话 `ncp-mpbbnltj-f5a4ef47` 的 journal 中，assistant 历史消息被写成 `message.sent` 且 `status: "pending"`；UI 三点态正是由该状态触发。
- 修复：调整 NCP session event 发布顺序为先持久化、再广播给监听者；同时在 journal replay 层恢复历史坏数据中 `assistant message.sent` 的 draft 状态，避免旧会话继续显示为正在回复。
- 后续根因 1：发送路径仍然返回 SSE，而页面同时通过 session live stream 订阅同一会话，导致同一 delta 可能被 `/send` 流和 `/stream` 流各消费一次，表现为实时文本重复。
- 后续修复 1：将 `/send` 收敛成 command-only API，只返回 `NcpRunHandle`；会话实时消息统一由 session stream 接收，删除 send SSE 旧路径。
- 后续根因 2：service deferred NCP wrapper 调用了底层 `send` 但没有 return handle，接口层返回 `{ ok: true }` 且没有 `data`，触发 `NCP send command returned an invalid handle.`。
- 后续修复 2：deferred wrapper 显式返回底层 handle，并新增 assembled API boundary 测试，防止 legacy ack 形状再次通过。
- 后续根因 3：同一个 assistant message id 在 final `message.sent` upsert 后，旧的 `streamingMessage` 副本没有清理；接口读取时拼接 `messages + streamingMessage`，于是同 id assistant 同时以 final 和 pending 两个气泡出现。
- 后续修复 3：`DefaultNcpAgentConversationStateManager.upsertMessage` 在同 id 消息进入历史列表时清理 streaming 副本；`readMessages` 也增加同 id 防重保护。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ncp-toolkit test -- agent-backend-append-session-event.test.ts`：通过。
- `pnpm --filter @nextclaw/kernel test -- ncp-agent-session-journal.store.test.ts ncp-session-api.service.test.ts`：通过。
- `pnpm --filter @nextclaw/kernel tsc && pnpm --filter @nextclaw/ncp-toolkit tsc`：通过。
- `pnpm --filter @nextclaw/kernel lint && pnpm --filter @nextclaw/ncp-toolkit lint`：通过；`@nextclaw/ncp-toolkit` 仍有既有 warning。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- maintainability guard：通过；非测试代码净增 0。
- `pnpm --filter @nextclaw/ncp-http-agent-client test -- index.test.ts`：通过。
- `pnpm --filter @nextclaw/ncp-http-agent-server test -- index.test.ts`：通过。
- `pnpm --filter @nextclaw/ui test -- use-ncp-agent-runtime.test.tsx`：通过。
- `pnpm --filter @nextclaw/ncp-toolkit test -- agent-client-from-server.test.ts`：通过。
- `pnpm --filter @nextclaw/service test -- service-deferred-ncp-agent.service.test.ts nextclaw-app.service.test.ts`：通过。
- `pnpm --filter @nextclaw/server test -- router.ncp-agent.test.ts server.cors.test.ts server.weixin-channel.test.ts`：通过。
- `pnpm --filter @nextclaw/service test -- service-ncp-agent-send-http-contract.test.ts service-deferred-ncp-agent.service.test.ts`：通过，覆盖真实 UI server API 边界的 `/api/ncp/agent/send` command handle 合同。
- `pnpm --filter @nextclaw/ncp-toolkit test -- agent-conversation-state-manager.dedup.test.ts agent-conversation-state-manager.test.ts in-memory-agent-backend.test.ts agent-backend-append-session-event.test.ts`：通过。
- `pnpm --filter @nextclaw/ncp-toolkit tsc`：通过。
- `pnpm --filter @nextclaw/ncp-toolkit lint`：通过；仍有既有 warning。
- `pnpm --filter @nextclaw/service test -- service-ncp-agent-send-http-contract.test.ts`：通过。
- `curl -sS http://127.0.0.1:5174/api/ncp/sessions/ncp-mpbdub27-d7ab716c/messages`：通过；返回 `total: 4`，assistant id `mpbduff5-c0pqsfmto` 只出现一次，且没有同 id pending 副本。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：通过；总增减 `+695 / -318 / +377`，非测试代码 `+183 / -187 / -4`。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance`：当前被文件角色命名治理阻塞；触发项是本次触达的 NCP 历史文件仍未满足新 role-suffix / module-structure 规则，例如 `client.ts`、`stream-handlers.ts`、`agent-conversation-state-manager.ts`、`types/run.ts`。本次不在重复气泡 bugfix 中扩大为跨包重命名迁移。

## 发布/部署方式

- 未发布。
- 本次触达 `@nextclaw/ncp-toolkit` 与 `@nextclaw/kernel` 源码，后续若需要用户运行中的桌面应用立即生效，需要重启/重建对应本地运行时或进入统一发布闭环。
- 后续追加触达 `@nextclaw/ncp`、`@nextclaw/ncp-http-agent-client`、`@nextclaw/ncp-http-agent-server`、`@nextclaw/ncp-react`、`@nextclaw/service`、`@nextclaw/server` 与 `@nextclaw/ui` 的源码或测试；本地 dev server 已重启到 `http://127.0.0.1:5174/` 验证。

## 用户/产品视角的验收步骤

1. 打开已有受影响会话。
2. 历史 assistant 消息下方应显示时间/复制操作，而不是三点“正在回复”状态。
3. 新发送消息完成后，activity preview 更新不应再把已完成 assistant 消息回写成 pending。
4. 在 `ncp-mpbdub27-d7ab716c` 这类新会话中，AI 回复不应出现两个同 id 气泡。
5. 发送消息后 `/send` 只返回 command handle，页面内容更新只来自 session live stream。

## 可维护性总结汇总

- 本次最终没有修改底层 conversation state manager，而是修正第一个错误边界：journal 持久化与事件广播顺序。
- 非测试代码净增 0；主要正向动作是用顺序调整替代新增 metadata-only 重写通道，避免引入额外持久化分支。
- 新增测试覆盖事件发布前已落盘、以及旧 journal 中 assistant draft 状态的恢复。
- 后续追加后，非测试代码净减 4 行；主要正向动作是删除 `/send` SSE 平行事件通路，并把 message 去重不变量收回 conversation state manager。
- 当前保留债务：本次触达的若干 NCP 历史文件仍不符合最新文件角色命名治理；这是独立的结构迁移问题，不应混入本次用户可见 bugfix。

## NPM 包发布记录

- 不涉及 NPM 包发布。
