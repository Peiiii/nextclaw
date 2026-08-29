---
name: nextclaw-agent-instructions-governance
description: 当确定要修改 AGENTS.md、commands、项目 AI 规则、skill/references、治理脚本，或明确优化 AI 驱动开发体系时使用；普通规则讨论和一次性纠偏不提前触发。
---

# AI 指令系统治理

## 目标

保持规则可靠、单一 owner、渐进加载和低 token 成本。修改前先对齐 `docs/VISION.md`、检查工作区和当前规则体积，并识别真正根因是缺失、重复、过宽、过长、过期还是放错层。

## 分层

1. `AGENTS.md`：每轮必须知道的安全与高层边界。
2. `SKILL.md`：一个明确意图的入口和每次命中都需要的决策。
3. `references/`：仅在子场景成立时读取的长合同、平台细节和示例。
4. `scripts/`：高信号、低误报、可确定执行的检查。
5. `docs/`：人类背景、设计、计划和长期记录；除非入口明确链接，不承担自动硬规则。

如果一段内容每次触发 skill 都必需，保留在入口；不要拆成必读 reference。若只在一个分支需要，必须移出入口并写清加载条件。

## 修改顺序

1. 找当前 owner 和相邻规则，先判断删除、合并、收窄、移动，再考虑新增。
2. 普通开发只能有一个 lifecycle owner；阶段不直接调用其它阶段或回链 lifecycle，专项 skill 不回链上游。
3. description 只描述一个稳定意图，不堆“实现/方案/深入/最佳实践”等泛词抢占触发。
4. 一个判断分支最多要求一个直接下游；不同阶段的 skill 到阶段再加载。
5. 规则影响脚本或命令时同步更新；脚本变化也同步 owning 文本。
6. 核心阶段使用统一的 `development-<stage>` 命名；只有深度依赖 NextClaw 产品、NCP、Kernel、仓库命令或发布合同的 skill 使用 `nextclaw-` 前缀。
7. 大型重构写设计并在同批迭代记录中留痕，小措辞不建日志。

## 条件方法

- 用户明确要求优化 AI 驱动开发体系，或有效反馈暴露重复、系统性、高影响机制缺口时，读取[开发体系演进闭环](references/development-system-evolution.md)。
- 修改、提升、下沉、合并或删除规则资产，或者要标记/复核模型能力补丁时，读取[规则资产生命周期](references/rule-asset-lifecycle.md)。
- 任务明确涉及常驻上下文膨胀、渐进加载、重复读取或 Token 成本时，读取[上下文与 Token 治理](references/context-token-governance.md)。
- 新增、删除、合并 Skill，或改变 lifecycle/阶段/专项入口拓扑时，读取[Skill 拓扑与创建门](references/skill-topology.md)。

普通局部措辞修正不机械加载多份参考；每次只读取当前判断确实需要的方法，不批量预读。

## 检查

完成前运行 `pnpm check:skill-progressive-loading`，确认 frontmatter、名称、链接、生命周期拓扑、依赖循环、已删除引用和体积预算；再按改动风险运行治理 ratchet。纯指令 Markdown 不运行 build/tsc/产品冒烟。

最终报告 AGENTS、skill 数、description 和入口体积变化，说明 command/script/baseline 是否适用，以及设计/迭代落点。
