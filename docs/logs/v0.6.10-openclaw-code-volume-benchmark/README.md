# 2026-02-19 Lightweight positioning 강화: automated OpenClaw LOC benchmark

## 背景 / 问题

- 现有 README 已有 LOC 徽章，但“轻量级”叙事仍缺少强对比基准。
- 团队希望把 `openclaw` 代码量纳入自动化对比，让文档持续展示“NextClaw 更轻量”的可验证证据。

## 决策

- 扩展 LOC 统计脚本：一次执行同时生成 NextClaw 快照和 OpenClaw 对比结果。
- workflow 自动 checkout `openclaw/openclaw` 并回写对比 JSON。
- README 增加对比徽章，直接展示 OpenClaw LOC 与 NextClaw 相对比例。

## 变更内容

- `scripts/code-volume-metrics.mjs`
  - 新增基准对比参数：
    - `--benchmark-name`
    - `--benchmark-root`
    - `--benchmark-include-dirs`
    - `--benchmark-output`
  - 新增输出文件：`docs/metrics/code-volume/comparison.json`
  - 对比字段包含：
    - `basePercentOfBenchmark`
    - `benchmarkMultipleOfBase`
    - `baseIsLighterByPercent`
- `.github/workflows/code-volume-metrics.yml`
  - 新增步骤 checkout `openclaw/openclaw`。
  - 统计命令改为带基准参数运行。
  - 自动提交/制品上传新增 `comparison.json`。
- `README.md`
  - 新增 `OpenClaw LOC` 与 `NextClaw vs OpenClaw` 动态徽章。
  - `Why NextClaw` 中新增 `Measured lightweight` 描述。
- 文档更新：
  - `docs/workflows/code-volume-monitoring.md`
  - `docs/metrics/code-volume/README.md`

## 验证（怎么确认符合预期）

```bash
pnpm metrics:loc -- --append-history --benchmark-name openclaw --benchmark-root ../openclaw --benchmark-include-dirs src,extensions,scripts --benchmark-output docs/metrics/code-volume/comparison.json
pnpm build
pnpm lint
pnpm tsc
```

验收点：

- `comparison.json` 成功生成，包含 NextClaw 与 OpenClaw 的 LOC 对比字段。
- README 徽章 query 指向 `comparison.json` 的有效路径字段。
- workflow 自动提交文件列表包含 `comparison.json`。
- `build/lint/tsc` 通过（lint 仅既有 warning）。

## 发布 / 部署

- 本次仅涉及工程自动化与文档层增强，不涉及数据库迁移。
- 如需发布 npm 包，继续遵循 `docs/workflows/npm-release-process.md`。

## 影响范围 / 风险

- 运行时行为无变化。
- 风险：若仓库默认分支或 `openclaw` 统计目录变化，需同步更新 workflow 与 README badge query。
