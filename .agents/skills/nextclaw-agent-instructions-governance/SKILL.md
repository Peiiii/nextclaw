---
name: nextclaw-agent-instructions-governance
description: 当确定要修改 AGENTS.md、commands、项目 AI 规则、skill/references 分层、治理脚本，或判断一条规则应放在哪一层时使用；普通规则讨论和一次性纠偏不提前触发。
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

## 入口分类

- **标准流程 owner**：普通开发只能有一个；具体入口由当前 `AGENTS.md` 的默认开发路由声明，本 skill 不重复写死名称。
- **阶段 owner**：Task Understanding、Design、Implementation、Validation、Review、Delivery、Retrospective 各有一个 `development-*` owner，只在进入该阶段后加载。
- **完整场景 owner**：发布、长期治理、外部系统交付等能独立回答“用户要完成什么任务”的闭环才保留入口。
- **工艺与场景规范**：只回答“当前阶段怎样判断/实现/验证”的通用原则或项目细节进入所属 owner 的条件 reference，不占平行入口。

reference 也要区分通用工艺与项目场景，文件名和加载条件应直接表达类别；不要把已删除 skill 的 frontmatter 原样搬入 reference。

## 修改顺序

1. 找当前 owner 和相邻规则，先判断删除、合并、收窄、移动，再考虑新增。
2. 普通开发只能有一个 lifecycle owner；阶段不直接调用其它阶段或回链 lifecycle，专项 skill 不回链上游。
3. description 只描述一个稳定意图，不堆“实现/方案/深入/最佳实践”等泛词抢占触发。
4. 一个判断分支最多要求一个直接下游；不同阶段的 skill 到阶段再加载。
5. 规则影响脚本或命令时同步更新；脚本变化也同步 owning 文本。
6. 核心阶段使用统一的 `development-<stage>` 命名；只有深度依赖 NextClaw 产品、NCP、Kernel、仓库命令或发布合同的 skill 使用 `nextclaw-` 前缀。
7. 大型重构写设计并在同批迭代记录中留痕，小措辞不建日志。

## 创建 Skill 门槛

只有同时满足才创建：

- 没有现有 owner；
- 有明确、可重复的用户意图；
- 有独立流程或稳定合同，而不是原则换名；
- description 能与相邻 skill 互斥；
- 新入口比 reference 或扩展现有 owner更清晰。

否则合并、写 reference 或删除。

## 检查

完成前运行 `pnpm check:skill-progressive-loading`，确认 frontmatter、名称、链接、生命周期拓扑、依赖循环、已删除引用和体积预算；再按改动风险运行治理 ratchet。纯指令 Markdown 不运行 build/tsc/产品冒烟。

最终报告 AGENTS、skill 数、description 和入口体积变化，说明 command/script/baseline 是否适用，以及设计/迭代落点。
