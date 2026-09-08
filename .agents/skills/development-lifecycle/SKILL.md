---
name: development-lifecycle
description: 通用开发流程的唯一 Meta Skill；理解后选择 standard、trivial 或 bugfix，管理阶段门、返工、验收与整体完成；阶段 Skill 提供方法，知识库提供事实。
---

# Development Lifecycle

## 职责与入口

只管理流程、阶段状态与完成判断，不复制阶段方法或动态项目事实。意图宏读取 `commands/commands.md` 展开；解释、引用不执行。仅调查、设计、Review 等请求止于指定产物，不自动扩展为实现或发布。

当前 observer：[`development-task-telemetry`](../development-task-telemetry/SKILL.md)。路径存在即加载一次，只观察既定状态；不可用时说明并继续。并发提交/主线并发才读[Worktree 合同](references/parallel-worktree-development.md)；用户同时明确省 Token 和子代理才读[委派合同](references/token-efficient-delegation.md)。

共同入口由 Task Understanding 给出用户结果、范围/授权、成功判定、事实/假设/未知、owner、风险与分类依据。上下文足够时不反问；会改变目标或关键选择的缺口才澄清。

## 分类与风险

按顺序选择 `flow`：

1. 恢复已有合同行为 → `bugfix`；预期未知先调查，不把新增需求当 bug。
2. 非 bug，且局部可逆、范围清楚、惯例路径、验证直接、无真实设计分叉或高风险边界 → `trivial`。
3. 其它变更 → `standard`。

风险独立：L0 普通文档/元信息；L1 局部低风险；L2 行为/交互；L3 跨 owner、持久化、协议或高影响规则；L4 发布、迁移、生产或不可逆操作。按内容而非扩展名或行数判断。trivial 仅 L0-L1；发现跨层影响或设计分叉升级 standard，复用有效证据。bugfix 有设计缺口时使用正式设计与方案 Review，保留修复目标。

`task-type` 仍按主要意图为 feature / bugfix / small-change，flow 独立记录，不机械替换统计字段。observer phase 使用原七个值；方案审查使用 review，AI 验收依次使用 validation/review，不新增 marker 值。

风险 L3-L4，或用户明确要求大型、多阶段、低监督完整交付/验收标准时加载 [`acceptance-contract-governance`](../acceptance-contract-governance/SKILL.md)，登记 active contract 与 stable acceptance IDs；普通任务也有判定，但不普遍创建 ledger。

## 三条流程

| flow | 顺序与门 |
| --- | --- |
| standard | 理解澄清 → 方案与验收设计 → Review(mode=design) → 实现与迭代检查 → Validation(mode=acceptance) → Review(mode=implementation) → 用户验收交付 → 复盘 |
| trivial | 快速理解与判定 → 修改 → 定向 Validation 与轻量 Review → 交付 → 轻量复盘；不要求独立方案或设计文档 |
| bugfix | 预期/异常 → 复现取证与根因 → 修复和回归判定 → 必要设计/方案 Review → 修复 → 原触发与相邻行为验证、Review → 交付 → 复盘 |

只有根因、路径与修后判定明确，L0-L1、单 owner、局部可逆且不改变跨层合同/状态/持久化/兼容/迁移/fallback 的 bugfix，才可内联修复设计并跳过独立方案 Review。记录 skip-design 与依据；其它 bugfix 走正式设计门。复现由理解阶段选择 reproduce 或 skip-reproduction 并说明证据，不新增 phase。

standard 不因 diff 小跳过设计：设计含验收标准、必要测试矩阵并完成方案 Review；轻量方案不等于必须建长文档。plan 只在跨批恢复需要时建立，不是新增 phase。

## 当前阶段路由

一次只加载当前 owner，阶段只返回结果，不相互调用或回链：

- 理解、分类依据、事实与复现：`development-task-understanding`。
- 方案、验收设计与矩阵：`development-design`。
- 方案审查(mode=design)或实现审查(mode=implementation)：`development-review`。
- 按合同修改与迭代检查：`development-implementation`。
- 定向证明或最终 AI 验收(mode=acceptance)：`development-validation`。
- 可用入口、用户验收、授权内交付：`development-delivery`。
- 轻量反思与条件沉淀：`development-retrospective`。

AI 验收结合 Validation 合同证据与 Review 结论，不新增平行 Skill。方案 Review 不要求多代理。用户验收不适用于纯内部产物时说明依据，不强加产品运行环境。

## 状态与返工

阶段返回 status(completed/skipped/rework/blocked)、结论、产物、证据、open_risks、rework_target、acceptance_updates 与 `parent_status`(in-progress/blocked/ready-for-completion-check)。无 active contract 时 acceptance_updates 为空。阶段、Delivery 和 release 仅关闭子目标，不返回整体 completed。

- 理解或根因不明回 Task Understanding；模型缺口回 Design；编码偏差回 Implementation。
- 方案 Review 失败回 Design；实现 Review 有 finding 不得交付，修正后重验变化并复审。
- 验证失败按原因返工，受影响证据转 stale，不重复未变化风险的验证。
- 交付入口不完整留在 Delivery；外部失败由该阶段恢复，产物合同错误才回上游。
- 复盘发现结果不完整先返工，不将缺口改称后续优化。

跨会话、交接或上下文压缩前保存 flow、阶段/mode、目标、授权、验收项、证据指针、open Required IDs 与 scope decisions；恢复先对账，不从版本或最新总结猜完成。

## 完成门

整体仅由本 Meta Skill 判定：最小完整结果成立；授权内无可关闭的必要缺口；适用验证有效、Review findings 清零；Delivery 已完成适用交接与用户验收合同；Retrospective 已判断是否沉淀；未验证和主观项已披露。

区分已交付待用户验收、用户验收通过和任务关闭。约定必须用户确认时保持待验收；否则可结束开发交付。未回复不算通过。待验收可先做内部复盘，用户反馈更新同一记录。

active contract 的 Required acceptance IDs 必须全部 current passed，且 parent-goal 无未登记缺口；scope reduction（删减/降低标准或移出目标）须用户确认与 scope revision。局部发布、测试成功或写完文档不能替代此门。

未经明确授权不 commit、push、PR、发布、部署或不可逆操作。不得为形式制造无信息增量的文档、检查、审查或沉淀。
