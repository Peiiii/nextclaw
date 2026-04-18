# v0.16.61-long-chain-debugging-and-skill-first-automation

## 迭代完成说明（改了什么）

- 新增项目私有 skill：
  - [`long-chain-debugging`](../../../.agents/skills/long-chain-debugging/SKILL.md)
  - 配套 UI 元信息：[agents/openai.yaml](../../../.agents/skills/long-chain-debugging/agents/openai.yaml)
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
- 本次没有新增脚本，刻意保持边界清晰：
  - 第一件事是补齐长链路 debug 的方法论 skill
  - 第二件事是把“沉淀经验时别只想到脚本，也要评估 skill”写成治理规则
  - 这两件事同时交付，但不再混成一个东西

## 测试/验证/验收方式

- 已执行：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec tsx -e "import { resolve } from 'node:path'; import { SkillsLoader } from './src/index.ts'; const repo = resolve(process.cwd(), '../..'); const loader = new SkillsLoader({ workspace: repo, projectRoot: repo }); const skill = loader.listSkills(false).find((entry) => entry.name === 'long-chain-debugging'); console.log(skill ? JSON.stringify({ name: skill.name, source: skill.source, path: skill.path }, null, 2) : 'MISSING');"`
  - 结果：输出 `name = long-chain-debugging`、`source = project`，说明仓库级 skill 可被发现。
- 已执行：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec tsx -e "import { resolve } from 'node:path'; import { existsSync } from 'node:fs'; import { SkillsLoader } from './src/index.ts'; const repo = resolve(process.cwd(), '../..'); const loader = new SkillsLoader({ workspace: repo, projectRoot: repo }); const skill = loader.getSkillInfo('long-chain-debugging'); const metadata = skill ? loader.getSkillMetadata(skill) : null; console.log(JSON.stringify({ found: Boolean(skill), source: skill?.source ?? null, name: metadata?.name ?? null, hasDescription: Boolean(metadata?.description), hasOpenAiYaml: existsSync(resolve(repo, '.agents/skills/long-chain-debugging/agents/openai.yaml')) }, null, 2));"`
  - 结果：输出 `found = true`、`source = project`、`name = long-chain-debugging`、`hasDescription = true`、`hasOpenAiYaml = true`，说明 frontmatter 可被读取，且配套 UI 元信息文件存在。
- `build / lint / tsc`：不适用。
  - 原因：本次仅新增/修改项目规则与 skill 文档，未触达构建、类型或运行链路代码。

## 发布/部署方式

- 本次无需独立部署。
- 规则与 skill 文件合入仓库后即生效。
- 后续在本仓库内进行长链路排查，或把高频经验沉淀为可复用能力时，助手会直接受这两项改动影响。

## 用户/产品视角的验收步骤

1. 打开 [`long-chain-debugging/SKILL.md`](../../../.agents/skills/long-chain-debugging/SKILL.md)，确认它不是泛泛而谈，而是明确要求先写 `症状定义 / 黄金复现 / 链路地图 / 观察点计划 / 当前假设与缩圈实验 / 根因与修复位点 / 同链路验收`。
2. 继续检查该 skill，确认其中明确写出“先切链再观测”“边界观察点”“一次实验只验证一个假设”“找第一个错误 hop”“修后走同链路验收”等关键动作。
3. 打开 [`AGENTS.md`](../../../AGENTS.md)，确认 Rulebook 中已经存在 `automation-deposition-must-evaluate-script-and-skill`。
4. 检查该规则正文，确认它要求每次沉淀经验时必须先评估 `script`、`skill` 或两者组合，而不是默认只写脚本。
5. 随机挑一个未来的重复问题场景，例如“发布前固定检查”或“长链路排障方法”，确认按规则判断时：
  - 固定、稳定、低判断的步骤会落到 `script`
  - 强依赖判断与排查策略的流程会落到 `skill`
  - 同时需要稳定动作与高层判断时会落到 `script + skill`

## 可维护性总结汇总

### 长期目标对齐 / 可维护性推进

本次顺着“让 NextClaw 逐步具备可积累、可复用、可自进化的问题解决能力”的长期方向推进了一小步。它没有把长链路排障经验继续留在一次性对话里，也没有把所有自动化都继续压扁成脚本，而是把“方法论”和“执行动作”明确拆成不同载体，并让 AI 默认知道两者都该被评估。

### 具体判断

- 本次是否已尽最大努力优化可维护性：是。本次没有再平铺多条平行规则，也没有新增多篇重复文档；只新增了一个 skill，并在现有规则位点上直接升级机制。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。规则层没有再加一条几乎重复的新规则，而是直接替换原有“重复流程自动化”那条，使治理结构更集中；skill 也只保留核心方法，不额外拆参考文档或模板目录。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：本次有最小必要净增长，原因是必须新增一个独立 skill 目录和一份迭代留痕；但同时避免了新增脚本、方案文档、额外规则文件或第二条平行规则，已将增长压到最小。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。`script` 与 `skill` 的职责边界被明确区分：前者解决稳定执行，后者解决稳定判断；没有再把两类问题混成一个模糊“自动化”概念。
- 目录结构与文件组织是否满足当前项目治理要求：满足。新增内容放在既有 `.agents/skills/<skill-name>/` 与 `docs/logs/v<semver>-<slug>/README.md` 约定位置，没有引入新的散点目录。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：不适用。本次未修改源码、脚本、测试或影响运行链路的配置。
- 若本次迭代不涉及代码可维护性评估，必须明确写“不适用”并说明理由：不适用，原因同上；本次属于项目规则与 skill 文档能力沉淀，不是代码实现或代码重构。

### 可维护性总结

这次改动把两类本来容易混在一起的事情拆清楚了：长链路 debug 的方法论沉淀成 `skill`，经验自动化的载体选择沉淀成规则。虽然仓库文件数有最小必要增长，但治理结构反而更简单了，因为它不再默认把一切都推向脚本，也不再把 debug 方法论继续散落在一次性讨论里。

## NPM 包发布记录

不涉及 NPM 包发布。
