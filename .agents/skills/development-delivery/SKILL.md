---
name: development-delivery
description: 通用开发生命周期的「交付、发布与部署」阶段 owner；当结果已经达到交付条件，或用户明确要求提交、发布、部署时使用，负责授权边界、结果交接和专项发布路由，不负责实现或 Review。
---

# Development Delivery

## 目标

回答“如何把已经接受的结果安全交付给用户或目标环境”。每个完成的开发任务都进行轻量结果交接；commit、push、PR、release、deploy 和其它外部写入只有在用户明确授权后执行。

## 进入门

进入时确认：

- 可观察目标和交付范围；
- 适用验证已经通过且证据未因后续修改失效；
- 适用 Review 已无未关闭 findings；
- 工作区中的用户或其它任务改动已经隔离；
- 外部动作的对象、范围和授权明确。

任一前置合同不成立时返回正确返工阶段，不在 Delivery 内修代码或改设计。

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

博客候选在适用 Validation 和 Review 已形成稳定证据后判断，不等待 commit、release 或 deploy。明显改变具体用户任务、具备可解释的 before/after、解决可复用的 AI 原生产品问题，或有真实指标/界面支撑独立主题时，进入产品博客 owner；常规修复、内部重构、纯 changeset 或证据仍会变化的结果跳过。

命中候选不等于发布。事实已经稳定且当前任务未明确排除内容产物时，可以提前形成内部草稿；若文章必须随当前产品变化发布，在对应 changeset 中写入博客绑定指令。文章上线、站点导航、配图公开和社交分发仍分别遵守明确授权与对应交付合同。

## 发布语义

- 每次 release/deploy 从进入交付阶段起使用 `development-task-telemetry` 记录阶段边界、wall time、外部等待、失败重试和人工/自动边界；专项发布器或 workflow 还必须输出稳定 schema 的机器可读观测，至少包含总 wall time、各阶段/各 job 起止与耗时、最慢 step、外部等待和重试/失败。失败路径同样保留已完成阶段，恢复必须沿用同一发布 identity 和观测链；最终在迭代记录与交付摘要中报告实测总耗时、最慢阶段和可执行提效项，不以估算替代。
- 清晰自然语言与 `commands/commands.md` 中对应的中文发布命令等价；执行前用一句话复述包含项、排除项和第一个完成点。
- “发布 NPM”只进入 NPM package owner；“发布 NextClaw 正式版”包含 NPM 与常规 runtime/product closure，但不包含 desktop；只有“桌面版”或“全平台版”才授权 desktop。
- 全平台发布按阶段顺序路由：当前 owner 完成并形成状态后再进入下一个 owner，不同时加载或并行触发 NPM 与 desktop 发布。
- 上下文不能确定对象时只问一个短问题；存在“只、仅、不包含”等限制词时以更窄授权为准。

## 外部动作

- 未经用户明确要求，不 commit、push、建 PR、release、deploy 或执行不可逆操作。
- 用户要求提交时先判断 changeset 和迭代记录，再精确 stage，禁止混入无关 WIP。
- 发布使用仓库既有 release flow，不以零散原子命令伪装完整闭环。
- 发布完成必须覆盖授权范围内适用的 artifact、manifest、update channel、release notes、部署后 smoke 和分支回流。
- tag、release 页面、workflow 触发或 registry publish 只是中间状态，不自动等于交付完成。
- 可恢复的分支分叉、并行 WIP 或暂存于隔离分支只是交付中间状态；不得据此收尾，必须主动完成安全集成与主线回流。只有真实外部依赖无法消除时才报告未完成，并给出恢复条件和可直接续跑的入口。
- 部分发布或外部失败优先进入专项恢复分支；不得重复发布已经成功的不可逆步骤。

## 输出

报告交付范围、主要证据、外部动作及其结果、未完成项、恢复入口和残余 WIP。没有外部动作时明确说明授权边界；不得把部分完成表述成全部完成。

本阶段不修改产品实现、不关闭 Review findings，也不把内部工程记录直接拼成用户 release notes。
