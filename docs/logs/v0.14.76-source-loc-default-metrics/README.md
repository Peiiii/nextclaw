# v0.14.76-source-loc-default-metrics

## 迭代完成说明（改了什么）

- 将 `pnpm metrics:loc` / `pnpm metrics:local` 的默认语义从“仓库代码体积”收敛为“源码 LOC”。
- 默认统计现在只覆盖真实源码入口：
  - workspace 内的 `src/`
  - workspace 内的 `bridge/src/`
  - workspace 内的 `.vitepress/`
  - 无 `src/` 的极简包根级入口文件（如 `index.js`）
  - 根目录 `bridge/src/`
- 默认统计文件类型收紧为 `.ts`、`.tsx`、`.js`、`.jsx`、`.mjs`、`.cjs`，不再把 `.sh`、`.yml`、`.yaml` 混入源码 LOC。
- 默认排除产物目录补齐为 `dist`、`build`、`ui-dist`、`release`、`out`、`.next`、`.wrangler`、`.temp` 等，避免打包结果和生成缓存进入统计。
- 保留显式旧口径：
  - `pnpm metrics:repo`
  - `pnpm metrics:repo:local`
- 对比仓库默认口径同步切到源码目录，对 OpenClaw 的比较不再把 `scripts` 混入默认基准。
- 生成与快照构建逻辑拆分为独立脚本模块，消除了主脚本越过可维护性预算的问题。
- 已重新生成：
  - `docs/metrics/code-volume/latest.json`
  - `docs/metrics/code-volume/history.jsonl`
  - `docs/metrics/code-volume/comparison.json`

## 测试/验证/验收方式

- 默认源码 LOC 冒烟：
  - `PATH=/opt/homebrew/bin:$PATH pnpm metrics:local`
  - 结果：通过；输出标题为 `Source LOC Snapshot`，`Profile: source`。
- 旧仓库体积口径冒烟：
  - `PATH=/opt/homebrew/bin:$PATH pnpm metrics:repo:local`
  - 结果：通过；输出标题为 `Repo Code Volume Snapshot`，`Profile: repo-volume`。
- 静态检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm exec eslint scripts/code-volume-metrics.mjs scripts/code-volume-metrics-profile.mjs scripts/code-volume-metrics-snapshot.mjs`
  - 结果：通过。
- 可维护性自检：
  - `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths scripts/code-volume-metrics.mjs scripts/code-volume-metrics-profile.mjs scripts/code-volume-metrics-snapshot.mjs`
  - 结果：通过，无告警。
- 快照回写验证：
  - `PATH=/opt/homebrew/bin:$PATH node scripts/code-volume-metrics.mjs --append-history --benchmark-name openclaw --benchmark-root ../openclaw --benchmark-include-dirs src,extensions --benchmark-output docs/metrics/code-volume/comparison.json`
  - 结果：通过；`latest.json` 中 `scope.profile=source`，`comparison.json` 已按源码 LOC 与本地兄弟仓库 `../openclaw` 对比。

## 发布/部署方式

- 本次无需额外部署。
- 合入后：
  - 日常查看源码 LOC 使用 `pnpm metrics:loc` / `pnpm metrics:local`
  - 如需查看旧语义的仓库体积，使用 `pnpm metrics:repo` / `pnpm metrics:repo:local`
- GitHub workflow `.github/workflows/code-volume-metrics.yml` 已同步为源码 LOC 口径，并会继续回写 `docs/metrics/code-volume/*`。

## 用户/产品视角的验收步骤

1. 在仓库根目录执行 `PATH=/opt/homebrew/bin:$PATH pnpm metrics:local`。
2. 确认输出标题为 `Source LOC Snapshot`，且包含 `Profile: source`。
3. 执行 `PATH=/opt/homebrew/bin:$PATH pnpm metrics:repo:local`。
4. 确认第二个命令输出标题为 `Repo Code Volume Snapshot`，用于和源码 LOC 做口径区分。
5. 打开 `docs/metrics/code-volume/latest.json`，确认 `scope.profile` 为 `source`。
6. 打开 `docs/metrics/code-volume/comparison.json`，确认对 OpenClaw 的比较使用源码 LOC 口径。
