# 2026-02-19 Local LOC result output for NextClaw-only flow

## 背景 / 问题

- 当前 LOC 脚本以写入快照文件为主，本地开发流程里很难快速看到完整结果。
- 用户希望本地流程直接输出统计结果，且只统计 NextClaw 自身代码。

## 决策

- 增加“本地只输出不写盘”模式。
- 增加本地快捷命令，直接打印完整摘要。

## 变更内容

- `scripts/code-volume-metrics.mjs`
  - 新增 `--no-write`：只计算，不写 `latest.json/history.jsonl/comparison.json`
  - 新增 `--print-summary`：打印完整统计摘要到终端
  - `--no-write` 时不再打印 snapshot saved 提示
- `package.json`
  - 新增 `metrics:local`
  - 命令：`node scripts/code-volume-metrics.mjs --no-write --print-summary`
- `docs/workflows/code-volume-monitoring.md`
  - 新增本地命令和参数说明

## 验证（怎么确认符合预期）

```bash
pnpm metrics:local
pnpm build
pnpm lint
pnpm tsc
```

验收点：

- `pnpm metrics:local` 输出完整摘要（含 Top scopes）。
- 该命令执行后不产生 metrics 文件写盘变更。
- `build/lint/tsc` 通过（lint 仅既有 warning）。

## 发布 / 部署

- 本次仅工程脚本与文档改动，不涉及数据库迁移。
- 如需发布 npm 包，按 `docs/workflows/npm-release-process.md`。

## 影响范围 / 风险

- 运行时行为无变化。
- 风险较低：仅本地工具体验增强。
