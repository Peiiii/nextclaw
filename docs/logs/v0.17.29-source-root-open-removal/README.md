# v0.17.29-source-root-open-removal

## 迭代完成说明

- 根因：`source-root-open` 作为协议名和模板没有表达稳定结构意图，容易把“显式目录契约”误用成“开放 source root”。
- 本轮删除了 `source-root-open` 协议注册，不再允许生产配置引用该协议。
- 新增 `package-src-explicit`，用于尚未完成搬迁但必须冻结 `src/` 根增长的模块；协议本身不开放任何根目录，模块必须用 `allowedRootDirectories` / `allowedRootFiles` 显式声明边界。
- 将原先 41 个 `source-root-open` 配置全部迁移为 `package-src-explicit`，保留原本已经显式列出的目录/文件白名单。
- 测试补上旧协议拒绝用例，确保后续恢复 `source-root-open` 会失败。
- 同步更新目录结构设计文档，并在 v0.17.26 历史记录里标注当时开放命名协议已被后续治理纠正。

## 测试/验证/验收方式

- 已通过：`node --check scripts/governance/module-structure/module-structure-contracts.mjs && node --check scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- 已通过：`node --test --test-name-pattern='explicit package src|removed source-root-open|every workspace root declares module-structure config|missing required root directories' scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- 已通过：`pnpm lint:new-code:governance -- <本轮治理脚本、文档与 module-structure.config.json>`
- 已通过：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths scripts/governance/module-structure/module-structure-contracts.mjs scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- 已运行但未全绿：`node --test scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`，剩余 2 个失败为既有测试债务：`blocks nested directories under flat role dirs inside shared`、`blocks parent-relative imports when alias imports are configured`。
- 已运行但未全绿：`pnpm check:governance-backlog-ratchet`，仍因既有 `docFileNameViolations = 13` 高于 baseline `11` 失败。
- `tsc` 不适用：本轮未触达 TypeScript 源码、类型声明或运行链路 TS 边界。

## 发布/部署方式

- 不涉及发布、部署或 migration。
- 不涉及 NPM 包发布。

## 用户/产品视角的验收步骤

1. 搜索生产配置，确认没有 `module-structure.config.json` 继续使用 `source-root-open`。
2. 查看 `scripts/governance/module-structure/module-structure-contracts.mjs`，确认 `MODULE_STRUCTURE_PROTOCOLS` 不再注册 `source-root-open`。
3. 查看 `scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`，确认存在拒绝旧协议的测试。
4. 修改任意配置为 `protocol: "source-root-open"`，治理解析应报 `Unknown module-structure protocol 'source-root-open'`。

## 可维护性总结汇总

- 本轮是非功能治理收敛，非测试代码净增为 `0`。
- 正向减债动作：删除开放协议模板，避免结构治理继续保留无约束入口。
- `package-src-explicit` 是过渡性冻结协议，不是新开放口；后续模块完成真实目录搬迁时，应继续升级到 `package-l1`、`frontend-l3`、`cli-command-first` 或新增命名具体且默认收紧的协议。
- maintainability guard 结果：`Errors: 0`、`Warnings: 0`。

## NPM 包发布记录

- 不涉及 NPM 包发布
