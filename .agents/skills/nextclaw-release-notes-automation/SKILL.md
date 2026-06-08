---
name: nextclaw-release-notes-automation
description: 当用户要求提交、收尾、统一 NPM 发布、GitHub release、changelog、release notes、变更汇总，或担心并行会话导致发布内容靠记忆整理时使用。适用于需要进入用户可见发布说明的 NextClaw workspace 包变更和 Changesets 聚合。
---

# NextClaw Release Notes Automation

## 目标

只把用户需要感知的产品变更写进发布说明。发布时直接收集这些发布说明片段，不靠记忆回忆。

本 skill 只管一个简单机制：

- 需要进入最终 changelog 的用户可见变更：添加 `.changeset/*.md`
- 不需要进入最终 changelog 的内部变更：不添加任何发布说明片段

## 提交/收尾时

在 `/commit`、`/close-task`、用户说“提交吧/收尾/完成”时，先判断本次 staged 范围是否包含用户需要感知的产品变更。

需要添加 `.changeset/*.md` 的典型情况：

- 新增或改变用户可见功能
- 修复用户会遇到的 bug
- 改变安装态、运行态、CLI、UI、agent 行为或公共 API
- 改变发布包内用户会使用或依赖的内容

不需要添加 `.changeset/*.md` 的典型情况：

- 只改 `AGENTS.md`、`.agents/skills`、内部治理规则
- 只改 `docs/logs`、`docs/thoughts`、`docs/plans`、内部设计文档
- 只补测试、lint、工程治理，不改变产品行为
- 纯内部重构且用户可见行为不变

判断规则：

- 如果用户最终看 changelog 时会觉得“这和我使用产品有关”，就写 changeset。
- 如果用户看了也没有意义，就不写。
- 不要为“不需要进入 changelog”的变更创建额外记录。

## 发布时

在 `/release-beta`、`/release-beta-npm`、稳定 NPM 发布、GitHub release 或用户要求“生成本次 changelog/汇总更新内容”时：

1. 读取未发布 `.changeset/*.md`。
2. 聚合受影响 packages、semver bump 和用户可读摘要。
3. 用聚合结果生成 NPM changelog / GitHub release notes。
4. 再进入 `npm-beta-release` / `npm-release-contract-guard` 的发布闭环。

## 自动化边界

当前仓库已有 Changesets 与 `pnpm release:auto:changeset`。后续若补脚本，只需要围绕这个简单合同：

```bash
pnpm release:notes:check
pnpm release:summary
```

`release:notes:check` 只检查“明显用户可见的 staged/package 改动是否缺 changeset”，不要要求内部治理、测试、docs/logs 生成排除记录。

## 禁止做法

- 不要发布当天只让 AI 扫 git diff 生成 changelog。
- 不要把内部治理、测试或纯工程文档写进用户 changelog。
- 不要为无用户可见变化的改动创建额外发布记录。
- 不要用一个 full public batch changeset 代替具体用户可读变更说明。
