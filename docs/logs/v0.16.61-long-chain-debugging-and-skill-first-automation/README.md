# v0.16.61-long-chain-debugging-and-skill-first-automation

## 迭代完成说明（改了什么）

- 新增项目私有 skill：
  - [`long-chain-debugging`](../../../.agents/skills/long-chain-debugging/SKILL.md)
  - 配套 UI 元信息：[agents/openai.yaml](../../../.agents/skills/long-chain-debugging/agents/openai.yaml)
- 新增项目私有 skill：
  - [`iteration-work-notes`](../../../.agents/skills/iteration-work-notes/SKILL.md)
  - 配套 UI 元信息：[agents/openai.yaml](../../../.agents/skills/iteration-work-notes/agents/openai.yaml)
- 新增项目私有 skill：
  - [`nextclaw-clean-implementation`](../../../.agents/skills/nextclaw-clean-implementation/SKILL.md)
  - 配套 UI 元信息：[agents/openai.yaml](../../../.agents/skills/nextclaw-clean-implementation/agents/openai.yaml)
- 该 skill 专门面向“长链路 debug 很慢”的场景，把排查流程固定为：
  - `症状定义`
  - `黄金复现`
  - `链路地图`
  - `观察点计划`
  - `当前假设与缩圈实验`
  - `根因与修复位点`
  - `同链路验收`
- skill 正文明确收敛以下长期有效的方法论，而不是零散技巧堆砌：
  - 先冻结症状，再排查
  - 优先建立最小真实复现
  - 用 hop / contract 视角画链路地图
  - 先切链再观测，默认优先二分法
  - 观察点只打在边界，且尽量结构化
  - 一次实验只验证一个假设
  - 找“第一个错误 hop”，而不是只盯最后一个报错点
  - 修复后必须走同链路验收
- 在 [`AGENTS.md`](../../../AGENTS.md) 中，将原先偏“重复流程自动化”的规则直接升级为 `automation-deposition-must-evaluate-script-and-skill`，把“沉淀自动化时必须评估 `script / skill / script + skill` 三种载体”固化为默认机制。
- 在 [`AGENTS.md`](../../../AGENTS.md) 的迭代制度与复杂任务规则中，新增并固化了 `work/` 工作目录机制：
  - 对复杂任务 / 复杂 debug / 长时间运行链路，允许并规范在对应迭代目录下创建 `work/`
  - 默认先使用一个 `work/working-notes.md`
  - `work/` 只用于过程性工作笔记，不替代迭代 `README.md`
  - 禁止仅为了记笔记而提前新建新的迭代目录
- 在 [`AGENTS.md`](../../../AGENTS.md) 的 `Project Rulebook` 中，新增并接入了 `nextclaw-clean-implementation-required`：
  - 代码、脚本、测试和运行链路配置在真正动手前，必须先自动加载 `nextclaw-clean-implementation`
  - 规则本身保持很薄，只负责把“写代码前的垃圾代码风险自检”接入治理链路
- 在 [`AGENTS.md`](../../../AGENTS.md) 中，将已有的 `non-feature-changes-must-not-bloat-codebase` 从“默认应尽量不膨胀”升级为硬门槛：
  - 对纯 bugfix、纯重构、结构整理、命名调整等非新增用户能力改动，排除测试后的非测试代码净增必须 `<= 0`
  - 若 `非测试代码增减报告` 仍为正数，则 `/validate` 与 `/maintainability-review` 必须直接判失败，不得再以“最小必要增长”解释放行
- 仓库原本就有 review 机制，这次没有另造一套新体系，而是直接升级已有入口：
  - [`code-review`](../../../.agents/skills/code-review/SKILL.md) 现在会把“纯非功能改动但非测试代码净增为正”直接视为 finding
  - [`post-edit-maintainability-review`](../../../.agents/skills/post-edit-maintainability-review/SKILL.md) 现在会把这种情况直接判为 `需继续修改`
  - [`nextclaw-clean-implementation`](../../../.agents/skills/nextclaw-clean-implementation/SKILL.md) 也同步前移了这条门槛，要求在动手前就说明如何保证 `非测试代码净增 <= 0`
