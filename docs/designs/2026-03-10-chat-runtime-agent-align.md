# Chat Runtime / Agent Alignment

## 背景

`nextclaw-ui` 当前 chat 前端核心逻辑已经明显偏重，复杂度主要集中在以下几个方面：

- `ChatPage` 同时承担 query 聚合、route/session 同步、runtime 绑定、manager/store 回填等多类职责。
- `useChatRuntimeController`（前身 `useChatStreamController`）一度承担 optimistic message、history hydrate、SSE 解析、session event 转换、run stop/resume、fallback reply、error/abort 语义。
- `@nextclaw/agent-chat` 当前更多被当作“消息事件容器”使用，而不是被真正当作通用 agent abstraction + runtime core 使用。

用户明确要求本次只关注 chat 核心 runtime：

- 流式管理
- 消息处理
- history hydrate
- send / stop / resume / abort
- run lifecycle

以下内容不作为本次重点：

- session list / sidebar
- route 外壳
- `chatUiManager`
- 纯 UI/交互样式

## 目标

本次目标不是继续在 `nextclaw-ui` 上叠局部 manager，而是两层同时收敛：

1. 让 `@nextclaw/agent-chat` 更通用，能支持 nextbot 这种“后端流式 + 宿主控制 session/run/meta”的场景。
2. 让 `nextclaw-ui` 的 chat runtime 对齐 `agent-kit` 的思路，只保留宿主特有的 adapter 逻辑。

补充原则（强约束）：

- 优先把能力沉到 `@nextclaw/agent-chat` 的通用抽象（event/type/controller/agent interface），而不是堆在业务 hook。
- 当 nextbot 场景发现通用层不支持时，默认动作是“先完善 `agent-chat`”，再做业务侧接入。
- 业务侧 (`nextclaw-ui`) 仅保留不可通用的宿主职责（路由、查询同步、后端 schema 投影）。

## 核心判断

### 1. 需要对齐的不只是 controller，而是 agent abstraction

`agent-kit` 的优雅之处，不只是 `AgentChatController` 本身，更在于：

- controller 只管理通用消息时序与运行状态；
- 可变能力通过 `agent` 抽象注入；
- tool / context / meta / beforeSend 等扩展能力通过抽象层进入 runtime。

对 nextbot 来说，真正需要对齐的是这个模型，而不是简单把当前 hook 改短。

### 2. nextbot 和 agent-kit 的主要差异不在“是否能对齐”，而在“差异应该落在哪一层”

nextbot 当前特殊点：

- tool 主要在后端执行；
- run 由后端管理，支持 reconnect / resume；
- 每次 send 带有宿主元数据，例如 `sessionKey`、`agentId`、`model`、`sessionType`、`requestedSkills`；
- history 与 active session 由宿主页面控制。

这些差异不应该继续散在 React hook 中，而应该沉到：

- `@nextclaw/agent-chat` 的通用扩展点；
- `nextclaw-ui` 的宿主 adapter。

## 实施方向

### A. 完善 `@nextclaw/agent-chat`

需要补足的能力：

1. 明确支持“宿主驱动”的 runtime 场景，而不只是假设前端直接持有一个简单 `IAgent.run(messages)`。
2. 允许 agent/provider 在 run 时接收宿主元数据或扩展上下文。
3. 保持 controller 作为消息真源，不让宿主再次在外部复制一份消息状态机。

预期结果：

- `@nextclaw/agent-chat` 能够自然承接 nextbot 的后端 SSE agent；
- 后续其他场景也能复用，而不是只为 nextbot 私有定制。

### B. 在 `nextclaw-ui` 中收敛 runtime adapter

保留 page shell 对以下内容的控制：

- route
- selected session
- sessions query
- history query

收敛到 runtime/agent adapter 的内容：

- stream ready / delta / session_event / final / error 解析
- optimistic message
- history -> `UIMessage` 投影
- send / stop / resume / abort
- backend run state
- fallback reply / abort / error 语义

## 推荐结构

### Runtime Adapter 定义（明确边界）

`runtime adapter` 指的是位于“后端流接口”与“`AgentChatController` 消息核心”之间的翻译层。

职责：

- 调用后端流接口（send / resume / stop）。
- 将 `ready / delta / session_event / final / error` 统一转换为 controller 可消费的事件/消息更新。
- 统一维护 send / stop / resume / abort 的时序语义。
- 承载 nextbot 宿主元数据注入（`sessionKey`、`agentId`、`model`、`sessionType`、`requestedSkills`）。

