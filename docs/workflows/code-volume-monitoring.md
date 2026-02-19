# Code Volume Monitoring Workflow

目标：持续统计 NextClaw 仓库代码规模（LOC）并形成可追踪快照，作为可维护性管理指标之一。

## 指标定义

- 统计范围：`packages/`、`bridge/`、`scripts/`
- 统计文件类型：`.ts`、`.tsx`、`.js`、`.jsx`、`.mjs`、`.cjs`、`.sh`、`.yml`、`.yaml`
- 输出指标：
  - `files`（文件数）
  - `totalLines`（总行数）
  - `blankLines`（空行）
  - `commentLines`（注释行）
  - `codeLines`（代码行）

## 本地执行

```bash
pnpm metrics:loc
```

默认输出：

- `docs/metrics/code-volume/latest.json`

可选参数：

- `--append-history`：追加到 `history.jsonl`
- `--summary-file <path>`：输出 Markdown 摘要（适合 CI）
- `--max-growth-percent <n>`：当 LOC 相比上次快照增长超过阈值时返回非 0

## CI 持续监控

工作流：`.github/workflows/code-volume-metrics.yml`

- 触发：`push(main)`、`pull_request`、每日定时、手动触发
- 产物：
  - `docs/metrics/code-volume/latest.json`
  - `docs/metrics/code-volume/history.jsonl`
- 结果展示：自动写入 GitHub Actions Job Summary

## 解释建议

- 单看 LOC 不代表质量，建议与 `lint/tsc`、缺陷率、变更频率一起看。
- 更关注“增速”和“突增来源（byScope）”，避免长期复杂度无感上升。
