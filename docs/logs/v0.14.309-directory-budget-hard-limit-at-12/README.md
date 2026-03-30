# v0.14.309-directory-budget-hard-limit-at-12

## 迭代完成说明

- 将共享目录预算阈值从原先的 `12` 告警 / `20` 硬限制收紧为 `12` 起直接进入硬限制，统一影响 maintainability report 与 post-edit maintainability guard。
- 调整共享预算输出口径：当目录预算只剩单一硬阈值时，报表中的 `budget` 字段输出为单值 `12`，不再显示误导性的双阈值。
- 更新目录预算单测与 guard 侧复用测试，覆盖“目录到达 `12` 即阻塞”和“有完整豁免时降级为警告”的新行为。
- 同步更新技能说明、增量减债工作流文档与现有目录预算豁免 README，避免仓库内继续残留“超过 `20` 个直接代码文件”这类旧口径。

## 测试/验证/验收方式

- 运行：
  - `node --test scripts/maintainability-directory-budget.test.mjs .agents/skills/post-edit-maintainability-guard/scripts/maintainability-guard-directory-budget.test.mjs`
- 运行：
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --no-fail --paths scripts/maintainability-directory-budget.mjs`
- 验证点：
  - 无豁免目录在直接代码文件数达到 `12` 时即命中 `directory-budget` error。
  - 带完整 `## 目录预算豁免` 的目录在达到 `12` 个直接代码文件时降级为 `warn`，而不是阻塞。
  - 统一报告与 diff-only guard 对同一目录数量给出一致语义。

## 发布/部署方式

- 本次变更为仓库治理规则与脚本更新，无独立部署动作。
- 合并后，所有收尾阶段执行的 `pnpm lint:maintainability:guard` 与仓库级 maintainability report 都会自动采用新阈值。
- 若某目录因装配边界确实需要保留 `12` 个及以上直接代码文件，需在该目录 `README.md` 中保留完整的 `## 目录预算豁免` 说明。

## 用户/产品视角的验收步骤

1. 在任意未写豁免说明的业务目录中，连续新增直接代码文件直到该目录达到 `12` 个。
2. 运行 `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --no-fail --paths <该目录中的任一代码文件>`。
3. 确认输出出现 `directory-budget` 错误，并明确提示目录已达到硬限制。
4. 在同目录 `README.md` 中补上 `## 目录预算豁免` 与 `- 原因：...` 后再次运行，确认结果降为可追踪警告。
