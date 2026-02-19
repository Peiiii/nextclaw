# 2026-02-19 Code volume continuous monitoring

## 背景 / 问题

- 目前缺少统一、持续、可追踪的“代码规模”指标，难以及时识别复杂度上升趋势。
- 团队希望将代码量纳入可维护性管理，至少做到：可重复统计、可自动执行、可比较增量。

## 决策

- 在仓库内新增统一 LOC 统计脚本（零额外依赖，Node 原生实现）。
- 在 CI 中自动执行统计并产出快照与历史文件，形成持续监测机制。
- 指标只做“维护性信号”，不单独作为质量结论，避免唯 LOC 导向。

## 变更内容

- 新增 `scripts/code-volume-metrics.mjs`
  - 统计 `packages/`、`bridge/`、`scripts/` 下代码文件规模。
  - 生成 `docs/metrics/code-volume/latest.json`。
  - 支持 `--append-history` 追加 `history.jsonl`。
  - 支持 `--summary-file` 输出 Markdown 摘要（供 CI Summary 使用）。
  - 支持 `--max-growth-percent` 做增长阈值守卫。
- 新增 npm 脚本 `pnpm metrics:loc`。
- 新增 GitHub Actions：`.github/workflows/code-volume-metrics.yml`
  - 在 `push(main)`、`pull_request`、定时任务、手动触发下执行。
  - 上传 `latest.json` 与 `history.jsonl` 为 artifact。
- 新增文档：
  - `docs/workflows/code-volume-monitoring.md`
  - `docs/metrics/code-volume/README.md`
  - `README.md` 新增入口链接。

## 验证（怎么确认符合预期）

```bash
pnpm metrics:loc -- --append-history
pnpm build
pnpm lint
pnpm tsc
```

验收点：

- `docs/metrics/code-volume/latest.json` 被更新且字段完整（totals/byLanguage/byScope/delta）。
- `docs/metrics/code-volume/history.jsonl` 追加新快照。
- `build/lint/tsc` 通过。

## 发布 / 部署

- 本次为仓库工程能力增强，不涉及数据库迁移。
- 若需发布 npm 包，按 `docs/workflows/npm-release-process.md`。

## 影响范围 / 风险

- 无运行时行为变更；仅影响工程脚本与 CI。
- 风险：若未来新增代码目录/文件类型，需同步更新脚本统计范围。
