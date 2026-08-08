---
name: nextclaw-solution-design
description: 当用户要求技术方案、方案设计、设计文档、架构方案、实现前设计、交互/前端/后端方案，或开发流程进入“先设计再实现”的阶段时使用。用于产出可执行的方案设计合同，覆盖现状证据、owner、数据流、目录组织、可维护性、非目标、风险与验证标准；本 skill 是开发流程中的方案设计专项，不是完整开发 workflow owner。
---

# NextClaw 方案设计专项

## 定位

本 skill 只负责“方案设计”阶段。完整开发节奏由 `nextclaw-delivery-workflow` 编排；本 skill 被它或用户显式设计诉求调用。

目标是让方案能指导实现，而不是只写想法、愿景或待办。

## 使用前置

设计前先确认：

- 问题对象：产品体验、架构边界、数据流、目录组织、运行链路，还是交互细节。
- 现状证据：至少查到当前 owner、调用方、被调用方、已有同类实现或缺口。
- 产物层级：用 `project-knowledge-governance` 判断写入 `docs/designs`、`docs/plans`，还是只在回复中给轻量方案。

如果证据不足，先用 `code-investigation-workflow` 查链路，不要凭文件名或局部片段做系统结论。

## 必须覆盖的设计维度

方案至少回答这些问题：

- 用户价值：解决什么用户可见或系统可观察问题。
- 当前事实：现有链路、owner、状态归属、已有约束是什么。
- 推荐方案：主链路是什么，为什么比备选更简单、更清晰。
- Owner 边界：业务逻辑归哪个 manager/service/store/presenter/feature。
- 数据流：事实从哪里产生，在哪里持久化，谁消费，谁不能越界依赖。
- 领域模型：核心实体、稳定身份、术语、坐标系和彼此关系是什么；禁止让同一个词在 runtime、持久化和 UI 中指向不同对象。
- 生命周期与不变量：涉及状态型功能时，必须写出从开始到终态的状态机、唯一终态 owner、崩溃/取消/重试路径，以及实时增量与冷重载必须共同满足的投影定律。
- 关键场景矩阵：跨 runtime / journal / projection / UI 的功能必须在设计阶段列全普通路径、运行中路径、继续/重试、取消、进程中断、刷新恢复和旧数据兼容；先确认同一模型能解释全部场景，再进入实现。
- 目录组织：新增或移动文件放在哪个 feature/root/role 下，为什么不是别处。
- 可维护性：删什么、合并什么、避免什么新抽象或重复链路。
- 兼容与迁移：旧数据、旧入口、fallback 是否需要保留，删除条件是什么。
- 非目标：明确本轮不解决什么，防止方案膨胀。
- 验证标准：测试、tsc、lint、冒烟、治理检查分别如何证明方案落地。

## 专项联动

按设计面选择专项 skill，不要把所有细节塞进本 skill：

- 架构职责、owner、生命周期：`classic-software-design-principles`
- 代码审美、抽象必要性、拆分收益：`writing-beautiful-code`
- kernel/manager/service/store/presenter 主干分支：`kernel-branch-owner-architecture`
- 前端 MVP、view/store/manager 状态归属：`mvp-view-logic-decoupling`
- 目录、命名、角色落位：`file-naming-convention`、`role-first-file-organization`、`collapsible-feature-root-architecture`、`file-organization-governance`
- 前端样式或交互：`frontend-style-encapsulation`、`frontend-interaction-quality`
- fallback、兼容、恢复路径：`predictable-behavior-first`

## 输出合同

轻量方案可在回复中给出；稳定方案应写入 `docs/designs/YYYY-MM-DD-<topic>.design.md`。

设计文档建议结构：

```md
# <标题>

## 背景
## 现状依据
## 核心判断
## 推荐方案
## Owner 与数据流
## 目录组织
## 兼容与迁移
## 验收标准
## 非目标
## 后续实现顺序
```

如果用户明确要求“简约清晰”，保留这些标题但写短，不扩成长篇论证。

对于跨层状态型功能，设计文档是实现阶段门：领域模型、owner、事件/数据合同、状态机、投影与恢复不变量、兼容边界和关键场景矩阵未完成前，不写修复代码或以单点失败测试代替设计。测试与真实 smoke 只用于设计冻结后的实现证明；发现新现象时先判断它是否暴露设计缺口，若是则先修正文档模型并重新审查整体自洽性，禁止围绕截图连续追加特判。

## 反模式

- 把方案设计当成完整开发 workflow owner。
- 只给结论，不给现状证据和 owner 边界。
- 只写 UI/代码步骤，不写数据流、目录组织和验证标准。
- 把真实验收脚本、单点回归测试或一组“设计调整记录”当作完整设计，缺少统一领域模型和端到端生命周期。
- 设计尚未覆盖 continuation、取消、重启、刷新等关键状态就进入实现，随后按报错不断叠加补丁。
- 为了显得完整新增很多抽象、阶段或文档，而没有删减和合并判断。
- 设计文档写完后没有说明它为什么属于 `docs/designs` 而不是 thought/plan/log。
