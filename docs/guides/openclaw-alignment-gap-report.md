# NextClaw vs OpenClaw 能力对比报告（对齐差距）

> 日期：2026-02-20  
> 范围：以你提出的多 Agent 目标能力为准，逐项对比 `nextbot` 与 `/Users/peiwang/Projects/openclaw` 当前代码实现。

## 2026-02-21 对齐进展更新

已完成下列 4 个“未对齐（关键）”能力：

- `bindings` 路由分诊：已落地（`channel + accountId + peer -> agentId`）
- `agents.list` 多角色常驻：已落地（网关运行池并行常驻）
- `session.dmScope`（含 `per-account-channel-peer`）：已落地
- `agentToAgent.maxPingPongTurns`：已落地（`sessions_send` 跨 Agent 往返限制）

另：Discord/Telegram 的 `dmPolicy/groupPolicy/requireMention/mentionPatterns/groups` 也已补齐平台级策略实现。

前端配置面（UI）新增对齐：

- 新增 `Routing & Runtime` 页面，支持编辑 `agents.list`、`bindings`、`session.dmScope`、`session.agentToAgent.maxPingPongTurns`
- ChannelForm 已补齐 Discord/Telegram 的 `accountId/dmPolicy/groupPolicy/groupAllowFrom/requireMention/mentionPatterns/groups`

## 结论摘要

- **已对齐（2项）**：
  - 单 Gateway 承载消息接入与统一处理。
  - Workspace 规则文件注入机制（`AGENTS.md`/`SOUL.md` 等）有基础。
- **部分对齐（3项）**：
  - 多账号能力（NextClaw 仅在插件网关启动层支持 accountId，未进入路由中枢）。
  - 群聊策略（NextClaw 只在 Slack/Mochat 具备，Discord/Telegram 不完整）。
  - 记忆能力（NextClaw 仅轻量注入；OpenClaw 有 memory backend + per-agent memorySearch）。
- **未对齐（4项，核心缺口）**：
  - `bindings: channel + accountId (+peer) -> agentId` 的平台级路由分诊。
  - 多 Agent 常驻并行（profiles/list）与独立 workspace 实例化运行。
  - `session.dmScope`（尤其 `per-account-channel-peer`）驱动的会话隔离。
  - `agentToAgent.maxPingPongTurns` 的平台级防循环控制。

## 对比矩阵（按你的目标能力）

| 能力 | OpenClaw 现状 | NextClaw 现状 | 对齐结论 |
|---|---|---|---|
| 单 Gateway 统一承载 | 统一在 gateway/runtime + channel monitor 下处理 | `service` 内单 `AgentLoop` + `ChannelManager` + `MessageBus` | **已对齐** |
| 多 Agent 固定角色并行 | `agents.list[]` + `AgentEntrySchema`（含 `id/workspace/model/groupChat`） | 只有 `agents.defaults`，无 `agents.list` | **未对齐** |
| `channel+accountId->agentId` 路由 | 顶层 `bindings` + `resolveAgentRoute()` 多层匹配 | 无顶层 `bindings`；通道入站直接进单总线 | **未对齐** |
| 私聊隔离 `dmScope` | `session.dmScope` 支持 `per-account-channel-peer` 等 | 默认 `sessionKey = channel:chatId`，无 `dmScope` 配置 | **未对齐** |
| Discord/Telegram 群聊 mention gate | Discord/Telegram 均有 `requireMention/groupPolicy` 与 mention regex 流程 | Slack/Mochat 有，Discord/Telegram 基本无 | **部分对齐** |
| 规则+提示词双轨治理 | 平台策略（路由/会话/群聊）+ agent 规则文件 | 有规则文件注入，但平台策略层不完整 | **部分对齐** |
| A2A ping-pong 限制 | `session.agentToAgent.maxPingPongTurns` + A2A 循环控制 | 无同等平台开关 | **未对齐** |
| 分层记忆与检索 | memory backend(`builtin/qmd`) + per-agent `memorySearch` | `agents.context.memory` 仅字符注入 | **部分对齐** |
| Discord/Telegram 双栈+账户级路由 | 路由计算中显式传 `accountId` + `peer/parentPeer` | 插件层能起 account，但无 agent 路由绑定 | **部分对齐** |

## 关键证据（代码级）

### OpenClaw（目标能力已具备）

- 多 Agent + bindings 顶层配置：
  - `/Users/peiwang/Projects/openclaw/src/config/zod-schema.ts:295`
  - `/Users/peiwang/Projects/openclaw/src/config/zod-schema.ts:297`
- Agent profile（workspace/model/groupChat/memorySearch）：
  - `/Users/peiwang/Projects/openclaw/src/config/zod-schema.agent-runtime.ts:583`
  - `/Users/peiwang/Projects/openclaw/src/config/zod-schema.agent-runtime.ts:588`
  - `/Users/peiwang/Projects/openclaw/src/config/zod-schema.agent-runtime.ts:592`
  - `/Users/peiwang/Projects/openclaw/src/config/zod-schema.agent-runtime.ts:596`
- 会话隔离 `dmScope` + ping-pong 限制：
  - `/Users/peiwang/Projects/openclaw/src/config/zod-schema.session.ts:27`
  - `/Users/peiwang/Projects/openclaw/src/config/zod-schema.session.ts:62`
