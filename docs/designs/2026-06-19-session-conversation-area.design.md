# 会话对话区域复用与子代理继续对话方案设计

## 背景

当前主会话已经具备完整对话能力：消息列表、运行态同步、输入框、发送、停止、模型/思考/skill 选择、附件和输入面板插件。右侧栏里的子代理会话目前只复用消息展示，不能继续对话。

用户期望不是给子代理面板临时加一个输入框，而是把主会话中 header 以下的完整会话区域拆成一个可复用、自包含的业务组件。主会话和右侧栏子代理都复用这一个组件，只是承载位置不同。

本设计沉淀到 `docs/designs`，因为它已经涉及稳定边界、owner、数据流、组件拆分和后续实现依据，不是普通想法或执行计划。

## 本次修订结论

上一版方案把 `areaKey` 暴露给全局 `ChatInputManager` / `ChatRunManager`，让这些 manager 管理多个会话区域实例。这个方向不够好。

原因是：

- 它把“组件实例管理”泄漏到全局 manager，manager 会变成多实例注册表。
- 外部调用方需要知道 `areaKey`，复用组件时仍要理解内部状态隔离机制。
- 它没有做到真正自包含，只是把单例状态改成 keyed 单例状态。
- `areaKey` 不是业务事实，只是前端组件实例事实，不应该进入全局业务 manager 的公共合同。

修订后的推荐方向是：

> `SessionConversationArea` 自己拥有局部输入状态、局部运行态绑定和发送/停止动作。外部只传 `sessionKey` 和少量边界回调。

也就是说，复用方式应该接近：

```tsx
<SessionConversationArea
  sessionKey={routeSessionKey}
  welcomeSlot={welcomeSlot}
  onSessionMaterialized={handleSessionMaterialized}
/>
```

右侧栏子代理：

```tsx
<SessionConversationArea
  sessionKey={activeChildSessionKey}
/>
```

## 现状依据

- 主页面 `packages/nextclaw-ui/src/features/chat/pages/ncp-chat-page.tsx` 负责创建 `useNcpSessionConversation(sessionKey)`，再通过 `useChatRunRuntimeConnection` 把当前路由会话绑定到全局 `ChatRunManager`。
- `ChatRunManager` 目前只有一个 `activeRuntime`。`sendMessage` 会校验 `runtime.sessionKey === payload.sessionKey`，所以它天然只服务当前 active 会话。
- `ChatInputManager.send` 从全局 `useChatInputStore`、`useChatSessionListStore`、`useChatThreadStore` 读取 draft、附件、model、skills、当前 session，再调用 `ChatRunManager.sendMessage`。
- `ChatInputStore` 目前只有一个 `snapshot`，意味着整个页面只有一个 draft、一个 sendError、一个 isSending、一个 stop 状态。
- 主会话组件 `ChatConversationPanel` 组合了父会话 banner、会话 header、alerts、消息内容、输入框和 workspace 右栏。其中 header 以下的内容由 `ChatConversationContent`、`ChatConversationAlerts`、`ChatInputBarContainer` 组成。
- `ChatConversationContent` 直接读取全局 `useChatThreadStore.snapshot.messages/isSending/isHistoryLoading`，不是按传入 sessionKey 自己取消息。
- 右栏子会话 `ChatSessionWorkspacePanelContent.ChildSessionContent` 直接调用 `useNcpSessionConversation(sessionKey)` 拉消息，然后只渲染 `ChatMessageListContainer`，没有输入框、发送或 stop 绑定。
- `useChatInputBarQueryState` 当前通过全局 `selectedSessionKey` 推导 selected session、session type、model fallback 和 skills，不支持指定某个子会话作为输入上下文。
- NCP 侧已经有“给现有 session 发送任务”的语义：`sessions_request` 可以发送到既有 session，包括 child session。底层 `useNcpSessionConversation(sessionId)` 也已经提供 `send/abort/streamRun` 能力。

## 核心判断

这不是一个纯 UI 组件抽取问题，而是一个“会话对话区域自包含边界”的问题。

如果只把 JSX 抽成组件，但继续复用全局 `ChatInputStore` 和单例 `ChatRunManager.activeRuntime`，主会话和子代理会共享 draft、sendError、stop、isSending、model/skill 选择，最终会出现下面这些问题：

