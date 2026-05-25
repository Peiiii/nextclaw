# v0.19.30-docs-deploy-metrics-refresh

## 迭代完成说明

本次修复文档站重新部署后 Project Pulse 仍展示旧 LOC 指标的问题。

根因：根命令 `pnpm deploy:docs` 只构建文档站并部署，文档站 build 阶段只运行 `project:pulse` 聚合脚本；该脚本读取已有的 `docs/metrics/code-volume/latest.json`，不会主动刷新 LOC 快照。因此重新部署会把旧指标重新打包发布。

修复：将根 `deploy:docs` 调整为先运行 `pnpm metrics:loc`，再构建并部署文档站；同时更新 `docs/workflows/code-volume-monitoring.md`，明确部署文档站会先刷新 LOC 快照。

后续补充：修复 Project Pulse 趋势图 tooltip 被图表 frame 裁剪的问题。根因是 tooltip 绝对定位在 `.trend-chart__frame` 内，而 frame 使用了 `overflow: hidden`；将 frame 改为允许溢出后，悬浮层可以完整显示。

## 测试/验证/验收方式

- `node -e '...'` 校验 `package.json` 可解析，且 `deploy:docs` 以 `pnpm metrics:loc && pnpm --filter @nextclaw/docs build &&` 开头：通过。
- `pnpm metrics:local`：通过，以 no-write 模式确认当前 LOC 脚本可正常计算。
- `git diff --check -- package.json docs/workflows/code-volume-monitoring.md`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths package.json docs/workflows/code-volume-monitoring.md`：不适用，未触达 code-like 文件。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm deploy:docs`：通过，验证部署链路会先刷新 LOC、再生成 Project Pulse 并部署文档站。
- `pnpm --filter @nextclaw/docs build && pnpm dlx wrangler pages deploy apps/docs/.vitepress/dist --project-name nextclaw-docs --branch master`：通过。由于当前工作区存在并行源码改动，本次先用干净 worktree 重新生成指标，再重新部署一次，确保线上内容与本次提交的指标一致。
- `pnpm -C apps/docs exec vitepress build`：通过，用于验证趋势图 tooltip 样式修复后的文档站构建，且不重写 Project Pulse 生成数据。

## 发布/部署方式

已执行真实文档站部署。最终部署地址：

- `https://a07c66c8.nextclaw-docs.pages.dev`

本次部署过程中发现当前工作区存在并行源码改动；为避免把并行改动的 LOC 派生结果提交进本次提交，最终提交的 `latest.json` 与 Project Pulse 数据基于干净 worktree 生成。

## 用户/产品视角的验收步骤

1. 在仓库根目录执行 `pnpm deploy:docs`。
2. 确认命令先输出 `metrics:loc` 的 LOC 快照生成结果。
3. 部署完成后打开文档站 Project Pulse 页面，确认当前 LOC 不再停留在旧 `latest.json` 指标。

## 可维护性总结汇总

本次是非功能 bugfix，改动收敛在唯一发布入口 `deploy:docs`，没有给页面、数据聚合脚本或运行时增加 fallback。它把“发布前刷新指标”放回发布链路 owner，避免以后靠人工记住额外命令。

`post-edit-maintainability-review` 对源码可维护性不适用：本次未触达源码、测试或 code-like 文件。总 diff 当前为文档 `+2/-0`、根脚本配置 `+1/-1`，没有增加生产源码 LOC。

## NPM 包发布记录

不涉及 NPM 包发布。
