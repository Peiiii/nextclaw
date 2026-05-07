# v0.17.31-directory-structure-overview-skill

## 迭代完成说明

- 根因：目录结构治理已经变成长期任务，用户后续会反复询问“概况”“热点”“整体问题”，如果每次临时拼扫描命令，容易口径漂移。
- 本轮新增项目 skill `directory-structure-governance-overview`，把目录结构治理概况的触发语、扫描命令、量化维度、优先级排序和输出格式固化下来。
- 该 skill 明确概况报告只做治理地图，不默认改代码；真正治理某个模块时再进入标准交付流程。
- 该 skill 记录了“顶层结构规范优先于脚本现状”的原则：如果高层规范已定义但脚本未实现，优先判断为脚本漏实现。

## 测试/验证/验收方式

- 已通过：读取并检查新增 skill frontmatter 与主体内容。
- 已通过：`pnpm lint:new-code:governance -- .agents/skills/directory-structure-governance-overview/SKILL.md docs/logs/v0.17.31-directory-structure-overview-skill/README.md`
- `tsc` 不适用：本轮只新增 skill 文本和迭代记录，没有触达 TypeScript 源码、类型声明或运行链路。

## 发布/部署方式

- 不涉及发布、部署或 migration。
- 不涉及 NPM 包发布。

## 用户/产品视角的验收步骤

1. 后续用户说“目录结构治理概况”“结构热点”“整体问题概况”等，应触发 `directory-structure-governance-overview`。
2. 使用该 skill 时，应输出总量、按协议分布、问题类型、Top 模块、核心优先级和建议下一步。
3. 如果用户要求忽略插件，报告应把插件问题单独分组，不让插件数量淹没 core / NCP / runtime。

## 可维护性总结汇总

- 本轮没有新增生产代码。
- 正向减债动作：把长期重复的概况扫描口径收敛成专门 skill，减少后续临时判断和口径漂移。
- 目录结构治理的自感知能力增强：后续可以稳定复现同一套量化视角。

## NPM 包发布记录

- 不涉及 NPM 包发布
