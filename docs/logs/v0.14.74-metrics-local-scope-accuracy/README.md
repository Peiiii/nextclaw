# v0.14.74-metrics-local-scope-accuracy

## 迭代完成说明（改了什么）

- 修复 `scripts/code-volume-metrics.mjs` 的 `byScope` 统计口径。
- 现在 `packages/extensions/*` 与 `packages/ncp-packages/*` 会按真实子项目边界统计，不再被错误合并成 `packages/extensions` 或 `packages/ncp-packages` 父级 scope。
- 同步更新 `docs/workflows/code-volume-monitoring.md`，补齐当前真实统计范围与 scope 粒度说明。
- 同步调整 `docs/metrics/code-volume/README.md` 的工作流文档引用格式。

## 测试/验证/验收方式

- 冒烟验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm metrics:local`
  - 结果：命令执行成功，输出完整摘要。
- 口径验证：
  - `PATH=/opt/homebrew/bin:$PATH node scripts/code-volume-metrics.mjs --output /tmp/nextclaw-metrics-local-check.json`
  - 验证 `/tmp/nextclaw-metrics-local-check.json` 中的 `byScope`，确认出现 `packages/extensions/nextclaw-channel-runtime`、`packages/ncp-packages/nextclaw-ncp-toolkit` 等真实子项目 scope。
- 静态检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm exec eslint scripts/code-volume-metrics.mjs`
  - 结果：通过。
- 可维护性自检：
  - `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths scripts/code-volume-metrics.mjs`
  - 结果：通过；存在 1 条 warning，提示 `scripts/code-volume-metrics.mjs` 接近文件预算（497/500），后续如继续扩展应考虑拆分。

## 发布/部署方式

- 本次无需单独发布或部署。
- 变更合入后，后续执行 `pnpm metrics:loc` / `pnpm metrics:local` 会自动采用新的 scope 统计口径。

## 用户/产品视角的验收步骤

1. 在仓库根目录执行 `PATH=/opt/homebrew/bin:$PATH pnpm metrics:local`。
2. 查看终端输出的 `Top scopes by LOC`，确认不会再出现把多个扩展包错误揉成一个父级 scope 的结果。
3. 如需进一步确认，执行 `PATH=/opt/homebrew/bin:$PATH node scripts/code-volume-metrics.mjs --output /tmp/nextclaw-metrics-local-check.json`。
4. 打开 `/tmp/nextclaw-metrics-local-check.json`，确认 `byScope` 中存在 `packages/extensions/<name>` 与 `packages/ncp-packages/<name>` 级别的真实子项目条目。
