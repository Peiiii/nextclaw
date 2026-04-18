# v0.16.75-module-structure-governance-closure

## 迭代完成说明

- 本次把“目录层级治理没有真正落地到默认主链路”的缺口补成了三段闭环：
  - 新增机器可读的模块结构 contract 数据源 [`scripts/governance/module-structure/module-structure-contracts.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/module-structure-contracts.mjs)，先覆盖 `packages/nextclaw-ui/src/components/chat`、`packages/nextclaw-ui/src/components/config`、`packages/nextclaw-server/src/ui`、`workers/nextclaw-provider-gateway-api/src`、`apps/platform-admin/src`、`apps/platform-console/src` 六个高风险目录。
  - 新增 diff-only 结构漂移检查 [`scripts/governance/module-structure/lint-new-code-module-structure.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/lint-new-code-module-structure.mjs)，默认拦截三类新增债务：冻结 root 继续长根级文件、白名单外一级目录继续冒出、共享容器里继续塞 `service/manager/controller/provider/router/store` 这类 owner 逻辑。
  - 将该检查接入 [`scripts/governance/lint-new-code-governance.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/lint-new-code-governance.mjs) 与根 [`package.json`](/Users/peiwang/Projects/nextbot/package.json) 的 `pnpm lint:new-code:governance` 主链路，再补充 PR workflow [`structure-governance.yml`](/Users/peiwang/Projects/nextbot/.github/workflows/structure-governance.yml)，让 review 阶段也能自动执行 diff-only 结构治理。
- 新增治理说明文档 [`docs/designs/2026-04-19-module-structure-contracts.md`](/Users/peiwang/Projects/nextbot/docs/designs/2026-04-19-module-structure-contracts.md)，把 contract 字段、shared 容器边界和“什么时候先改 contract 再落目录”写成明确结构规范。
- 根因记录：
  - 根因不是“仓库完全没有结构治理脚本”，而是此前只有命名治理、flat-directory、frozen-directory、topology report 等分散机制，没有一份模块级结构 contract 作为单一事实来源，也没有一条默认 diff-only gate 去判断“这个模块允许怎么长”。
  - 这一点通过代码路径确认：`lint:new-code:governance` 之前没有任何 `module-structure` 检查，`.github/workflows/` 中也没有专门跑结构治理的 PR workflow；`check:topology` 虽存在，但当前全仓仍有 `26` 个既有 cross-layer violation，只能作为报告命令，不能直接粗暴接成 blocking gate。
  - 因此之前的真实状态是：规则/skill/README 已经写了很多，但目录层级约束没有形成“contract -> diff gate -> PR workflow”闭环，所以团队体感会等同于“没管”。
- 本次修复命中根因而不是只处理表象，因为新增的是结构 contract 与默认入口接线本身，而不是再补一条口头规则或单目录例外说明。
- 相关设计与说明：
  - [2026-04-02-structure-governance-hardening-plan.md](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-02-structure-governance-hardening-plan.md)
  - [2026-04-19-module-structure-contracts.md](/Users/peiwang/Projects/nextbot/docs/designs/2026-04-19-module-structure-contracts.md)

## 测试/验证/验收方式

- 已通过：`node --test scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- 已通过：`pnpm lint:new-code:module-structure -- scripts/governance/module-structure/lint-new-code-module-structure.mjs scripts/governance/module-structure/module-structure-contracts.mjs scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- 已通过：`pnpm lint:new-code:governance -- scripts/governance/module-structure/lint-new-code-module-structure.mjs scripts/governance/module-structure/module-structure-contracts.mjs scripts/governance/module-structure/lint-new-code-module-structure.test.mjs scripts/governance/lint-new-code-governance.mjs`
- 已通过：`pnpm check:governance-backlog-ratchet`
- 已通过：`ruby -e 'require "yaml"; YAML.load_file(".github/workflows/structure-governance.yml"); puts "yaml ok"'`
- 已通过：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths package.json scripts/governance/README.md scripts/governance/lint-new-code-governance.mjs scripts/governance/module-structure/module-structure-contracts.mjs scripts/governance/module-structure/lint-new-code-module-structure.mjs scripts/governance/module-structure/lint-new-code-module-structure.test.mjs .github/workflows/structure-governance.yml`
- 当前未作为 blocking gate 接入的项：`pnpm check:topology`
  - 原因：仓库现状仍有历史 cross-layer violation backlog，本次按根因优先顺序先补“目录层级 contract + diff gate + PR workflow”，把 topology 继续保留为 PR 报告产物，而不是直接炸掉全仓准入。

## 发布/部署方式

- 无需产品发布或服务部署。
- 合入后即可生效：
  - 本地收尾时运行 `pnpm lint:new-code:governance`
  - PR 阶段自动触发 `.github/workflows/structure-governance.yml`

## 用户/产品视角的验收步骤

1. 在一个受 contract 约束的目录里尝试新增根级文件，例如向 `packages/nextclaw-ui/src/components/chat/` 新增 `chat-draft-toolbar.tsx`。
2. 运行 `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/chat/chat-draft-toolbar.tsx`，确认会直接失败，提示该模块 root 已冻结，应改放到白名单子树。
3. 在受约束目录下尝试新增白名单之外的一级目录，例如 `apps/platform-console/src/runtime/runtime-shell.tsx`。
4. 运行 `pnpm lint:new-code:governance -- apps/platform-console/src/runtime/runtime-shell.tsx`，确认会直接失败，提示一级目录不在 module structure whitelist 中。
5. 在 PR 中提交上述违规改动，确认 `structure-governance` workflow 会自动运行并阻断。
6. 查看 workflow 上传的 `topology-governance-report` artifact，确认 review 阶段能同时看到全仓 topology 报告。

## 可维护性总结汇总

- 是否已尽最大努力优化可维护性：是。本次目标不是业务重构，而是把“目录层级治理”补成最小可运行闭环；已优先复用既有 `lint:new-code:governance` 和 ratchet 主链，没有再造第二套平行入口。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。没有把 full topology backlog 粗暴接成 blocking gate，也没有扩成仓库级结构重写；新增内容集中在一个新的 `module-structure/` 子树与一条 workflow，复杂度增长限定在最小必要范围内。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：目录组织层面有改善。虽然总代码净增，但新增代码是为了提供此前缺失的结构治理能力；同时把新治理逻辑收进了 `scripts/governance/module-structure/` 子树，而不是继续把 `scripts/governance/` 根目录摊平。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：更清晰。结构 contract、检查器、workflow 与说明文档各自承担单一职责，没有把 contract 数据、diff 判断和 CI 接线混在一个巨型脚本里。
- 目录结构与文件组织是否满足当前项目治理要求：本次新增内容满足。新增治理能力已放入独立子树 `scripts/governance/module-structure/`；保留债务是 `scripts/governance/` 根目录整体仍然偏拥挤，但本次没有继续把新逻辑摊回根目录。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。结论如下：
  - 长期目标对齐 / 可维护性推进：是，这次顺着“目录边界更明确、默认入口更统一、review 更可预测”的方向推进了一步。它增强的是 NextClaw 作为长期统一入口产品的内部演进能力，因为后续新能力更不容易继续掉进平铺失控目录。
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：584 行
    - 删除：0 行
    - 净增：+584 行
  - 非测试代码增减报告：
    - 新增：375 行
    - 删除：0 行
    - 净增：+375 行
  - 可维护性总结：这次净增长主要来自一项新的治理能力，而不是非功能性补丁膨胀；同时已把新增逻辑收敛进独立子树，并复用现有聚合命令与 ratchet 主链，避免继续堆第二套治理系统。剩余观察点是后续逐步扩充 contract 覆盖面，并在 topology backlog 下降后再评估 full topology blocking gate。
- 不适用项：无。

## NPM 包发布记录

- 不涉及 NPM 包发布。
