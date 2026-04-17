# 2026-02-20 v0.6.34-multi-agent-gateway-research

## 迭代完成说明（改了什么）

- 已将你提供的多 Agent 架构实践原文归档到：`docs/logs/v0.6.34-multi-agent-gateway-research/source.md`。
- 基于当前 NextClaw 主干代码（截至本地当前版本）完成一轮“能力对照研究”，输出“已支持 / 部分支持 / 缺口”与可落地路线图。
- 本次为“研究迭代”，不改动运行时代码，不触发版本发布。

## 研究结论（能力对照）

### A) 与你实践高度一致（已支持）

1. 单 Gateway 统一承载
- NextClaw 当前默认就是单进程 Gateway 承载通道接入、Agent Loop、会话、工具与服务控制。

2. 多渠道接入（基础能力）
- Discord、Telegram 已有通道实现；可在同一 Gateway 里同时启用。

3. `<noreply/>` 静默路径
- 已与 OpenClaw 行为对齐；且 typing 生命周期已修复为处理结束即停止（含 no-reply 路径）。

4. workspace 规则文件治理
- 现有模板已支持 `AGENTS.md`、`SOUL.md`、`TOOLS.md`、`IDENTITY.md`、`HEARTBEAT.md` 等文件注入。

### B) 部分支持（可用但不完整）

1. 多账号（accountId）
- 插件网关层支持按 account 启动（`startAccount` / `listAccountIds`）。
- 但“`channel + accountId -> agentId` 显式绑定路由”尚未成为平台一等配置能力。

2. 群聊策略控制
- Slack/Mochat 有 `groupPolicy/requireMention` 等策略。
- Discord/Telegram 目前偏基础接入，缺少统一、细粒度的 mention gate 与 pattern 策略。

3. 会话上下文里包含 account 信息
- Agent Loop 支持从 metadata 读取 `account_id`，并写入 delivery context。
- 但 session key 默认仍是 `channel:chatId`，未内建 `per-account-channel-peer` 维度模板。

### C) 关键缺口（与你目标差距最大）

1. 平台级角色路由（核心）
- 缺“路由分诊层”：入口消息未在平台层做 `channel + accountId -> agent/workspace` 的确定性路由。

2. 多角色并行常驻运行模型
- 当前是单主 Agent Runtime；虽有 subagent 工具，但不是你描述的“5 个固定角色常驻并行 + 独立 workspace + 显式协作编排”。

3. 会话隔离策略配置化
- 缺可配置 `dmScope`（如 `per-account-channel-peer`）并落到 session key 生成策略。

4. agent-to-agent ping-pong 限流开关
- 尚无平台级“自动互 ping 限制=0”此类硬开关。

## 推荐落地路线图（按价值优先）

### Phase 1（先把“可控路由”做对）
- 新增统一路由配置：`routing.bindings[]`，结构至少含 `{ channel, accountId, agentId, workspace }`。
- 在通道入站后、进入 Agent Loop 前执行路由分诊，命中后将消息送入对应 Agent Runtime。
- 验收：5 角色 × 2 渠道映射可稳定命中，且无串路由。

### Phase 2（把“会话隔离”做成硬能力）
- 新增 `session.dmScope` 枚举：`per-channel-peer | per-account-channel-peer | custom`。
- 将 session key 生成器独立成策略类（建议 class），统一供所有通道使用。
- 验收：同一用户跨 Discord/Telegram 不串；不同用户同角色不串。

### Phase 3（把“群聊协作”做成策略层）
- 为 Discord/Telegram 增加 `groupPolicy`、`requireMention`、`mentionPatterns`、`dmPolicy`。
- 支持“总指挥监听 + 专家 @触发”模板化配置。
- 验收：群聊中只有命中策略角色响应，且接力链路可观察。

### Phase 4（把“多角色运行时”做成产品能力）
- 引入 `agents.profiles[]`（每个 profile 独立 workspace/model/rules），Gateway 常驻管理多 Agent Loop。
- 增加 `agentToAgent.maxHops`（默认 0）防止 ping-pong。
- 验收：5 角色稳定并行，长时间运行无循环对话失控。

### Phase 5（记忆工程化）
- 抽象记忆分层：`daily`、`longterm`、`group`、`archive`。
- 先召回后精读，限制注入预算，支持自动归档。
- 验收：上下文质量可复现，token 使用可量化下降。

## 测试 / 验证 / 验收方式

### 本次研究迭代验证

```bash
# 仅文档变更，做结构与可读性校验
ls -la docs/logs/v0.6.34-multi-agent-gateway-research
```

验收点：
- 存在 `README.md`（研究结论与路线图）
- 存在 `source.md`（原文归档）

### 关于 build/lint/tsc

- 本次无源码逻辑改动，仅新增研究文档；`build/lint/tsc` 对本次结论无增量验证价值，标记为“不适用（N/A）”。

## 发布 / 部署方式

- 本次为研究文档迭代，不涉及包发布、服务部署与远端 migration。
- 如进入实现阶段，将按“路由层 -> 会话隔离 -> 群聊策略 -> 多角色运行时 -> 记忆分层”顺序分版本发布。

## 下一步建议（可直接执行）

- 建议从 Phase 1 开始，我可以直接起草：
  - 配置 schema（`routing.bindings`）
  - 路由解析器 class
  - Discord/Telegram 入站接入点改造
  - 对应冒烟脚本（10 条绑定映射）
