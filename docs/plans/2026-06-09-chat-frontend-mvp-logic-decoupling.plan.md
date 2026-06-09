# Chat 前端 MVP 逻辑解耦改造计划

## 背景

本计划聚焦 `packages/nextclaw-ui/src/features/chat` 里的 Chat 页面、workspace 侧栏和会话运行链路。当前代码已经有 Presenter / Manager / Store 的雏形：`NcpChatPresenter` 负责装配 chat managers，`NcpChatThreadManager` 已经承接 workspace 选中、文件预览、历史导航和 `show-content` 分发，`chat-thread.store.ts` 已经用 Zustand `persist` 保存 workspace 连续性。

问题不在于“完全没有架构”，而在于剩余业务编排还散落在页面组件、hook 和 workspace 组件里，导致 View 层仍在承担状态迁移、read 标记、运行时绑定和 view model 组装。

## 目标

1. 让 `NcpChatPage` 退回页面连接层：只连接 route、query、agent runtime 和 Presenter，不承载业务迁移规则。
2. 让 `ChatSessionWorkspacePanel` 退回业务容器或纯展示边界：workspace active selection、tabs view model、已读标记和工具动作分发归 Manager / selector owner。
3. 收敛 Chat 状态 owner：Store 负责状态事实和持久化，Manager 负责业务转移，Utils 只保留纯计算。
4. 减少业务型 `useEffect`：只保留外部系统同步，例如 runtime attach、DOM/scroll、浏览器事件监听。
5. 不引入平行实现；优先把逻辑收回现有 `NcpChatThreadManager`、`NcpChatInputManager`、`ChatSessionListManager`，只有职责确实独立时才拆新 manager。

## 非目标

1. 不重写聊天运行时、NCP 协议或 `@nextclaw/ncp-react` hook。
2. 不改 UI 视觉样式，除非为了拆容器/展示边界必须调整 props。
3. 不把所有 hook 都消灭；数据查询 hook 和外部 runtime hook 可以保留，但它们不应承载业务迁移。
4. 不为局部简化新增大量空心 presenter。Chat 仍以 `NcpChatPresenter` 为装配根。

## 当前问题

### 1. 页面层承担运行时发送编排

证据：`packages/nextclaw-ui/src/features/chat/pages/ncp-chat-page.tsx`

- `useNcpChatStreamBindings` 在页面 hook 中绑定 `ChatStreamActionsManager`，并在 `sendMessage` 内构造 metadata、request envelope、调用 `agent.send`、materialize route、失败后恢复 draft。
- 这些逻辑涉及消息发送合同、session materialization、pending project root 选择、draft 恢复，已经超出 View 层的职责。

违反规范：

- 违反 `mvp-view-logic-decoupling`：复杂业务逻辑、streaming flows、cross-event ordering 应归 Manager / Store / Presenter。
- 违反 `useEffect` 边界：effect 应用于外部系统同步；当前 effect 内含业务发送规则。
- 违反 `information-expert`：发送恢复和 project root 选择更接近 `NcpChatInputManager` / run bridge，而不是页面组件。

### 2. 页面层通过 effect 做业务状态迁移

证据：`ncp-chat-page.tsx`

- `usePendingProjectRootOverrideCleanup` 直接调用 `useChatInputStore.getState().setSnapshot` 清理 pending project root。
- `useSelectedSessionAgentSync` 在 effect 中把 selected session 的 agent 写回 session list store。
- `useMaterializedRootSessionRouteSync` 在 effect 中根据 active run 或 messages 推导 materialized session route。
- `useNcpChatSnapshotSync` 把 query/agent 派生字段批量镜像进 `chatInputStore` 和 `chatThreadStore`。

违反规范：

- 违反 `mvp-view-logic-decoupling` 的 effect boundary：不要用 `useEffect` mirror query results into stores，也不要用 effect 触发业务 action。
- 违反 `complete-owner`：状态清理、route materialization、agent selection 同步没有集中 owner，页面成了隐形 manager。
- 违反 `single-domain-owner`：同一事实既由 query 派生，又被 store snapshot 镜像，读路径变成两套事实来源。

### 3. Workspace 组件承担 active selection、tabs view model 和已读副作用

证据：`packages/nextclaw-ui/src/features/chat/components/chat-session-workspace-panel.tsx`

- `resolveWorkspaceSelection` 从 nav 文件导入后在组件中决定当前 active panel。
- `buildWorkspaceTabsViewModel` 在组件文件中把 child sessions、file tabs、cron tab、unread dot、action callbacks 组装成 tabs。
- `useEffect` 在 active child session 非 running 时调用 `chatSessionListManager.markSessionRead`。
- `handleToolAction` 在组件中判断 `show-content` 和 `open-session` 分发到不同 manager 方法。