- 路由核心（binding 匹配分层 + 会话键生成）：
  - `/Users/peiwang/Projects/openclaw/src/routing/resolve-route.ts:295`
  - `/Users/peiwang/Projects/openclaw/src/routing/resolve-route.ts:366`
  - `/Users/peiwang/Projects/openclaw/src/routing/session-key.ts:168`
- Discord/Telegram 路由接入与 mention gating：
  - `/Users/peiwang/Projects/openclaw/src/discord/monitor/message-handler.preflight.ts:243`
  - `/Users/peiwang/Projects/openclaw/src/discord/monitor/message-handler.preflight.ts:537`
  - `/Users/peiwang/Projects/openclaw/src/telegram/bot-handlers.ts:206`
- 群聊策略配置（Discord/Telegram）：
  - `/Users/peiwang/Projects/openclaw/src/config/zod-schema.providers-core.ts:61`
  - `/Users/peiwang/Projects/openclaw/src/config/zod-schema.providers-core.ts:117`
  - `/Users/peiwang/Projects/openclaw/src/config/zod-schema.providers-core.ts:235`
  - `/Users/peiwang/Projects/openclaw/src/config/zod-schema.providers-core.ts:284`
- mentionPatterns 来源（agent/global）：
  - `/Users/peiwang/Projects/openclaw/src/config/zod-schema.core.ts:93`
  - `/Users/peiwang/Projects/openclaw/src/auto-reply/reply/mentions.ts:38`
- A2A 防 ping-pong 运行时：
  - `/Users/peiwang/Projects/openclaw/src/agents/tools/sessions-send-helpers.ts:158`
  - `/Users/peiwang/Projects/openclaw/src/agents/tools/sessions-send-tool.a2a.ts:60`

### NextClaw（当前现状）

- 顶层配置只有 `agents/channels/providers/plugins/gateway/ui/tools`，无 `bindings/session`：
  - `packages/nextclaw-core/src/config/schema.ts:268`
- 仅单 Agent 默认项，无 `agents.list[]`：
  - `packages/nextclaw-core/src/config/schema.ts:183`
- 服务启动是单 `AgentLoop` 实例：
  - `packages/nextclaw/src/cli/commands/service.ts:136`
- 通道入站直接 `publishInbound`，无 agent 分诊路由：
  - `packages/nextclaw-core/src/channels/base.ts:38`
  - `packages/nextclaw-core/src/bus/queue.ts:36`
- 会话键默认 `channel:chatId`（无 `dmScope`）：
  - `packages/nextclaw-core/src/agent/loop.ts:365`
- Discord/Telegram 配置较基础（无 groupPolicy/requireMention）：
  - `packages/nextclaw-core/src/config/schema.ts:17`
  - `packages/nextclaw-core/src/config/schema.ts:40`
- Discord 入站未做 mention gate；仅收消息后入总线：
  - `packages/extensions/nextclaw-channel-runtime/src/channels/discord.ts:133`
  - `packages/extensions/nextclaw-channel-runtime/src/channels/discord.ts:184`
- 当前“部分能力”只在 Slack/Mochat 具备：
  - `packages/nextclaw-core/src/config/schema.ts:122`
  - `packages/extensions/nextclaw-channel-runtime/src/channels/slack.ts:167`
  - `packages/extensions/nextclaw-channel-runtime/src/channels/mochat.ts:637`
- accountId 在插件网关层可启动，但未形成路由中枢：
  - `packages/nextclaw-openclaw-compat/src/plugins/types.ts:87`
  - `packages/nextclaw-openclaw-compat/src/plugins/channel-runtime.ts:115`
- 记忆仅上下文注入上限配置：
  - `packages/nextclaw-core/src/config/schema.ts:173`

## 未对齐项优先级（建议实施顺序）

### P0（必须先做）

1. 平台路由分诊层（`bindings[]`）
- 缺失影响：5 角色 × 2 渠道无法做确定性分诊，群聊协作会乱。
- 目标：新增 `bindings` 到 config schema，接入入站消息路径，路由到对应 `agentId` runtime。

2. 会话隔离策略（`session.dmScope`）
- 缺失影响：跨渠道/跨账号/跨用户上下文错串风险高。
- 目标：引入 `session.dmScope`，落地到 session key 生成器。

### P1（协作质量关键）

3. Discord/Telegram 统一群聊策略
- 目标：补齐 `groupPolicy + requireMention + mentionPatterns (+ per-group override)`。

4. 多 Agent 常驻运行
- 目标：`agents.list[]` + runtime 池（每个 agent 独立 workspace/model/context）。

### P2（稳定性与规模化）

5. A2A 防循环治理
- 目标：引入 `session.agentToAgent.maxPingPongTurns` 与运行时硬限制。

6. 记忆工程化
- 目标：在现有注入基础上补“索引检索、分层存储、归档策略”。

## 一句话判断

当前 NextClaw 已有“能跑的单 Agent 网关底座”，但距离你描述的 OpenClaw 多 Agent 协作体系，**核心差距集中在“路由层 + 会话层 + 角色运行时层”三层**。