- 在当前迭代目录下新增示范性工作笔记：
  - [`work/working-notes.md`](./work/working-notes.md)
- `long-chain-debugging` 已同步接入这条机制：当排查跨多轮对话或存在压缩风险时，应配合 `iteration-work-notes` 使用，而不是把所有证据继续只留在聊天上下文里。
- 新增 `nextclaw-clean-implementation` skill，用来在真正写实现前先拦住“垃圾代码”：
  - 先判断能删什么，而不是直接加代码
  - 先判断业务 owner 和主路径，而不是继续让逻辑散落
  - 先判断是不是隐藏 fallback 或补丁式修复
  - 先判断目录、角色、命名和复用边界
  - 需要时再联动 `predictable-behavior-first`、`collapsible-feature-root-architecture`、`role-first-file-organization`、`file-naming-convention`、`long-chain-debugging` 与 `iteration-work-notes`
- 本次没有新增脚本，刻意保持边界清晰：
  - 第一件事是补齐长链路 debug 的方法论 skill
  - 第二件事是把“沉淀经验时别只想到脚本，也要评估 skill”写成治理规则
  - 第三件事是为复杂任务 / 复杂 debug 补上上下文保真的 `work/` 工作目录与工作笔记 skill
  - 第四件事是为“避免写出垃圾代码”补一个写实现前的前置 coding skill
  - 这四件事同时交付，但仍保持各自边界清晰，不再混成一个东西

## 测试/验证/验收方式

- 已执行：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec tsx -e "import { resolve } from 'node:path'; import { SkillsLoader } from './src/index.ts'; const repo = resolve(process.cwd(), '../..'); const loader = new SkillsLoader({ workspace: repo, projectRoot: repo }); const skill = loader.listSkills(false).find((entry) => entry.name === 'long-chain-debugging'); console.log(skill ? JSON.stringify({ name: skill.name, source: skill.source, path: skill.path }, null, 2) : 'MISSING');"`
  - 结果：输出 `name = long-chain-debugging`、`source = project`，说明仓库级 skill 可被发现。
- 已执行：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec tsx -e "import { resolve } from 'node:path'; import { SkillsLoader } from './src/index.ts'; const repo = resolve(process.cwd(), '../..'); const loader = new SkillsLoader({ workspace: repo, projectRoot: repo }); const skill = loader.listSkills(false).find((entry) => entry.name === 'iteration-work-notes'); console.log(skill ? JSON.stringify({ name: skill.name, source: skill.source, path: skill.path }, null, 2) : 'MISSING');"`
  - 结果：输出 `name = iteration-work-notes`、`source = project`，说明新的工作笔记 skill 可被发现。
- 已执行：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec tsx -e "import { resolve } from 'node:path'; import { SkillsLoader } from './src/index.ts'; const repo = resolve(process.cwd(), '../..'); const loader = new SkillsLoader({ workspace: repo, projectRoot: repo }); const skill = loader.listSkills(false).find((entry) => entry.name === 'nextclaw-clean-implementation'); console.log(skill ? JSON.stringify({ name: skill.name, source: skill.source, path: skill.path }, null, 2) : 'MISSING');"`
  - 结果：输出 `name = nextclaw-clean-implementation`、`source = project`，说明新的代码质量 skill 可被发现。
- 已执行：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec tsx -e "import { resolve } from 'node:path'; import { existsSync } from 'node:fs'; import { SkillsLoader } from './src/index.ts'; const repo = resolve(process.cwd(), '../..'); const loader = new SkillsLoader({ workspace: repo, projectRoot: repo }); const skill = loader.getSkillInfo('nextclaw-clean-implementation'); const metadata = skill ? loader.getSkillMetadata(skill) : null; console.log(JSON.stringify({ found: Boolean(skill), source: skill?.source ?? null, name: metadata?.name ?? null, hasDescription: Boolean(metadata?.description), hasOpenAiYaml: existsSync(resolve(repo, '.agents/skills/nextclaw-clean-implementation/agents/openai.yaml')) }, null, 2));"`
  - 结果：输出 `found = true`、`source = project`、`name = nextclaw-clean-implementation`、`hasDescription = true`、`hasOpenAiYaml = true`，说明 frontmatter 可被读取，且配套 UI 元信息文件存在。
