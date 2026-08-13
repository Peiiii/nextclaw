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
- 明确 commit、push、release 和 deploy 已因未授权跳过。

## 专项路由

每个决策只进入当前需要的一个 owner：

- 提交范围、changeset、版本笔记和用户可见更新摘要：`nextclaw-release-notes`；
- 重要交付、跨模块长链路、红区和发布留痕：`nextclaw-iteration-log-governance`；
- NextClaw NPM package、runtime channel、真实安装和分支闭环：`nextclaw-npm-release`；
- NextClaw Desktop installer、DMG、update manifest、发布和恢复：`nextclaw-desktop-release`。

专项 owner 可以被本阶段路由，也可以在用户明确提出完整场景时直接触发；它们不重新编排上游开发阶段。

## 外部动作

- 未经用户明确要求，不 commit、push、建 PR、release、deploy 或执行不可逆操作。
- 用户要求提交时先判断 changeset 和迭代记录，再精确 stage，禁止混入无关 WIP。
- 发布使用仓库既有 release flow，不以零散原子命令伪装完整闭环。
- 发布完成必须覆盖授权范围内适用的 artifact、manifest、update channel、release notes、部署后 smoke 和分支回流。
- tag、release 页面、workflow 触发或 registry publish 只是中间状态，不自动等于交付完成。
- 部分发布或外部失败优先进入专项恢复分支；不得重复发布已经成功的不可逆步骤。

## 输出

报告交付范围、主要证据、外部动作及其结果、未完成项、恢复入口和残余 WIP。没有外部动作时明确说明授权边界；不得把部分完成表述成全部完成。

本阶段不修改产品实现、不关闭 Review findings，也不把内部工程记录直接拼成用户 release notes。
