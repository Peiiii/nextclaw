# 迭代完成说明

本次迭代收紧了仓库的两条通用职责目录规则：

- `hooks/` 现在被正式视为和 `services/`、`utils/`、`stores/` 一样的平铺职责目录，目录下禁止再出现任何子目录，只允许直接文件。
- `lib/` 现在被明确写成模块容器目录，目录下只能出现模块子目录，不允许直接堆文件。

本次命中的根因有两层：

- 规范文本虽然已经要求 hook 文件必须落在 `hooks/` 并使用 `use-*.ts(x)` 命名，但治理系统没有把 `hooks` 纳入“flat role directory”名单，导致模块结构检查只能约束文件命名，不能阻断 `hooks/<subtree>/...` 这种继续分层的目录漂移。
- `shared/lib` 的代码治理里已经存在“直属文件禁止、必须先建模块目录”的硬约束，但 skill / workflow / 总规则没有把这条边界清楚写出来，导致规范文本与现有拦截能力之间仍有认知缺口。

本次修复直接命中根因，而不是只补表面提示：

- 在 [`scripts/governance/module-structure/module-structure-contracts.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/module-structure-contracts.mjs) 中把 `hooks` 纳入 `FLAT_ROLE_DIRECTORY_NAMES`
- 利用现有 [`module-structure-flat-role-findings.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/module-structure-flat-role-findings.mjs) 的统一能力，让 `hooks/<subdir>/...` 自动触发 “may only contain direct files” 硬错误
- 在 [`scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/lint-new-code-module-structure.test.mjs) 中补了 package root、feature、shared 三类场景的回归测试
- 在 [`.agents/skills/file-naming-convention/SKILL.md`](/Users/peiwang/Projects/nextbot/.agents/skills/file-naming-convention/SKILL.md)、[`.agents/skills/file-organization-governance/SKILL.md`](/Users/peiwang/Projects/nextbot/.agents/skills/file-organization-governance/SKILL.md)、[`docs/workflows/file-naming-convention.md`](/Users/peiwang/Projects/nextbot/docs/workflows/file-naming-convention.md) 与 [`AGENTS.md`](/Users/peiwang/Projects/nextbot/AGENTS.md) 中把“`hooks/` 必须平铺、禁止子目录”和“`lib/` 下只能出现模块目录、不能直接放文件”写成明确规则，避免文档、skill 与脚本再次漂移

# 测试/验证/验收方式

- `node --test scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- `pnpm lint:new-code:governance -- --files AGENTS.md docs/workflows/file-naming-convention.md scripts/governance/module-structure/module-structure-contracts.mjs scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths AGENTS.md docs/workflows/file-naming-convention.md scripts/governance/module-structure/module-structure-contracts.mjs scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- `pnpm check:governance-backlog-ratchet`

验证结果：

- 模块结构测试通过，新增的 `hooks` 平铺约束在 package root、feature、shared 三类场景都能被正确拦截
- 增量 governance 全部通过，没有引入新的命名、目录或模块结构回归
- maintainability guard 通过，纯规范治理场景下非测试代码净增为 `0`
- governance backlog ratchet 通过，tracked backlog 没有反弹
- `lib` 的文本规则现已和既有 `shared/lib` 模块边界拦截保持一致：直属文件不允许，必须先创建模块目录

# 发布/部署方式

本次不涉及运行时发布或部署。

合并后即可生效；后续任何新增或修改的 `hooks/<subdir>/...` 路径都会在治理检查中被直接拦截。

# 用户/产品视角的验收步骤

1. 在任意受协议治理的模块里，尝试新增类似 `src/features/chat/hooks/runtime/use-chat-runtime.ts` 的路径。
2. 运行 `pnpm lint:new-code:governance -- --files <that-file>` 或对应增量治理流程。
3. 确认治理报错包含 `hooks/ may only contain direct files`，并明确指出嵌套子目录不允许。
4. 改为把 hook 文件直接落在对应 `hooks/` 目录下，例如 `src/features/chat/hooks/use-chat-runtime.ts`。
5. 再次运行治理流程，确认不再因为 `hooks` 子目录触发模块结构错误。
6. 在支持 `shared/lib` 约束的模块里，尝试新增类似 `src/shared/lib/date-format.utils.ts` 的直属文件。
7. 运行治理流程，确认报错包含 `files cannot live directly under 'shared/lib/'`，并提示先创建模块目录。
8. 改为落到 `src/shared/lib/date-format/index.ts` 与对应模块文件后，再次运行治理流程，确认 `lib` 结构符合要求。

# 可维护性总结汇总

本次已尽最大努力优化可维护性：是。

本次优先遵循了“删减优先、简化优先、代码更少更好”的原则：是。没有新增新的特判脚本或重复规则，而是复用现有 flat-role 检查，只把 `hooks` 补回正确的职责名单。

本次是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。非测试代码净增为 `0`，同时补上了一个长期存在的治理漏洞，没有引入新的运行时实现复杂度。

抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：是。`hooks` 的目录边界现在和其它通用职责目录保持一致，不再存在“命名像职责目录、结构却还能继续分层”的语义漂移；`lib` 的文本规则也和现有模块边界约束对齐，不再靠口头约定记忆。

目录结构与文件组织是否满足当前项目治理要求：本次触达范围内满足。`hooks/` 的规范文本与治理系统现已对齐；`lib/` 也已被明确写成“只能挂模块目录”的规则。后续若继续新增 `hooks` 子目录或 `lib` 直属文件，会分别被模块结构检查直接阻断或被现有 `shared/lib` 规则拦截。

本次可维护性评估是否基于独立于实现阶段的复核：是。除模块结构测试与 governance 验证外，还额外执行了 `post-edit-maintainability-guard` 做独立复核；结果为通过，且非测试净增保持 `0`。

长期目标对齐 / 可维护性推进：这次不是新增能力，而是把一个“说得严、拦得松”的规范缺口收成真正的硬约束，让目录治理更一致、更可预测。后续若还要继续收紧通用职责目录边界，应该优先沿用同一类“先统一 contract，再复用现有 gate”的做法，而不是继续堆单点特判。

# NPM 包发布记录

不涉及 NPM 包发布。