违反规范：

- 违反 business component cohesion：页面/布局级组件不应组装宽 view model 和 action bag。
- 违反 `tell-dont-ask`：组件读取一堆 tab/readAt/runStatus 字段后替 owner 决定是否 mark read。
- 违反 `information-expert`：workspace selection 与 navigation history 已由 `NcpChatThreadManager` 写入，active selection repair、tabs 模型和 read 标记也应由同一 workspace owner 解释。

### 4. Store 形态混合了持久化事实、运行时 read model 和非序列化对象

证据：`packages/nextclaw-ui/src/features/chat/stores/chat-thread.store.ts`

- `ChatThreadSnapshot` 同时包含 workspace persisted state、当前 session identity、model options、messages、threadRef、contextWindow、loading/sending 状态。
- `persist.partialize` 只持久化 workspace 子集，说明 store 实际同时承担了“持久化 workspace state”和“页面运行时 read model”两类职责。

违反规范：

- 违反 `responsibility-surface-minimization`：一个 snapshot 暴露过多变化原因。
- 违反 `mvp-view-logic-decoupling`：persisted payload 应小、可序列化、版本化；当前实现虽 partialize 规避了持久化风险，但类型层仍把运行时对象与持久化状态混在一起。
- 违反长期可维护性目标：后续新增字段时容易误放进 store 或 persist 范围。

### 5. 当前边界已经接近正确，但命名与文件角色还没有跟上

证据：`NcpChatThreadManager` 已经负责 workspace open/close/select/history/showContent/delete session；`chat-session-workspace-panel-nav.tsx` 已经有 `WorkspaceTabsBar` 和部分 workspace pure view 工具。

问题是：

- `ThreadManager` 同时包含会话删除、workspace 面板、DocBrowser show-content 分发。
- `workspace-panel-nav.tsx` 既有纯展示组件，也有 `resolveWorkspaceSelection` 这类业务解释函数。
- `ChatSessionWorkspacePanel` 既是容器又是展示。

违反规范：

- 违反 `high-cohesion-low-coupling`：一个 owner / 文件包含多个独立变化原因。
- 违反 `role-first-file-organization` 思路：展示组件、业务容器、manager read model utility 的文件角色不够清晰。

## 目标架构

### Owner 分工

#### `NcpChatPresenter`

- 继续作为 Chat 产品面的装配根。
- 只负责创建长期 managers，并注入稳定依赖，例如 `AppPresenter.docBrowserManager`。
- 不新增普通一跳 forwarding facade。

#### `NcpChatInputManager`

负责：

- composer nodes、draft、attachments、selected skills 的不变量。
- 发送前输入快照转换。
- 发送失败恢复 draft / composer state。
- pending project root 的生命周期清理。

新增/迁移方法建议：

- `resolveSendProjectRoot(payload, selectedSession)`
- `restoreDraftAfterSendFailure(payload)`
- `reconcilePendingProjectRootWithSession(selectedSession)`

#### `ChatSessionListManager`

负责：

- selected session key / agent id / list mode / read state。
- route session key 与 selected session key 的同步。
- root session materialization。
- child session read 标记。

新增/迁移方法建议：

- `syncRouteSessionSelection({ view, routeSessionKey })`
- `reconcileSelectedAgentFromSession(selectedSession)`
- `materializeRootSessionFromRuntime({ routeSessionKey, activeRunSessionId, visibleMessages })`
- `markVisibleWorkspaceChildRead(tab)`

#### `NcpChatThreadManager`

负责：

- workspace panel open/close/select。
- file tabs、cron tab、child session tab 的 workspace selection。
- workspace navigation history。
- tool action / show content 的业务分发。
- workspace view model 的纯业务解释，不直接渲染 UI。

新增/迁移方法建议：

- `resolveWorkspaceSelection(snapshot, facts)`
- `buildWorkspaceTabsModel(facts, actions)`
- `handleWorkspaceToolAction(action)`
- `reconcileWorkspaceAfterFactsChanged(facts)`

后续如果 `NcpChatThreadManager` 继续膨胀，再拆 `NcpChatWorkspaceManager`。第一阶段不急着拆，避免新旧 manager 平行存在。

#### Store

短期保留 `chat-thread.store.ts`，但把职责命名拆清：

- `ChatThreadRuntimeSnapshot`：当前会话运行时 read model，不持久化。
- `ChatWorkspaceSnapshot`：workspace panel / file tabs / history，允许 persist。
- `ChatThreadSnapshot = ChatThreadRuntimeSnapshot & ChatWorkspaceSnapshot` 作为过渡类型。

