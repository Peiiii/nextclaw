# v0.18.20 Design Plan Date Prefix Governance

## 迭代完成说明

本次把“所有 design 和 plan 必须带日期前缀”固化为迭代机制规范。

落地方式：

- `AGENTS.md` 在迭代留痕常驻原则中增加规则：迭代机制中的设计和计划沉淀必须带 `YYYY-MM-DD-` 日期锚点。
- `nextclaw-iteration-log-governance` skill 增加专门的 `Design / Plan Date Prefix` 小节：`docs/designs` 与 `docs/plans` 下的 design/plan 文档必须带日期前缀，即使本次不需要 `docs/logs` 迭代记录也适用。
- `file-naming-convention` skill 增加可执行治理入口说明。
- `lint-doc-file-names` 从单纯 kebab-case 检查升级为文档命名治理检查。
- `doc-file-name-shared` 增加 `docs/designs` / `docs/plans` 日期前缀检查与建议路径。
- `lint-doc-file-names.test` 增加无日期前缀阻断与有日期前缀放行用例。
- `governance-backlog-baseline` 将新规则暴露出的 16 个既有历史 design 文档无日期前缀问题纳入基线，避免 ratchet 把历史债务误判成本次新增。
- 将当前工作区未追踪的 `docs/designs/service-package-split.md` 重命名为 `docs/designs/2026-05-09-service-package-split.md`，只改文件名，不改内容。

同时顺手简化了 `lint-doc-file-names` 中 rename / non-rename 分支的重复路径选择逻辑，并删除未使用的 `isBlockingDocEntry`。

## 测试/验证/验收方式

- `node --test scripts/governance/lint-doc-file-names.test.mjs`
  - 结果：通过，6 个测试。
- `pnpm exec eslint scripts/governance/doc-file-name-shared.mjs scripts/governance/lint-doc-file-names.mjs scripts/governance/report-doc-file-name-violations.mjs scripts/governance/lint-doc-file-names.test.mjs --no-warn-ignored`
  - 结果：通过。
- `pnpm lint:new-code:doc-file-names -- AGENTS.md .agents/skills/file-naming-convention .agents/skills/nextclaw-iteration-log-governance scripts/governance`
  - 结果：通过，当前触达治理文件的文档命名检查通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过；doc file-name violations 当前为 16，baseline 为 16。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
  - 结果：通过，0 error，1 warning；总代码 `+63 / -31 / net +32`，非测试代码 `+27 / -28 / net -1`。
- `pnpm lint:new-code:governance -- AGENTS.md .agents/skills/file-naming-convention/SKILL.md .agents/skills/nextclaw-iteration-log-governance/SKILL.md scripts/governance/doc-file-name-shared.mjs scripts/governance/lint-doc-file-names.mjs scripts/governance/report-doc-file-name-violations.mjs scripts/governance/lint-doc-file-names.test.mjs scripts/governance/governance-backlog-baseline.json docs/logs/v0.18.20-design-plan-date-prefix-governance/README.md docs/designs/2026-05-09-service-package-split.md`
  - 结果：通过。
- `pnpm lint:new-code:governance`
  - 结果：未通过；阻塞来自工作区既有 `packages/nextclaw-service/**` 与 `packages/nextclaw-runtime/src/providers/index.ts` 的 file-role-boundaries 命名问题，不属于本次日期前缀规范改动。

本次不涉及 TypeScript 源码、类型声明、导入导出边界或运行链路配置，因此 `tsc` 不适用。

## 发布/部署方式

未发布、未部署。

本次为治理规则、脚本和测试变更，不涉及后端、数据库、线上服务或 NPM 包发布。

## 用户/产品视角的验收步骤

1. 新建 `docs/designs/runtime-control-design.md` 或 `docs/plans/runtime-control-plan.md`。
2. 运行 `pnpm lint:new-code:doc-file-names`。
3. 预期命令阻断，并建议改为 `docs/designs/YYYY-MM-DD-runtime-control-design.md` 或 `docs/plans/YYYY-MM-DD-runtime-control-plan.md`。
4. 新建 `docs/designs/2026-05-09-runtime-control-design.md` 或 `docs/plans/2026-05-09-runtime-control-plan.md`。
5. 预期命名检查通过。

## 可维护性总结汇总

可维护性复核结论：通过。

代码增减报告：新增 63 行，删除 31 行，净增 32 行。

非测试代码增减报告：新增 27 行，删除 28 行，净增 -1 行。

正向减债动作：简化 / 删除。删除了未使用的 `isBlockingDocEntry`，并把 rename 与普通变更的重复路径解析收敛为单一路径选择，抵消新规则带来的脚本增长。

保留债务：

- `docs/designs` 下仍有 16 个 tracked 历史文档缺少日期前缀，已进入治理 backlog baseline。
- 工作区中已有未追踪 `docs/designs/service-package-split.md` 已只做文件名归一，改为 `docs/designs/2026-05-09-service-package-split.md`。
- `scripts/governance` 目录仍超过目录预算，但已有记录的治理目录例外；本次没有继续增加直接文件数。

## NPM 包发布记录

不涉及 NPM 包发布。
