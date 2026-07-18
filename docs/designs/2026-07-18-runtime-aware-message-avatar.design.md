# 会话消息 Runtime 头像设计

## 背景

当前 AI 消息统一显示固定 Bot 头像，用户无法从消息流直接感知当前会话由 Native、Claude Code、Codex、Hermes 或其他 Agent runtime 执行。会话类型目录已经提供 runtime label 与 icon，这份事实应进入消息身份展示。

## 现状依据

- `ChatConversationContent` 已持有当前消息表面的 `sessionKey`；`ChatMessageListContainer` 是 NextClaw 消息业务容器，可据此读取该表面对应的会话事实。
- `@nextclaw/agent-chat-ui` 是业务无关的可复用聊天 UI，当前由 `ChatMessageAvatar` 统一拥有头像框、尺寸和默认 Bot。
- `sessionTypesQuery` 是 runtime 展示信息的现有事实源，`SessionContextIconNode` 已统一处理 app resource URI、图片展示和加载失败回退。
- 会话的 `sessionType` 是消息所属 runtime 的权威事实；会话内不需要为每条消息复制一份 runtime 图标元数据。

## 核心判断

遵循 `information-expert`、`layer-paradigm-fit` 与 `protected-variations`：NextClaw 容器负责把会话 runtime 映射为产品图标；通用聊天 UI 只提供最小 assistant 图标插槽，并继续拥有头像视觉结构和默认行为。

## 推荐方案

1. 为 `ChatMessageList` 增加可选的 `assistantAvatarIcon` React 插槽。
2. `ChatMessageAvatar` 在 assistant 头像框内优先渲染该插槽；未提供时继续渲染现有 Bot。
3. `ChatMessageListContainer` 从当前会话 `sessionType` 和 `sessionTypesQuery` 找到对应 icon，复用 `SessionContextIconNode` 传入消息列表。
4. 历史消息、流式消息和等待回复占位使用同一个 runtime 图标；用户和工具头像不变。

## Owner 与数据流

```text
ChatConversationContent.sessionKey
  -> session summary.sessionType
  + sessionTypesQuery.options
  -> ChatMessageListContainer
  -> ChatMessageList.assistantAvatarIcon
  -> ChatMessageAvatar assistant frame
```

- 会话内容表面：显式传递自己正在展示的 `sessionKey`，不依赖全局选中会话。
- NextClaw 消息业务容器：runtime 事实到产品图标的映射 owner。
- 通用聊天 UI：头像布局、尺寸和默认 Bot 的视觉 owner。
- 禁止通用聊天 UI 读取 NextClaw store、runtime registry 或 app resource 规则。

## 目录组织

- 不新增源码目录或 owner。
- 通用插槽留在 `packages/nextclaw-agent-chat-ui` 的现有消息列表组件。
- 产品映射留在 `packages/nextclaw-ui` 的现有消息业务容器。

## 兼容与迁移

- 插槽可选，其他 `ChatMessageList` 消费者无需迁移即可保持原 Bot。
- runtime 未声明 icon 时使用原 Bot。
- runtime icon 加载失败时由现有 `LogoBadge` 路径回退到 Bot，不增加第二套资源解析。

## 验收标准

- 有 icon 的 runtime：历史 assistant 消息、流式消息和等待回复头像均显示对应图片。
- 主会话、工作区子会话等并行消息表面均按各自 `sessionKey` 解析 runtime，不串用全局选中会话。
- Native 或无 icon runtime：保持清晰的 Bot fallback。
- 用户与工具头像不变。
- 通用聊天 UI 定向测试、NextClaw 容器测试、两个包的 `tsc`、NextClaw UI lint 与真实浏览器会话验证通过。

## 非目标

- 不修改 Agent 自定义头像、工具卡内 sub-agent 头像或会话列表头像语义。
- 不把 runtime 信息持久化到每条消息。
- 不新增 runtime 名称到图标的硬编码映射。

## 后续实现顺序

1. 扩展通用消息头像插槽并验证默认行为。
2. 在 NextClaw 消息容器连接现有 runtime 图标事实。
3. 验证 fallback、流式占位、真实页面与治理门禁。