- 已执行：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec tsx -e "import { resolve } from 'node:path'; import { existsSync } from 'node:fs'; import { SkillsLoader } from './src/index.ts'; const repo = resolve(process.cwd(), '../..'); const loader = new SkillsLoader({ workspace: repo, projectRoot: repo }); const skill = loader.getSkillInfo('long-chain-debugging'); const metadata = skill ? loader.getSkillMetadata(skill) : null; console.log(JSON.stringify({ found: Boolean(skill), source: skill?.source ?? null, name: metadata?.name ?? null, hasDescription: Boolean(metadata?.description), hasOpenAiYaml: existsSync(resolve(repo, '.agents/skills/long-chain-debugging/agents/openai.yaml')) }, null, 2));"`
  - 结果：输出 `found = true`、`source = project`、`name = long-chain-debugging`、`hasDescription = true`、`hasOpenAiYaml = true`，说明 frontmatter 可被读取，且配套 UI 元信息文件存在。
- 已执行：
  - `rg -n "非测试代码净增|净增 <= 0|判失败|需继续修改" AGENTS.md .agents/skills/code-review/SKILL.md .agents/skills/post-edit-maintainability-review/SKILL.md .agents/skills/nextclaw-clean-implementation/SKILL.md`
  - 结果：命中 `AGENTS.md`、`code-review`、`post-edit-maintainability-review` 与 `nextclaw-clean-implementation`，说明“纯非功能改动非测试代码净增即失败”的硬门槛已经同时接入前置 skill、评审 skill、可维护性复核与验证规则。
- 已执行：
  - `git diff --check -- AGENTS.md .agents/skills/code-review/SKILL.md .agents/skills/post-edit-maintainability-review/SKILL.md .agents/skills/nextclaw-clean-implementation/SKILL.md docs/logs/v0.16.61-long-chain-debugging-and-skill-first-automation/README.md docs/logs/v0.16.61-long-chain-debugging-and-skill-first-automation/work/working-notes.md`
  - 结果：通过，说明本次文档与规则修改没有引入空白符或 patch 级格式问题。
- 已执行：
  - `test -f docs/logs/v0.16.61-long-chain-debugging-and-skill-first-automation/work/working-notes.md`
  - 结果：通过，说明当前迭代的 `work/` 工作笔记已落库。
- `build / lint / tsc`：不适用。
  - 原因：本次仅新增/修改项目规则与 skill 文档，未触达构建、类型或运行链路代码。

## 发布/部署方式

- 本次无需独立部署。
- 规则与 skill 文件合入仓库后即生效。
- 后续在本仓库内进行长链路排查，或把高频经验沉淀为可复用能力时，助手会直接受这两项改动影响。

## 用户/产品视角的验收步骤

1. 打开 [`long-chain-debugging/SKILL.md`](../../../.agents/skills/long-chain-debugging/SKILL.md)，确认它不是泛泛而谈，而是明确要求先写 `症状定义 / 黄金复现 / 链路地图 / 观察点计划 / 当前假设与缩圈实验 / 根因与修复位点 / 同链路验收`。
2. 继续检查该 skill，确认其中明确写出“先切链再观测”“边界观察点”“一次实验只验证一个假设”“找第一个错误 hop”“修后走同链路验收”，并且已经提到跨多轮排查时可配合 `iteration-work-notes` 使用。
3. 打开 [`iteration-work-notes/SKILL.md`](../../../.agents/skills/iteration-work-notes/SKILL.md)，确认它明确要求把复杂任务 / 复杂 debug 的过程性上下文落到对应迭代目录的 `work/working-notes.md`，并包含 `当前事实 / 证据 / 活跃假设 / 已排除项 / 决策 / 下一步` 这类模块。
4. 打开 [`work/working-notes.md`](./work/working-notes.md)，确认当前迭代目录下已经有示范性的工作笔记，不需要再从聊天历史里回捞关键结论。
5. 打开 [`nextclaw-clean-implementation/SKILL.md`](../../../.agents/skills/nextclaw-clean-implementation/SKILL.md)，确认它不是泛泛谈“代码质量”，而是明确要求先判断：`能删什么`、`owner 是谁`、`主路径是什么`、`为什么这不是隐藏 fallback`、`文件为什么放在这里`、`最小可信验证是什么`。
6. 打开 [`AGENTS.md`](../../../AGENTS.md)，确认：
  - Rulebook 中已经存在 `automation-deposition-must-evaluate-script-and-skill`
  - 迭代制度中已经显式允许并规范 `work/` 工作目录
  - `complex-work-needs-staged-plan-docs` 已要求复杂任务在需要时同步维护 `work/`
  - `Project Rulebook` 中已经存在 `nextclaw-clean-implementation-required`
  - `non-feature-changes-must-not-bloat-codebase` 已明确写成硬门槛：纯 bugfix / 重构 / 非功能改动只要 `非测试代码净增 > 0` 就直接失败
  - `/validate` 与 `/maintainability-review` 已明确写出这条失败条件
7. 打开 [`code-review`](../../../.agents/skills/code-review/SKILL.md) 与 [`post-edit-maintainability-review`](../../../.agents/skills/post-edit-maintainability-review/SKILL.md)，确认：
  - review 机制本来就存在，不需要再发明一个新入口
  - 现在两者都已明确把“纯非功能改动但非测试代码净增为正”视为不能放行
8. 随机挑一个未来的纯 bugfix 或纯重构场景，确认按新规则判断时：
  - 若排除测试后的非测试代码净增为负数或 `0`，验证才有资格通过
  - 若排除测试后的非测试代码净增为正数，即使能解释理由，也必须继续改，不能算完成

## 可维护性总结汇总

### 长期目标对齐 / 可维护性推进

本次顺着“让 NextClaw 逐步具备可积累、可复用、可自进化的问题解决能力”的长期方向继续推进了一小步。它不再允许纯 bugfix / 纯重构类改动靠“解释为什么净增也合理”来过关，而是把“非测试代码净增必须 <= 0”写成了前置 skill、review skill、maintainability review 和验证阶段共同遵守的硬门槛。

### 具体判断

- 本次是否已尽最大努力优化可维护性：是。本次没有再平铺多条平行规则，也没有再长出一个新的文档体系，而是把新机制接到现有迭代制度、复杂任务规则和项目私有 skill 位点上。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。这轮没有再把“纯非功能改动净增也可解释通过”留成软约束，而是直接把它改成硬门槛，强制把实现路径压回“删减优先、简化优先”；同时仍然复用现有 review 机制，而不是新造一套并行体系。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：本次有最小必要净增长，原因是必须新增一个独立 skill 目录并更新当前迭代留痕；但同时避免了新增脚本、额外规则文件、第二个迭代目录或新的文档体系，增长仍属最小必要。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。现在边界被进一步拆清：`nextclaw-clean-implementation` 负责写代码前的垃圾代码风险自检，`code-review` 负责 findings-first 评审，`post-edit-maintainability-review` 负责最终主观可维护性复核，`/validate` 负责最终 gate；它们围绕同一硬规则协同，而不是各说各话。
- 目录结构与文件组织是否满足当前项目治理要求：满足。新增内容放在既有 `.agents/skills/<skill-name>/` 与当前迭代 `README.md` / `work/` 之下，没有引入新的散点目录。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：不适用。本次未修改源码、脚本、测试或影响运行链路的配置。
- 若本次迭代不涉及代码可维护性评估，必须明确写“不适用”并说明理由：不适用，原因同上；本次属于项目规则与 skill 文档能力沉淀，不是代码实现或代码重构。

### 可维护性总结

这次改动把“非功能改动不得越改越多”从原则升级成了 gate。以后在这个仓库里，纯 bugfix / 纯重构 / 纯结构整理只要排除测试后的非测试代码净增为正，就不算通过；而且这条判断已经同时出现在实现前、评审中、可维护性复核和最终验证里，不再靠人临场记忆。

## NPM 包发布记录

不涉及 NPM 包发布。
