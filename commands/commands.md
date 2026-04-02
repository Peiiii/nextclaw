# Commands

本文件只记录“本项目管理/协作/治理相关”的元指令，定位与 Rulebook 类似。
不收录 package 命令、产品 CLI 命令、部署脚本命令或其它业务执行命令；这类内容应写入对应产品文档、使用文档或发布文档。

- `/new-command`: 新建一条项目管理元指令的元指令。流程：先判断该命令是否属于本项目管理/协作/治理范围；仅当符合范围时，确认名称、用途、输入格式、输出/期望行为，写入本文件并保持 `AGENTS.md` 索引同步。
- `/config-meta`: 调整或更新 `AGENTS.md` 中的机制/元信息（如规则、流程、索引等）的指令。执行时必须先自行判断：应修正已有规则，还是在 Rulebook/Project Rulebook 中删减/新增规则条目；必须先分析深层原因并优先处理更本质的问题，避免只做表层修补；若已开启深思模式，还需推理用户潜在意图、读懂暗示并直接执行高概率期望动作，以减少沟通成本；并明确变更点与预期影响。迭代记录策略：仅当本次改动触达代码或属于重大机制变更时，才要求新增 `docs/logs` 迭代记录；普通元信息微调不强制新增。
- `/add-to-plan`: 将想法或用户建议纳入规划体系。输入：`/add-to-plan <一句话事项>`（可选：来源、优先级、owner）。输出/期望行为：先写入 `docs/TODO.md` 的 `Inbox`，给出 `Now/Next/Later/Roadmap Candidate` 分流建议，并生成对应 Issue 草案；若属于中长期方向，同步更新 `docs/ROADMAP.md`。
- `/check-meta`: 检查 `AGENTS.md` 机制是否自洽、是否符合自身规范的指令。输出需包含发现的问题与修复建议（若无问题需明确说明）。
- `/new-rule`: 创建新规则条目的指令。执行时必须先判断该规则属于可跨项目复用的通用规则，还是依赖本项目路径/工具链/发布方式的项目规则；随后按 Rulebook 模板写全字段并更新 `AGENTS.md` 规则区。若规则本质是在约束系统行为原则，应优先固化“行为明确、清晰、可预测，不依赖隐藏兜底或环境状态制造 surprise success / surprise failure”这类高层约束，而不是只记录单次问题的表层补丁。
- `/commit`: 进行提交操作（提交信息需使用英文）。
- `/maintainability-review`: 对本次改动执行一轮独立于实现阶段的可维护性复核。输入：`/maintainability-review`（可选：`<paths...>` 作为聚焦范围）。输出/期望行为：使用 skill [`.agents/skills/post-edit-maintainability-review/SKILL.md`](../.agents/skills/post-edit-maintainability-review/SKILL.md) 检查“能否删减、能否简化、是否让代码继续膨胀、非功能改动的增长是否最小必要、抽象与职责边界是否更清晰”，并给出 `可维护性复核结论：通过 / 需继续修改 / 保留债务经说明接受` 以及 `本次顺手减债：是/否`。
- `/validate`: 对项目进行验证，按改动影响范围执行最小充分验证；仅当改动触达构建/类型/运行链路时，执行 `build`、`lint`、`tsc` 的相关项，必要时补充冒烟测试。代码改动收尾默认执行 `pnpm lint:maintainability:guard`，并通过统一入口 `pnpm lint:new-code:governance` 运行新改动治理规则（当前包含 touched class / touched object 箭头函数治理、closure-object-to-class、flat-directory-needs-subtree、stateful-orchestrator-must-have-owner）；在守卫之后，还应使用 skill [`.agents/skills/post-edit-maintainability-review/SKILL.md`](../.agents/skills/post-edit-maintainability-review/SKILL.md) 再做一轮主观可维护性复核。执行前需确认验证范围和可跳过项。
- `/release-frontend`: 前端一键发布（仅 UI 变更场景）。输入：`/release-frontend`。输出：生成 UI changeset，并执行 `pnpm release:version` + `pnpm release:publish`，最终发布 `@nextclaw/ui` 与 `nextclaw`。

（后续指令在此追加，保持格式一致。） 
