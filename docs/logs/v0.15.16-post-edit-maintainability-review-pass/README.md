# v0.15.16-post-edit-maintainability-review-pass

## 迭代完成说明

- 新增仓库内 skill [`.agents/skills/post-edit-maintainability-review/SKILL.md`](../../../.agents/skills/post-edit-maintainability-review/SKILL.md)，把“代码守卫通过之后，还要再做一轮主观可维护性复核”的流程收敛为标准的 `skill + AGENTS` 组合。
- 新增 skill UI 元信息文件 [`.agents/skills/post-edit-maintainability-review/agents/openai.yaml`](../../../.agents/skills/post-edit-maintainability-review/agents/openai.yaml)，方便后续直接以统一入口调用。
- 在 [`AGENTS.md`](../../../AGENTS.md) 中补强收尾闭环：
  - 迭代 README 的 `可维护性总结汇总` 默认应基于独立的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果。
  - 新增 `post-edit-maintainability-review-required` 规则，要求代码任务在 `post-edit-maintainability-guard` 之后，再做一次专门的可维护性复核。
  - 把 `/validate` 扩成“守卫 + 主观复核”的双阶段收尾流程，并新增 `/maintainability-review` 指令索引，统一指向该 skill。
- 在 [`commands/commands.md`](../../../commands/commands.md) 中新增 `/maintainability-review`，同时明确 `/validate` 在可量化守卫之后，还必须再执行一次非指标型可维护性复核。
- 这次机制补上的重点，不只是“再看一眼”，而是把以下判断显式纳入默认复核问题集：
  - 能不能删
  - 删不掉还能不能再简化
  - 是否优先遵循“代码更少更好、复杂度更低更好、清晰度更高更好”
  - 非功能改动的代码增长是否属于最小必要
  - 抽象和模块边界是否更清晰
  - 是否只是把复杂度换个位置继续保留

## 测试/验证/验收方式

- 本次改动未触达项目运行时代码、构建脚本或类型链路，`build` / `lint` / `tsc` 不适用。
- 本次改动也未触达源码、脚本、测试文件或影响运行链路的配置，`post-edit-maintainability-guard` 不适用。
- 执行文本与引用校验：
  - `rg -n "post-edit-maintainability-review-required|/maintainability-review|post-edit-maintainability-review" AGENTS.md commands/commands.md .agents/skills/post-edit-maintainability-review/SKILL.md`
  - `test -f .agents/skills/post-edit-maintainability-review/SKILL.md`
  - `test -f .agents/skills/post-edit-maintainability-review/agents/openai.yaml`
  - `test -f docs/logs/v0.15.16-post-edit-maintainability-review-pass/README.md`
- 验证点：
  - `AGENTS.md` 中存在新增规则 `post-edit-maintainability-review-required`
  - `commands/commands.md` 中存在新增指令 `/maintainability-review`
  - `/validate` 已明确改为“守卫后再做主观可维护性复核”
  - skill 中明确包含“删除优先、简化优先、代码更少更好、非功能改动不能无谓膨胀、边界更清晰、不能伪解决”这类复核问题集

## 发布/部署方式

- 本次为仓库治理机制、命令索引与 skill 文档更新，无独立发布、部署、迁移或前端发布动作。
- 合入后，该机制随仓库后续代码任务默认生效，无需额外环境变更。

## 用户/产品视角的验收步骤

1. 打开 [`.agents/skills/post-edit-maintainability-review/SKILL.md`](../../../.agents/skills/post-edit-maintainability-review/SKILL.md)，确认它已经明确区分“守卫通过”和“结构真的更可维护”不是一回事。
2. 打开 [`AGENTS.md`](../../../AGENTS.md)，确认存在 `post-edit-maintainability-review-required`，并且其问题集明确要求检查“能不能删、能不能简化、代码是否继续膨胀、边界是否更清晰、是否只是把复杂度换个位置保留”。
3. 打开 [`commands/commands.md`](../../../commands/commands.md)，确认存在 `/maintainability-review`，且 `/validate` 已把这轮复核接进默认收尾动作。
4. 之后让 AI 完成任意一次代码任务，观察最终说明里是否不再只写“guard 通过”，而会额外给出：
   - `可维护性复核结论：通过 / 需继续修改 / 保留债务经说明接受`
   - `本次顺手减债：是/否`
   - 若保留债务，原因、风险与下一步拆分缝

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。本次目标本身就是补强 AI 开发收尾阶段对可维护性的判断质量，不只是补一条措辞，而是把规则、命令入口、skill 与迭代留痕接成闭环。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。方案没有新增脚本或重复机制，而是复用现有 `code-review` 视角和已有守卫链路，只新增最小必要的 skill 文档与规则接线，把“代码更少更好”直接写进复核问题集。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：总体仅最小必要增长。新增了一个 skill 目录和一个迭代留痕文件，同时在既有规则与命令入口上做接线，没有再新增第二套守卫脚本或并行机制；同步偿还的维护性债务是“过去只有量化守卫，没有独立主观二审”的机制缺口。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。此次没有引入新的运行时抽象，而是把“守卫负责拦新增债务、复核负责判断能否进一步删减/简化”的职责边界写清楚，避免以后把所有维护性判断都硬塞进 guard 或 lint。
- 目录结构与文件组织是否满足当前项目治理要求；若未满足，必须记录具体现状、为何本次未处理、以及下一步整理入口：满足。本次新增文件均落在既有治理目录下：skill 文档进入 `.agents/skills/post-edit-maintainability-review/`，迭代留痕进入 `docs/logs/v<semver>-<slug>`，未引入新的平铺失控目录。