- 在子代理右栏输入会污染主会话输入框。
- 子代理发送可能被 `ChatRunManager` 拒绝，因为 active runtime 仍是主会话。
- stop 可能停止主会话，而不是子会话。
- 子会话的 model/skills 可能来自主会话 selected session。
- 多个子会话 tab 切换时，没有明确的草稿归属。

但解决方式不应该是让全局 manager 管理 `areaKey`。正确方向是：

- `SessionConversationArea` 是一个 business component。
- 它内部调用 `useNcpSessionConversation(sessionKey)` 获得消息、运行态、send、abort。
- 它内部维护输入状态，或使用只属于该组件模块的局部 draft cache。
- 它内部组装 `ChatInputBar` 的 view props 和 actions。
- 外部组件不负责输入状态、不负责运行态绑定、不传 `areaKey`。
- 外部只负责页面布局和少数外部边界动作，例如新 draft session materialize 后跳转路由。

## 推荐组件合同

```ts
type SessionConversationAreaProps = {
  sessionKey: string | null;
  welcomeSlot?: React.ReactNode;
  onSessionMaterialized?: (sessionKey: string) => void;
};
```

说明：

- `sessionKey` 是唯一必需业务事实；已有会话传具体 id，新建主会话草稿传 `null`。
- `welcomeSlot` 只用于主会话空白欢迎页；右侧栏一般不传。
- `onSessionMaterialized` 只服务 `sessionKey === null` 的主会话新建场景。路由跳转不是组件内部职责，所以通过边界回调交给页面。
- 不暴露 `areaKey`。如果组件内部需要区分草稿缓存 key，应在组件内部用 `sessionKey ?? "__draft__"` 或 internal instance id 解决。

## 自包含怎么做

这里的“自包含”不是说组件不依赖任何模块，而是说调用方不需要理解和管理它的内部会话闭环。它可以依赖 NCP hook、React Query、纯工具函数和基础 UI 组件，但不能要求外层 page、workspace 或全局 manager 替它持有 draft、running、send、stop 这些实例状态。

`SessionConversationArea` 的内部闭环如下：

```text
SessionConversationArea(sessionKey)
  -> useNcpSessionConversation(sessionKey ?? undefined)
  -> useSessionConversationInputState(sessionKey)
  -> useSessionConversationInputQuery(sessionKey, inputState)
  -> useSessionConversationController(conversation, inputState, inputQuery)
  -> SessionConversationMessages(messages/run state)
  -> SessionConversationInput(input state/query/controller)
```

边界规则：

- 外部只提供业务事实：`sessionKey`。`null` 表示主会话草稿，具体 id 表示已有主会话或 child session。
- 外部只处理外壳动作：例如草稿 materialize 后切换路由、右栏 header、workspace 布局。
- 组件内部拥有会话实例状态：composer nodes、draft、attachments、selected skills、selected model、thinking、sendError、sending、stop 状态。
- 组件内部拥有会话动作：发送、停止、附件写入、composer token 变化、输入面板 trigger 变化。
- 组件内部按 `sessionKey` 查询当前会话需要的 session、model、skill、context window，不读全局 `selectedSessionKey` 作为事实来源。
- 消息 tool action、文件打开、panel app card 点击这类 app shell 动作可以继续通过现有 presenter/manager 处理，因为它们不是输入闭环事实；如果后续发现 child session 需要不同 workspace parent，再单独设计 workspace owner，不把它塞进输入组件。

换句话说，外层复用方式应该永远保持简单：

```tsx
<SessionConversationArea sessionKey={activeSessionKey} />
```

而不是：

```tsx
<SessionConversationArea
  areaKey="workspace-child-session"
  inputStore={...}
  runManager={...}
  selectedSessionKey={...}
/>
```

后者看起来是“可配置”，实际是把组件内部 owner 泄漏给调用方。

## 单路径迁移原则

这次不能做“主会话继续走 presenter 旧 manager，child session 走新 area owner”的双轨结构。双轨看起来改动小，实际会留下两套输入、两套运行态和两套 send/stop 路径，后续每个输入插件、附件、模型选择和 stop bug 都要判断命中了哪条路径。

最终合并态必须满足：

