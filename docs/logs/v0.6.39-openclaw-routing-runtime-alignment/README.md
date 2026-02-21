# v0.6.39-openclaw-routing-runtime-alignment

## 迭代完成说明（改了什么）

本次迭代一次性补齐了与 OpenClaw 对齐的 4 个核心能力（无 feature flag）：

1. `bindings` 路由分诊
- 新增 `AgentRouteResolver`，支持 `channel + accountId + peer -> agentId`。
- 网关入站从“单 Agent 消费”改为“运行池按路由分发”。

2. `agents.list` 多角色常驻
- 新增 `GatewayAgentRuntimePool`，根据 `agents.list` 常驻多个 `AgentLoop`。
- `service`、插件桥接、cron、heartbeat 均改为走运行池。

3. `session.dmScope`（含 `per-account-channel-peer`）
- 路由层统一生成 agent-scoped session key。
- 直接对话支持 `main/per-peer/per-channel-peer/per-account-channel-peer` 四种隔离粒度。

4. `agentToAgent.maxPingPongTurns`
- `sessions_send` 新增跨 Agent handoff 流程与硬限制。
- `maxPingPongTurns=0` 时直接阻断跨 Agent 往返。

同时补齐了通道侧策略对齐：
- Discord/Telegram：`dmPolicy`、`groupPolicy`、`requireMention`、`mentionPatterns`、`groups`。
- 入站 metadata 新增 `account_id`、`peer_kind`、`peer_id`，供路由与会话键生成使用。

## 测试 / 验证 / 验收方式

### 1) 单元验证

- `pnpm -C packages/nextclaw-core test -- --run`
  - `src/agent/route-resolver.test.ts`（bindings + dmScope + session key）
  - `src/agent/tools/sessions-send.test.ts`（ping-pong 限制与跨 Agent handoff）

### 2) 工程验证（规则要求）

- `pnpm build`
- `pnpm lint`
- `pnpm tsc`

结果：全部通过（lint 仅历史 warning，无新增 error）。

### 3) 冒烟验证（非仓库目录）

- 执行环境：`/tmp`
- 命令：`node /tmp/nextclaw-smoke.mts`
- 观察点：
  - bindings 命中 `engineer`
  - Discord `requireMention` 生效（未提及不入站，提及后入站）
  - Telegram `requireMention` 生效（未提及不入站，提及后入站）
  - metadata 包含 `account_id`、`peer_kind`
- 输出：`SMOKE_OK { routeAgent: 'engineer', discordPeerKind: 'channel', telegramPeerKind: 'group' }`

### 4) 用户/产品视角验收步骤

1. 在配置中准备至少 2 个 agent（如 `main`、`engineer`）并设置 `bindings`（例如 Discord 某 channel/account 路由到 `engineer`）。
2. 从用户视角发送真实消息，确认命中绑定角色（不是随机角色回复），并且回复内容符合该角色职责。
3. 在 Discord 与 Telegram 分别进行群聊测试：
   - 未 `@` 时（启用 `requireMention`）不应触发回复；
   - `@` 后应正常触发回复。
4. 在私聊场景验证会话隔离：同一用户跨渠道对话不串上下文，不同用户同渠道不串上下文。
5. 在多角色协作场景验证防循环：当设置 `session.agentToAgent.maxPingPongTurns=0` 时，跨 agent 往返应被阻断并给出可理解结果。
6. 产品验收通过标准：路由稳定、会话不串、群聊触发可预测、错误可解释。

## 发布 / 部署方式

已执行发布闭环：

1. 生成 changeset（覆盖受影响包联动发布）：
   - `@nextclaw/core`
   - `@nextclaw/channel-runtime`
   - `@nextclaw/openclaw-compat`
   - `@nextclaw/server`
   - `nextclaw`
2. 执行版本提升：`pnpm changeset version`
3. 执行发布：`pnpm changeset publish`
4. 发布后回归：最小路由冒烟 + Discord/Telegram mention gate 冒烟

已发布版本：

- `@nextclaw/core@0.6.22`
- `@nextclaw/channel-runtime@0.1.8`
- `@nextclaw/openclaw-compat@0.1.15`
- `@nextclaw/server@0.4.7`
- `nextclaw@0.6.23`
