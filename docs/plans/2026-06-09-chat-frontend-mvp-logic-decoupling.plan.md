# Chat 前端 MVP 逻辑解耦改造计划

## 文档状态

本文是 Chat 核心前端重构的执行计划，当前重点覆盖 `packages/nextclaw-ui/src/features/chat`。截至本文更新时，workspace panel 的 view model 纯计算已经开始从组件中抽出到 `chat-workspace-panel-view-model.utils.ts`，后续执行应在这个方向上继续收敛，不要另起一套平行 workspace 解释逻辑。

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

## 分块具体方案

### A. Workspace View Model 与 Active Selection

目标 owner：

- 纯计算 owner：`chat-workspace-panel-view-model.utils.ts`。
- mutation owner：`NcpChatThreadManager`。
- UI owner：`chat-session-workspace-panel-nav.tsx` 只保留 tabs bar 展示。

具体动作：

1. 保留当前已经抽出的 `resolveWorkspaceSelection`、`buildWorkspaceTabsViewModel`，补齐测试覆盖：
   - explicit `activePanelKind` 优先级。
   - child / file / cron fallback 顺序。
   - optimistic readAt 覆盖 persisted readAt。
   - running child session 不显示 unread dot。
   - file diff badge 和 close action。
2. `chat-session-workspace-panel-nav.tsx` 不再导出业务解释函数，只导出 `WorkspaceTabsBar` 与展示相关局部组件。
3. `ChatSessionWorkspacePanel` 临时可以继续调用 pure utils，但下一步要把 action callback 组装收敛到 `NcpChatThreadManager.createWorkspacePanelModel(...)`，避免组件长期拼 action bag。
4. 不新增 `WorkspaceSelectionManager` 这类单方法 owner。只要逻辑仍是纯计算，就留在 utils；一旦需要读取 store、修复状态或触发 action，就进入 `NcpChatThreadManager`。

删除/收敛点：

- 删除组件内的 `buildWorkspaceTabsViewModel` 复制实现。
- 删除 nav 展示文件里的 selection 业务解释。
- 删除任何与当前 utils 平行的 workspace tabs builder。

验收：

- `ChatSessionWorkspacePanel` 中不再出现 tabs unread 规则细节。
- utils 测试能独立证明 workspace tab model 的状态组合。

### B. Workspace Read Marker 与可见性同步

目标 owner：

- read watermark 事实 owner：`ChatSessionListManager`。
- workspace active selection owner：`NcpChatThreadManager`。
- React effect 只表达“这个 selection 已经可见”。

具体动作：

1. 将 `ChatSessionWorkspacePanel` 中的 effect 从“判断并 mark read”改成“通知 workspace selection visible”：
   - 推荐入口：`presenter.chatThreadManager.syncVisibleWorkspaceSelection(activeSelection)`。
   - `NcpChatThreadManager` 内部判断 selection kind。
   - `ChatSessionListManager.markVisibleWorkspaceChildRead` 继续作为 read state owner。
2. 判断 read 的细节保留在 manager：
   - 没有 sessionKey 不处理。
   - running 不写 readAt。
   - lastMessageAt 空不处理。
   - optimistic readAt 不倒退。
3. 后续评估是否能在 `selectChildSessionDetail` / `openChildSessionPanel` 同步 mark read，减少可见性 effect；但第一阶段不要为了消灭 effect 改变“实际可见才已读”的语义。

删除/收敛点：

- 组件不再读取 `runStatus`、`lastMessageAt`、`readAt` 来决定业务规则。
- `shouldShowUnreadSessionIndicator` 仍可作为纯展示判断使用，但写 readAt 的规则不应散在组件。

验收：

- 新增或更新 `chat-session-list.manager.test.ts`：running child 不 mark，非 running 且 newer lastMessageAt mark，旧 readAt 不回退。
- workspace panel 组件测试只关心可见 selection 触发 manager 意图，不验证 readAt 细节。

### C. Child Session 内容容器

目标 owner：

- runtime conversation hook：继续由 `useNcpSessionConversation` 连接外部 NCP runtime。
- child session container：`chat-child-session-content.container.tsx`。
- child session view：只有在 props 明显稳定后再拆，不为了行数机械拆。

具体动作：

1. 从 `chat-session-workspace-panel.tsx` 拆出 `ChildSessionContent`。
2. Container 负责：
   - 调用 `useNcpSessionConversation(sessionKey)`。
   - 调用 `useStickyBottomScroll`，因为这是 DOM/scroll 外部同步。
   - 将 `visibleMessages`、loading/error/running 状态传给 message list。
3. 不在 child session content 里重新实现 tool action 分发；优先让 `ChatMessageListContainer` 的 tool action 默认通道或上层 workspace manager 统一处理。
4. 若必须传 action，则传 `presenter.chatThreadManager.handleWorkspaceToolAction`，不要在组件中判断 `show-content` / `open-session` 分支。

