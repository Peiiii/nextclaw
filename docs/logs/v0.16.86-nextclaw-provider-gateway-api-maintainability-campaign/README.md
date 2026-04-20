# 迭代完成说明

本迭代继续完成了 `workers/nextclaw-provider-gateway-api` 的严格结构治理，并把相关检测系统的规则缺口一并补齐。当前交付仍然是非功能改动，没有新增用户能力。

本轮确认的根因有四层，而且都已经命中处理：

- `module-structure` contract 曾经放错位置、还出现过自造 shell / 自造 organization model，导致模块没有被稳定纳入仓库统一协议。
- 协议文档与协议检测此前只写了“角色目录和文件后缀要对应”，却没有明确写出“带固定 `.role.ts(x)` 映射的通用职责目录内部只能直放文件，不能再套领域子目录”，所以 `services/platform/`、`controllers/marketplace/` 这类结构会被误判为可接受。
- `file-role-boundaries` 治理器本身没有把 `routes/`、`presenters/` 当成完整一等角色，导致已经合规的 `*.route.ts(x)`、`*.presenter.ts(x)` 也可能被误报。
- `flat-directories-subtree` 规则仍在要求扁平目录继续长子树，但这和“固定角色目录只能直放文件”的严格协议是直接冲突的，导致治理系统内部自相矛盾。

这些根因通过以下证据被确认：

- 文档 [`docs/designs/2026-04-19-module-structure-contracts.md`](/Users/peiwang/Projects/nextbot/docs/designs/2026-04-19-module-structure-contracts.md) 在本轮前只有角色后缀映射，没有写出“角色目录内部禁止子目录”的硬约束。
- 检测脚本 [`scripts/governance/module-structure/module-structure-protocol-checks.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/module-structure-protocol-checks.mjs) 在本轮前不会阻断 `services/foo/...`、`controllers/bar/...` 这种嵌套路径。
- 治理脚本 [`scripts/governance/lint-new-code-file-role-boundaries.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/lint-new-code-file-role-boundaries.mjs) 在本轮前缺少 `routes` / `presenters` 角色映射，导致 `routes/app.route.ts` 这类文件也会被误报。
- `pnpm lint:new-code:governance -- ...` 在本轮中真实暴露了上述漏检和规则冲突，而不是纸面推断。

本次修复命中了根因，而不是只处理表象：

- [`workers/nextclaw-provider-gateway-api/module-structure.config.json`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/module-structure.config.json) 现已稳定落在包根，并使用真实 `contractKind: "protocol"` + `protocol: "package-l1"`。
- [`docs/designs/2026-04-19-module-structure-contracts.md`](/Users/peiwang/Projects/nextbot/docs/designs/2026-04-19-module-structure-contracts.md) 现已明确写出：凡带固定 `.role.ts(x)` 映射的通用职责目录，只能直放文件，禁止继续套领域子目录；复杂领域必须提升为真正的业务 owner 根，而不是躲进 `services/` / `controllers/` / `utils/` / `configs/` 里。
- [`scripts/governance/module-structure/module-structure-contracts.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/module-structure-contracts.mjs) 新增 `FLAT_ROLE_DIRECTORY_NAMES`，作为协议层统一真相源。
- [`scripts/governance/module-structure/module-structure-protocol-checks.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/module-structure-protocol-checks.mjs) 现已在 `package-l1`、`feature`、`command`、`shared`、`platform` 这些协议边界上一致阻断角色目录内部子目录。
- [`scripts/governance/lint-new-code-file-role-boundaries.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/lint-new-code-file-role-boundaries.mjs) 现已补齐 `managers`、`presenters`、`routes` 的目录角色映射，同时允许 `*.presenter.ts(x)` 与 `*.route.ts(x)`。
- [`scripts/governance/lint-new-code-flat-directories.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/lint-new-code-flat-directories.mjs) 现已识别协议 flat role dir，不再错误要求这些目录继续长子树。
- [`workers/nextclaw-provider-gateway-api/src`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src) 当前顶层只保留 `app / configs / controllers / repositories / routes / services / types / utils` 与入口文件 `index.ts / main.ts`。
- `workers/nextclaw-provider-gateway-api` 内此前存在的角色目录子树已经全部压平：
  - `configs/auth-browser/*`、`configs/remote-quota/*` 已压回 [`src/configs`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/configs)
  - `controllers/auth/*`、`controllers/marketplace/*`、`controllers/remote/*` 已压回 [`src/controllers`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/controllers)
  - `services/auth-browser/*`、`services/platform/*`、`services/remote-quota/*` 已压回 [`src/services`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/services)
  - `utils/auth-browser/*`、`utils/remote-quota/*`、`utils/remote-relay/*` 已压回 [`src/utils`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/utils)
- `routes` 文件名也已继续收正为 [`workers/nextclaw-provider-gateway-api/src/routes/app.route.ts`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/routes/app.route.ts)，不再残留 `app.routes.ts` 这类不合规命名。

当前结果可以用一句话概括：

