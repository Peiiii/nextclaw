## 迭代完成说明

- 本轮把“目录结构规范”从单一 skill 文本，正式收敛成一个有明确 owner 的规范系统。
- 明确了目录结构规范至少包含：
  - 高层结构模型：`collapsible-feature-root-architecture`
  - 文件角色落位：`role-first-file-organization`
  - 命名规则：`file-naming-convention`
  - 执行入口：`file-organization-governance`
  - 可执行治理脚本：`scripts/governance/*`
  - 结构协议与 contract：`module-structure.config.json` 与 `scripts/governance/module-structure/module-structure-contracts.mjs`
- 明确补上了两条此前口头存在、但规范系统里不够显式的规则：
  - `L1` 根目录原则上只保留边界文件与固定职责目录
  - 角色实现文件必须进入对应角色目录，不应直接散落在根目录
- 把上述规则分别落进了结构模型 skill、角色落位 skill、目录治理 skill、元规范治理 skill和 `/config-meta` 命令口径。
- 把脚本/协议层也补齐到最小完整状态：
  - `package-l1` 协议默认允许 `index.ts` 作为根边界文件
  - 补充对应 module-structure 测试，确保不是只改文本

## 测试/验证/验收方式

- 通过：
  - `node --test scripts/governance/lint-new-code-file-role-boundaries.test.mjs`
  - `node --test --test-name-pattern='package-l1|nextclaw-kernel package root config' scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths .agents/skills/collapsible-feature-root-architecture/SKILL.md .agents/skills/role-first-file-organization/SKILL.md .agents/skills/file-organization-governance/SKILL.md .agents/skills/nextclaw-agent-instructions-governance/SKILL.md commands/commands.md docs/internal/governance-system-sources-of-truth.md docs/plans/2026-05-06-nextclaw-client-sdk-design.md scripts/governance/module-structure/module-structure-contracts.mjs scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
  - `pnpm lint:new-code:governance -- --files .agents/skills/collapsible-feature-root-architecture/SKILL.md .agents/skills/role-first-file-organization/SKILL.md .agents/skills/file-organization-governance/SKILL.md .agents/skills/nextclaw-agent-instructions-governance/SKILL.md commands/commands.md docs/internal/governance-system-sources-of-truth.md docs/plans/2026-05-06-nextclaw-client-sdk-design.md scripts/governance/module-structure/module-structure-contracts.mjs scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- 已知非本轮新增失败：
  - `node --test scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
  - 当前仍有 2 条既有失败：
    - `blocks nested directories under flat role dirs inside shared`
    - `blocks parent-relative imports when alias imports are configured`
  - 这两条失败对应的是 CLI shared / import-boundary 既有测试面，不是本轮 `package-l1 root index` 协议修正引入的新问题；本轮新增相关测试已单独通过。
- 未通过：
  - `pnpm check:governance-backlog-ratchet`
  - 原因：仓库级 `docFileNameViolations` 当前 `13`，基线 `11`，属于既有 backlog，不是本轮新增问题

## 发布/部署方式

- 不适用
- 本轮变更仅涉及治理 skill、内部说明文档、命令口径与治理脚本/测试，不涉及运行时发布或部署

## 用户/产品视角的验收步骤

1. 查看 [/.agents/skills/file-organization-governance/SKILL.md](/Users/peiwang/Projects/nextbot/.agents/skills/file-organization-governance/SKILL.md)，确认它已明确写出“目录结构规范系统包含哪些部分”。
2. 查看 [/.agents/skills/collapsible-feature-root-architecture/SKILL.md](/Users/peiwang/Projects/nextbot/.agents/skills/collapsible-feature-root-architecture/SKILL.md) 与 [/.agents/skills/role-first-file-organization/SKILL.md](/Users/peiwang/Projects/nextbot/.agents/skills/role-first-file-organization/SKILL.md)，确认：
   - `L1` 根目录只保留边界文件与固定职责目录
   - 角色实现文件回到对应角色目录
3. 查看 [scripts/governance/module-structure/module-structure-contracts.mjs](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/module-structure-contracts.mjs)，确认 `package-l1` 默认允许 `index.ts`。
4. 查看 [scripts/governance/module-structure/lint-new-code-module-structure.test.mjs](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/lint-new-code-module-structure.test.mjs)，确认新增了 `package-l1 root index` 的验证用例。
5. 之后当提出“优化目录结构规范”时，AI 不应只改一个 skill 文本，而应同时检查结构模型、角色规则、命名、脚本和 protocol contract。

## 可维护性总结汇总

- 本轮做了最小但完整的规则收口，没有再发明新的顶层规范入口。
- 文字规则、skill owner、命令口径、脚本协议之间的边界比之前清晰。
- 目录结构规范从“散落在多个地方、容易漏掉脚本层”收敛成了可追踪的系统。
- `package-l1` 的 root boundary 规则现在具备了脚本级默认值，不再只依赖局部口头约定。
- maintainability guard 结果：`Errors: 0`、`Warnings: 0`，非测试代码净变化 `+0`

## NPM 包发布记录

- 不涉及 NPM 包发布