- `ChatPresenter` 不再 import / new / expose `ChatInputManager` 和 `ChatRunManager`。
- `ChatPresenterProvider` 的公开合同不再包含 `chatInputManager` / `chatRunManager`。
- `NcpChatPage` 不再把 route conversation 绑定到 `ChatRunManager.activeRuntime`，也不再通过 `applyRunSnapshot` 镜像消息和运行态到全局 store。
- `ChatInputBarContainer` 不再从 presenter 读取 input manager；输入区连接 `SessionConversationArea` 内部 owner。
- 主会话和右侧栏 child session 都走 `SessionConversationArea -> useNcpSessionConversation -> area-local input/run owner -> ChatInputBar` 这一条路径。
- 旧 manager 的测试不能作为长期保留理由；迁移后改成验证 area-local owner 和组件行为。

实现过程可以按小步提交，但每个可合并阶段都不能留下两个可运行主链路。若某一步需要临时过渡，只能在本地开发过程中存在，不能作为方案完成态。

## 目标

第一期目标：

- 主会话 header 以下区域由 `SessionConversationArea` 承载。
- 右侧栏 child session 使用同一个 `SessionConversationArea`。
- 子代理右栏可以继续输入并发送到对应 child session。
- 主会话和子会话 draft、sendError、isSending、stop 互相隔离。
- 消息展示、sticky scroll、输入框、输入面板插件、发送、停止走同一套组件内部链路。
- 不引入子代理专用协议；继续使用 NCP session send/envelope 合同。

本次完成态目标：

- `ChatThreadStore` 不再作为消息和运行态事实 owner，只保留当前主会话、workspace、导航和布局状态。
- 当前全局 `ChatInputStore` / `ChatInputManager` / `ChatRunManager` 不再作为主对话区域链路存在；本次改造完成态必须从 `ChatPresenter` 上移除 `chatInputManager` / `chatRunManager`。
- `SessionConversationArea` 成为后续任意嵌入式会话、panel app 会话和多会话并排的统一入口。

## 非目标

第一期不做：

- 不把子代理继续对话的结果自动合并回父会话。父子会话协作仍通过 NCP/session orchestration 语义表达。
- 不支持无限嵌套的 workspace 右栏。child session 内再产生 child session 时，先沿现有 tool action 行为处理，嵌套导航另行设计。
- 不改 NCP 协议，不新增 child-session 专用发送接口。
- 不重做整个 chat page 布局，也不把 header、sidebar、workspace panel 都塞进 `SessionConversationArea`。
- 不把组件内部状态提升到全局 manager 注册表。

## 技术难点

### 1. 输入状态要组件自包含

当前 `ChatInputStore.snapshot` 是全局唯一。右栏子会话如果直接使用现有 `ChatInputBarContainer`，会共享主会话 draft。

推荐做法：

- `SessionConversationArea` 内部使用 local reducer 或局部 hook 管理输入状态。
- 输入状态包含 composerNodes、attachments、selectedSkills、selectedModel、selectedThinkingLevel、sendError、isSending、focus request 等。
- 初始值可以复用现有 `createInitialChatComposerNodes`、composer derive/sync utilities。
- 组件卸载时默认释放本地输入状态。
- 如果需要 tab 切换保留草稿，可以在 `features/conversation` 内部维护一个 component-private draft cache，key 由 `sessionKey` 推导；这个 cache 不进入外部 props，也不归全局 manager 管。

示意：

```ts
function useSessionConversationInputState(params: {
  sessionKey: string | null;
}) {
  // local reducer / component-private cache
}
```

### 2. 发送和停止要直接绑定当前会话 hook

当前 `ChatRunManager` 通过单 active runtime 转发发送。这个模型不适合可复用组件。

推荐做法：

- `SessionConversationArea` 内部调用 `useNcpSessionConversation(sessionKey ?? undefined)`。
- 发送时在组件内部构造 NCP envelope，然后直接调用 `conversation.send(envelope)`。
- 停止时直接调用 `conversation.abort()`。
- existing session 的 `sessionId` 写入 envelope；`sessionKey === null` 时不写 sessionId，让底层创建新会话。
- 如果 `conversation.send` 返回新 session id，调用 `onSessionMaterialized(sessionId)`。

示意：

```ts
async function sendCurrentDraft() {
  const envelope = buildNcpRequestEnvelope({
    sessionId: sessionKey ?? undefined,
    text,
    attachments,
    parts,
    metadata,
  });
  const handle = await conversation.send(envelope);
  if (!sessionKey && handle?.sessionId) {
    onSessionMaterialized?.(handle.sessionId);
  }
}
```

