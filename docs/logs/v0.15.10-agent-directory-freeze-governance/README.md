# v0.15.10-agent-directory-freeze-governance

## 迭代完成说明

- 新增治理脚本 [`scripts/lint-new-code-frozen-directories.mjs`](../../../scripts/lint-new-code-frozen-directories.mjs)，支持把特定拥挤目录标记为“冻结目录”。
- 将 [`packages/nextclaw-core/src/agent`](../../../packages/nextclaw-core/src/agent) 配置为冻结目录：当它的直接代码文件数仍大于等于 `12` 时，只要本次改动触碰该目录及其子目录中的任意代码文件，`lint:new-code:governance` 就会直接报错。
- 把新检查接入 [`scripts/lint-new-code-governance.mjs`](../../../scripts/lint-new-code-governance.mjs) 和根 [`package.json`](../../../package.json) 的 `lint:new-code:governance` / `lint:maintainability:guard` 链路，无需额外改 AI 收尾流程。
- 新增测试 [`scripts/lint-new-code-frozen-directories.test.mjs`](../../../scripts/lint-new-code-frozen-directories.test.mjs)，覆盖“命中冻结目录报错”“降到预算下后自动解除”“目录外改动不误伤”三类场景。

## 测试/验证/验收方式

- 已执行：`PATH=/opt/homebrew/bin:$PATH node --test scripts/lint-new-code-frozen-directories.test.mjs`
  - 结果：3 个测试全部通过。
- 已执行：`PATH=/opt/homebrew/bin:$PATH node --input-type=module -e "import { evaluateFrozenDirectoryViolation, FROZEN_DIRECTORY_RULES } from './scripts/lint-new-code-frozen-directories.mjs'; const violation = evaluateFrozenDirectoryViolation({ rule: FROZEN_DIRECTORY_RULES[0], changedFiles: ['packages/nextclaw-core/src/agent/subagent.ts'], currentDirectCodeFileCount: 24 }); if (!violation) { process.exit(1); } console.log(JSON.stringify({ level: violation.level, filePath: violation.filePath, message: violation.message }, null, 2));"`
  - 结果：返回 `error`，并明确指出 `packages/nextclaw-core/src/agent` 在 24 个直接代码文件、预算 12 的情况下被阻断。
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
  - 结果：通过；仅保留 `scripts/` 目录的既有预算豁免 warning。
- `build` / `tsc`：不适用。
  - 原因：本次只改仓库治理脚本和根命令接线，未触达产品构建产物、业务运行时代码或类型定义。

## 发布/部署方式

- 无独立发布动作；改动合入后即随仓库规则生效。
- 后续 AI 或人工完成代码任务并运行 `pnpm lint:maintainability:guard` 时，会自动经过新的冻结目录检查。

## 用户/产品视角的验收步骤

1. 在 [`packages/nextclaw-core/src/agent`](../../../packages/nextclaw-core/src/agent) 或其任一子目录里修改一个 `.ts/.tsx` 文件。
2. 在仓库根目录运行 `PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`。
3. 确认输出中出现 `frozen-directories` 检查，并报错说明该目录仍有 `24` 个直接代码文件、预算为 `12`。
4. 未来若先把 [`packages/nextclaw-core/src/agent`](../../../packages/nextclaw-core/src/agent) 根目录直接代码文件数拆到 `12` 以下，再重复步骤 1-2，确认这条专项阻断会自动解除。
