---
name: development-delivery
description: 通用开发生命周期的「交付、发布与部署」阶段 owner；当结果已经达到交付条件，或用户明确要求提交、发布、部署时使用，负责授权边界、结果交接和专项发布路由，不负责实现或 Review。
---

# Development Delivery

## 目标

回答“如何安全交付结果”。每个任务都交接结果；commit、push、PR、release、deploy 等外部写入仅在用户明确授权后执行。

## 进入门

进入时确认：

- 可观察目标和交付范围；
- 适用验证已经通过且证据未因后续修改失效；
- 适用 Review 已无未关闭 findings；
- 工作区中的用户或其它任务改动已经隔离；
- 外部动作的对象、范围和授权明确。
- active contract 存在时，本次交付对应 stable acceptance IDs 已明确且证据当前有效。

前置合同不成立就返回正确阶段，不在 Delivery 内修代码或设计。

## 轻量交付

没有外部发布授权时也要完成：

- 汇报结果和主要证据；
- 披露未验证技术路径、主观确认项和残余风险；
- 判断生成物是否应保留；
- 判断 changeset、release notes 和迭代记录是否适用；
- 判断已经形成稳定证据的用户可见结果是否值得提前准备产品博客；
- 明确 commit、push、release 和 deploy 已因未授权跳过。

## 专项路由

每个决策只进入当前需要的一个 owner：

- 提交范围、changeset、版本笔记和用户可见更新摘要：`nextclaw-release-notes`；
- 重要交付、跨模块长链路、红区和发布留痕：`nextclaw-iteration-log-governance`；
- 有独立用户任务、可核查证据和公开叙事价值的产品成果：`nextclaw-product-blog-storytelling`；
- NextClaw NPM package、runtime channel、真实安装和分支闭环：`nextclaw-npm-release`；
- NextClaw Desktop installer、DMG、update manifest、发布和恢复：`nextclaw-desktop-release`。

专项 owner 可以被本阶段路由，也可以在用户明确提出完整场景时直接触发；它们不重新编排上游开发阶段。

## 博客候选门

适用 Validation/Review 已形成稳定证据，且成果明显改变用户任务、有可解释 before/after、解决可复用 AI 原生问题或有真实指标/界面时，进入博客 owner；常规修复、内部重构、纯 changeset 或证据未稳定时跳过。命中不等于发布：可在任务未排除内容产物时先写内部草稿；需随版本发布则写入 changeset 绑定指令，上线、导航、配图和社交仍各自遵守授权。

## 发布语义

- release/deploy 使用 `development-task-telemetry` 记录阶段、wall time、等待、重试和人工边界；workflow 输出 job/step 耗时与失败，恢复沿用 identity；最终报告实测耗时、最慢阶段和提效项。
- 每次 release/deploy 结束（含失败/取消）固定报告 `AUTOMATION_INTERVENTIONS: <n>`，目标为 `0`。`owning entry/prewarm` 至终态的 owner 外人工动作按根因计数；初始 dispatch、准备、只读观察和 owner 自动重试/恢复不计。非 `0` 时逐项报告介入点、根因和自动化消除落点；不报主观分数。
- 外部等待只在完成点、风险、失败或需决策时更新；状态未变不发心跳。优先一次有界 wait/sleep；重复只读监控仅在净省 Token 时交给低成本 Agent，不把等待变成定时任务或高频轮询。
- 清晰自然语言与 `commands/commands.md` 中对应的中文发布命令等价；执行前用一句话复述包含项、排除项和第一个完成点。
- “发布 NPM”只进入 NPM package owner；“发布 NextClaw 正式版”包含 NPM 与常规 runtime/product closure，但不包含 desktop；只有“桌面版”或“全平台版”才授权 desktop。
- 一键发布公开入口只收业务必要参数（全平台仅 `target=all`）；单次 dispatch 后冻结 identity/protocol 并按 checkpoint 自动幂等恢复，禁止要求用户或 Agent 补传版本、SHA、阶段或恢复参数。
- 上下文不能确定对象时只问一个短问题；存在“只、仅、不包含”等限制词时以更窄授权为准。

## 外部动作

- 未经用户明确要求，不 commit、push、建 PR、release、deploy 或执行不可逆操作。
- 用户要求“提交”或使用 `/commit` 时，只在当前任务分支精确 stage/commit；用户明确说“合入主干”时，才安全集成本地 `master` 并推送 `origin/master`。用户限制为本地时跳过 push，禁止混入无关 WIP 或把隔离分支报告为合入完成。
- 发布使用仓库既有 release flow，不以零散原子命令伪装完整闭环。
- 发布完成必须覆盖授权范围内适用的 artifact、manifest、update channel、release notes、部署后 smoke 和分支回流。
- tag、release 页面、workflow 触发或 registry publish 只是中间状态，不自动等于交付完成。
- 任何向远程 `master` 写入的交付或发布在远程完成门后运行 `pnpm release:reconcile:mainline`。本地独有提交由协调器在隔离 worktree 合并、验证并普通 push；本地主 worktree 有活跃 WIP 时由单例 retry worker 自动续跑，禁止要求用户手工 pull/rebase/stash。只有脚本返回 `LOCAL_MAINLINE_SYNCED` 才报告本地同步；`LOCAL_WORKTREE_RETRYING` 表示自动任务仍在运行，不是用户待办。
- 可恢复分叉、并行 WIP 或隔离分支只是中间状态，必须安全集成并回流主线。冲突留在恢复 worktree 继续解决和验证，不污染活跃区、不重复发布；只有真实外部依赖无法消除时报告未完成。
- 部分发布或外部失败优先进入专项恢复分支；不得重复发布已经成功的不可逆步骤。
- active contract 下只返回 `acceptance_updates` 与 `parent_status`；artifact、版本或 release 不能完成 parent-goal，交回 lifecycle 执行 completion gate。

## 输出

报告交付范围、主要证据、外部动作及其结果、未完成项、恢复入口和残余 WIP；有 active contract 时同时报告 stable ID 更新并返回 parent。没有外部动作时说明授权边界；不得把部分完成表述成全部完成。

本阶段不修改产品实现、不关闭 Review findings，也不把内部工程记录直接拼成用户 release notes。