这样 stop/send 都是组件实例自己的行为，不需要 `areaKey`。

### 3. 输入 query 需要按 props.sessionKey 推导

`useChatInputBarQueryState` 当前从 `useChatSessionListStore.snapshot.selectedSessionKey` 推导 selected session。右栏 child session 不应该依赖左侧当前选中项。

推荐改成新的局部 hook：

```ts
useSessionConversationInputQuery({
  sessionKey,
  inputState,
});
```

调整点：

- selected session 由传入 `sessionKey` 在 sessions query 中查找。
- session skills 使用 `useNcpSessionSkills({ sessionId: sessionKey || "draft-session" })` 直接按当前组件查询。
- model fallback、thinking fallback、sessionTypeState 都基于传入 session，而不是全局 selected session。
- shared config/providers/sessionTypes query 可以继续复用 React Query，不需要组件外层同步到全局 query store 后再读。

### 4. 消息和运行态事实要从 ChatThreadStore 下沉到组件

`ChatConversationContent` 当前读 `ChatThreadStore.snapshot.messages`。这让主会话消息成为全局事实，无法自然复用到 child session。

推荐 `SessionConversationArea` 自己从 `useNcpSessionConversation` 得到：

- visibleMessages
- isHydrating
- hydrateError
- isRunning
- isSending
- contextWindow
- send error

`ChatThreadStore` 保留：

- 当前主 route sessionKey。
- session header 所需元信息。
- workspace panel parent、tabs、active key、navigation history。

不再长期作为消息列表和发送运行态 owner。

### 5. 输入面板插件需要继续复用

刚改造过的输入面板插件机制不能被子会话绕开。新的 `SessionConversationArea` 不应该复用旧的全局 `ChatInputBarContainer`，但应复用底层纯 UI 和插件 hook：

- 复用 `ChatInputBar` 展示组件。
- 复用 composer utils。
- 复用输入面板插件 hook；现有实现名可以继续是 `useChatInputSurfaceState` / `input-surface-plugins`，但新方案不把 `surface` 作为对外概念。
- 复用 skill/model picker builder 中的纯构造函数。

需要避免：

- 不要让 input plugin 直接读全局主会话 snapshot。
- 不要让 child session 的 `/skill` 选择写进主会话 input store。

### 6. 并发运行与 stop 语义需要验证

前端可以同时挂载主会话和 child 会话两个 `useNcpSessionConversation`。已有测试证明 existing session send 使用当前 session 的 live stream，abort 也按 sessionId 调用。

仍需在实现阶段验证：

- 主会话运行中时，child session 是否允许独立发送。
- child session 运行中时，主会话 stop 不会停止 child。
- child session stop 只按 child sessionId abort。
- 如果底层 runtime 不允许同一 provider 并发，应显示明确 disabled/hint，而不是静默失败。

## 推荐结构

这次组件不只是一个展示片段，而是拥有自己的输入、消息、发送、停止和 query 连接。因此它已经是 `chat` 下稳定子能力，建议放到新的 conversation 子 feature：

```text
packages/nextclaw-ui/src/features/chat/features/conversation/
├── components/
│   ├── session-conversation-area.tsx
│   ├── session-conversation-input.tsx
│   └── session-conversation-messages.tsx
├── hooks/
│   ├── use-session-conversation-input-state.ts
│   ├── use-session-conversation-input-query.ts
│   └── use-session-conversation-controller.ts
└── utils/
    └── session-conversation-send.utils.ts
```

角色说明：

- `session-conversation-area.tsx` 是业务组件，对外只暴露 `sessionKey/welcomeSlot/onSessionMaterialized`。
- `session-conversation-input.tsx` 连接局部 input state、input query、输入面板插件和 `ChatInputBar`。
- `session-conversation-messages.tsx` 负责消息区布局、loading/empty/error/sticky scroll 与 `ChatMessageListContainer` 组合。
- `use-session-conversation-controller.ts` 是组件内部 controller hook，连接 NCP conversation、输入状态、发送/停止动作。
- `use-session-conversation-input-state.ts` 管局部 input reducer 或 component-private draft cache。
- `use-session-conversation-input-query.ts` 按传入 sessionKey 推导 session/model/skill/query 状态。
- `session-conversation-send.utils.ts` 放纯 envelope/metadata 构造逻辑，不持有 React 或 manager 状态。

