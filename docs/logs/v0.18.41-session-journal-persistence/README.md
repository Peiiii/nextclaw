# v0.18.41 Session Journal Persistence

## 迭代完成说明

本次修复了 NCP agent 工具执行期间 session 高频事件通过 legacy `SessionManager.save()` 做同步全量 rewrite，导致 Node event loop 被文件 IO 和全量重建拖住、普通 API 刷新时一起变慢的问题。

确认根因的证据链：`DefaultNcpAgentBackend.send()` 每个 runtime event 都调用 realtime publish；`AgentBackendSessionRealtime.publishSessionEvent()` 默认持久化；kernel `NcpAgentSessionStoreAdapter` 会把 live NCP messages 转 legacy messages，clear 后逐条 append，最后走 core `SessionStore.save()` 同步写完整 JSONL 和 list index。工具执行期间事件密度高，所以卡顿表现会和工具执行高度相关。

修复方式：引入 NCP session journal-first 持久化路径。toolkit 的 `AgentSessionStore` 支持 `appendSessionEvent` / summary / messages 读取扩展点；backend 在 store 支持 append-only 时不再每事件全量 `saveSession`，也不再为 append 主路径构造完整 `messages` snapshot；kernel 新增 `NcpAgentSessionJournalStore` 用异步 JSONL append 保存 NCP endpoint events，并用 summary index 支撑列表；UI session API 优先读 NCP store，legacy session store 作为历史兼容路径。

兼容修正：历史 legacy 会话没有 journal 文件时，`listSessionMessages` 必须回落到 legacy session store；历史会话第一次写入 journal 前，会先把 legacy 历史消息一次性 seed 到 journal，避免继续对话后新 journal 读模型遮住旧消息。

本次还记录了用户明确授权的 `@nextclaw/ncp-toolkit` module-structure 临时豁免，并把后续 toolkit/lib 类型目录协议迁移写入 TODO。

## 测试/验证/验收方式

- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit test -- src/agent/__tests__/agent-backend-append-session-event.test.ts src/agent/in-memory-agent-backend.test.ts`
- `pnpm -C packages/nextclaw-kernel test -- src/stores/ncp-agent-session-journal.store.test.ts src/services/ncp-session-api.service.test.ts`
- `pnpm -C packages/nextclaw-kernel test -- src/services/ncp-agent-session-store-adapter.service.test.ts src/stores/ncp-agent-session-journal.store.test.ts src/services/ncp-session-api.service.test.ts`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit build`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit lint`
- `pnpm -C packages/nextclaw-kernel lint`
- `node scripts/governance/module-structure/lint-new-code-module-structure.mjs -- packages/ncp-packages/nextclaw-ncp-toolkit packages/nextclaw-kernel docs/TODO.md docs/designs/2026-04-19-module-structure-contracts.md docs/designs/2026-05-14-session-journal-persistence-design.md`
- `pnpm check:governance-backlog-ratchet`
- 真实接口复测：`GET http://127.0.0.1:5174/api/ncp/sessions/ncp-mp4alqjo-e3c666c3/messages?limit=300` 返回 `total: 2`，包含历史 user “你好” 与 assistant 回复。

全量 `pnpm lint:new-code:governance` 和 maintainability guard 当前被工作区内既有/并行的 extension runtime bridge 改动阻塞，不属于本迭代触达范围。本迭代相关路径的 module-structure 定向检查已通过。

## 发布/部署方式

未执行发布/部署。本次是源码与治理配置改动，需要后续随正常包发布流程发布相关 workspace 包。

## 用户/产品视角的验收步骤

1. 发起 NCP agent 会话并触发 streaming / tool 执行。
2. 工具执行期间刷新页面或请求 session list / session detail，确认普通 API 不再等待每事件 legacy 全量 rewrite。
3. 在 assistant text delta 只写到一半时重启服务，重新读取 session messages，确认能看到 streaming assistant 半截消息。
4. 结束 run 后确认 session summary 中 message count、metadata label 和 updatedAt 正常。

## 可维护性总结汇总

已使用 `post-edit-maintainability-review` 的检查问题清单进行结构收敛：backend 主文件降回预算内，kernel journal store 拆出 pure utils，toolkit 触达文件统一补 role suffix，并把 toolkit 当前历史目录结构作为用户授权豁免记录在 module config。追加减债：append-only contract 从完整 `AgentSessionRecord` 收窄到无 `messages` 的 `AgentSessionEventRecord`，旧 snapshot 构造只留在 legacy fallback。仍保留的债务：`agent-backend` 目录本身处在目录文件数预算边缘，后续应通过 lib protocol 迁移和子目录拆分解决。

## NPM 包发布记录

不涉及 NPM 包发布。

## 工作笔记

- 目标锚点：[work/goal-progress.md](work/goal-progress.md)
