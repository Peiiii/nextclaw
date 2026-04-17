# Hermes Cold-Start Skill Closure Plan

> This closure plan is subordinate to and constrained by [2026-04-17-hermes-acp-runtime-route-bridge-design.md](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-17-hermes-acp-runtime-route-bridge-design.md). If any sentence below conflicts with that design doc, the design doc wins.

**Goal:** 把 `hermes-runtime` skill 收口成“能指导 AI 为零预设新用户完成 Hermes 安装、接入、验证”的执行方案，并且主链严格使用 `hermes acp`，而不是 API server/connector 叙事。  
**Architecture:** `Hermes install -> hermes acp -> NextClaw runtime entry -> readiness -> real smoke`。  
**Tech Stack:** Hermes 官方 installer、`hermes acp`、NextClaw `narp-stdio` runtime entry、真实 chat smoke。

---

## 1. 这轮要补齐什么

这轮不是补一个新的技术主链，而是补 `skill` 的冷启动闭环。

必须达到：

1. 用户不需要预先安装 Hermes
2. AI 使用 `hermes-runtime` skill 时，能先安装 Hermes
3. AI 能验证 `hermes acp` 可启动
4. AI 能写出正确的 `agents.runtimes.entries.hermes`
5. AI 能让 `Hermes` 出现在 `/api/ncp/session-types`
6. AI 能自己跑真实 smoke，不把验证甩给用户

---

## 2. 必须废止的旧冷启动叙事

以下内容不再是主路径：

- `Hermes API server`
- `stdio connector`
- `nextclaw-hermes-stdio-connector`
- “先配 API server 再接 runtime entry”

这些内容若仍出现在 skill 或 AI 的默认执行剧本中，都属于需要修正的偏差。

---

## 3. 最小实现策略

### 3.1 不发明新的安装器

Hermes 安装主路径继续复用官方：

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --skip-setup
```

### 3.2 skill 负责串起完整执行剧本

skill 必须明确执行：

1. `command -v hermes`
2. 安装 Hermes
3. `hermes --help`
4. `hermes acp --help`
5. 若 ACP extra 缺失，则补 `hermes-agent[acp]`
6. 写 NextClaw runtime entry
7. 查 `/api/ncp/session-types`
8. 跑真实 smoke
9. 必要时复测或二次验证

---

## 4. 验证策略

### 4.1 文档/skill 对表

确认 skill 已不再把以下内容当主语：

- API server
- connector
- 第二套 Hermes provider config

### 4.2 隔离冷启动环境验证

使用临时 `HOME` / `NEXTCLAW_HOME`：

- 不复用用户原本的 Hermes home
- 不复用用户原本的 NextClaw home

验证顺序：

1. 冷启动安装 Hermes
2. 通过 `hermes acp` 探测 ACP launcher
3. 配置/写入 `Hermes` runtime entry
4. 真实 smoke

### 4.3 二次验证

如果环境支持 delegation，则默认推荐：

1. 主 agent 完成 setup / repair / smoke
2. 第二个 agent 再做一次独立 smoke

如果环境不支持 delegation，主 agent 至少要自己做两轮独立检查：

- 路径/readiness 检查
- 真实 reply smoke
