# NextClaw 核心架构

本文档描述当前有效的主执行架构。2026-04-11 起，NextClaw 的主执行链已经统一收敛到 NCP，不再存在 `AgentLoop` / `NativeAgentEngine` 这条旧执行主链。

---

## 1. 包与分层

```text
packages/
├── nextclaw-core (@nextclaw/core)     # 核心基础设施：消息总线、路由、配置、Provider、会话、通道
├── nextclaw (CLI)                     # 进程入口：CLI、Gateway、Service、NCP 装配
├── nextclaw-server (@nextclaw/server) # HTTP/WebSocket 服务（UI 后端）
├── nextclaw-ui (@nextclaw/ui)         # 前端 UI
└── extensions/
    ├── nextclaw-channel-extension-*   # 渠道 extension 包，通过 manifest 贡献渠道
    ├── nextclaw-ncp-runtime-codex-sdk
    ├── nextclaw-ncp-runtime-claude-code-sdk
    ├── nextclaw-narp-runtime-codex-sdk
    └── nextclaw-narp-runtime-claude-code-sdk
```

- `nextclaw-core` 只保留基础设施与共享模型，不承担具体 agent 推理循环。
- `nextclaw` 负责把 `MessageBus`、`SessionManager`、`ProviderManager`、工具能力与 NCP backend 装配起来。
- 真正的 agent 执行统一通过 `createUiNcpAgent(...)` 产出的 NCP backend 完成。

---

## 2. 统一消息流

```text
[ 各渠道 ] -> Channel / Gateway -> bus.publishInbound(msg)
                                   |
                                   v
                         runGatewayInboundLoop(...)
                                   |
                                   |- AgentRouteResolver.resolveInbound()
                                   `- runPromptOverNcp(...)
                                              |
                                              v
                                   NCP session + run + event stream
                                              |
                        +---------------------+----------------------+
                        |                                            |
                        v                                            v
              bus.publishOutbound(delta/reset/final)        SessionManager 持久化会话
                        |
                        v
                ChannelManager.dispatchOutbound()
                        |
                        v
                    [ 各渠道 ]
```

- 入站消息统一先进 `MessageBus`。
- Gateway 主循环直接调用 `runGatewayInboundLoop(...)`，不再额外经过 runtime pool class。
- 最终执行、工具调用、上下文构建、会话写入都在 NCP backend 内部完成。

---

## 3. 核心抽象

### 3.1 MessageBus

- `publishInbound()` / `consumeInbound()`：Gateway 主循环消费。
- `publishOutbound()` / `consumeOutbound()`：`ChannelManager` 统一出站。
- 控制消息仍走同一条 outbound 队列，例如 assistant stream reset / delta / typing stop。

### 3.2 AgentRouteResolver

- 根据 `channel`、`chatId`、`accountId`、binding 与 session override 解析：
  - `agentId`
  - `accountId`
  - `sessionKey`
- 这是 Gateway 侧唯一的“把消息送到哪个 session / agent”决策点。

### 3.3 Gateway Runtime Helpers

Gateway 相关的旧 runtime pool 已删除，当前只保留两类薄 helper：

- `runGatewayInboundLoop(...)`
  - `consumeInbound()`
  - 路由解析
  - `runPromptOverNcp(...)`
  - 把 delta / final reply 回写到 outbound bus
- `dispatchPromptOverNcp(...)`
  - 供 CLI、extension bridge 等 direct prompt 场景复用
  - slash command 优先执行
  - 本质上仍然是“一次 NCP run”

### 3.4 NCP Backend

`createUiNcpAgent(...)` 是当前唯一执行核心，内部装配：

- `DefaultNcpAgentBackend`
- `NextclawAgentSessionStore`
- `NextclawNcpContextBuilder`
- `NextclawNcpToolRegistry`
- `ProviderManagerNcpLLMApi`
- kernel 内置 agent runtime provider（`native` / `narp-http` / `narp-stdio`）

它对外暴露：

- `runApi`
- `sessionApi`
- `agentClientEndpoint`
- `assetApi`

### 3.5 runPromptOverNcp

这是 NextClaw 侧统一的直接执行 helper，负责：

- 组装 user message
- 本地附件通过 `assetApi.put(...)` 资产化
- 调 `runApi.send(...)`
- 消费 NCP event stream
- 产出 delta 与最终 assistant message

CLI agent、Gateway direct dispatch、后续任何非 UI 的直接执行入口，都应复用它。

### 3.6 ChannelManager / BaseChannel

- `ChannelManager` 仍负责多通道启动与 outbound 分发。
- 通道层不关心底层是哪个 LLM 或哪个 runtime，只消费统一的 `OutboundMessage`。

### 3.7 SessionManager

- 会话底层仍由 `SessionManager` 持久化到本地 JSONL。
- NCP session store 负责把 NCP session/message 读写映射到 `SessionManager`。
- 这意味着“执行核心换成 NCP”并不要求同步重做 session 存储。

---

## 4. Gateway / CLI / UI 的关系

### 4.1 UI Chat

- UI 早已基于 NCP agent endpoint。
- 当前继续复用同一个 `UiNcpAgentHandle`。

### 4.2 Gateway Inbound

- 渠道消息进 `MessageBus`
- `runGatewayInboundLoop(...)` 调 `runPromptOverNcp(...)`
- 通过 outbound bus 把流式与最终回复送回通道

### 4.3 CLI Agent

- `nextclaw agent` 不再直接 new 本地 loop
- CLI 现在也会创建同一套 `UiNcpAgentHandle`
- 单轮与交互式都走 NCP session + run

### 4.4 Extension Runtime Bridge

- Extension runtime 通过 `dispatchPromptOverNcp(...)` 进入统一调度入口
- 不再经过 runtime pool 或旧 loop 中间层

---

## 5. 扩展点

- `ExtensionRegistry.tools`
  - 注入工具能力
- `ExtensionRegistry.channels`
  - 注入通道能力
- `agents.runtimes.entries`
  - 配置可选的 agent runtime entry；具体 provider 由 kernel 注册

当前长期方向是继续围绕 kernel 注册的 runtime provider 与配置化 runtime entry 扩展，而不是恢复第二套 engine、runtime pool 或旧注册模型。

---

## 6. 小结

| 层次 | 职责 |
|------|------|
| `nextclaw-core` | 总线、路由、配置、Provider、通道、会话、扩展基础类型 |
| `nextclaw` | CLI / Gateway / Service 装配，NCP backend 创建，direct dispatch helper，配置重载 |
| `NCP backend` | 上下文构建、工具调用、模型执行、事件流、会话落盘 |
| `ChannelManager` | 统一把 outbound message 送回外部渠道 |

当前架构已经从“单进程、多执行中间层”进一步收敛成“单进程、单执行核心（NCP）、多入口复用同一执行合同”。
