# Source LOC Monitoring Workflow

目标：持续统计 NextClaw 源码行数（Source LOC）并形成可追踪快照，作为可维护性管理指标之一。

## 指标定义

- 默认口径：源码 LOC（不是仓库总体积）
- 统计范围：
  - workspace 内的 `src/`
  - workspace 内的 `bridge/src/`
  - workspace 内的 `.vitepress/`
  - 无 `src/` 的极简包入口文件（如根级 `index.js`）
  - 根目录 `bridge/src/`
- scope 粒度：
  - `apps/<name>`
  - `workers/<name>`
  - `packages/<name>`
  - `packages/extensions/<name>`
  - `packages/ncp-packages/<name>`
- 统计文件类型：`.ts`、`.tsx`、`.js`、`.jsx`、`.mjs`、`.cjs`
- 默认排除常见产物目录：`node_modules`、`dist`、`build`、`ui-dist`、`release`、`out`、`.next`、`.wrangler`、`.temp` 等
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

仅看本地结果输出（仅 NextClaw，不写回文件）：

```bash
pnpm metrics:local
```

如需查看旧语义的“仓库代码体积”统计：

```bash
pnpm metrics:repo
pnpm metrics:repo:local
```

默认输出：

- `docs/metrics/code-volume/latest.json`

可选参数：

- `--append-history`：追加到 `history.jsonl`
- `--no-write`：只计算不写 `latest.json/history.jsonl/comparison.json`
- `--print-summary`：将完整统计摘要打印到终端
- `--summary-file <path>`：输出 Markdown 摘要（适合 CI）
- `--max-growth-percent <n>`：当 LOC 相比上次快照增长超过阈值时返回非 0
- `--scope-profile <source|repo-volume>`：切换统计口径；默认 `source`
- `--benchmark-name <name>`：设置对比仓库名称（例如 `openclaw`）
- `--benchmark-root <path>`：对比仓库本地路径（例如 `../openclaw`）
- `--benchmark-include-dirs <csv>`：对比仓库统计目录（例如 `src,extensions`）
- `--benchmark-output <path>`：输出对比 JSON（默认 `docs/metrics/code-volume/comparison.json`）

## CI 持续监控

工作流：`.github/workflows/code-volume-metrics.yml`

- 触发：`push(master/main)`、`pull_request`、每日定时、手动触发
- 产物：
  - `docs/metrics/code-volume/latest.json`
  - `docs/metrics/code-volume/history.jsonl`
  - `docs/metrics/code-volume/comparison.json`
- 结果展示：自动写入 GitHub Actions Job Summary
- 自动回写：仅在 `schedule` / `workflow_dispatch` 且位于 `master/main` 时提交快照更新；`push`/`pull_request` 只做统计与展示，不写回分支，避免干扰日常推送
- 对比来源：workflow 会自动 checkout `openclaw/openclaw`，并按 `src,extensions` 做源码 LOC 基准对比

## README 实时展示

- README 徽章通过 `shields.io` 的 dynamic JSON 模式读取源码 LOC：
  - `docs/metrics/code-volume/latest.json` 中的 `$.totals.codeLines`
  - `docs/metrics/code-volume/comparison.json` 中的 `$.benchmark.totals.codeLines`
  - `docs/metrics/code-volume/comparison.json` 中的 `$.comparison.basePercentOfBenchmark`
- 因为主分支快照与对比结果会被 workflow 自动回写，所以徽章会持续展示最新 LOC 与 OpenClaw 对比值。

## 解释建议

- 单看源码 LOC 不代表质量，建议与 `lint/tsc`、缺陷率、变更频率一起看。
- 更关注“增速”和“突增来源（byScope）”，避免长期复杂度无感上升。
- `byScope` 应反映真实子项目边界；若某个多层工作区被错误合并成父目录（例如 `packages/extensions`），需要优先修正统计口径，再解释数据。
- 当默认口径从一种 profile 切到另一种 profile 时，delta 会自动视为“无可比基线”，避免把不同统计语义硬算成涨跌。
