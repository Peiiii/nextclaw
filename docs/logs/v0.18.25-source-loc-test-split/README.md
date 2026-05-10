# v0.18.25-source-loc-test-split

## 迭代完成说明

- 根因：`Source LOC` headline 之前统计 `src/` 下所有代码文件，测试文件也进入主 LOC，容易把补测试误判为生产复杂度增长；同时默认 source profile 仍保留 `.vitepress` 候选目录，语义上不够收敛。
- 修复：默认 source profile 移除 `.vitepress`；metrics snapshot 将 `codeLines` 收敛为生产 LOC，并新增 `testCodeLines` 单独输出。
- Project Pulse 已适配生产 LOC / 测试 LOC 展示，生成数据同步刷新。
- 治理补齐：`apps/docs/.vitepress/data/*.generated.mjs` 属于文档站生成物，file-role-boundary 不再要求它使用业务角色后缀，并补了回归测试。

## 测试/验证/验收方式

- `node --test scripts/metrics/code-volume-metrics.test.mjs scripts/governance/lint-new-code-file-role-boundaries.test.mjs`：通过。
- Targeted ESLint：通过。
- `pnpm -C apps/docs build`：通过；保留 VitePress chunk size warning。
- `node scripts/governance/lint-new-code-governance.mjs --staged`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `post-edit-maintainability-guard --non-feature --paths ...`：通过，非测试代码净增 `-2`。

## 发布/部署方式

不涉及线上部署。文档站下一次正常构建会使用新的 Project Pulse 生成逻辑。

## 用户/产品视角的验收步骤

1. 运行 `pnpm metrics:local`。
2. 确认输出包含 `Production code lines (LOC)` 与 `Test code lines`。
3. 打开 Project Pulse，确认主 LOC 文案为生产 LOC，并显示测试 LOC。

## 可维护性总结汇总

- 本次使用 `post-edit-maintainability-review` 口径复核：生产代码净增未增加。
- 正向减债动作：简化统计口径并移除 `.vitepress` source 候选，避免主指标继续承载非生产代码。
- 治理规则与 workflow 真实产物对齐，避免生成文件触发不合理角色命名阻断。

## NPM 包发布记录

不涉及 NPM 包发布。