原有目录调整：

- `components/conversation/` 继续保留页面级布局组件，例如 `ChatConversationPanel`、header section、parent banner、workspace section。
- `features/input/` 继续保留通用输入面板插件机制和底层 input helpers。
- `managers/chat-input.manager.ts`、`managers/chat-run.manager.ts` 不再作为 presenter 装配的全局 owner。可复用的纯逻辑迁到 `features/conversation` 或 `features/input` 纯工具；旧 manager 文件随调用方迁移同步删除。

## 之前的东西怎么处理

现有代码不应该被简单整段复制到新组件里，也不应该为了赶进度长期双轨运行。处理原则是：能复用纯逻辑就复用，能迁移 owner 就迁移，只有旧 owner 不再承载真实职责时才删除。

保留并复用：

- `ChatInputBar`：继续作为纯输入 UI，不读业务 store，不决定发送目标。
- `ChatMessageListContainer`：继续作为消息列表容器，第一期保留 tool action / file open / panel app card 的 app shell 集成。
- `features/input/input-surface-plugins/*`：作为现有输入面板插件实现继续保留，`/skill`、`@panel app` 都应通过这套机制接入。
- `chat-composer-state.utils.ts`、`chat-inline-token.utils.ts`、`chat-input-bar.utils.ts`、`ncp-chat-input-availability.utils.ts`：继续作为纯工具复用。
- `useNcpSessionConversation(sessionKey)`：成为 `SessionConversationArea` 的会话事实和发送/停止能力来源。
- `ChatConversationHeaderSection`、`ChatConversationParentBanner`、`ChatConversationWorkspaceSection`：继续留在外层 conversation panel，因为 header、父子关系提示、workspace 不是会话区域内部闭环。

改造或迁移：

- `ChatConversationPanel`：从“自己拼 alerts/content/input”改为“header 以下挂 `SessionConversationArea`”。
- `ChatConversationContent`：消息展示和 sticky scroll 逻辑迁入 `session-conversation-messages.tsx`，由 `useNcpSessionConversation` 结果驱动，不再读 `ChatThreadStore.messages`。
- `ChatConversationAlerts`：从读全局 `ChatInputStore.sendError` 改为由 `SessionConversationArea` 内部根据当前 conversation/input state 渲染，或合并进 `session-conversation-messages.tsx` / `session-conversation-input.tsx`。
- `ChatInputBarContainer`：拆出可复用的 labels/collections/toolbar 构造逻辑；新 `session-conversation-input.tsx` 直接连接局部 input state，不再通过全局 `ChatInputManager`。
- `useChatInputBarQueryState`：改成或旁路出 `useSessionConversationInputQuery`，以传入 `sessionKey` 为事实来源，不再从 `selectedSessionKey` 推导当前输入上下文。
- `NcpChatPage`：移除 `useChatRunRuntimeConnection` / `useChatRunSnapshotSync`，不再把 route conversation 绑定到全局 `ChatRunManager.activeRuntime`；页面保留 route、presenter provider、confirm dialog、query sync、draft intent 等外壳职责。
- `ChatSessionWorkspacePanelContent`：删除 `ChildSessionContent` 的只读消息区域，active child header 下直接挂 `SessionConversationArea`。
- `ChatPresenter` / `ChatPresenterProvider`：删除 `chatInputManager` / `chatRunManager` 字段和公开类型；`startAgentCreationDraft` 不再直接写 input manager，改为进入主会话草稿意图 owner，由 `SessionConversationArea` 消费。
- `ChatSessionListManager` / `ChatThreadManager`：移除对 `ChatRunManager.clearRunState` 的依赖；session 切换和删除只清 shell/workspace 状态，消息和运行态由 `SessionConversationArea` 按 `sessionKey` 挂载/卸载自然归位。
- `ChatConversationWelcome`：从调用 `presenter.chatInputManager` 改为调用当前 area input owner，欢迎页输入、prompt suggestion、project root、session type 都归 area-local draft state。
- `ChatInputStore` / `ChatInputManager` / `ChatRunManager`：不保留全局主链路。输入状态、send/stop、run snapshot mirror 迁入 `features/conversation` 后同步删除旧 owner。
- `ChatThreadStore`：长期不再保存消息列表和发送运行态；保留主会话选择、workspace tabs、当前预览、导航历史等 shell 状态。

