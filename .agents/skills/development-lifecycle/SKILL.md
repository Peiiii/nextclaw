---
name: development-lifecycle
description: 通用开发生命周期的唯一默认流程 owner；用于按风险编排 Task Understanding、Design、Implementation、Validation、Review、Delivery 与 Retrospective，只管理阶段推进、返工和完成判断，不复制阶段内部合同。
---

# Development Lifecycle

## Lifecycle observer

当前 observer：[`development-task-telemetry`](../development-task-telemetry/SKILL.md)。

- observer 路径存在即启用，只在进入本流程时加载一次；它只接收既定 task / phase，不参与路由、返工或完成门。
- 子 Agent 接收父任务的 observer、task-id 与 phase；缺失或加载失败时说明 unavailable 并继续。
- 把“当前 observer”设为空即可停用；本节不复制 observer 的具体输出协议。

## 定位

这是普通源码、脚本、测试、运行链路和从方案到实现任务的唯一默认流程 owner。开始时只加载本入口；进入某一阶段后才加载该阶段 owner，不预读未来阶段。

总流程只负责阶段状态和任务完成，不拥有调查、设计、实现、验证、review、发布或沉淀的内部方法。

风险为 L3-L4，或用户明确给出验收标准、要求大型/多阶段/低监督完整交付时，加载 [`acceptance-contract-governance`](../acceptance-contract-governance/SKILL.md)，建立 active contract 与 stable acceptance IDs；它不是新 phase，普通 L0-L2 任务不加载。

## 开始

并发提交或主线并发时，读取[Worktree 合同](references/parallel-worktree-development.md)。

先确定六件事：

- 一个可观察的最小完整结果；
- 任务类型：`feature`、`bugfix` 或 `small-change`；
- 最近 owner 和影响面；
- 风险等级 L0-L4；
- 当前阶段；
- 完成任务所需的最小可信证据。

命中时记录 `contract-id`、`parent-goal`、ledger 落点和 Required acceptance IDs；设计/计划清单先登记，不能凭文档存在进入 gate。

用户当前任务同时明确开启省 Token 并要求子代理时才读取[省 Token 委派合同](references/token-efficient-delegation.md)；效率、省 Token 或并行本身不授权委派。

风险定义：L0 文档/元信息；L1 局部低风险代码或展示；L2 交互、状态、局部行为或明确 bug；L3 跨 owner/transport、持久化、兼容或运行链路；L4 发布、迁移、生产或不可逆操作。

任务类型按主要意图互斥归类：`bugfix` 恢复已有合同；`feature` 新增或实质改变能力；`small-change` 仅用于前两者都不成立且局部、可逆、沿用惯例的琐碎改动。依次判断并在 Task Understanding 冻结；新证据改变意图时显式修正。类型不替代风险，telemetry 不参与分类。

`bugfix` 还必须在 Task Understanding 显式选择 `reproduce` 或 `skip-reproduction` 并留下证据；复现不是独立 phase，具体门槛归 Task Understanding 和 Validation owner。

## 设计门

Task Understanding 后、Implementation 前显式判断 Design，任务类型不能自动决定。仅当同时记录 `skip-design`、`design-document: not-required` 和单一路径依据，风险 L0-L1，只触达一个 owner，不改变跨层合同/状态/持久化/兼容/迁移/fallback，无未决工作流、交互取舍或真实方案分叉，且改动局部可逆、验证直接时跳过；feature 还须结果与行为边界清楚，bugfix 还须根因、路径和修后判定确认。否则进入 `development-design`，返回设计文档与 plan 决定；plan 不是 phase。diff 小、时间紧或“显然”不是依据。

## 阶段路由

按当前阶段只选择一个 owner：

1. 任务理解、现状取证、范围和成功条件：`development-task-understanding`。
2. 设计门不满足全部跳过条件，或用户明确要求设计：`development-design`。
3. 按已确认目标和设计修改产物：`development-implementation`。
4. 证明行为、合同和运行链路：`development-validation`。
5. 判断改动是否可接受并关闭 findings：`development-review`。
6. 结果交接、提交、发布或部署：`development-delivery`。
7. 任务结束前的轻量反思和条件沉淀：`development-retrospective`。

阶段不等于重型仪式：Design 可用轻量产物且单批无需 plan；无实现产物时实现、验证和 review 可跳过；无外部授权时 Delivery 只交接；Retrospective 无复用价值时不落盘。

## 阶段结果

阶段必须返回同等语义的信息：

- `status`：completed、skipped、rework 或 blocked；
- `summary`：本阶段结论；
- `artifacts`：形成或更新的产物；
- `evidence`：支持结论的最小可信证据；
- `open_risks`：未关闭或未验证边界；
- `rework_target`：需要返回的阶段，没有则为空。
- `acceptance_updates`：本阶段改变的 stable IDs，没有 active contract 时为空；
- `parent_status`：in-progress、blocked 或 ready-for-completion-check，阶段不得返回整体 completed。

`open_risks` 承载妨碍最小完整结果的必要缺口，不得降格为“后续优化”。格式可变，但不得省略影响下一阶段或完成判断的事实。

跨会话、交接或上下文压缩前持久化 active contract、open Required IDs、证据和 scope decisions；恢复后先重载对账，不能从 summary、版本或发布猜测父目标。

## 返工

- 任务或现状证据不足：留在 Task Understanding。
- 实现暴露模型缺口：回到 Design；只是编码偏差则回到 Implementation。
- Validation 失败：按失败 owner 回到 Design 或 Implementation。
- Review 有 finding：不得进入 Delivery；修改后重新经过 Validation 和 Review。
- Delivery 的外部失败：优先留在 Delivery 的恢复分支；产物合同错误才回上游。
- Retrospective 发现当前任务未完成：返回对应阶段；只有长期建议时形成后续输入。

阶段 owner 不直接调用其它阶段 owner，也不回链本入口。阶段切换始终由本流程决定。

阶段、Delivery 和 release 只关闭子目标并返回 `acceptance_updates`。仅本流程可改 parent 整体状态；局部发布不得把 `parent_status` 升为完成。

## 完成门

任务完成必须同时满足：

- 可观察的最小完整结果已经实现，或明确说明为何无需实现；
- 当前授权与可控范围内不存在仍可安全关闭、但会使该结果不完整的必要缺口；
- 适用的 Validation 已完成，证据仍然有效；
- 适用的 Review 已无未关闭 findings；
- Delivery 已完成结果交接，外部动作已完成或因未授权而明确跳过；
- Retrospective 已判断是否需要持久化；
- 未验证边界、主观确认项和外部阻塞已经披露。
- active contract 的 Required acceptance IDs 均为 current passed，且 parent-goal 无未登记必要缺口；
- scope reduction（删/降 Required ID、降低合同或移出 parent-goal）有用户确认和 scope revision。

无 active contract 时按最小完整结果判断；命中却未建 ledger 时不得完成。进度、局部成功、版本发布和“主要功能已完成”不能替代完成门。

## 禁止

- 任务开始时加载全部七个阶段。
- 在本入口复制阶段详细清单。
- 让阶段 skill 互相调用或回链生命周期。
- 制造无信息增量的设计、测试、review 或文档。
- 未经用户授权执行 commit、push、PR、release、deploy 或不可逆操作。
