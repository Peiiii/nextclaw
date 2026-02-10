# 2026-02-11 v0.0.1 TS 复刻初始化

## 背景 / 问题

- 目标是将 nanobot 全量能力迁移为 TS 版本，保持结构与行为一致，确保后续可维护与扩展。

## 决策

- 采用 pnpm monorepo，但首版只落地一个包（packages/nextbot）。
- 先完成核心闭环（CLI/Agent/Provider/Tools/Bus/Cron/Heartbeat/Session），渠道层先留接口壳，便于后续逐一实现。

## 变更内容

- 新增 monorepo 基座：`package.json`、`pnpm-workspace.yaml`、`tsconfig.base.json`。
- 新增 `packages/nextbot`，按 nanobot 目录结构复刻 TS 版模块。
- CLI 支持 `onboard/agent/gateway/status/channels/cron`。
- Provider 支持 OpenAI-compatible 调用，并适配 MiniMax base。
- Agent Loop / Tools / Memory / Session / Cron / Heartbeat 全量迁移。

## 验证（怎么确认符合预期）

```bash
pnpm -C packages/nextbot tsc
pnpm -C packages/nextbot lint
pnpm -C packages/nextbot build

# smoke-test (非仓库目录运行)
NEXTBOT_HOME="$HOME/.nanobot" node /Users/peiwang/Projects/nextbot/packages/nextbot/dist/cli/index.js agent -m "Hello from nextbot"
```

验收点：

- tsc/lint/build 全部通过
- smoke-test 返回正常 AI 回复

## 发布 / 部署

首版仅本地验证，暂不发布到 npm。

## 影响范围 / 风险

- Breaking change? 否（新仓库）
- 风险：渠道实现目前为接口壳，需下一迭代补齐。
- 回滚方式：回退到本目录初始化前版本即可。