- 这次不再存在“代码按严格规范整理了，但检测系统自己还在放水或互相打架”的例外；规范、检测器和 worker 现状已经重新对齐。

过程记录见：

- [work/working-notes.md](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.86-nextclaw-provider-gateway-api-maintainability-campaign/work/working-notes.md)
- [work/state.json](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.86-nextclaw-provider-gateway-api-maintainability-campaign/work/state.json)

# 测试 / 验证 / 验收方式

本次已执行并通过：

- `node --test scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- `node --test scripts/governance/lint-new-code-file-role-boundaries.test.mjs`
- `node --test scripts/governance/lint-new-code-flat-directories.test.mjs`
- `pnpm -C workers/nextclaw-provider-gateway-api lint`
- `pnpm -C workers/nextclaw-provider-gateway-api tsc`
- `pnpm -C workers/nextclaw-provider-gateway-api test:quota`
- `pnpm lint:new-code:governance -- workers/nextclaw-provider-gateway-api scripts/governance/module-structure scripts/governance/lint-new-code-file-role-boundaries.mjs scripts/governance/lint-new-code-file-role-boundaries.test.mjs scripts/governance/lint-new-code-flat-directories.mjs scripts/governance/lint-new-code-flat-directories.test.mjs docs/designs/2026-04-19-module-structure-contracts.md docs/logs/v0.16.86-nextclaw-provider-gateway-api-maintainability-campaign`
- `pnpm check:governance-backlog-ratchet`

验证结论：

- `module-structure` 定向测试：`36/36` 通过
- `file-role-boundaries` 定向测试：`19/19` 通过
- `flat-directories` 定向测试：`5/5` 通过
- worker `lint`：通过
- worker `tsc`：通过
- worker `build + quota runner`：通过，`10/10`
- new-code governance：通过
- governance backlog ratchet：通过

# 发布 / 部署方式

本轮只涉及结构治理、规则治理与定向测试，不涉及新的发布步骤，也不需要额外部署变更。

如需继续验证 worker 构建链路，仍按现有流程：

- `pnpm -C workers/nextclaw-provider-gateway-api build`
- `pnpm -C workers/nextclaw-provider-gateway-api deploy`

# 用户 / 产品视角的验收步骤

1. 打开 [`workers/nextclaw-provider-gateway-api/src`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src)，确认顶层只剩通用职责目录与 `index.ts / main.ts`。
2. 分别打开 [`src/configs`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/configs)、[`src/controllers`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/controllers)、[`src/services`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/services)、[`src/utils`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/utils)，确认内部只直接放文件，不再存在领域子目录。
3. 打开 [`docs/designs/2026-04-19-module-structure-contracts.md`](/Users/peiwang/Projects/nextbot/docs/designs/2026-04-19-module-structure-contracts.md)，确认“固定 `.role.ts(x)` 映射目录内部只能直放文件”的约束已经写成硬规则。
4. 运行 `node --test scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`，确认协议测试会阻断 `services/foo/...`、`controllers/bar/...` 这类嵌套路径。
5. 运行 `pnpm lint:new-code:governance -- workers/nextclaw-provider-gateway-api scripts/governance/module-structure scripts/governance/lint-new-code-file-role-boundaries.mjs scripts/governance/lint-new-code-flat-directories.mjs docs/designs/2026-04-19-module-structure-contracts.md`，确认治理系统不会再出现“有的规则允许套目录、有的规则强迫套目录”的冲突。
6. 运行 `pnpm -C workers/nextclaw-provider-gateway-api test:quota`，确认 worker 行为链路没有因重命名与目录压平而回归。

# 可维护性总结汇总

本次是否已尽最大努力优化可维护性：是。当前最核心的问题已经不再是某个文件脏，而是规则之间不一致、检测器本身有漏口和互相冲突；本轮直接把这层根因清掉了。

是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。实现方式不是继续加 README 例外或再发明壳层，而是删除角色目录内部子树、删除错误预期、删除治理系统里的规则缺口与冲突。

是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。当前 diff 总体仍为显著净删减；同时 `configs / controllers / services / utils` 下的领域子目录已经完全清空，目录结构比上一轮更收敛、更统一。

抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。现在的边界更清晰地分成两层：

- 业务 owner 根目录只能是 `features / commands / platforms` 这类真正的业务边界
- `configs / controllers / services / utils / ...` 这类固定角色目录只承载直接文件，不再偷偷承担业务树职责

目录结构与文件组织是否满足当前项目治理要求：在本轮范围内满足。`workers/nextclaw-provider-gateway-api` 已满足当前严格 `package-l1` 预期，治理脚本也已被修到与这份预期一致。

若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已基于独立复核判断为“通过”。关键理由不是“命令都绿了”这么简单，而是：

- 这次修掉的是规则层真空和规则层冲突，而不是只修一批路径
- worker 结构、协议文档、协议检测、角色边界检测、flat-directory 检测已经统一到同一套严格预期
- 没有为了通过检查再引入新的例外壳、兼容分支或临时 README 豁免

# NPM 包发布记录

不涉及 NPM 包发布。
