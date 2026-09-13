---
name: development-design
description: 通用开发生命周期的「方案设计」阶段 owner；当用户明确要求设计、风险达到 L3-L4，或用户可见 L2 功能存在真实方案空间时使用，负责冻结可执行设计，不负责实现、验证或发布。
---

# Development Design

## 目标

回答“采用哪条主链路，为什么”。核对证据和文档层级；证据不足时返回调查，不用假设计补洞。

实现前同时冻结验收与交付：每项必要用户结果写出场景、可观察预期、证据入口与失败判定，并说明交付物、实际入口、环境/授权前提及整体完成条件。每次方案设计给出“黄金验收”：用户时间有限时优先验证的 1–3 条代表性真实链路，按核心价值与关键风险排序；每条写清入口、最短操作、可见预期、失败判定及等待成本，不把大量检查藏进三条标题。黄金验收映射完整验收标准，不削减范围、不替代 AI 自验，也不把安装、测试或排障转交用户。无用户可操作变化时说明不适用并给出可核对证据，不虚构交互。普通任务可内联，active contract 使用既有 acceptance IDs；状态、平台或权限改变行为时才补必要矩阵。

稳定设计写入 `docs/designs/YYYY-MM-DD-<topic>.design.md`，局部方案可直接回复；路径显然仍要判断，不为形式建文档。

## 产物分级

输出设计结论与 `design-document: required | not-required`；feature/bugfix 共用产物门。

轻量设计限单 owner、无跨层合同/状态/兼容或真实分叉、局部可逆且不复用；写清问题、主链路、理由与验证。

出现以下任一情况，必须写入或更新稳定的 `docs/designs` 文档：

- L3-L4，或跨 package、runtime、projection、transport、持久化边界；
- 用户可见 L2 功能存在交互、信息架构或行为取舍；
- 改变状态 owner、生命周期、不变量、协议、兼容、迁移、fallback 或失败恢复；
- 有两个以上真实可行候选，需要记录选择与放弃理由；
- 设计会跨会话、跨批次、交给他人实现，或预计成为后续判断依据。

L0 文档修正和 lifecycle 可跳过的 L1 单路径改动无需进入；不按 diff、工时或文件数决定是否建文档。

## 计划门

进入 Implementation 前输出 `plan: required | not-required`。单批无法可信闭环时使用[开发执行 Plan 合同](../../wiki/skills/process/project-knowledge-governance/references/development-plan-contract.md)，否则不建；Plan 不是新 phase。

## 设计合同

只展开与当前任务相关的维度：

- 用户或系统可观察问题；
- producer、owner、consumer、已有约束与现有能力复用证据；
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

1. 从真实问题或调用链写出入口到结果的最小完整路径，接口和字段须服务该路径。
2. 区分单次实例、局部重复与跨场景不变量；抽象和公共合同不得高于证据层级，单例不升级全局机制。
3. 复用现有主链路和最窄正确 owner；只有多个独立场景共享变化边界才扩大范围，未来可能性不算证据。
4. 恢复、权限和幂等须完整；无真实消费者的通用基础设施不借完整性进入范围。
5. 比较欠设计的错误 owner、重复生命周期与迁移债，以及过度设计的无消费者抽象、状态与验证面，选择全生命周期净复杂度最低的结构，不以 diff、文件数或 MVP 替代。

新增/改变抽象或公开闭集 variant 时必须读取[架构设计原则](references/architecture-principles.md)，写清保留、删除、延后项；未来成本未付清不得 `Design Ready`。

涉及用户可用能力（含 CLI、SDK、后台自动化与集成）或交互时，读取[功能设计关](references/feature-design-gate.md)，先呈现用户链路再展开协议；纯内部且用户行为不变时说明不适用。

跨 runtime、journal、projection、transport 或 UI 的状态型设计补普通、运行、重试、取消、中断、刷新恢复和旧数据矩阵；局部无状态方案不填。

已有实现、验证、Review 或线上现象暴露未建模行为时，读取[设计缺失的范围判定](references/design-gap-scope.md)，区分实现偏差、局部合同、能力面和系统模型缺口，选防同类复发的最小范围；不按报错位置或 diff 定范围。

## 专项路由

每个设计决策最多选择一个当前 owner：

- 通用 owner、生命周期、不变量、职责边界或抽象力度：读取[架构设计原则](references/architecture-principles.md)；
- NextClaw kernel/runtime host/manager/store/presenter 主干依赖：读取[NextClaw Kernel Owner 架构](references/nextclaw-kernel-owner-architecture.md)；
- 前端状态和 view logic：读取[View Logic 解耦](../../wiki/skills/frontend/mvp-view-logic-decoupling/SKILL.md)；
- 目录、角色、命名：读取[文件组织治理](../../wiki/skills/governance/file-organization-governance/SKILL.md)；
- fallback、兼容、恢复：读取[可预测行为优先](../../wiki/skills/architecture/predictable-behavior-first/SKILL.md)；
- 前端系统性重构、交互或参考皮肤：分别选择[前端代码优化](../../wiki/skills/frontend/frontend-code-optimization/SKILL.md)、[交互质量](../../wiki/skills/frontend/frontend-interaction-quality/SKILL.md)或[参考皮肤复刻](../../wiki/skills/frontend/replicating-reference-skins/SKILL.md)中的一个；
- Hermes HTTP 或 NARP stdio runtime 接入：分别读取[HTTP runtime 接入](../../wiki/skills/architecture/nextclaw-http-agent-runtime-integration/SKILL.md)或[NARP stdio 接入](../../wiki/skills/architecture/nextclaw-narp-stdio-runtime-integration/SKILL.md)；
- 用户可见内容边界：读取[用户内容边界](../../wiki/skills/content/user-facing-content-boundary/SKILL.md)；
- Marketplace skill 的评估与集成设计：读取[Marketplace skill 集成](../../wiki/skills/operations/nextclaw-marketplace-skill-integration/SKILL.md)并只进入 design 分支。

前两项仅按条件读取。

## 完成

冻结前用验收场景自审主链路、失败边界与抽象力度，关闭缺口；单路径简述结论，不虚构候选、默认委派或另建评审文档。

设计须形成统一模型，返回设计/plan、owner、主链路、验收标准、必要矩阵和非目标；standard 与正式 bugfix 设计交回总流程进入方案 Review，通过前不进入实现。本阶段的自审不替代该门。

新现象暴露模型缺口则返工设计；仅实现偏差不扩大。本阶段不编辑产品实现、验证、review、提交或发布。
