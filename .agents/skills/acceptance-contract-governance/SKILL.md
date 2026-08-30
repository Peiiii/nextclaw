---
name: acceptance-contract-governance
description: 当风险为 L3-L4，或用户明确要求大型、多阶段、低监督完整交付或验收标准时使用；形成并维护 active acceptance contract 与阶段门，不替代任务理解、设计、验证、Review 或交付。
---

# 验收契约治理

## 定位

把“做到什么才算完整”变成可观察、可演进、不过度约束实现的契约，使大型任务可分阶段自主推进而不把执行切片偷换成最终交付。

本 skill 只拥有验收契约，不调查代码事实、不冻结方案、不选择测试工具、不执行质量收敛，也不是新的 lifecycle phase。事实、设计、证明、Review 和外部交付仍归既有阶段 owner。

## 进入

风险为 L3-L4、用户明确给出验收标准/要求完整或低监督交付，或任务确需多个可独立验收阶段时进入。普通 L0-L2 小改、合同清楚的 bugfix、单一验证和主观偏好调整不使用。

完整执行[验收契约方法](references/acceptance-contract-method.md)，把设计、计划和用户标准登记成 active contract；被动文档中未入 ledger 的条目不能进入完成门。跨阶段、跨会话或有压缩风险时维护最小活文档，否则留在工作记录。

## 输出

返回 contract-id、parent-goal、stable acceptance IDs、粗粒度阶段图、当前阶段门、契约 Review 和未关闭项。只在阶段切换、新事实改变完成判断或用户改变目标时更新。
