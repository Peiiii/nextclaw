# v0.15.67-file-name-kebab-governance

## 迭代完成说明

- 新增 `file-name-kebab-case` diff gate：
  - 新文件 [`scripts/lint-new-code-file-names.mjs`](../../../scripts/lint-new-code-file-names.mjs)
  - 接入统一入口 [`scripts/lint-new-code-governance.mjs`](../../../scripts/lint-new-code-governance.mjs)
  - 新增或重命名的源码/脚本/测试文件如果不是 kebab-case，会直接阻断；历史遗留且本次被触达的非 kebab-case 文件默认只告警并给出建议目标名。
- 新增 `file-role-boundaries` diff gate：
  - 新文件 [`scripts/lint-new-code-file-role-boundaries.mjs`](../../../scripts/lint-new-code-file-role-boundaries.mjs)
  - 新增测试 [`scripts/lint-new-code-file-role-boundaries.test.mjs`](../../../scripts/lint-new-code-file-role-boundaries.test.mjs)
  - 接入统一入口 [`scripts/lint-new-code-governance.mjs`](../../../scripts/lint-new-code-governance.mjs)
  - 对新增或重命名文件执行“白名单二级后缀 + 目录与后缀联动”阻断；对本次触达的历史错配文件先 warning，不一次性炸掉存量债务。
- 新增共享命名检查与建议器：
  - [`scripts/file-name-kebab-shared.mjs`](../../../scripts/file-name-kebab-shared.mjs)
  - [`scripts/file-name-kebab-shared.test.mjs`](../../../scripts/file-name-kebab-shared.test.mjs)
  - 统一处理 camelCase / PascalCase / snake_case 到 kebab-case 的识别与建议路径生成。
- 新增仓库级历史命名债务审计入口：
  - [`scripts/report-file-name-kebab-violations.mjs`](../../../scripts/report-file-name-kebab-violations.mjs)
  - [`package.json`](../../../package.json) 新增命令 `pnpm report:file-naming`
  - 当前验证时全仓扫出 `81` 个 legacy 非 kebab 文件名，分布在 `22` 个目录，后续可据此按目录或按触达链路分批迁移。
- 更新治理与使用文档：
  - [`AGENTS.md`](../../../AGENTS.md)
  - [`docs/workflows/file-naming-convention.md`](../../workflows/file-naming-convention.md)
  - [`.agents/skills/file-naming-convention/SKILL.md`](../../../.agents/skills/file-naming-convention/SKILL.md)
  - [`.agents/skills/file-naming-convention/references/file-naming-spec.md`](../../../.agents/skills/file-naming-convention/references/file-naming-spec.md)
  - 让 AI 默认执行路径明确变成：`skill 选名 -> kebab-case diff gate -> 目录/后缀 diff gate -> report 盘点存量 -> 改动即治理渐进迁移`。

## 测试/验证/验收方式

- 语法检查：
  - `PATH=/opt/homebrew/bin:$PATH node --check scripts/file-name-kebab-shared.mjs`
  - `PATH=/opt/homebrew/bin:$PATH node --check scripts/lint-new-code-file-names.mjs`
  - `PATH=/opt/homebrew/bin:$PATH node --check scripts/lint-new-code-file-role-boundaries.mjs`
  - `PATH=/opt/homebrew/bin:$PATH node --check scripts/report-file-name-kebab-violations.mjs`
  - `PATH=/opt/homebrew/bin:$PATH node --check scripts/lint-new-code-governance.mjs`
- 单测：
  - `PATH=/opt/homebrew/bin:$PATH node --test scripts/file-name-kebab-shared.test.mjs scripts/lint-new-code-file-names.test.mjs scripts/lint-new-code-file-role-boundaries.test.mjs`
- 聚合治理入口验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint:new-code:governance -- scripts/file-name-kebab-shared.mjs scripts/file-name-kebab-shared.test.mjs scripts/lint-new-code-file-names.mjs scripts/lint-new-code-file-names.test.mjs scripts/lint-new-code-file-role-boundaries.mjs scripts/lint-new-code-file-role-boundaries.test.mjs scripts/report-file-name-kebab-violations.mjs scripts/lint-new-code-governance.mjs`
  - 结果：通过；新增 `file-name-kebab-case` 与 `file-role-boundaries` 已共同参与统一治理链路。
- 历史债务审计入口验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm report:file-naming -- --limit 10`
  - 结果：正常输出 legacy 非 kebab 文件名清单与建议目标名；当前为 `81` 条 violation、`22` 个目录。