中期如果文件继续膨胀，再拆：

- `chat-thread.store.ts`：当前 thread runtime read model。
- `chat-workspace.store.ts`：workspace persisted continuity。

拆 store 必须保证迁移读旧 storage key，不丢用户 workspace continuity。

### 组件分工

#### `ChatSessionWorkspacePanel`

改为业务容器或保留导出名但内部变薄：

- 订阅 store / presenter。
- 调用 manager 获取 `WorkspacePanelViewModel`。
- 把 view model 传给纯展示组件。

#### `ChatSessionWorkspacePanelView`

新增或从现文件拆出：

- 只渲染 `WorkspaceTabsBar`、active child header、file preview、cron content。
- 不 import store，不 import presenter。
- 不判断 mark read，不决定 tool action 分发。

#### `ChildSessionContent`

建议拆到 `chat-child-session-content.container.tsx`：

- `useNcpSessionConversation(sessionKey)` 是外部数据连接，可以作为 container。
- 纯展示部分只接收 `{ messages, isHydrating, hydrateError, isRunning, onToolAction, onFileOpen }`。

## 改造步骤

### 第 0 步：建立保护网

目标：不动结构前先固定现有行为。

要补或确认的测试：

1. workspace tabs：child/file/cron 的优先级、active 状态、unread dot、close file。
2. workspace navigation：back/forward、close active file 后恢复历史项。
3. child session read：active child 非 running 且有 lastMessageAt 时 mark read；running 时不 mark。
4. `show-content` tool action：file 打开 workspace preview，url/panel-app 打开 DocBrowser。
5. root session materialization：draft session 首次发送后 route 正确 materialize。

### 第 1 步：把 workspace view model 从组件收进逻辑层

动作：

1. 从 `chat-session-workspace-panel.tsx` 移出 `buildWorkspaceTabsViewModel`。
2. 将 `resolveWorkspaceSelection` 从 `chat-session-workspace-panel-nav.tsx` 移到 manager read-model util，例如：
   - `features/chat/utils/chat-workspace-view-model.utils.ts`，只放纯计算；或
   - `NcpChatThreadManager` 私有/公开 read 方法，如果需要读取 store 或调用 manager action。
3. 新增 `NcpChatThreadManager.createWorkspacePanelModel(facts)`，返回：
   - `activeSelection`
   - `tabs`
   - `canGoBack`
   - `canGoForward`
   - `contentKind`
4. `WorkspaceTabsBar` 保持纯 UI，只接收 tabs 和按钮 handlers。

完成标准：

- `ChatSessionWorkspacePanel` 不再自己计算 unread dot、不再拼 tabs action bag。
- `chat-session-workspace-panel-nav.tsx` 只保留 UI 组件和 UI 类型；业务 selection 解释不在 nav 展示文件里。

### 第 2 步：把 child read 标记收进 Manager

动作：

1. 在 `ChatSessionListManager` 或 `NcpChatThreadManager` 新增 `markVisibleWorkspaceChildRead(tab)`。
2. `ChatSessionWorkspacePanel` 中的 effect 不再直接读 `runStatus/readAt/lastMessageAt` 后调用 `markSessionRead`。
3. 若仍需 effect，effect 只表达“active workspace child 已经进入可见区域”这个外部可见性事实，具体判断归 manager：

```ts
useEffect(() => {
  presenter.chatThreadManager.syncVisibleWorkspaceSelection(activeSelection);
}, [activeSelection, presenter.chatThreadManager]);
```

4. 优先评估能否在 `selectChildSessionDetail`、`openChildSessionPanel`、workspace facts reconcile 时同步完成 read 标记，减少 effect。

完成标准：

- read 标记规则只有一个 owner。
- 组件不再知道 running / lastMessageAt / readAt 的业务判定细节。

### 第 3 步：收敛 NcpChatPage 的业务 effect

动作：

1. `usePendingProjectRootOverrideCleanup` 迁移为 `NcpChatInputManager.reconcilePendingProjectRootWithSession(selectedSession)`。
2. `useSelectedSessionAgentSync` 迁移为 `ChatSessionListManager.reconcileSelectedAgentFromSession(selectedSession)`。
3. `useMaterializedRootSessionRouteSync` 迁移为 `ChatSessionListManager.materializeRootSessionFromRuntime(...)`。
4. `useChatSessionSync` 迁移为 `ChatSessionListManager.syncRouteSessionSelection(...)`，保留 route 外部事实输入。
5. `useNcpChatStreamBindings` 拆为 runtime bridge：
   - effect 只 attach/detach 当前 `agent` 和 `sessionKey`。
   - send envelope 构造、project root 选择、draft restore 调用 manager 方法。

