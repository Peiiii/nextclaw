# 2026-02-19 Release v0.6.4

## 迭代完成说明

- 目标：按长期最优架构实现多会话多模型/多 provider 路由能力，并保持高可维护性。
- 核心改动：
  - 将 provider 运行时升级为“按请求模型动态路由 + provider 实例池”。
  - AgentLoop/Subagent 改为通过 `ProviderManager.chat(...)` 按请求选择 provider。
  - 会话级模型覆盖：支持通过消息 metadata 注入模型，并持久化到 session metadata（`preferred_model`）。
  - CLI 新增 `nextclaw agent --model <model>`，可直接为指定会话设置/覆盖模型路由。
  - 配置热更新链路中同步刷新 provider 路由配置，避免仅重启后才生效。
- 本次实际发布包：
  - `nextclaw@0.6.4`
  - `@nextclaw/core@0.6.4`

## 测试 / 验证 / 验收

### 发布前校验

```bash
pnpm release:check
```

结果：通过（仅仓库既有 lint warning：`max-lines` / `max-lines-per-function`，无新增错误）。

### 线上冒烟（VPS）

目标：`8.219.57.52`（root）

```bash
npm i -g nextclaw@0.6.4
nextclaw --version

# 维持 openai responses 模式
nextclaw config get providers.openai.wireApi

# 会话 A: OpenAI
nextclaw agent -s cli:route-openai --model openai/gpt-5.2-codex -m "只回复OPENAI_OK"

# 会话 B: MiniMax
nextclaw agent -s cli:route-minimax --model minimax/MiniMax-M2.5 -m "只回复MINIMAX_OK"

# 验证会话级粘性（不再传 --model）
nextclaw agent -s cli:route-openai -m "只回复OPENAI_STICKY"
nextclaw agent -s cli:route-minimax -m "只回复MINIMAX_STICKY"
```

观察点：

- 版本为 `0.6.4`。
- 两个会话均成功回复，且会话级模型粘性生效。
- session 文件首行 metadata 包含不同 `preferred_model`：
  - `openai/gpt-5.2-codex`
  - `minimax/MiniMax-M2.5`
- `responses` 模式下不再出现 JSON 解析异常回退问题。

### 发布后验收

```bash
npm view nextclaw version
npm view @nextclaw/core version
npm view nextclaw dist-tags --json
npm view @nextclaw/core dist-tags --json
```

结果：

- `nextclaw` 最新版本 `0.6.4`
- `@nextclaw/core` 最新版本 `0.6.4`
- `dist-tags.latest` 均为 `0.6.4`

## 发布 / 部署方式

- 已执行：
  1. `pnpm release:version`
  2. `pnpm release:publish`
- 自动创建 tag：
  - `nextclaw@0.6.4`
  - `@nextclaw/core@0.6.4`
- VPS 部署方式：`npm i -g nextclaw@0.6.4`

## 发布后文档检查

- 已更新：
  - `docs/USAGE.md`
  - `packages/nextclaw/templates/USAGE.md`
  - `docs/logs/v0.6.4-release-v0.6.4/README.md`
- 结论：新增 `agent --model` 与会话级模型路由能力已同步文档。