同步删除：

- 当主会话与 child session 都不再使用 `ChatInputBarContainer` 时，删除它，保留已抽出的纯 builder/hook。
- 删除 `chat-input.manager.ts`，把仍有价值的 composer、attachment、selection 逻辑迁到 area-local owner 或纯工具。
- 删除 `chat-run.manager.ts`，把 envelope 构造、materialize route、stop scoped abort 迁到 `use-session-conversation-controller.ts` / `session-conversation-send.utils.ts`。
- 当 `ChatConversationContent` 和 `ChatConversationAlerts` 不再被引用时，删除旧文件和旧测试，避免保留两套消息/错误展示路径。
- 当 `ChatThreadStore.snapshot.messages/isSending/isAwaitingAssistantOutput/contextWindow` 没有消费者时，删除这些字段和相关同步逻辑。

不删除：

- 不删除 `ChatThreadManager.handleToolAction/openFilePreview`，因为它们仍是 workspace/app shell 行为 owner。
- 不删除输入面板插件机制，新的会话区域必须继续复用它。
- 不删除 NCP session conversation hook；它正是新组件自包含的底层事实来源。

## 推荐数据流

### 主会话

```text
NcpChatPage
  -> routeSessionKey
  -> ChatConversationPanel
  -> SessionConversationArea(sessionKey=routeSessionKey)
  -> useSessionConversationController(sessionKey)
  -> useNcpSessionConversation(routeSessionKey)
  -> local input state
  -> sendCurrentDraft()
  -> conversation.send(envelope)
  -> onSessionMaterialized(sessionId) when draft materializes
```

### 右侧栏子会话

```text
ChatSessionWorkspacePanelContent
  -> active child tab
  -> SessionConversationArea(sessionKey=activeChildSessionKey)
  -> useSessionConversationController(sessionKey)
  -> useNcpSessionConversation(sessionKey)
  -> local input state
  -> sendCurrentDraft()
  -> conversation.send(envelope)
```

## 组件边界

`ChatConversationPanel` 改造后只组合：

- `ChatConversationParentBanner`
- `ChatConversationHeaderSection`
- `SessionConversationArea`
- `ChatConversationWorkspaceSection`

其中 `SessionConversationArea` 内部包含：

- alerts
- welcome slot
- message list
- sticky scroll
- input bar
- send/stop binding
- run state display

右侧栏 `WorkspaceActiveChildHeader` 保留在 `ChatSessionWorkspacePanelContent` 里，作为子会话区域外部 header。其下方直接渲染 `SessionConversationArea`。右栏宽度、边框和滚动容器等布局差异由 workspace panel 外层容器负责。

## 文件级增改删清单

新增：

- `features/conversation/components/session-conversation-area.tsx`：会话区域唯一对外组件。
- `features/conversation/components/session-conversation-messages.tsx`：消息、loading、empty、error、sticky scroll。
- `features/conversation/components/session-conversation-input.tsx`：局部 input state/query/controller 到 `ChatInputBar` 的连接层。
- `features/conversation/hooks/use-session-conversation-input-state.ts`：局部 input reducer；必要时内部维护按 `sessionKey` 的 draft cache。
- `features/conversation/hooks/use-session-conversation-input-query.ts`：按当前 `sessionKey` 推导 session、model、skill、provider、context window 状态。
- `features/conversation/hooks/use-session-conversation-controller.ts`：绑定 conversation hook、send、stop、materialize、error 状态。
- `features/conversation/utils/session-conversation-send.utils.ts`：纯 envelope / metadata / message parts 构造逻辑。
- 对应定向测试：input state、input query、controller、area 组件、workspace child 渲染。

改造：

