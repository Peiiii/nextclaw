# NCP Chat Page Runtime 解耦计划

## 背景

`NcpChatPage` 目前仍在直接连接 session route、input/session store、NCP conversation runtime、agent profiles、system status、thread/input snapshot sync 和若干业务修正 effect。虽然已经删除了 `useNcpChatPageState` 这个中心状态包，但页面函数本身仍然承担过多业务拼装职责。

本计划聚焦一个简化原则：page 只连接顶层 owner 和布局，不保存或中转属于具体业务组件的展示状态。

## 问题

1. `threadRef` 由 page 创建，再写入 `ChatThreadSnapshot`，最后由 `ChatConversationContent` 取出用于滚动容器。
   - 违反：DOM ref 的 owner 应该是实际 DOM 容器组件。
   - 影响：page、thread store、conversation content 之间形成无意义 ref 传递链。

2. `availableAgents` 由 page 读取 `useAgents()` 后写入 `ChatThreadSnapshot`，仅用于欢迎页 draft agent 选择；`agentDisplayName` / `agentAvatarUrl` 也由 page 派生后写入 snapshot，仅用于 header 头像展示。
   - 违反：业务组件应在最近业务语义位置自行连接数据 owner。
   - 影响：page 为 `ChatWelcome` 和 header avatar 代读数据，扩大 snapshot 字段面，让 thread snapshot 混入 agent catalog 投影。

3. `useNcpChatSnapshotSync` 参数仍包含 UI-only 字段，导致 page 看起来像 thread/input store 的装配器。
   - 违反：layout/page 不要组装宽 snapshot prop bag。
   - 影响：后续修改 conversation UI 时必须理解 page 的 runtime/snapshot 拼装。

## 本轮改造范围

本轮一次性完成低风险、确定收益的下沉：

- 删除 `ChatThreadSnapshot.threadRef`，让 `ChatConversationContent` 自己拥有滚动 ref。
- 删除 `ChatThreadSnapshot.availableAgents`，让 `ChatConversationContent` 自己读取 `useAgents()` 并为 `ChatWelcome` 构造 agent 列表。
- 删除 `ChatThreadSnapshot.agentDisplayName` / `agentAvatarUrl`，让 header 使用 `AgentIdentityAvatar` 按 `agentId` 自行解析展示信息。
- 从 `useNcpChatSnapshotSync` 删除 `threadRef`、`availableAgents`、`currentAgent` 参数。
- 从 `NcpChatPage` 删除对应创建、查询、传参和 snapshot 写回。

## 暂不改造

- 暂不把 `useNcpSessionConversation` 整体移动到新容器，避免把 page 的大逻辑原样搬到另一个“Boundary”里。
- 暂不改 `send/stop/resume` action bus 绑定；这需要先决定是否删除 `ChatStreamActionsManager.bind` 这条二阶段 wiring。
- 暂不重写 `useNcpChatSnapshotSync` 的 input/thread patch 合同；这是下一刀。

## 目标结构

- `NcpChatPage`：保留 presenter provider、route sync、UI shell binding、runtime-to-store 同步的当前过渡层。
- `ChatConversationContent`：拥有滚动 ref，并直接连接 agent profiles 供 welcome draft agent 选择使用。
- `ChatConversationHeaderContainer`：只从 snapshot 读取 `agentId`，头像展示交给 `AgentIdentityAvatar` 自行解析 profile。
- `ChatThreadSnapshot`：只保存 thread 业务状态，不保存 DOM ref、agent list 或 agent catalog 派生展示字段。

## 验证

- `@nextclaw/ui` targeted ESLint。
- `@nextclaw/ui` targeted tests。
- `@nextclaw/ui tsc --noEmit`。
- `pnpm lint:new-code:governance`。
- `pnpm check:governance-backlog-ratchet`。
- `post-edit-maintainability-guard --non-feature`。
