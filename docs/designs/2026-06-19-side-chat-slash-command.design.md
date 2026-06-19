# Side Chat Slash Command 设计

## 背景

输入区已经改造成 input surface 插件机制，`/` 和 `@` 都通过同一套触发式面板运行。下一步需要让 `/` 面板不只是 skill 选择器，而是正式成为 slash command 面板。

第一个 command 是 `Side chat`：用户在已有会话里通过 `/side chat` 打开右侧空会话界面，这个会话继承父会话上下文，但在用户发送第一条消息前不创建真实后端 session。

## 现状依据

- `packages/nextclaw-agent-chat-ui/src/lib/input-surface/input-surface-plugin.utils.ts` 已提供 generic input surface plugin，`/` skill 是其中一个插件。
- `packages/nextclaw-ui/src/features/chat/features/input/input-surface-plugins/skill-reference-plugin.utils.ts` 目前把 slash trigger 绑定到 skill reference token。
- `packages/nextclaw-ui/src/features/chat/features/conversation/components/session-conversation-area.tsx` 已支持 `sessionKey=null` 的 draft conversation，普通新会话会在首条消息发送后 materialize。
- `packages/nextclaw-ui/src/features/chat/stores/chat-thread.store.ts` 和 `ChatThreadManager` 是右侧 workspace panel 的状态和动作 owner。
- `packages/nextclaw-kernel/src/managers/agent-run-request.manager.ts` 是 `agentRun.send` materialize session 的主路径。
- `packages/nextclaw-kernel/src/managers/session.manager.ts` 已支持 `parentSessionId`、`sourceSessionId` 和 `contextInheritance` 创建继承父上下文的 child session。

## 核心判断

`Side chat` 应建模为前端 workspace draft，而不是伪造 child session。

slash 面板应先展示 `Commands`，再展示 `Skills`。选择 skill 是插入文本 token；选择 command 是执行动作，不向 composer 插入任何文本。两者共用同一个 `/` trigger 和同一个 input surface host。

首条消息 materialize 时应走现有 `agentRun.send` 主链路，由后端在当前 session 创建 owner 中创建真实 child session。不能新增平行 API，也不能复用 `sessions_spawn`，因为 `sessions_spawn` 是 AI/tool path，会立即创建 session。

## 推荐方案

### Slash 面板

新增一个 slash command input surface plugin：

```ts
createSlashCommandInputSurfacePlugin({
  commands: [
    {
      key: "side-chat",
      title: t("chatSlashCommandSideChatTitle"),
      onSelect: () => chatThreadManager.openSideChatDraft(),
    },
  ],
});
```

插件返回的 command item 不带 `tokenKind`、`tokenKey`、`value`，因此 composer 不插入 token，只调用 selection handler。

插件注册顺序固定为：

```text
Commands
Skills
Panel apps(@ 独立 trigger)
```

这里的 “Commands 在 Skills 前” 是 `/` 面板产品合同，不能靠排序巧合实现。

### Side chat draft

在 `ChatThreadStore` 中增加非持久 draft 状态：

```ts
type ChatWorkspaceSideChatDraft = {
  draftKey: string;
  parentSessionKey: string;
};
```

draft 只存在于当前前端运行态，不进入 persist payload，不进入 `childSessionTabs`。真实 child session 仍然只来自后端 session summary 的 `parentSessionId` 或 manager 显式 upsert 的真实 session key。

### Workspace 展示

`ChatThreadManager.openSideChatDraft()`：

1. 读取当前选中的父 session。
2. 写入 `workspacePanelParentKey`。
3. 设置 `activeWorkspacePanelKind="side-chat-draft"`。
4. 写入 `activeSideChatDraft`。
5. 保持主路由停留在父 session。

workspace panel 增加 draft selection。draft content 复用 `SessionConversationArea`，传入：

```tsx
<SessionConversationArea
  sessionKey={null}
  materializationContext={{
    kind: "child",
    parentSessionKey: draft.parentSessionKey,
    inheritContext: true,
  }}
  onSessionMaterialized={chatThreadManager.materializeSideChatDraft}
/>
```

side chat draft 不展示欢迎页 hero，只展示右侧会话界面、继承提示和输入框。

### 首条消息 materialize

`SessionConversationArea` 和 `useSessionConversationController` 增加 `materializationContext`：

