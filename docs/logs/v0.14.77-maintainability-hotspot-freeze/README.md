# v0.14.77 Maintainability Hotspot Freeze

## 迭代完成说明（改了什么）

- 落地仓库可维护性治理方案的 `Phase 2: Hotspot Freeze`。
- 新增 [`scripts/maintainability-hotspots.mjs`](../../../scripts/maintainability-hotspots.mjs)，把首批红区文件、链路归属、允许新增职责、禁止新增职责与下一步拆分缝收敛为单一数据源。
- 新增 [`docs/workflows/maintainability-hotspot-freeze.md`](../../../docs/workflows/maintainability-hotspot-freeze.md)，固定红区治理流程、日志格式与日常使用方式。
- 升级 [`post-edit-maintainability-guard`](../../../.codex/skills/post-edit-maintainability-guard/SKILL.md) 及其脚本，在触达红区文件时自动校验本次 `docs/logs` 迭代 `README.md` 是否包含完整的“红区触达与减债记录”。
- 在 [`AGENTS.md`](../../../AGENTS.md) 增加 `hotspot-touch-must-record-debt-status` 项目规则，把“触达红区必须记录是否减债”从口头约定升级为仓库默认规则。
- 将根级 [`package.json`](../../../package.json) 的 `lint:maintainability` 扩展为 `guard + report + hotspots`，把红区清单可见化纳入默认维护性闭环。

## 测试/验证/验收方式

- `node --check scripts/maintainability-hotspots.mjs`
- `node --check .codex/skills/post-edit-maintainability-guard/scripts/maintainability-guard-hotspots.mjs`
- `node --check .codex/skills/post-edit-maintainability-guard/scripts/maintainability-guard-support.mjs`
- `node --check .codex/skills/post-edit-maintainability-guard/scripts/maintainability-guard-core.mjs`
- `node scripts/maintainability-hotspots.mjs --paths packages/nextclaw/src/cli/commands/diagnostics.ts`
- `node scripts/maintainability-hotspots.mjs --json`
- `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths scripts/maintainability-hotspots.mjs .codex/skills/post-edit-maintainability-guard/scripts/maintainability-guard-hotspots.mjs .codex/skills/post-edit-maintainability-guard/scripts/maintainability-guard-support.mjs .codex/skills/post-edit-maintainability-guard/scripts/maintainability-guard-core.mjs`
- `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --json --no-fail --paths packages/nextclaw/src/cli/commands/diagnostics.ts`

验收结果要点：

- 红区脚本当前追踪 `8` 个首批热点文件。
- 守卫脚本对本次新增文件与改动文件检查通过，未新增文件级或函数级维护性债务。
- 定向检查 `packages/nextclaw/src/cli/commands/diagnostics.ts` 时，守卫能正确报出“缺少红区触达与减债记录”的阻塞项，证明新闸门已生效。
- 守卫支撑逻辑已拆到独立的 `maintainability-guard-hotspots.mjs`，避免 `maintainability-guard-support.mjs` 继续逼近预算线。

## 发布/部署方式

- 不适用。本次为仓库治理脚本、规则与流程文档改动，无独立部署动作。
- 合并后，后续代码任务在执行 `pnpm lint:maintainability` 或 `post-edit-maintainability-guard` 时会自动纳入红区冻结机制。

## 用户/产品视角的验收步骤

1. 在仓库根目录执行 `node scripts/maintainability-hotspots.mjs`，确认当前首批红区文件、允许新增职责、禁止新增职责与下一步拆分缝可直接查看。
2. 新建一次代码改动并触达任一红区文件，但不要在本次 `docs/logs/.../README.md` 里填写“红区触达与减债记录”，执行 `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`，应看到阻塞错误。
3. 在对应迭代 README 中补齐：
   - `## 红区触达与减债记录`
   - `### <repo-path>`
   - `- 本次是否减债：...`
   - `- 说明：...`
   - `- 下一步拆分缝：...`
4. 重新执行守卫脚本，确认阻塞错误消失，只保留真实的文件级/函数级维护性问题。