删除/收敛点：

- 删除 parent conversation 与 child conversation 里重复的 `handleToolAction` 分支。
- `ChatMessageListContainer` 只接收统一 tool action handler，不关心 workspace 还是 main thread。

验收：

- child session loading / empty / messages 渲染测试保持。
- show-content 在 child session 内打开同一 workspace/file/doc surface。

### D. Main Conversation 与 Tool Action 分发

目标 owner：

- tool action 业务分发 owner：`NcpChatThreadManager`。
- message list container：只做消息 view model 和 UI 连接。
- conversation panel：只组合 header/content/input/workspace。

具体动作：

1. 在 `NcpChatThreadManager` 增加 `handleToolAction(action)`：
   - `show-content` 调 `showContent(request)`。
   - `open-session` 调 `openSessionFromToolAction(action)`。
   - 其它未来 action 只从这里扩展。
2. `ChatConversationContent` 和 child session content 都直接传同一个 handler。
3. `ChatMessageListContainer` 保持业务无关，不 import chat managers。
4. 若 `ChatMessageListContainer` 当前已经有 file open 直传，保留为 view event，但最终由 `NcpChatThreadManager.openFilePreview` 承接。

删除/收敛点：

- 删除 conversation panel 与 workspace child content 中重复的 `if action.kind === "show-content"`。
- 不新增第二套 `tool-action.utils.ts` 分发层，除非 action 映射变成纯计算且跨 manager 复用。

验收：

- `ncp-chat-thread.manager.test.ts` 覆盖 tool action 分发。
- `chat-message-list.container.test.tsx` 只验证 action 触发，不验证业务分支。

### E. NcpChatPage Route / Runtime Bridge

目标 owner：

- `NcpChatPage`：页面连接层。
- route/session selection owner：`ChatSessionListManager`。
- runtime send bridge：短期可保留 hook，但业务构造进入 manager。

具体动作：

1. 将 `useChatSessionSync` 从 layout shell 的业务 hook 迁入 chat feature owner：
   - 推荐 manager 方法：`ChatSessionListManager.syncRouteSessionSelection({ view, routeSessionKey })`。
   - hook 只把 route 外部事实喂给 manager。
2. `useNcpChatStreamBindings` 拆成更窄的 runtime bridge：
   - effect 只把当前 `agent`、`sessionKey` attach 到 bridge。
   - send metadata/envelope 构造不留在 effect 内。
3. `buildNcpSendMetadata` 先保留纯函数，但从 page 文件迁到 `utils` 或 input manager 附近，明确它是 outbound metadata contract。
4. `materializeRootSessionRoute` 由 `ChatSessionListManager.materializeRootSessionFromRuntime(...)` 接收 runtime facts。

删除/收敛点：

- `NcpChatPage` 不直接调用 `useChatInputStore.getState().setSnapshot`。
- `NcpChatPage` 不再直接恢复 draft。
- `NcpChatPage` 不再包含 metadata alias 细节。

验收：

- `ncp-chat-page.test.ts` 继续覆盖 route selection 与 materialization。
- manager 单测覆盖 draft session route 物化。

### F. Input / Send / Draft Restore

目标 owner：

- composer/draft/attachments owner：`NcpChatInputManager`。
- outbound send contract owner：`NcpChatInputManager` + runtime bridge。
- stream execution owner：runtime hook / bridge，不归输入 manager 直接拥有。

具体动作：

1. `NcpChatInputManager.send` 继续负责读取 input/list/thread snapshot 和清空 composer。
2. 发送 payload 构造继续由 input manager 发起，但 metadata/projectRoot 选择必须进入明确方法：
   - `resolveSendProjectRoot({ payloadSessionKey, selectedSession, pendingProjectRoot, pendingProjectRootSessionKey })`。
   - `buildSendMetadata(...)`。
3. 失败恢复进入 `NcpChatInputManager.restoreDraftAfterSendFailure(payload)`。
4. `pendingProjectRoot` 清理进入 `reconcilePendingProjectRootWithSession(selectedSession)`，由 page bridge 调用 manager，不直接写 store。

删除/收敛点：

- 删除 page effect 中的 composer restore 分支。
- 删除 page 对 pending project root 规则的直接判断。

验收：

- `ncp-chat-input.manager.test.ts` 覆盖：
  - 发送失败恢复 composer nodes 和 attachments。
  - 空 draft 不覆盖已有 draft。
  - pending project root 在 session materialized 后清理。

### G. Session List / Sidebar Read Model

目标 owner：

- session list state owner：`ChatSessionListManager` + `chat-session-list.store.ts`。
- sidebar grouping view model：纯 utils 或 sidebar-local pure functions。
- sidebar component：展示与轻量 container。

