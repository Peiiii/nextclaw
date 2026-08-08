---
name: nextclaw-solution-design
description: 当用户明确要求技术方案、设计文档、架构方案或实现前设计，或 delivery 已判断为 L3/L4 设计风险时使用；只负责冻结可执行设计，不回链或重做完整开发流程。
---

# NextClaw 方案设计

## 入口

先确认问题对象、当前证据和文档层级。证据不足且需要系统调查时只加载 `code-investigation-workflow`；稳定设计写入 `docs/designs/YYYY-MM-DD-<topic>.design.md`，轻量局部方案可直接回复。

## 设计合同

只展开与当前任务相关的维度：

- 用户或系统可观察问题；
- 当前 producer、owner、consumer 和已有约束；
- 推荐主链路，以及为什么比备选更少、更清晰；
- 状态、生命周期、不变量和失败/恢复边界；
- 目录与依赖边界；
- 要删除、合并和禁止新增的平行路径；
- 兼容/迁移必要性与退出条件；
- 非目标和最小验证标准。

跨 runtime、journal、projection、transport 或 UI 的状态型设计，再补普通、运行中、继续/重试、取消、中断、刷新恢复和旧数据场景矩阵。局部无状态方案不机械填写这些栏目。

## 专项路由

每个设计决策最多选择一个当前 owner：

- 通用 owner、生命周期、不变量、职责边界或抽象力度：读取[架构设计原则](references/architecture-principles.md)；
- kernel/runtime host/manager/store/presenter 主干依赖：读取[Kernel Owner 架构](references/kernel-owner-architecture.md)；
- 前端状态和 view logic：`mvp-view-logic-decoupling`；
- 目录、角色、命名：`file-organization-governance`；
- fallback/兼容/恢复：`predictable-behavior-first`；
- 样式或交互：选择对应一个 frontend skill。

前两项是本阶段的条件参考，不是平行 workflow；普通局部方案不读取。实现工艺由标准开发流程拥有，不在设计阶段预读。

## 阶段门

设计必须形成统一模型，不能用一组修正记录、测试截图或局部失败替代。若实现中新现象暴露模型缺口，先修正设计再继续；若只是实现偏差，直接修实现。

完成时说明设计文档落点、关键 owner、删除点、验证标准和明确非目标。不要在本 skill 中执行验证、提交或发布流程。
