# v0.17.29-source-root-open-removal

## 迭代完成说明

- 根因：`source-root-open` 作为协议名和模板没有表达稳定结构意图，容易把“显式目录契约”误用成“开放 source root”。
- 本轮删除了 `source-root-open` 协议注册，不再允许生产配置引用该协议。
- 纠偏：曾短暂新增 `package-src-explicit` 作为显式冻结协议，但这仍然会掩盖模块与目标结构协议的真实冲突；本轮已删除该协议。
- 将原先 41 个 `source-root-open` 配置全部迁移为目标严格协议：普通包与 worker 使用 `app-l1`，单平台多 feature app 使用 `app-l2`。
- 补齐 `app-l2` 协议，因为高层规范已经定义 L2，脚本缺失该协议属于脚本实现不一致。
- 测试补上旧协议拒绝用例，确保后续恢复 `source-root-open` 会失败。
- 同步更新目录结构设计文档，并在 v0.17.26 历史记录里标注当时开放命名协议已被后续治理纠正。

## 测试/验证/验收方式

- 已通过：`node --check scripts/governance/module-structure/module-structure-contracts.mjs && node --check scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- 已通过：`node --test --test-name-pattern='approved fixed list|strict package L1|package L2|removed package-src-explicit|removed source-root-open|every workspace root declares module-structure config|missing required root directories' scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
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
2. 搜索生产配置，确认没有 `module-structure.config.json` 使用 `package-src-explicit`。
3. 查看 `scripts/governance/module-structure/module-structure-contracts.mjs`，确认 `MODULE_STRUCTURE_PROTOCOLS` 不再注册 `source-root-open` 或 `package-src-explicit`。
4. 查看 `scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`，确认存在拒绝旧协议的测试。
5. 修改任意配置为 `protocol: "source-root-open"` 或 `protocol: "package-src-explicit"`，治理解析应报 unknown protocol。

## 可维护性总结汇总

- 本轮是非功能治理收敛，非测试代码净增为 `0`。
- 正向减债动作：删除开放协议模板，避免结构治理继续保留无约束入口。
- 后续模块如果与 `app-l1` / `app-l2` / `app-l3` / `cli-command-first` 冲突，应把冲突作为治理债务处理，而不是新增冻结协议继续绕开。
- maintainability guard 结果：`Errors: 0`、`Warnings: 0`。

## NPM 包发布记录

- 不涉及 NPM 包发布
