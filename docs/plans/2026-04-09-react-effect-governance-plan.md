# 2026-04-09 React Effect Governance Plan

## 背景

当前仓库已经有一套可维护性治理主链路：

- Rulebook 负责高层行为约束
- skill 负责实现与复核流程
- `pnpm lint:new-code:governance` 负责 diff-only 新债阻断
- `post-edit-maintainability-guard` / `post-edit-maintainability-review` 负责收尾自检与主观复核

但在 React 场景里，还缺一条明确边界：

**`useEffect` 何时是合理的边界同步，何时是在偷运业务编排。**

这会带来三个长期问题：

- 组件通过监听状态变化来补业务动作，执行时序变成隐式契约
- query、store、local state 之间出现镜像同步，形成第二真相源
- `store / manager / presenter` 架构已存在，但 `useEffect` 仍可绕过 owner 边界继续堆补丁

## 长期目标对齐 / 可维护性推进

- 本次改动顺着“代码更少、边界更清晰、行为更可预测”的方向推进一小步：不是再发明一套前端哲学，而是把 React effect 问题收进现有 owner-boundary 治理体系。
- 本次优先推进的最小维护性改进是：只阻断新增的高置信度坏味道 `useEffect`，并把推荐修法明确指向 `store / manager / presenter / query-view hook`。
- 暂不做全仓清扫，也不把所有 effect 都打成错误，避免历史债务与新债治理混在一起。

## 目标与范围

本次目标：

- 新增一条通用规则，明确 `useEffect` 只应用于边界同步
- 扩展现有 MVP skill 与 maintainability review 口径
- 新增 diff-only 治理脚本，拦截新增的高置信度业务型 `useEffect`
- 接入 `pnpm lint:new-code:governance`
- 补测试、验证与迭代留痕

本次不做：

- 不批量重构现有 React 页面
- 不把所有 `useEffect` 使用场景都升级为阻塞
- 不在首版治理 alias 逃逸、复杂回调间接调用等低置信度问题

## 方案

推荐方案：沿用现有 `lint-new-code-*` 增量治理框架，新增 `scripts/lint-new-code-react-effects.mjs`。

同时在规则与 skill 层把“正确归属”写清楚：

- 远端读取与只读派生：`query / view hook`
- 本地 UI 态：`store`
- 动作、状态迁移与业务规则：`manager`
- 跨模块协作、导航、全局能力：`presenter`
- 与 React 外部系统同步：`useEffect`

不采用的方案：

- 只加文档提醒，不加 diff-only 阻断
  - 问题：靠人工 review，无法持续收口
- 直接上全仓 ESLint 重锤
  - 问题：噪音过大，且无法体现本项目偏好的 owner 迁移方向

## 首版检查边界

首版只拦高置信度坏味道：

- 在 `useEffect` 内根据 query 结果把数据再写入 store 或本地 state
- 在 `useEffect` 内根据状态变化触发业务动作、mutation、logout、query invalidation 或导航
- 在 `useEffect` 内连续维护多项业务 state，把 effect 当状态修补器

首版默认豁免：

- `document` / `window` / `matchMedia` / `addEventListener` / `removeEventListener`
- focus、scroll、测量、cleanup 这类边界同步
- 明确的 runtime 订阅与外部资源生命周期管理

## 验证

- 单测覆盖高置信度违规与白名单场景
- 定向运行新脚本与聚合治理入口
- 运行 `pnpm lint:maintainability:guard`
- 补一轮独立 maintainability review，确认这是在收紧 owner 边界，而不是简单堆更多治理代码
