# NextClaw 通用通信协议头脑风暴（2026-03-11）

## 核心愿景

NextClaw 不仅仅是"接入 Codex/Claude Code"，而是要成为一个 **通用通信中枢（Communication Hub）**。每个端点——无论是 Codex、Claude Code、飞书机器人、真人、邮箱——都是一个 Endpoint，NextClaw 和它们之间通过统一协议通信。

类比：**NextClaw 要做的事情类似于 Matrix 协议对聊天做的事，但面向的是 Agent + 人 + 协作平台的混合通信场景。**

## 实现边界决策

**选项 A（已确认）：NextClaw 后端是中枢，所有端点对接都在后端完成。前端只看到统一的消息流。**

## `@nextclaw/agent-chat` 已有的可复用基础

看完 `@nextclaw/agent-chat` 源码，以下设计已经很接近通用通信协议的雏形：

### 1. Parts-based 消息模型

`UIMessage` 不是纯文本，而是由多种 Part 组成：

- `TextUIPart` — 文本
- `FileUIPart` — 文件（带 MIME type）
- `ToolInvocationUIPart` — 工具调用
- `ReasoningUIPart` — 推理过程
- `SourceUIPart` — 来源引用
- `StepStartUIPart` — 步骤边界

这天然支持富内容，是通用协议消息结构的极佳基础。

### 2. 事件流模型

`Subscribable<AgentEvent>` 配合 delta 流式输出：

- **Text 流**：`TEXT_START → TEXT_DELTA → TEXT_END`
- **Reasoning 流**：`REASONING_START → REASONING_DELTA → REASONING_END`
- **Tool 生命周期**：`TOOL_CALL_START → TOOL_CALL_ARGS_DELTA → TOOL_CALL_END → TOOL_CALL_RESULT`
- **Run 生命周期**：`RUN_STARTED → RUN_FINISHED / RUN_ERROR`

### 3. Status 语义

`pending / streaming / final / error` — 对任何通信端点都适用。

### 4. AgentEventHandler 的状态累积模式

有状态的事件处理器，把低级 delta 事件重建为高级消息结构——可作为 Agent 类端点的参考实现。

## 从 Agent 专用到 Endpoint 通用：需要跨越的关键差距

### 差距 1：从 request-response 到双向异步

当前 `IAgent` 的核心抽象：

```typescript
interface IAgent {
  run: (input: RunAgentInput) => Subscribable<AgentEvent>;
}
```

隐含假设：通信是"我发一轮，对方回一轮"的 request-response 模式。

但飞书/钉钉/邮箱/真人的通信是**双向异步**的——对方可以主动发消息给你，可以延迟几小时回复，可以发多条消息。

核心抽象需要升级为 **双向消息通道**：

```typescript
interface Endpoint {
  // 发出去
  send(message: OutboundMessage): Promise<MessageReceipt>;
  // 收进来（订阅）
  incoming$: Observable<EndpointEvent>;
  // 能力声明
  manifest: EndpointManifest;
}
```

### 差距 2：从 Run 生命周期到 Message 生命周期

当前模型围绕 `Run`（一轮 agent 执行），但通用通信的原子单位是 **Message**，不是 Run。

| 端点类型 | 原子单位 |
|---------|---------|
| Agent (Codex/Claude) | 一个 Run 产生一条多 parts 的 assistant message（包含流式 delta） |
| 飞书 | 用户直接发一条 message，没有 Run 的概念 |
| 邮箱 | 一封邮件就是一条 message，可能很久才收到 |
| 真人 | 随时发，无 Run 概念 |

**结论**：Run 应该是 Agent 类端点**内部**的概念，协议层只关心 Message 的收发和状态。

### 差距 3：能力声明（Manifest）是关键

不同端点能力差异巨大：

| 能力 | Codex/Claude Code | 飞书 | 邮箱 | 真人 |
|------|-------------------|------|------|------|
| 流式输出 | yes | no | no | no |
| 富内容 (parts) | yes (tool, reasoning) | yes (卡片, 图片) | yes (附件, HTML) | yes (文字, 文件) |
| 主动推送 | no (被动响应) | yes | yes | yes |
| Tool 调用 | yes | no | no | no |
| 延迟回复 | 秒级 | 秒级-分钟级 | 小时级-天级 | 不确定 |
| Abort | yes | N/A | N/A | N/A |

协议必须声明这些能力，调用方根据 manifest 做适配：

```typescript
interface EndpointManifest {
  endpointKind: string;              // 'agent' | 'platform' | 'human' | 'email' | ...
  version: string;
  supportsStreaming: boolean;
  supportsToolCalls: boolean;
  supportsProactiveMessages: boolean;
  supportsAbort: boolean;
  expectedLatency: 'realtime' | 'seconds' | 'minutes' | 'hours' | 'days';
  supportedPartTypes: string[];      // 支持的消息 Part 类型
  sharedLevel?: 'minimal' | 'partial' | 'full';  // Agent 端点的共享等级
}
```

### 差距 4：Parts 模型需要扩展

