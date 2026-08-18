---
name: development-design
description: 通用开发生命周期的「方案设计」阶段 owner；当用户明确要求设计、风险达到 L3-L4，或用户可见 L2 功能存在真实方案空间时使用，负责冻结可执行设计，不负责实现、验证或发布。
---

# Development Design

## 目标

回答“准备采用哪条主链路，以及为什么”。先确认问题对象、当前证据和文档层级；证据不足时返回调查缺口，不用假设计补洞。

稳定设计写入 `docs/designs/YYYY-MM-DD-<topic>.design.md`，轻量局部方案可以直接回复。路径显然的任务仍要完成设计门判断，但不机械创建设计文档。

## 设计合同

只展开与当前任务相关的维度：

- 用户或系统可观察问题；
- 当前 producer、owner、consumer 和已有约束；
- 2-4 个真实候选及用户价值、结构 owner、复杂度、可逆性和验证成本；
- 推荐主链路，以及为什么比备选更少、更清晰；
- 状态、生命周期、不变量和失败/恢复边界；
- 目录、公共入口和依赖边界；
- 要删除、合并和禁止新增的平行路径；
- 兼容、迁移和 fallback 的必要性与退出条件；
- 非目标和最小验证标准。

证据足够时由 AI 推荐并冻结明显占优方案；只有不同选择会显著改变用户可见行为或任务范围，且无法从上下文判断偏好时，才请求用户决定。

涉及用户可见功能、信息架构、入口、浏览/搜索、选择或反馈时，先读取[功能设计关](references/feature-design-gate.md)。功能闭环未冻结前，不得用数据结构或接口设计替代功能设计。

跨 runtime、journal、projection、transport 或 UI 的状态型设计，再补普通、运行中、继续/重试、取消、中断、刷新恢复和旧数据场景矩阵。局部无状态方案不机械填写。

已有实现、验证、Review 或线上现象暴露未建模行为时，读取[设计缺失的范围判定](references/design-gap-scope.md)。先区分实现偏差、局部合同缺口、能力面缺失和系统模型缺失，再选择能够关闭同类复发的最小完整设计范围；不得按报错位置或 diff 大小决定范围。

## 专项路由

每个设计决策最多选择一个当前 owner：

- 通用 owner、生命周期、不变量、职责边界或抽象力度：读取[架构设计原则](references/architecture-principles.md)；
- NextClaw kernel/runtime host/manager/store/presenter 主干依赖：读取[NextClaw Kernel Owner 架构](references/nextclaw-kernel-owner-architecture.md)；
- 前端状态和 view logic：`mvp-view-logic-decoupling`；
- 目录、角色、命名：`file-organization-governance`；
- fallback、兼容、恢复：`predictable-behavior-first`；
- 样式或交互：选择对应一个 frontend skill。

前两项是条件 reference，不是平行 workflow；普通局部方案不读取。

## 完成

设计必须形成统一模型，不能用修正记录、测试截图或局部失败替代。完成时说明文档落点、关键 owner、主链路、删除点、验证标准和非目标。

若后续新现象暴露模型缺口，阶段结果应请求返工设计；若只是实现偏差，不扩大本阶段。本阶段不编辑产品实现、不执行验证、review、提交或发布。