- `components/conversation/chat-conversation-panel.tsx`：保留 header/banner/workspace，header 以下改挂 `SessionConversationArea`。
- `components/conversation/chat-conversation-content.tsx`：逻辑迁到 `session-conversation-messages.tsx` 后删除旧引用。
- `components/conversation/chat-conversation-alerts.tsx`：错误展示迁到 area 内部，按当前会话实例渲染。
- `features/workspace/components/chat-session-workspace-panel-content.tsx`：`ChildSessionContent` 改为复用 `SessionConversationArea`。
- `features/input/components/chat-input-bar.container.tsx`：先抽纯 builder/labels/collections，后续不再作为主链路 container。
- `features/input/hooks/use-chat-input-bar-query-state.ts`：提取成可按 `sessionKey` 查询的 hook，旧全局 `selectedSessionKey` 入口同步删除。
- `pages/ncp-chat-page.tsx`：同步移除 run snapshot mirror 和 active runtime 绑定。
- `presenters/chat.presenter.ts`：同步删除 `ChatInputManager` / `ChatRunManager` import、字段和装配；`ChatSessionListManager` / `ChatThreadManager` 构造参数随之收敛。
- `components/providers/chat-presenter.provider.tsx`：同步删除 `chatInputManager` / `chatRunManager` 类型暴露。
- 相关测试：从断言全局 input/run store，改为断言 `SessionConversationArea` 的实例隔离和 session-scoped send/stop。

删除：

- `ChildSessionContent` 内联组件：右侧栏不再有只读 child conversation 专用路径。
- `ChatConversationContent`：迁移完成且无引用后删除。
- `ChatConversationAlerts`：迁移完成且无引用后删除。
- `ChatInputBarContainer`：主会话与 child 都迁移到 `session-conversation-input.tsx` 后删除。
- `chat-run.manager.ts`：不再有 presenter 装配或调用方后删除文件及旧测试。
- `chat-input.manager.ts`：输入草稿、composer、send、stop、selection 职责迁入 area-local owner 后删除文件及旧测试。
- `ChatThreadStore` 中消息和运行态字段：无消费者后删除。

## 实施顺序

1. 抽出 `features/conversation` 子 feature，先创建 `SessionConversationArea` 的空骨架和消息展示组件。
2. 把当前 `ChatConversationContent` 的消息展示逻辑迁入 `session-conversation-messages.tsx`，由 conversation hook 驱动，不再读 `ChatThreadStore.messages`。
3. 抽出 `ChatInputBarContainer` 里的纯 labels / collections / toolbar builder，避免新组件复制一份输入 UI 组装逻辑。
4. 新增 `useSessionConversationInputState`，复用现有 composer utils，先支持文本、skill token、panel-app token 和附件状态。
5. 新增 `useSessionConversationInputQuery`，按 `sessionKey` 推导 session/model/skill 状态。
6. 新增 `useSessionConversationController`，在组件内部绑定 `useNcpSessionConversation`、send、stop、materialize callback。
7. 新增 `session-conversation-input.tsx`，直接使用 `ChatInputBar` 和输入面板插件，不依赖旧 `ChatInputBarContainer`。
8. 主会话改为 `ChatConversationPanel -> SessionConversationArea`，同时从 `NcpChatPage` 移除 `ChatRunManager` runtime 绑定和 snapshot mirror。
9. 右侧栏 child session 复用同一个 `SessionConversationArea`，删除 `ChildSessionContent` 的只读消息展示路径。
10. 删除 `ChatPresenter` / `ChatPresenterProvider` 上的 `chatInputManager` / `chatRunManager`，并同步收敛 `ChatSessionListManager`、`ChatThreadManager` 的 clear run state 依赖。
11. 删除旧 `ChatInputManager`、`ChatRunManager`、`ChatInputStore` 中已无消费者的输入/运行态字段，以及对应旧测试；保留的测试必须迁到新 area-local owner。

## 备选方案与取舍

### 方案 A：只给右侧栏 child session 加一个局部输入框

优点：实现最快。

缺点：

- 会制造第二套输入/发送链路。
- `/skill`、`@panel app`、附件、模型选择、stop、错误展示都要复制或裁剪。
- 后续主会话和子会话能力容易漂移。

结论：不推荐。

### 方案 B：点击子代理后跳转到完整子会话页面继续聊

优点：几乎复用现有主会话链路。

缺点：

- 打断父会话上下文。
- 右侧栏作为工作台的价值消失。
- 用户期望是在父会话旁边继续和子代理协作。

结论：可作为临时兜底，不作为目标方案。

### 方案 C：全局 manager 管理 areaKey

优点：

- 能复用现有 manager 类和 store 结构。
- 比单 active runtime 更容易支持多个区域。