完成标准：

- `NcpChatPage` 不直接调用 `useChatInputStore.getState().setSnapshot`。
- `NcpChatPage` 中剩余 effect 只处理 route/runtime/DOM 等外部系统同步。
- 发送失败恢复、project root 选择、route materialization 都有明确 manager 方法和单测。

### 第 4 步：拆清 chat-thread store 类型边界

动作：

1. 在 `chat-thread.store.ts` 内先拆类型：
   - `ChatThreadRuntimeSnapshot`
   - `ChatWorkspaceSnapshot`
   - `ChatThreadSnapshot`
2. 把 persist 相关 normalize / partialize 函数命名为 workspace owner 语义：
   - `normalizePersistedWorkspaceSnapshot`
   - `toPersistedWorkspaceFileTab`
3. 审计 `ChatThreadSnapshot` 字段：
   - `threadRef`、`messages`、`modelOptions`、`availableAgents` 不得进入 persisted subset。
   - workspace persisted subset 继续保持小而可修复。
4. 若类型拆分后文件仍过长，再执行 store 文件拆分；拆分时保留旧 storage key 和 migration。

完成标准：

- 类型层能一眼看出哪些是 runtime read model，哪些是 persisted workspace continuity。
- 新增 workspace 字段时必须显式进入 `ChatWorkspaceSnapshot`，并经过 persist sanitization 判断。

### 第 5 步：组件拆分和命名收尾

动作：

1. 保留 `ChatSessionWorkspacePanel` 导出名作为兼容入口，但内部只组合 container/view。
2. 拆出：
   - `chat-session-workspace-panel.view.tsx`
   - `chat-child-session-content.container.tsx`
   - 必要时 `chat-child-session-content.view.tsx`
3. 展示组件不 import presenter/store/query hook。
4. 业务容器直接取 presenter/store，不通过上层页面继续传宽 props。

完成标准：

- UI 组件 props 只包含展示数据和明确 UI event。
- 业务容器内聚在最接近业务语义的位置，不让 `NcpChatPage` 继续装配 workspace 细节。

## 验证计划

代码实现阶段必须执行：

1. `pnpm --filter @nextclaw/ui tsc --noEmit` 或项目当前等价 TypeScript 检查。
2. 相关单测：
   - `chat-session-workspace-panel` / workspace nav 测试。
   - `ncp-chat-thread.manager` 测试。
   - `chat-session-list.manager` 测试。
   - `ncp-chat-input.manager` 测试。
3. 定向组件测试：
   - child session tab 点击后 active。
   - file preview 打开、关闭、back/forward。
   - show-content tool action 打开正确 surface。
4. 浏览器或最贴近链路冒烟：
   - 打开一个 parent session。
   - 打开 child session workspace panel。
   - 触发 file preview。
   - back/forward 切换 child/file/cron。
   - 刷新后 workspace file tabs/history 恢复。

收尾阶段还要按仓库规则运行 maintainability / governance 检查，并披露非测试代码净增。此任务属于非新增用户能力，默认应通过删除页面层逻辑、减少重复派生、收敛 owner 来抵消新增文件成本；若非测试代码净增大于 0，需要说明对应删除了哪些职责泄漏或申请豁免。

## 风险与取舍

1. 不建议第一步就拆出全新的 `NcpChatWorkspaceManager`。当前 `NcpChatThreadManager` 已经是 workspace mutation owner，直接拆新 manager 容易形成双 owner。应先把逻辑收回现 owner，再根据文件职责膨胀情况拆分。
2. `useEffect` 不能机械清零。runtime attach、route 外部事实、可见性同步可能仍需要 effect；但 effect 内不能继续包含业务规则。
3. Store 拆分需要谨慎。`chat-thread.store.ts` 当前已有 persist migration 和 sanitization，直接改 storage key 会破坏用户连续性。先拆类型和 owner 命名，再评估文件拆分。
4. View model 是否放 Manager 还是 utils：纯计算、无 store 访问、无 side effect 的模型可以放 utils；需要读取 store、调用 action 或维护不变量的逻辑必须放 Manager。

## 最小推荐落地顺序

1. 先收 `ChatSessionWorkspacePanel`：移动 tabs model / selection / read 标记逻辑。
2. 再收 `NcpChatPage`：把 pending cleanup、agent sync、materialization 和 stream send 编排迁回 managers。
3. 最后拆类型边界：整理 `chat-thread.store.ts` 的 runtime vs persisted workspace 类型。

这样收益最大，风险最小，也最符合当前已有 owner：workspace 先回 `NcpChatThreadManager`，输入和发送恢复回 `NcpChatInputManager`，session 选择和已读回 `ChatSessionListManager`。
