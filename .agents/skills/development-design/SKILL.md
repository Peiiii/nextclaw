---
name: development-design
description: 通用开发生命周期的「方案设计」阶段 owner；当用户明确要求设计、风险达到 L3-L4，或用户可见 L2 功能存在真实方案空间时使用，负责冻结可执行设计，不负责实现、验证或发布。
---

# Development Design

## 目标

回答“采用哪条主链路，为什么”。核对证据和文档层级；证据不足时返回调查，不用假设计补洞。

稳定设计写入 `docs/designs/YYYY-MM-DD-<topic>.design.md`，局部方案可直接回复；路径显然仍要判断，不为形式建文档。

## 产物分级

进入本阶段必须形成设计结论并输出 `design-document: required | not-required`；`feature` 和 `bugfix` 使用同一产物门，不按类型机械决定。

轻量设计仅限单一 owner、无跨层合同/状态/兼容和真实分叉，且改动局部可逆、不复用；仍须写清问题、主链路、理由与验证。

出现以下任一情况，必须写入或更新稳定的 `docs/designs` 文档：

- L3-L4，或跨 package、runtime、projection、transport、持久化边界；
- 用户可见 L2 功能存在交互、信息架构或行为取舍；
- 改变状态 owner、生命周期、不变量、协议、兼容、迁移、fallback 或失败恢复；
- 有两个以上真实可行候选，需要记录选择与放弃理由；
- 设计会跨会话、跨批次、交给他人实现，或预计成为后续判断依据。

L0 文档修正和 lifecycle 可跳过的 L1 单路径改动无需进入；不按 diff、工时或文件数决定是否建文档。

## 计划门

进入 Implementation 前输出 `plan: required | not-required`。单批无法可信闭环时使用 `project-knowledge-governance` 的[开发执行 Plan 合同](../project-knowledge-governance/references/development-plan-contract.md)，否则不建；Plan 不是新 phase。

## 设计合同

只展开与当前任务相关的维度：

- 用户或系统可观察问题；
- producer、owner、consumer 与已有约束；
- 真实分叉时的 2-4 个候选：用户价值、owner、复杂度、可逆性、验证成本及主链路；路径明显不虚构候选；
- 状态、生命周期、不变量、失败/恢复、目录/公共入口/依赖边界；
- 第三方框架/runtime/协议：冻结上游执行、线程、生命周期、资源与错误合同及产品保留职责；偏离须有必要性、官方依据、验证和退出条件；
- 删除或禁止的平行路径，兼容/迁移/fallback 的必要性与退出条件；
- 非目标与最小验证标准。

证据足够时冻结占优方案；仅当选择显著改变用户行为或范围且无法判断偏好时，才请求用户决定。

## 思考投入

目标、事实、根因或候选不确定，或属高风险决策时，读取[自适应方案思考](references/adaptive-deliberation.md)，选最低成本方法。简单可逆的惯例路径直接结论；不机械多方案，也不凭直觉冻结复杂设计。

## 过度设计门

任何设计进入 `Design Ready` 前必须完成一次抽象审计：

1. 用一个真实用户问题或现有调用链写出入口到结果的最小完整路径；接口、字段和示例必须服务这条路径。
2. 先判断证据属于单次实例、局部重复还是跨场景稳定不变量；设计结论、抽象和公共合同的层级不得高于证据层级，单个案例不得直接升级为全局机制或长期优先级。
3. 选择能完整解决问题的最低层级和最窄 owner，优先复用现有主链路；只有多个独立场景出现同一变化边界时才扩大适用范围，未来可能性不能替代当前证据。
4. 区分核心语义完整与基础设施一次做全：恢复、权限和幂等不能省略，没有真实消费者的通用性也不能借完整性之名进入实现范围。
5. 双向比较：过小端是否固化错误 owner、重复生命周期或已知迁移债，过大端是否增加无消费者抽象、状态和验证面；选择全生命周期净复杂度最低的平衡结构。防止过度设计不等于最小改动、最少文件或 MVP。

新增/改变抽象或公开闭集 variant 时必须读取[架构设计原则](references/architecture-principles.md)，写清保留、删除、延后项；未来成本未付清不得 `Design Ready`。

涉及用户可见功能、信息架构、入口、浏览/搜索、选择或反馈时，读取[功能设计关](references/feature-design-gate.md)；功能闭环未冻结，不用接口代替功能设计。

跨 runtime、journal、projection、transport 或 UI 的状态型设计补普通、运行、重试、取消、中断、刷新恢复和旧数据矩阵；局部无状态方案不填。

已有实现、验证、Review 或线上现象暴露未建模行为时，读取[设计缺失的范围判定](references/design-gap-scope.md)，区分实现偏差、局部合同、能力面和系统模型缺口，选防同类复发的最小范围；不按报错位置或 diff 定范围。

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

设计须形成统一模型。完成时说明设计/plan 落点、owner、主链路、删除点、验证与非目标；有 plan 时确认策略已冻结。

新现象暴露模型缺口则返工设计；仅实现偏差不扩大。本阶段不编辑产品实现、验证、review、提交或发布。