具体动作：

1. 保留 `ChatSidebar` 中的 date/project grouping 纯函数，但如果继续膨胀，迁到 `chat-sidebar-view-model.utils.ts`。
2. `useChatSessionUnreadState` 中的 effect 改成只通知 selected item visible，read 细节继续归 manager。
3. `ChatSessionListManager` 增加更语义化的方法：
   - `markSelectedSessionVisible(item)`。
   - `markWorkspaceChildVisible(tab)`。
4. `ChatSidebarSessionEntry` 保持展示组件，不读取 store。

删除/收敛点：

- 删除 sidebar 中 readAt/runStatus 的业务判定。
- 不把 sidebar grouping 提前升级成 manager；它是纯 view model，先放 utils 即可。

验收：

- `chat-sidebar-read-state.test.tsx` 覆盖 selected session 已读。
- `chat-session-list.manager.test.ts` 覆盖 read watermark 规则。

### H. Thread Store 类型边界

目标 owner：

- runtime read model：`ChatThreadRuntimeSnapshot`。
- workspace continuity：`ChatWorkspaceSnapshot`。
- store 文件短期保留一个，类型先拆清。

具体动作：

1. 在 `chat-thread.store.ts` 内拆类型：
   - `ChatThreadRuntimeSnapshot`：provider/model/session/messages/threadRef/contextWindow/loading/sending。
   - `ChatWorkspaceSnapshot`：workspace parent、active kind、child key、file tabs、history。
   - `ChatThreadSnapshot = ChatThreadRuntimeSnapshot & ChatWorkspaceSnapshot`。
2. persist normalize / partialize 只接受 `ChatWorkspaceSnapshot`。
3. 把 `initialSnapshot` 拆为 `initialRuntimeSnapshot` 与 `initialWorkspaceSnapshot` 再合并。
4. 不改 storage key；如需 version bump，必须写 migration 或证明 merge sanitization 可兼容。

删除/收敛点：

- 删除运行时字段进入 persist 逻辑的可能性。
- 删除 `ChatThreadSnapshot` “什么都能塞”的心理入口。

验收：

- `chat-thread.store.test.ts` 覆盖旧 persisted payload merge。
- tsc 能证明 persisted subset 不接收 `threadRef/messages/modelOptions`。

### I. NCP Session Adapter / Metadata Contract

目标 owner：

- inbound adapter owner：`ncp-session-adapter.utils.ts`。
- outbound metadata owner：新的 send metadata util 或 input manager 私有方法。
- 长期协议事实源：后续应尽量上移到 shared API contract，而不是 UI 猜字段。

具体动作：

1. 先盘点 metadata 字段：
   - outbound：`preferred_model`、`preferred_thinking`、`session_type`、`agent_id`、`project_root`、`requested_skill_refs`。
   - inbound：当前 adapter 读取的 alias。
2. 对每个 alias 标注来源：
   - 真实后端/历史数据兼容。
   - UI 内部旧写法。
   - 不确定字段。
3. 不在第一阶段直接删 alias；先增加测试固定当前行为。
4. 第二阶段把 outbound 写法收敛到规范字段；确认后端与历史数据兼容后，再删除内部 alias 写入。

删除/收敛点：

- 删除 page 文件中的 metadata 构造。
- 删除没有来源证明的 alias 写入。
- inbound 兼容只留在 adapter 边界，不扩散到 manager/component。

验收：

- `ncp-session-adapter.utils.test.ts` 覆盖 preferred model/thinking/project/child/activity preview。
- outbound metadata util 单测覆盖规范字段。

### J. 文件组织与命名收尾

目标 owner：

- `components/`：容器和展示组件按文件名明确。
- `utils/`：无状态纯计算。
- `managers/`：业务动作、状态迁移、跨 owner 编排。
- `stores/`：状态形状、persist、原子 setter。

具体动作：

1. 新增文件默认使用角色后缀：
   - `chat-workspace-panel-view-model.utils.ts`
   - `chat-child-session-content.container.tsx`
   - `chat-session-workspace-panel.view.tsx`
2. 不新增 `workspace/` 子目录到 `hooks/`；项目治理要求 hooks 平铺。
3. `components/workspace/` 已存在时，只放 workspace 展示组件，不放 manager 或 store。
4. 每次移动后用 `rg` 反查旧导入，删除空文件和无意义 barrel。

删除/收敛点：

- 删除组件文件内的大段纯计算。
- 删除只做转发的中间文件。
- 不新增 `index.ts`，除非它是稳定公共边界。

验收：

- `pnpm lint:new-code:governance` 不出现新增结构违规。
- 相关 imports 全部指向真实 owner 文件。

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
