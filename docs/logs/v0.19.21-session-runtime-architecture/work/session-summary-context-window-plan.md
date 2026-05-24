# Session Summary Event 与 Context Window 收敛临时方案

关联大方案：[会话运行态与持久化架构设计草案](../../../designs/2026-05-23-session-runtime-architecture-design.md)。

## 当前判断

当前第一阶段不新增 `SessionRepository` facade，也不先铺新的 manager 层。现有代码里，`NcpSessionManager` 已经是 session summary 变化、metadata 更新、session 列表读取、单 session 读取和 context-window preview 聚合的实际 owner。因此这两块应先在 `NcpSessionManager` 周边完成闭环收敛。

当前相关代码位置：

- `packages/nextclaw-kernel/src/managers/ncp-session.manager.ts`
- `packages/nextclaw-shared/src/configs/event-keys.config.ts`
- `packages/nextclaw-ui/src/shared/lib/api/ncp-session-query-cache.ts`
- `packages/nextclaw-ui/src/app/hooks/use-app-event-consumers.ts`
- `packages/ncp-packages/nextclaw-ncp/src/types/session.ts`
- `packages/nextclaw-server/src/features/sessions/controllers/sessions.controller.ts`

## 切块 1：Session Summary Event 收敛

目标：eventBus 上 session summary 变化只通过一个事件表达。

目标事件：

```ts
sessionSummaryUpdated: createAppEventKey<{ summary: NcpSessionSummary }>(
  "session.summary.updated",
)
```

拟议改动：

- 在 `event-keys.config.ts` 新增 `sessionSummaryUpdated`。
- 将 `NcpSessionManager.publishSessionChange(...)` 拆成更清楚的职责：
  - search 刷新仍直接调用 `sessionSearch.handleSessionUpdated(sessionId)`。
  - summary realtime 只发布 `session.summary.updated`。
  - 找不到 summary 时不发 delete summary 事件。
- `createSession(...)`、`appendSessionEvent(...)`、`setSessionMetadata(...)`、`updateSessionMetadata(...)` 触发 summary 更新时统一走同一条 update 发布路径。
- 删除或停止使用 `sessionSummaryUpsert` / `sessionSummaryDelete`。
- 删除或停止使用 `sessionMetadataChanged`，metadata 变化由 `session.summary.updated` 表达。
- UI cache 侧保留内部 upsert list 算法，但 realtime event 类型改为 `session.summary.updated`。
- 删除 session 后的 UI 本地清理由 delete mutation 继续负责，不通过 eventBus summary delete 表达。

不在本切块处理：

- 不改底层 journal / metadata / summary index 文件结构。
- 不改 `session.updated` 在其它非 `NcpSessionManager` 链路中的历史用途。
- 不引入 `SessionRepository` facade。

主要验证：

- `packages/nextclaw-kernel/src/managers/__tests__/ncp-session.manager.test.ts`
- `packages/nextclaw-ui/src/shared/lib/api/ncp-session-query-cache.test.ts`
- TypeScript typecheck

## 切块 2：Context Window 归属剥离

目标：`contextWindow` 不属于 session summary / metadata，但单 session 读取需要返回它。

目标类型形态：

```ts
export type NcpSessionSummary = {
  sessionId: string;
  agentId?: string;
  messageCount: number;
  createdAt?: string;
  updatedAt: string;
  lastMessageAt?: string;
  status?: NcpSessionStatus;
  metadata?: Record<string, unknown>;
};

export type NcpSessionDetail = {
  summary: NcpSessionSummary;
  contextWindow?: Record<string, unknown> | null;
};
```

拟议改动：

- 从 `NcpSessionSummary` 类型中移除 `contextWindow`。
- `listSessions(...)` 继续返回 `NcpSessionSummary[]`，不带 context-window。
- `getSession(sessionId)` 改为返回 `NcpSessionDetail | null`。
- `NcpSessionManager.getSession(...)` 内部：
  - 读取 session record。
  - 生成 summary。
  - 通过现有 `ContextWindowPreviewManager` 计算 context-window preview。
  - 返回 `{ summary, contextWindow }`。
- `listSessionMessages(...)` 的 response 仍可带 `contextWindow`，但读取来源应从 `getSession(...).contextWindow` 切换为 detail 的字段。
- UI 侧 `NcpSessionSummaryView` 不再包含 context-window；messages seed / chat thread snapshot 仍可接收 context-window。

不在本切块处理：

- 不重写 `SessionContextWindowContribution`。
- 不把 context-window 写入 session metadata 或 summary。
- 不改 agent runtime 的 context-window 事件产生方式。

主要验证：

- `packages/nextclaw-server/src/app/router.ncp-agent.test.ts`
- `packages/nextclaw-ui/src/features/chat/utils/ncp-session-adapter.utils.test.ts`
- `packages/nextclaw-ui/src/features/chat/hooks/use-ncp-session-conversation.test.tsx`
- TypeScript typecheck

## 推荐执行顺序

先做切块 1，再做切块 2。

原因：

- 切块 1 边界更小，主要是 event key、manager 发布点和 UI cache 消费。
- 切块 2 会改公共 API 类型，影响 server / client / UI / tests，适合在 summary event 语义收敛后处理。

两个切块都完成后，再回头讨论是否进入 `AgentRunRequestManager` ingress 化或 `SessionRun` / inbox 切入。
