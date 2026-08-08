---
name: frontend-code-optimization
description: 仅当用户明确要求前端可维护性治理、组件/逻辑系统性拆分、MVP 解耦、prop drilling 改造或前端重构优先级审计时使用；普通前端功能、样式和局部 bugfix 不触发。
---

# 前端代码优化

## 定位

这是显式前端治理任务的诊断入口，不是所有前端改动的 workflow owner。完整交付仍由 delivery 负责，本 skill 只识别最高收益的结构问题并选择一个当前专项 owner。

## 诊断顺序

1. 找出用户可见行为和稳定业务事实。
2. 判断当前对象是展示组件、业务容器、adapter、manager/store/presenter 还是生命周期 owner。
3. 查重复状态、重复 action、宽 props、组件内业务编排、effect 状态迁移和重复 UI 骨架。
4. 按收益排序：事实双写/错误 owner > 业务透传 > 生命周期不安全 > 重复实现 > 单纯文件偏长。
5. 每次只选择一个可验证 vertical slice，不同时启动所有前端专项治理。

## 专项选择

- 状态归属、MVP、store/manager/presenter、prop drilling：`mvp-view-logic-decoupling`。
- React key、动态组件、streaming DOM、焦点/选区/iframe/editor 连续性：`react-rendering-lifecycle-safety`。
- 样式 owner、响应式、基础组件可移植性：`frontend-style-encapsulation`。
- 操作语义、状态反馈、键盘可达性、tooltip/menu：`frontend-interaction-quality`。
- 文件和 feature root 变化：`file-organization-governance`。

同一判断只加载一个上述专项；完成该 slice 后再决定是否需要下一项。

## 实施原则

- 先删重复计算、重复状态、重复入口和无语义中间组件。
- 业务状态与动作收敛到最近 owner，展示组件只接展示合同。
- 不因文件长机械拆分；按变化原因、生命周期、不变量和真实复用拆分。
- 不用新 ViewModel/Presenter/Manager 包装混乱；新 owner 必须减少参数面或删除旧职责。
- 必要的清晰增长允许存在，不为行数门槛扩大无关重构。

## 输出

审计时给出 findings、证据、正确 owner、优先级和最小 slice。实施时只汇报当前 slice、主要验证和是否出现新的结构风险，不自动加载主观 review 或完整治理全家桶。
