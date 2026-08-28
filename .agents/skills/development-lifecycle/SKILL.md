---
name: development-lifecycle
description: 通用开发生命周期的唯一默认流程 owner；用于按风险编排 Task Understanding、Design、Implementation、Validation、Review、Delivery 与 Retrospective，只管理阶段推进、返工和完成判断，不复制阶段内部合同。
---

# Development Lifecycle

## Lifecycle observer

当前 observer：[`development-task-telemetry`](../development-task-telemetry/SKILL.md)。

- observer 路径存在时视为启用，进入本流程时只加载一次；阶段切换时不重复加载。
- observer 只接收本流程已经决定的 task / phase 事实，不参与阶段路由、返工和完成门。
- 子 Agent 由父任务传入 observer 名、task-id 和当前 phase，不自行扫描全局配置。
- observer 缺失或加载失败时明确说明 unavailable 并继续任务。
- 把“当前 observer”设为空即可停用；本节不复制 observer 的具体输出协议。

## 定位

这是普通源码、脚本、测试、运行链路和从方案到实现任务的唯一默认流程 owner。开始时只加载本入口；进入某一阶段后才加载该阶段 owner，不预读未来阶段。

总流程只负责阶段状态和任务完成，不拥有调查、设计、实现、验证、review、发布或沉淀的内部方法。

用户明确要求大型、多阶段或低监督任务的完整交付验收标准时，条件加载 [`acceptance-contract-governance`](../acceptance-contract-governance/SKILL.md)，把它的整体契约与阶段门作为各阶段共享输入；它不是新 phase，普通任务不加载。

## 开始

先确定六件事：

- 一个可观察结果；
- 任务类型：`feature`、`bugfix` 或 `small-change`；
- 最近 owner 和影响面；
- 风险等级 L0-L4；
- 当前阶段；
- 完成任务所需的最小可信证据。

风险定义：

- L0：文档与普通元信息；
- L1：局部低风险代码、纯视觉或文案展示；
- L2：交互、状态、局部行为或明确 bug；
- L3：跨 owner/transport、持久化、兼容或运行链路；
- L4：发布、迁移、生产或不可逆操作。

任务类型按主要意图互斥归类，不能替代风险等级：

- `bugfix`：恢复已有合同或预期行为；
- `feature`：新增或实质改变用户、开发者或系统可用能力；
- `small-change`：既不是修复已有合同，也不新增或实质改变能力，并且局部、可逆、沿用既有惯例的琐碎改动。

优先判断 `bugfix`，再判断 `feature`；只有两者都不成立时才可使用 `small-change`。任务理解阶段冻结类型；新证据改变主要意图时显式修正，telemetry 不参与分类。

`bugfix` 还必须在 Task Understanding 显式选择 `reproduce` 或 `skip-reproduction` 并留下证据；复现不是独立 phase，具体门槛归 Task Understanding 和 Validation owner。

## 设计门

Task Understanding 结束、进入 Implementation 前必须显式判断 Design；`feature`、`bugfix` 和 `small-change` 都不能按类型自动决定。只有以下条件同时成立才允许跳过：

- 已记录 `skip-design`、`design-document: not-required` 及单一路径依据；若为 `feature`，用户结果和行为边界已清楚；若为 `bugfix`，根因、修复路径和修后验证判定均已确认；
- 风险为 L0-L1；
- 只触达一个现有 owner，不改变跨层合同、状态归属、持久化、兼容、迁移或 fallback，也不存在未决的用户工作流或交互取舍；
- 已有明确惯例且不存在会改变结果的真实方案分叉；
- 改动局部、可逆，验证方式直接且不依赖新增交互或运行时假设。

任一条件不成立就进入 `development-design`。跳过不能用 diff 小、时间紧或“看起来显然”代替判断。进入 Design 后返回稳定设计文档与大型执行 plan 决定；plan 不是新 phase。

## 阶段路由

按当前阶段只选择一个 owner：

1. 任务理解、现状取证、范围和成功条件：`development-task-understanding`。
2. 设计门不满足全部跳过条件，或用户明确要求设计：`development-design`。
3. 按已确认目标和设计修改产物：`development-implementation`。
4. 证明行为、合同和运行链路：`development-validation`。
5. 判断改动是否可接受并关闭 findings：`development-review`。
6. 结果交接、提交、发布或部署：`development-delivery`。
7. 任务结束前的轻量反思和条件沉淀：`development-retrospective`。

阶段存在不等于重型执行：Design 可以判定为轻量产物而不创建设计文档，也可以判定单批任务不需要 plan；没有实现产物时实现、验证和 review 可明确跳过；没有外部授权时 Delivery 只完成结果交接；Retrospective 没有复用价值时不落盘。

## 阶段结果

阶段必须返回同等语义的信息：

- `status`：completed、skipped、rework 或 blocked；
- `summary`：本阶段结论；
- `artifacts`：形成或更新的产物；
- `evidence`：支持结论的最小可信证据；
- `open_risks`：未关闭或未验证边界；
- `rework_target`：需要返回的阶段，没有则为空。

不要求机械输出固定格式，但不能省略影响下一阶段的事实。

## 返工

- 任务或现状证据不足：留在 Task Understanding。
- 实现暴露模型缺口：回到 Design；只是编码偏差则回到 Implementation。
- Validation 失败：按失败 owner 回到 Design 或 Implementation。
- Review 有 finding：不得进入 Delivery；修改后重新经过 Validation 和 Review。
- Delivery 的外部失败：优先留在 Delivery 的恢复分支；产物合同错误才回上游。
- Retrospective 发现当前任务未完成：返回对应阶段；只有长期建议时形成后续输入。

阶段 owner 不直接调用其它阶段 owner，也不回链本入口。阶段切换始终由本流程决定。

## 完成门

任务完成必须同时满足：

- 可观察目标已经实现，或明确说明为何无需实现；
- 适用的 Validation 已完成，证据仍然有效；
- 适用的 Review 已无未关闭 findings；
- Delivery 已完成结果交接，外部动作已完成或因未授权而明确跳过；
- Retrospective 已判断是否需要持久化；
- 未验证边界、主观确认项和外部阻塞已经披露。

只汇报结果、主要证据、未验证边界和真实触发的交付/沉淀状态，不罗列所有未触发阶段和命令。

## 禁止

- 任务开始时加载全部七个阶段。
- 在本入口复制阶段详细清单。
- 让阶段 skill 互相调用或回链生命周期。
- 为流程完整而制造无信息增量的设计、测试、review 或文档。
- 未经用户授权执行 commit、push、PR、release、deploy 或不可逆操作。
