# 用户使用链路与交付验收完成门

## 目标与证据

用户要求优化 AI 开发体系并合入主干：设计不仅要给实际入口，还要给完整使用链路，交付时由 AI 先走通再交给用户。服务产品愿景中的自主、可靠交付，减少用户反复追问。

本次会话的失败证据：时间 tail 功能的设计以请求组装测试充当黄金验收，以工作区源码作为交付物；即使测试全部通过，用户仍没有包含改动的实际会话及使用链路。已有 feature-design-gate 与 user-acceptance reference 已要求真实链路，缺口是设计可自行缩减交付、无 UI 被误作豁免、完成判断未独立核对证据。不能由此推断所有任务都失败。

## 最小修改与职责

- Design：以完整使用链路定义黄金验收，限制设计自行缩减原结果；豁免按用户行为和明确范围判断。
- Review：从原用户目标独立检查链路，不只验证方案自洽；入口或测试清单不能代替使用过程。
- Lifecycle：分别核对实现、AI 验证与用户交付；引用 Delivery 的结果证据，缺链路/先行验证不得完成，不复制交付方法。
- Delivery 原合同已负责真实环境、先行走通与一次交齐说明，保持其唯一执行 owner。主工作区有另一任务对 Delivery 的未提交修改，本任务不复制、提交或撤销它。

不新增 Skill、脚本、审批门或发现入口，不修改 AGENTS 与 command/baseline。规则语义无法靠关键词脚本证明执行有效，本次只做结构检查和代表场景走查，不为单次问题建窄检查。保留纯内部、仅 Review 和用户限定原型的轻量路径。

## Active acceptance ledger

contract-id: acceptance-use-chain-20260914；parent-goal: 完整使用链路与用户验收完成判断落实到既有 owner 并合入 origin/master；scope-revision: 1。

| ID | Required | 合同 | Status | 证据 |
| --- | --- | --- | --- | --- |
| UC-1 | true | 设计给完整使用链路，不能自行缩减用户结果 | passed | Design/Review diff，六个场景逐项走查符合预期 |
| UC-2 | true | 缺实际交付证据不能整体完成，正常豁免与授权不受损 | passed | Lifecycle 与 Delivery 原合同一致；未修改审批授权 |
| UC-3 | true | 渐进加载/治理检查通过，不扩大常驻发现面 | passed | progressive-loading、governance、ratchet、diff-check 全部通过 |
| UC-4 | true | 仅本任务规则改动合入远程主干，保护其它 WIP | passed | 规则提交 070a8f8fe 已包含于 origin/master 的 7c1b9d760；主线回流由 retry worker 接管，既有 WIP 保留 |

## 代表场景走查

| 场景 | 必须作出的判断 | 对应 owner |
| --- | --- | --- |
| 时间感知功能只有测试和工作区链接 | 设计缺真实使用链路，不能完成用户交付 | Design / Review / Lifecycle |
| 提供应用链接，但未写操作、响应和下一步 | 链路不完整，退回补齐，不让用户猜步骤 | Design / Review |
| 后端能力影响回答，没新增 UI | 仍是用户行为变化，不能豁免真实验收 | Design / Review |
| 测试通过、尚未发布但可启动隔离实例 | 在已有授权内准备实例并先行验证，不能以未发布收尾 | Delivery / Lifecycle |
| 纯规则修改或明确只要 Review/原型 | 交付可核对产物，不强建运行实例 | Design / Lifecycle |
| 已授权合入主干，用户尚未回复验收 | 不捏造验收通过，也不新增合入审批 | Lifecycle / Delivery |

黄金验收：维护者先核对三处 owner 的 diff，再用上述失败/正常场景逐条走查路由和终态，最后确认主干包含提交与其它 WIP 仍独立。纯规则任务不运行产品 build/tsc/冒烟。

## 生命周期与代价

本次修订已有约束而非创建新机制，作为最小作用域试用。复核触发：后续有用户可见任务再次按该链路交付，或模型升级时；观察是否仍有“测试即交付”、是否误触发纯内部运行环境或额外审批。无净收益时收窄/回退三处增量，不提升到 AGENTS。场景走查证明文本覆盖，不冒充未来模型行为已得到保证。体积和最终检查结果在本记录收尾更新。

## 提交前验证

`check:skill-progressive-loading`、`lint:new-code:governance`、`check:governance-backlog-ratchet`、`git diff --check` 通过。初次发现 Design 入口超预算，压缩重复表述后通过，未提高 baseline。Review 无开放 finding；不为纯指令 Markdown 运行产品 tsc/build。

AGENTS 11962 bytes 不变；顶层 Skill 15、Wiki Skill 23、discovery 2726 chars、description 1392 chars 和依赖边 51 均不变。三个入口合计增加 768 bytes（290 字符）：Design 7745 → 7926、Review 4940 → 5058、Lifecycle 7217 → 7686，均在既有预算内。Wiki、命令、脚本和 baseline 不变；内部规则不新增 changeset，不另建重复日志。

## 主干交付回执

规则提交 `070a8f8fe` 经 `7c1b9d760` 合入并普通 push 到 `origin/master`。`pnpm release:reconcile:mainline` 返回 `LOCAL_WORKTREE_RETRYING`：本地 master 有其它任务的 tracked WIP，自动 worker 等待安全快进；未 stash/reset 或覆盖其改动。时间 tail 功能的独立工作区仍保留未提交源码，未混入本次提交。此记录随后以纯文档提交补记交付证据。