当前 Parts 类型偏 Agent。通用协议的做法：**核心 Parts 保持精简，通过扩展机制支持不同端点类型**：

```
CoreParts（所有端点通用）:
  - text          — 纯文本
  - file          — 文件（带 MIME type）
  - source        — 来源引用
  - step-start    — 步骤边界标记

AgentParts（Agent 类端点扩展）:
  - reasoning     — 推理过程
  - tool-invocation — 工具调用

PlatformParts（协作平台端点扩展）:
  - card          — 卡片消息（飞书/钉钉）
  - rich-text     — HTML/Markdown 富文本
  - action        — 可交互按钮/表单
  - location      — 位置信息

ConversationParts（会话引用扩展）:
  - thread-ref    — 引用其他会话/消息
```

也可以通过 `ExtensionPart` 提供开放式扩展：

```typescript
interface ExtensionPart {
  type: 'extension';
  extensionType: string;   // 由端点自定义
  data: unknown;           // 自定义载荷
}
```

## 协议分层设计

```
┌─────────────────────────────────────────┐
│  L3: Capability Bridges                 │
│  （可选，只对 Agent 端点有意义）            │
│  Tool Bridge / Memory Bridge /          │
│  Skill Bridge / Context Bridge /        │
│  Routing Bridge / Observability Bridge  │
├─────────────────────────────────────────┤
│  L2: Session Protocol                   │
│  （所有端点必须实现）                      │
│  会话管理 / 消息模型 / 状态同步 /          │
│  持久化 / 错误规范                        │
├─────────────────────────────────────────┤
│  L1: Transport                          │
│  （对接具体通信方式）                      │
│  连接 / 认证 / 消息收发 / 心跳            │
└─────────────────────────────────────────┘
```

### L1: Transport 层

每种端点有自己的 transport adapter：

| 端点 | Transport |
|------|-----------|
| Codex | Codex SDK 调用 |
| Claude Code | Claude Agent SDK |
| 飞书 | Webhook + Bot API |
| 钉钉 | Webhook + 开放平台 API |
| 邮箱 | IMAP/SMTP |
| 真人（WebSocket） | WebSocket 通道 |

L1 的职责：连接管理、认证、原始消息收发、心跳/重连。

### L2: Session Protocol 层

统一的会话/消息模型，是当前 NCIP v1 最低标准的升级版：

- **Session Contract** — sessionKey ↔ 端点会话的稳定映射
- **Message Contract** — Parts-based 统一消息模型 + status 状态机
- **Event Contract** — 统一事件流（delta 模型 for 流式，complete 模型 for 非流式）
- **Persistence Contract** — 所有消息写入 NextClaw 会话层
- **Error Contract** — 统一错误码（config_error / auth_error / runtime_error / timeout_error / abort_error）

### L3: Capability Bridges 层

只对 Agent 类端点适用，就是当前 NCIP 的 O1-O6：

- O1 Context Bridge — 共享 ContextBuilder
- O2 Memory Bridge — 共享 memory 注入
- O3 Tool Bridge — 共享 ToolRegistry
- O4 Skill Bridge — 共享 skills 体系
- O5 Routing/Handoff Bridge — 跨 agent 路由
- O6 Observability Bridge — 统一 metrics/tracing

## 与现有 NCIP v1 的关系

NCIP v1 本质上是 L2 + L3 的 Agent 专用子集。通用协议可以把 NCIP v1 包含为一个 profile：

```
NextClaw Communication Protocol (NCP)
  ├── NCP-Core   (L1 + L2, 所有端点必须实现)
  ├── NCP-Agent  (L3, Agent 端点 profile ≈ 当前 NCIP)
  ├── NCP-Platform (飞书/钉钉 profile)
  └── NCP-Human  (真人/邮箱 profile)
```

## 最值得复用的 `agent-chat` 设计

| agent-chat 现有设计 | 在通用协议中的角色 |
|---------------------|-------------------|
| 事件流 + Delta 模型 | 直接升级为 L2 的消息传递机制 |
| Parts-based 消息 | 直接作为 L2 的消息结构基础，加扩展机制 |
| Status 语义 (pending/streaming/final/error) | L2 的消息状态机 |
| AgentEventHandler 状态累积模式 | Agent profile (NCP-Agent) 的参考实现 |
| ToolInvocation 生命周期 | L3 Tool Bridge 的基础 |
| AgentChatController 状态机 | 升级为通用 EndpointChatController |

## 后续待讨论

1. L1 Transport adapter 的接口规范（统一 adapter 接口 vs 各自实现）
2. 非流式端点（飞书/邮箱）的事件模型简化——是否跳过 delta，直接发 complete 事件
3. 主动推送消息的路由策略——端点主动发来的消息如何路由到正确的会话
4. 消息格式转换层——不同端点的 Part 类型如何互转（如 agent 的 tool-invocation 在飞书侧如何展示）
5. 多端点会话——一个会话能否同时连接多个端点（如同时和 Codex + 飞书群聊通信）
6. 协议版本演进策略
