# v0.17.19 Agent Instructions Token Optimization

## 迭代完成说明

本次把 `AGENTS.md` 从全量规则书收敛为“每轮必读的常驻内核”，同步把 `commands/commands.md` 改成“命令定义 + skill 触发”的短索引，并新增三个场景 skill 承接长流程：

- `.agents/skills/nextclaw-agent-instructions-governance/SKILL.md`
- `.agents/skills/nextclaw-iteration-log-governance/SKILL.md`
- `.agents/skills/nextclaw-validation-workflow/SKILL.md`

根因：`AGENTS.md` 将常驻硬规则、场景流程、示例、反例、命令细节、迭代模板和可维护性检查清单全部展开在启动上下文中，导致每轮对话都消耗大量 token，且规则越长越容易稀释真正的高优先级约束。

根因确认方式：通过 `wc` 与内容扫描确认原文件包含数百行长规则，且大量规则只在特定场景需要；随后按“常驻内核 / 场景 skill / 普通文档”的加载模型重排。修复命中根因的原因是：常驻 `AGENTS.md` 只保留每轮必须知道的约束，同时把迭代留痕、验证闭环、AGENTS/Rulebook 治理等长流程迁到具备触发描述的 skill 中，避免拆成 AI 不会主动读取的普通文档。

## 测试/验证/验收方式

- 执行 `wc -c -m -w AGENTS.md commands/commands.md .agents/skills/nextclaw-agent-instructions-governance/SKILL.md .agents/skills/nextclaw-iteration-log-governance/SKILL.md .agents/skills/nextclaw-validation-workflow/SKILL.md`，确认 `AGENTS.md` 与命令索引体积已显著下降。
- 检查三个新增 skill 的 YAML frontmatter，确认 `description` 覆盖 `/config-meta`、`/check-meta`、`/new-rule`、`/validate`、迭代留痕、NPM 发布记录、工作笔记等触发场景。
- `build` / `lint` / `tsc` 不适用：本次只修改 `AGENTS.md`、`.agents/skills` 文本和迭代日志，未触达源码、类型声明、导入导出边界或运行链路。
- 冒烟测试不适用：本次没有用户可运行行为改动。

## 发布/部署方式

不涉及应用发布、部署、数据库 migration 或线上配置变更。规则与 skill 文件随仓库内容生效。

## 用户/产品视角的验收步骤

1. 打开 `AGENTS.md`，确认它只保留常驻内核，而不是继续承载完整 Rulebook。
2. 打开 `commands/commands.md`，确认命令不再重复展开长流程，而是指向对应 skill。
3. 搜索 `nextclaw-agent-instructions-governance`、`nextclaw-iteration-log-governance`、`nextclaw-validation-workflow`，确认对应场景有 skill 触发入口。
4. 后续让 AI 执行 `/validate`、`/config-meta` 或需要迭代留痕的任务时，观察其是否主动读取对应 skill。

## 可维护性总结汇总

- 本次已尽最大努力优化可维护性：是。主要动作是删除 `AGENTS.md` 中大量不应常驻的长规则展开，并把场景流程迁入 skill。
- 已优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”：是。`AGENTS.md` 大幅净删除，新增 skill 用更清晰的 owner 承接场景流程。
- 本次未触达项目代码，因此总代码量、分支数、函数数、运行目录平铺度不适用；规则文本总量被重新分层，常驻上下文显著下降。
- 抽象与职责划分更清晰：`AGENTS.md` 负责常驻硬约束，`commands/commands.md` 负责元指令索引，三个新增 skill 分别负责 agent 指令治理、迭代留痕治理和验证闭环治理。
- 目录结构与文件组织满足当前治理要求：新增 skill 均位于 `.agents/skills/<skill>/SKILL.md`，未创建额外 README 或普通规则文档。
- 代码可维护性评估不适用：本次没有源码、脚本、测试或运行链路配置改动；未执行 `post-edit-maintainability-review`。

## NPM 包发布记录

不涉及 NPM 包发布。