非职责：

- 不负责 session list、sidebar、route 外壳。
- 不负责 `chatUiManager` 之类页面导航逻辑。
- 不负责纯 UI 展示样式与交互细节。

### `packages/nextclaw-agent-chat`

- 补通用扩展点
- 保持 `AgentChatController` 作为消息与事件汇聚中心
- 明确 agent/provider 层是扩展边界

### `packages/nextclaw-ui`

- 新增 nextbot 专属 agent/runtime adapter
- 该 adapter 负责：
  - 调后端 `/api/chat/turn/stream`
  - 调后端 `/api/chat/runs/:runId/stream`
  - 调后端 stop API
  - 将后端事件转换为 `AgentEvent`
  - 对接 history hydrate

- `useChatRuntimeController` 变成薄 hook，只负责：
  - 订阅 controller/runtime state
  - 暴露现有页面所需接口

## 本次改造边界

本次允许改动：

- `packages/nextclaw-agent-chat`
- `packages/nextclaw-ui/src/components/chat/useChatRuntimeController.ts`
- `packages/nextclaw-ui/src/components/chat/chat-stream/*`
- 新增 nextbot chat runtime/agent adapter

本次暂不处理：

- session list 架构
- `chatUiManager`
- 页面壳层路由设计
- chat 纯 UI 组件层重构

## 验收标准

1. `useChatRuntimeController` 显著变薄，核心状态机尽可能回收至 `AgentChatController + IAgent` 主链。
2. SSE / history / run lifecycle 不再散在多个局部函数中。
3. `@nextclaw/agent-chat` 的抽象比当前更适合“后端流式 agent”场景。
4. `nextclaw-ui` 仍保持当前页面壳层行为，session list 与 UI 外围不被大范围牵动。

## 像素级对齐清单（agent-kit）

已对齐：

- 主链路对齐为 `AgentChatController -> IAgent.run()`，不再把发送主流程放在独立 runtime 状态机类中。
- nextbot SSE 适配集中在 `NextbotRuntimeAgent`，职责与 `agent-kit` 的 `mapped-http-agent` 一致（后端事件 -> `AgentEvent`）。
- 发送入口改为走 controller 语义（`handleSendMessage` / `runAgent` / `abortAgentRun`），不再使用 runtime 私有 `sendMessage` 状态机。

不能完全照抄（必须保留差异）：

- **后端 stop 依赖 ready/runId**：nextbot 的 stop API 依赖后端 `runId`。本轮已通过 `RUN_METADATA(kind=ready)` 在通用事件通道传递该信息，不再使用额外 side-channel listener。
- **history 来源是后端 session schema**：nextbot 需要把后端 `SessionMessageView`（含 `reasoning_content/tool_calls`）投影成 `UIMessage`，这层转换在通用 `agent-kit` 中并不存在。
- **session 路由与 refetch 由宿主控制**：nextbot 需要在 send/resume/final 后同步 `selectedSessionKey` 与 `sessions/history` 查询，这属于宿主页面职责，不应塞回通用 controller。

## 本轮落地（2026-03-10）

- 已将“后端 stop run”从 hook 下沉到 `NextbotRuntimeAgent.abortRun()`：
  - agent 内部在 `RUN_METADATA(kind=ready)` 阶段记录后端 `runId/stopSupported/sessionKey/agentId`；
  - 外部仅调用 `AgentChatController.abortAgentRun()`；
  - agent 侧负责同时执行本地流 abort + 后端 stop API。
- `@nextclaw/agent-chat` 已补 run 生命周期通用能力：
  - `EventType.RUN_METADATA`
  - `RUN_STARTED/RUN_FINISHED/RUN_ERROR` 统一支持 `runId?: string`
  - `AgentChatController` 新增 `activeRunId$ / isAwaitingResponse$ / runCompleted$ / runError$ / runMetadata$`
- `nextclaw-ui` 已完成 runtime 收敛：
  - `useChatRuntimeController` 薄化为订阅 + action 转发；
  - run 编排、stop 状态、error 恢复、history hydrate 下沉到 `ChatRunLifecycleManager`；
  - 后端流解析集中在 `NextbotRuntimeAgent`（`AgentEvent` 主通道）。
- 同类问题复盘结论：凡是“运行态控制信息”（runId/stop 能力/中断语义）优先收敛到 agent/controller；UI hook 不直接持有 transport stop 逻辑。
