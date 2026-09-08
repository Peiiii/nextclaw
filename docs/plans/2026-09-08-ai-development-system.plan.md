# AI 开发体系落地与验收计划

日期：2026-09-08。状态：已完成本地落地与验证，未提交/发布。

上位设计：[完整架构](../designs/2026-09-08-ai-development-system.design.md)、[意图宏](../designs/2026-09-08-intent-macro.design.md)。

## 目标与授权

- contract-id：ai-development-system-20260908；parent-goal：完整落地流程、方法、知识、意图宏与受控复盘，并交付验证汇总。
- scope-revision：1；scope-confirmation：用户授权一次性实施与验证。
- 范围：规则与知识治理，无产品源码、发布或 Git 提交；保护此前 delivery/lifecycle/validation 与用户验收 reference 的 WIP。
- 风险：跨 owner 规则语义变化，流程 standard；文件类型不降低行为验证要求。

## 执行与阶段门

| 部分 | owner / 输入 | 结果与验证 | 状态 |
| --- | --- | --- | --- |
| 方案 Review | 规则治理；设计与当前 diff | 单一 lifecycle、保持统计协议、无新 Skill、明确验收门 | passed |
| 流程与方法 | lifecycle 与阶段 owner；复用上位设计 | 三路分类、验收前置、方案 Review、AI 验收与返工 | passed |
| 知识与宏 | 知识/规则治理；复用上位设计 | 条件 reference、唯一宏目录、发布快捷表达 | passed |
| 复盘收敛 | retrospective 与资产生命周期；复用上位设计 | 更新/合并/退场优先，事实与方法分流 | passed |
| 验证交付 | 验证、Review、交付；实际 diff | 自动检查、场景审查、WIP 审计、汇总 | passed |

## Active acceptance ledger

| ID | Required | 合同 | Status | 证据 |
| --- | --- | --- | --- | --- |
| ADS-01 | true | 唯一 Meta Skill 管三条流程与升级、只读边界 | passed | [本批证据](../logs/v0.48.12-ai-development-system/README.md) |
| ADS-02 | true | 验收前置、方案 Review、AI 验收与用户验收归属明确 | passed | [本批证据](../logs/v0.48.12-ai-development-system/README.md) |
| ADS-03 | true | 事实有来源、作用域、有效性及更新/冲突规则 | passed | [本批证据](../logs/v0.48.12-ai-development-system/README.md) |
| ADS-04 | true | 宏可创建、解释、调用和修订，临时变化不污染定义 | passed | [本批证据](../logs/v0.48.12-ai-development-system/README.md) |
| ADS-05 | true | 复盘支持不沉淀、合并、删除与补丁退出 | passed | [本批证据](../logs/v0.48.12-ai-development-system/README.md) |
| ADS-06 | true | 拓扑/链接/体积与治理检查通过，场景无合同冲突 | passed | [本批证据](../logs/v0.48.12-ai-development-system/README.md) |
| ADS-07 | true | 原 WIP 保留、运行入口接入、交付可追溯 | passed | [本批证据](../logs/v0.48.12-ai-development-system/README.md) |

## 方案 Review 结论

采用一个 Meta Skill 与原七阶段 owner；两类 Review 共用显式 mode。flow 与统计 task-type 分离，不扩展 marker 协议。知识与宏由原 owner 的条件 reference 承载。纯规则不运行产品 tsc/build，不用静态检查宣称跨模型可靠性。

## 恢复与返工

恢复先读 ledger、git diff 与证据，只对变化项重验；新 owner 或协议分叉返回设计。未通过项保持 open，修复后更新同一记录，不另建计划。最终证据汇总进入本批迭代记录。

## 最终对账

ADS-01～07 全部通过本地规则合同与静态场景验收，无 open-required。自动检查与 20 个场景结论见迭代记录；该 passed 不代表独立模型行为盲测或用户验收已完成。本批未改变产品代码，无发布、提交或部署动作。原 delivery diff 完整保留。