```ts
type SessionConversationMaterializationContext = {
  kind: "child";
  parentSessionKey: string;
  inheritContext: true;
};
```

发送时，如果 `sessionKey=null` 且存在 child materialization context，则把规范 metadata 写入 envelope：

```ts
metadata.session_materialization = {
  kind: "child",
  parentSessionId: parentSessionKey,
  inheritContext: true,
};
```

`AgentRunRequestManager` 在 `agentRun.send` 边界解析该 metadata，并把创建参数交给 `SessionManager.getOrCreateAgentRunSession`。`SessionManager.createAgentRunSession` 再调用现有 `createSession`：

```ts
createSession({
  sourceSessionId: parentSessionId,
  sourceSessionMetadata: parent.metadata,
  parentSessionId,
  contextInheritance: {},
  ...
});
```

这样后端 session 创建、context inheritance、session summary 更新仍归同一个 owner。

### Draft 升级

首条消息发送成功后，前端拿到 `materializedSessionKey`：

1. 清掉 `activeSideChatDraft`。
2. upsert 真实 child tab。
3. 设置 `activeWorkspacePanelKind="child-session"`。
4. 设置 `activeChildSessionKey=materializedSessionKey`。
5. 主路由继续停留在父 session。

## Owner 与数据流

```text
Slash command plugin
  -> command selection
  -> ChatThreadManager.openSideChatDraft
  -> ChatThreadStore.activeSideChatDraft
  -> ChatSessionWorkspacePanel
  -> SessionConversationArea(sessionKey=null, child materialization context)
  -> agentRun.send metadata.session_materialization
  -> AgentRunRequestManager
  -> SessionManager.createSession(parent + inheritance)
  -> materialized session id
  -> ChatThreadManager.materializeSideChatDraft
  -> real child session tab
```

职责边界：

- input surface core：只负责 trigger、panel 和 selection command，不知道业务。
- slash command plugin：只负责把 command item 变成 command action。
- `ChatThreadManager`：负责 workspace draft 状态和 materialized child tab 升级。
- `SessionConversationArea`：负责复用会话 UI 和发送 controller。
- `AgentRunRequestManager`：负责 `agentRun.send` materialization 边界归一化。
- `SessionManager`：负责 session 创建、父子关系和 context inheritance。

## 目录组织

- 方案文档：`docs/designs/2026-06-19-side-chat-slash-command.design.md`。
- slash command plugin：放在 `packages/nextclaw-ui/src/features/chat/features/input/input-surface-plugins/*.utils.ts`，因为它是无状态 input surface plugin builder。
- side chat draft 类型和状态：放在 `packages/nextclaw-ui/src/features/chat/stores/chat-thread.store.ts`。
- workspace draft 展示：复用现有 workspace components，不新增新的 feature root。
- materialization metadata contract：放在 `@nextclaw/shared`，因为 UI 和 kernel 都要依赖同一个协议字段。

## 兼容与迁移

- 旧 skill token 插入不变。
- `@` panel app reference 不变。
- 普通新会话 materialize 不变。
- `sessions_spawn` 不变。
- 未提交的 side chat draft 不持久化，刷新后自然消失。
- 如果当前没有真实父 session，`Side chat` command 不展示，避免从 root draft 创建无父继承。

## 非目标

- 不做多个未提交 side chat draft 并存。
- 不做 draft 跨刷新恢复。
- 不新增独立后端 API。
- 不把 `Side chat` 做成可发送文本命令。
- 不改变 skill 和 panel app 的文本 token 协议。
- 不实现 AI 问答面板插件，这只作为 input surface 机制未来可覆盖的方向。

## 验收标准

- `/` 面板中 `Commands` 分组排在 `Skills` 分组前。
- 选择 `Side chat` 不向输入框插入文本，只打开右侧 draft 会话。
- draft 打开后后端 session 列表不新增 session。
- draft 右侧显示继承父会话上下文提示。
- draft 首条消息发送后创建真实 child session，继承父会话上下文。
- materialize 后右侧 draft 升级为真实 child session，主会话路由保持父 session。
- 现有 skill token 选择、`@` panel app reference、普通新会话首条消息 materialize 行为不回归。
- TypeScript、定向单测、相关 lint/governance 和贴近链路的冒烟验证通过。
