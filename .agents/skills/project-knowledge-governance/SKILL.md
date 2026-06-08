---
name: project-knowledge-governance
description: 当用户要求沉淀、整理、归档、维护或分流项目想法、产品思考、讨论记录、PRD、设计、计划、路线图、TODO、docs/thoughts、docs/designs、docs/plans 或 docs/logs 迭代记录时使用。用于判断内容应进入 docs/TODO.md、docs/thoughts、docs/designs、docs/plans、docs/prd、docs/ROADMAP.md 还是 docs/logs，并维护它们之间的升级关系。
---

# Project Knowledge Governance

## 目标

维护项目知识沉淀链路，让讨论不会丢，也不会过早升级成设计或计划。

核心分层：

```text
docs/TODO.md Inbox
  -> docs/thoughts
  -> docs/designs
  -> docs/plans
  -> docs/logs
```

`docs/ROADMAP.md` 承接跨阶段的中长期方向，`docs/prd` 承接产品需求定义。若项目已有等价目录或文件，优先遵守当前项目约定。

## 使用时机

用户出现以下意图时使用：

- “沉淀一下”“记录下来”“这个思考有价值”“还没到 plan/design”。
- “整理 plans/designs/thoughts/迭代机制”。
- “把这次讨论放到合适位置”。
- “这个想法后续怎么维护/升级”。
- 新增或调整知识沉淀目录、模板、命令或规则。

若任务触达 `AGENTS.md`、命令机制或 skill 分层，同时使用当前项目的 agent instructions / meta governance 规则。

若任务触达 `docs/logs` 或需要判断是否创建迭代记录，同时使用当前项目的 iteration log governance 规则。

## 分流规则

- `docs/TODO.md`：一句话想法、待办、未展开建议、还没有明确判断的 Inbox。
- `docs/thoughts`：有价值但未定型的产品、架构、交互或战略思考；已经超过一句话想法，但还没有形成定稿设计或执行计划。
- `docs/designs`：已经形成结构、边界、owner、数据流、协议或交互设计判断，需要作为后续实现依据。
- `docs/plans`：已经准备执行的分步计划，包含范围、步骤、验证和交付顺序。
- `docs/prd`：产品需求、用户价值、范围、验收、非目标和版本切分。
- `docs/ROADMAP.md`：跨阶段、中长期方向和优先级。
- `docs/logs`：代码、脚本、测试、运行链路配置、发布、修复或大规模治理完成后的迭代留痕；不用于普通讨论起草。

## 升级规则

- TODO 升级为 thought：出现明确背景、核心判断、方案空间或未决问题。
- thought 升级为 design：出现稳定系统边界、模块职责、数据流、协议、交互结构或关键 owner。
- design 升级为 plan：出现明确执行批次、步骤、验证方式和完成标准。
- plan / implementation 升级为 docs/logs：实际完成交付、验证、发布、修复或治理后，按当前项目的迭代记录规则判断。

升级时保留原文链接，不需要删除旧文；若旧文已明显过时，应在旧文顶部标注升级去向。

## 文件命名

- `docs/thoughts` 下的 Markdown 文件必须使用 `YYYY-MM-DD-<kebab-topic>.thought.md`。
- `docs/designs` 下的 Markdown 文件必须使用 `YYYY-MM-DD-<kebab-topic>.design.md`。
- `docs/plans` 下的 Markdown 文件必须使用 `YYYY-MM-DD-<kebab-topic>.plan.md`。
- 普通主题使用中文正文、英文或拼音无歧义 kebab 文件名均可；优先英文短 slug，便于搜索和链接。
- 同一天同主题的微调更新原文件，不拆细碎新文档。

## Thought 模板

```md
# <标题>

## 背景

这次思考从什么问题触发。

## 核心判断

当前比较确定的判断。

## 方案空间

可选路线及取舍。

## 推荐倾向

目前更推荐的方向和理由。

## 未决问题

还没想清楚或需要验证的问题。

## 升级条件

什么时候升级到 designs 或 plans。
```

## 操作流程

1. 先判断这次内容属于想法、思考、设计、计划、PRD、路线图还是迭代记录。
2. 若是产品、架构、交互或实现方向判断，先对齐当前项目的愿景、原则、strategy 或 charter 文档；如果项目没有这类文档，明确标注缺失。
3. 选择最轻的可用沉淀层，不要把早期讨论硬塞进 `docs/designs` 或 `docs/plans`。
4. 写入或更新目标文档，保持中文正文、日期前缀和清晰升级条件。
5. 若新增目录、命令、skill 或 AGENTS 路由，同步维护触发入口。
6. 收尾时说明本次进入了哪一层，为什么没有进入其它层。