- maintainability guard：
  - `PATH=/opt/homebrew/bin:$PATH node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths scripts/file-name-kebab-shared.mjs scripts/file-name-kebab-shared.test.mjs scripts/lint-new-code-file-names.mjs scripts/lint-new-code-file-names.test.mjs scripts/lint-new-code-file-role-boundaries.mjs scripts/lint-new-code-file-role-boundaries.test.mjs scripts/report-file-name-kebab-violations.mjs scripts/lint-new-code-governance.mjs`
  - 结果：`Errors = 0`，`Warnings = 1`
  - 唯一 warning 为 [`scripts/README.md`](../../../scripts/README.md) 已记录的目录预算豁免，属于仓库既有可接受状态，本次未新增额外目录治理债务。

## 发布/部署方式

- 本次为仓库治理脚本、规则与文档增强，不涉及线上服务部署、数据库 migration、NPM 发布或 GitHub Release。
- 合并后即对后续 AI 改动生效：
  - 日常验证走 `pnpm lint:new-code:governance`
  - 盘点历史命名债务走 `pnpm report:file-naming`

## 用户/产品视角的验收步骤

1. 在任意受治理目录里新建一个非 kebab-case 的源码文件，例如 `FooBar.ts`。
2. 运行 `PATH=/opt/homebrew/bin:$PATH pnpm lint:new-code:governance -- <该文件路径>`。
3. 确认输出直接阻断，并给出建议目标名。
4. 再在 `services/` 下新建一个目录-后缀错配文件，例如 `services/chat-manager.ts`。
5. 再次运行 `PATH=/opt/homebrew/bin:$PATH pnpm lint:new-code:governance -- <该文件路径>`，确认它会因为目录和后缀不一致而阻断。
6. 运行 `PATH=/opt/homebrew/bin:$PATH pnpm report:file-naming -- --limit 10`。
7. 确认它会列出仓库里已有的 legacy 非 kebab 文件名，作为后续 AI 渐进迁移入口。
8. 触达一个历史遗留但命名或目录-后缀错配的已有文件，再运行 `pnpm lint:new-code:governance`，确认当前机制只告警、不强行阻断主任务，并给出修正方向。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。当前目标是把“新增阻断 + 存量审计 + 改动即治理”补成闭环；直接批量重命名 `81` 个历史文件会把机制建设任务扩成高风险跨模块迁移，反而不利于可维护的渐进收敛。
- 本次独立可维护性复核结论：通过，`no maintainability findings`。
- 是否优先遵循删减优先、简化优先、代码更少更好原则：是。没有新增第二套平行治理系统，而是复用现有 `lint:new-code:governance` 主链，只补最小必要的共享 helper、diff gate 和 report 入口。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：这次为治理能力新增，代码与文件数净增长是最小必要。同步偿还的维护性债务是“此前只有规则和 skill、缺少统一机器阻断与历史审计入口”的机制债。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：是。命名校验、diff gate、repo report 三类职责分别放在共享 helper、治理脚本和审计脚本中，没有把逻辑堆回 AGENTS 或单一大脚本。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足。`scripts/` 目录本身仍处于既有扁平豁免状态，本次 guard warning 已复核，原因和豁免说明仍在 [`scripts/README.md`](../../../scripts/README.md) 中明确记录。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行独立复核。针对这轮“目录-后缀联动治理补强”续改范围，代码增减报告为：新增 `493` 行、删除 `27` 行、净增 `466` 行；非测试代码增减报告为：新增 `403` 行、删除 `27` 行、净增 `376` 行。净增长主要来自新增 `file-role-boundaries` diff gate 及规则/文档同步，已经达到当前补强目标下的最小必要；后续真正的减债动作是沿 `pnpm report:file-naming` 清单持续把历史文件迁成 kebab-case，并在触达目录时一并收敛目录-后缀错配。
- 长期目标对齐 / 可维护性推进：这次顺着“代码更少、边界更清晰、行为更可预测”的长期方向推进了一小步，因为后续新文件不再继续制造命名债务，历史债务也首次有了统一清单入口。下一步最自然的推进位点，是在后续相关模块被触达时，优先选择 report 中建议路径最稳定、导入面最小的目录做第一批渐进迁移。
