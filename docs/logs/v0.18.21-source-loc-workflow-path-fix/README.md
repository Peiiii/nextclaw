# v0.18.21-source-loc-workflow-path-fix

## 迭代完成说明

- 根因：`Source LOC Metrics` GitHub Action 仍调用迁移前的 `scripts/code-volume-metrics.mjs`，但真实脚本已收敛到 `scripts/metrics/code-volume-metrics.mjs`。
- 确认方式：全仓搜索 LOC workflow 与 metrics 入口，确认只有 `.github/workflows/code-volume-metrics.yml` 还保留旧路径。
- 修复方式：将 workflow 中的 LOC 生成命令改为当前 metrics 脚本路径，直接修正 CI 入口，不新增兼容 shim 或第二套脚本。
- 为什么命中根因：本地用新路径执行同等 LOC + OpenClaw benchmark 参数已成功生成统计输出。

## 测试/验证/验收方式

- `node scripts/metrics/code-volume-metrics.mjs --no-write --summary-file /tmp/nextclaw-code-volume-summary.md --benchmark-name openclaw --benchmark-root ../openclaw --benchmark-include-dirs src,extensions --benchmark-output /tmp/nextclaw-code-volume-comparison.json`
  - 结果：通过，输出 Source LOC 与 OpenClaw benchmark 对比。
- `pnpm lint:new-code:governance`
  - 结果：通过，无 changed workspace source files。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths .github/workflows/code-volume-metrics.yml`
  - 结果：不适用，未发现 changed code-like files。

## 发布/部署方式

- 不涉及应用部署。
- 修复随 git commit 进入仓库后，由下一次 GitHub Action 运行验证。

## 用户/产品视角的验收步骤

1. 在 GitHub Actions 手动触发或等待 `Source LOC Metrics` workflow。
2. 确认 `Generate source LOC metrics` step 不再因找不到 `scripts/code-volume-metrics.mjs` 失败。
3. 确认 workflow summary 和 `source-loc-metrics-*` artifact 正常生成。

## 可维护性总结汇总

- 本次遵循删减/收敛原则：没有新增兼容脚本或旧路径 shim，只把 CI 调用点指向当前唯一 metrics owner。
- 代码/分支/函数/目录扩散：不涉及源码新增，不增加分支、函数或目录复杂度。
- owner 边界：LOC 统计 owner 继续保持在 `scripts/metrics/code-volume-metrics.mjs`。
- `post-edit-maintainability-review`：适用，结论为配置级单路径收敛，无 maintainability findings。

## NPM 包发布记录

- 不涉及 NPM 包发布。
