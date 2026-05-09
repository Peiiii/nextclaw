# v0.18.19 NextClaw Core Dead Code Cleanup

## 迭代完成说明

本次是 `packages/nextclaw-core` 的非功能清理，目标是删除上一轮死代码扫描中确认的低风险冗余实现。

- 删除 `src/features/runtime-context/services/runtime-user-prompt.service.ts`。同等实现已经由 `src/features/runtime-context/types/runtime-user-prompt.ts` 承接，并通过 `features/runtime-context/index.ts` 对外导出。
- 删除 `src/features/agent/features/runtime/runtime-hooks.ts`。源码无调用方，属于历史 runtime glue 残留。
- 删除 `bootstrap-context.service.ts` 中未使用的 `dedupeStrings` helper。
- 顺手把 `bootstrap-context.service.ts` 的跨 feature 深层相对导入改为 feature barrel alias，满足当前 module-structure 治理。
- 新增 `.agents/skills/nextclaw-dead-code-governance/SKILL.md`，把本次死代码扫描、风险分层、删除顺序与验证闭环沉淀为后续常态化治理入口。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-core tsc`：通过。
- `pnpm -C packages/nextclaw-core lint`：通过；保留既有 warning。
- `pnpm -C packages/nextclaw-core exec vitest run src/features/agent/features/tests/runtime-user-prompt.test.ts src/features/runtime-context/services/workspace-repository-identity.test.ts`：通过，2 个测试文件，7 个用例。
- `pnpm lint:new-code:governance -- --files packages/nextclaw-core/src/features/runtime-context/services/bootstrap-context.service.ts docs/logs/v0.18.19-nextclaw-core-dead-code-cleanup/README.md`：通过。补跑全量 `pnpm lint:new-code:governance` 时被工作区内另一批 `packages/ncp-packages/nextclaw-ncp-agent-runtime` 文件迁移的 file-role-boundary 问题阻塞，非本次清理引入。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-core/src/features/runtime-context/services/bootstrap-context.service.ts packages/nextclaw-core/src/features/runtime-context/services/runtime-user-prompt.service.ts packages/nextclaw-core/src/features/agent/features/runtime/runtime-hooks.ts`：通过。
- `pnpm dlx knip --workspace packages/nextclaw-core --include files,exports --reporter compact --no-exit-code --max-show-issues 120`：确认已删除的两个生产 unused file 不再出现；剩余 unused files 主要是测试入口识别噪声，剩余 unused exports 属于公共表面收敛候选，未在本轮直接删除实现。
- `pnpm lint:new-code:governance -- --files .agents/skills/nextclaw-dead-code-governance/SKILL.md docs/logs/v0.18.19-nextclaw-core-dead-code-cleanup/README.md`：通过。

## 发布/部署方式

未发布、未部署。本次只清理源码冗余，后续随常规包发布流程带出。

## 用户/产品视角的验收步骤

- 对终端用户无新增交互。
- 开发者验收重点是 `@nextclaw/core` 仍可通过类型检查、lint 和相关 runtime-context 测试。
- 维护视角验收重点是重复/无引用生产代码减少，core 公共运行路径不新增分支。

## 可维护性总结汇总

本次使用 `post-edit-maintainability-guard` 和人工复核。改动遵循先删减原则，删除重复实现、无引用 glue 文件和未使用 helper，同时修正触达文件的 module-structure 导入边界。

- 总代码增减：新增 2 行，删除 266 行，净减 264 行。
- 非测试代码增减：新增 2 行，删除 266 行，净减 264 行。
- 正向减债动作：删除。
- 质量与可维护性提升证明：生产代码文件数减少，runtime prompt builder 保留单一实现来源，bootstrap context 文件去掉无用 helper，触达导入符合 feature barrel 边界。
- 常态化沉淀：新增 `nextclaw-dead-code-governance` skill，后续用户要求扫死代码、清理无用代码、治理核心包臃肿时可直接触发。

## NPM 包发布记录

不涉及 NPM 包发布。
