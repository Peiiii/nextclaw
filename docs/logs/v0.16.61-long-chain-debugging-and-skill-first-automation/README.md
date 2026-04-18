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
7. 随机挑一个未来的重复问题场景，例如“发布前固定检查”或“长链路排障方法”，确认按规则判断时：
  - 固定、稳定、低判断的步骤会落到 `script`
  - 强依赖判断与排查策略的流程会落到 `skill`
  - 同时需要稳定动作与高层判断时会落到 `script + skill`

## 可维护性总结汇总

### 长期目标对齐 / 可维护性推进

本次顺着“让 NextClaw 逐步具备可积累、可复用、可自进化的问题解决能力”的长期方向继续推进了一小步。它没有把“避免写出垃圾代码”的经验继续分散在 Rulebook 零散条目和聊天提醒里，而是把这套前置判断收成了一个真正能在实现前触发的项目私有 skill，同时仍保持 Rulebook 只负责路由，不负责塞满细节。

### 具体判断

- 本次是否已尽最大努力优化可维护性：是。本次没有再平铺多条平行规则，也没有再长出一个新的文档体系，而是把新机制接到现有迭代制度、复杂任务规则和项目私有 skill 位点上。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。这轮没有再把“避免垃圾代码”的所有细节堆回 Rulebook，而是新增一个专门 skill 承载实现前判断；同时 `Project Rulebook` 只增加了一条很薄的接入规则，避免治理说明继续肿胀。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：本次有最小必要净增长，原因是必须新增一个独立 skill 目录并更新当前迭代留痕；但同时避免了新增脚本、额外规则文件、第二个迭代目录或新的文档体系，增长仍属最小必要。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。现在边界被进一步拆清：`nextclaw-clean-implementation` 负责“写代码前的垃圾代码风险自检”，`long-chain-debugging` 负责排障方法，`iteration-work-notes` 负责复杂过程上下文连续性，`predictable-behavior-first` 等 skill 继续承接专题深入判断；没有再把所有概念混成一个模糊大 skill。
- 目录结构与文件组织是否满足当前项目治理要求：满足。新增内容放在既有 `.agents/skills/<skill-name>/` 与当前迭代 `README.md` / `work/` 之下，没有引入新的散点目录。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：不适用。本次未修改源码、脚本、测试或影响运行链路的配置。
- 若本次迭代不涉及代码可维护性评估，必须明确写“不适用”并说明理由：不适用，原因同上；本次属于项目规则与 skill 文档能力沉淀，不是代码实现或代码重构。

### 可维护性总结

这次改动把四类本来容易混在一起的事情拆清楚了：长链路 debug 的方法论沉淀成 `skill`，经验自动化的载体选择沉淀成规则，复杂过程里的易失上下文沉淀成迭代 `work/` 工作笔记，而“写代码前怎么避免垃圾代码”则收敛成实现前的前置 coding skill。虽然仓库文件数有最小必要增长，但治理结构反而更完整也更简单了，因为关键知识不再只能散落在聊天历史或零散规则里。

## NPM 包发布记录

不涉及 NPM 包发布。