缺点：

- manager 会变成组件实例注册表。
- 外部复用组件时还要理解和传递 `areaKey`。
- 不符合“组件自包含”的目标。
- keyed singleton 仍然是全局状态，不是组件局部闭环。

结论：不推荐，已从推荐方案中移除。

### 方案 D：`SessionConversationArea` 自包含

优点：

- 外部复用最简单，只传 `sessionKey`。
- 输入、运行、send、stop 都归组件实例自己。
- 主会话和子会话天然隔离。
- 不新增业务协议，仍走 NCP session。
- 后续任意嵌入式 session 可以直接复用。

缺点：

- 需要从旧全局 manager/store 链路中抽出纯逻辑。
- 第一阶段 diff 会比 UI 补丁大，需要定向测试兜住。

结论：推荐。

## 验收标准

功能验收：

- 主会话发送、停止、模型/思考选择、skill 选择、附件、欢迎页输入保持原行为。
- 右侧栏打开 child session 后，可以在同一右栏继续输入并发送到该 child session。
- 主会话 draft 与 child session draft 互不影响。
- child session 正在发送时，主会话输入框不显示 child 的 sending/error。
- child session stop 只停止 child session。
- 关闭 child tab 后再次打开，不出现主会话 draft 污染。

测试验收：

- `useSessionConversationInputState` 单测覆盖本地 draft/attachments/skill tokens 隔离。
- `useSessionConversationInputQuery` 单测覆盖传入 child sessionKey 时使用 child session 偏好和 skills。
- `useSessionConversationController` 单测覆盖 existing session send、draft materialization、stop scoped abort。
- `SessionConversationArea` 组件测试覆盖 loading/empty/error/messages/input，并分别在主会话容器和右栏容器中挂载验证。
- `ChatSessionWorkspacePanelContent` 测试覆盖 child selection 渲染 `SessionConversationArea`。

工程验收：

- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui lint`
- 相关 Vitest 定向测试
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- maintainability guard/review

用户路径冒烟：

- 打开主会话，发送一条普通消息。
- 通过子代理工具打开右侧栏 child session。
- 在右侧栏 child session 继续发送一条消息。
- 确认消息出现在 child session，不切换主路由，不污染主输入框。

## 风险与待确认问题

- 底层 runtime 是否允许同一时间多个 session 并发运行，需要用真实 NCP runtime 冒烟确认。
- child session 使用哪一组 session skills：推荐按 child session 自己查询，若后端对 child session skills 返回不足，需要补 API 行为。
- 右栏输入区是否需要更紧凑的视觉。建议第一期完整复用同一套 `SessionConversationArea`，不暴露 layout prop；如后续确有差异，再以明确的视觉需求新增配置。
- child session 内 tool action 打开文件或再打开 child session 时，workspace owner 是否需要支持以 child session 为 parent 的嵌套 tabs。第一期不作为继续对话阻塞项，但需要记录后续设计。
- 组件卸载后是否保留 child draft，需要产品确认。默认自包含 local state 会随卸载释放；如果需要保留，使用 conversation 子 feature 内部的 component-private draft cache，而不是外部 `areaKey`。

## 设计原则依据

- `classic-software-design-principles: information-expert`：消息、运行态和输入状态应归具体 `SessionConversationArea` 实例，而不是由路过的主页面或全局 manager 代持。
- `classic-software-design-principles: single-domain-owner`：避免主会话一套输入链路、子会话另一套临时输入链路。
- `mvp-view-logic-decoupling`：页面/layout 只组合区域，业务组件直接连接 query 和局部 controller；不要让 page 继续组装宽 prop bag。
- `writing-beautiful-code: semantic-responsibility-names`：使用 `SessionConversationArea` 表达真实业务职责，避免 `Surface` 这类过虚命名。
- `writing-beautiful-code: simplest-shape-first`：外部不传 `areaKey`，不新增全局多实例 registry；组件内部闭合状态和行为。
- `kernel-branch-owner-architecture: responsibility-closure`：`SessionConversationArea` 需要覆盖自己的消息、输入、发送、停止闭环，不能只是包装全局 manager 的空心 UI。
- `collapsible-feature-root-architecture`：会话区域已经拥有组件、hooks、utils 和复用边界，适合成为 `chat/features/conversation` 子 feature。
