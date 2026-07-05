---
name: nextclaw-release-notes-automation
description: 当用户要求提交、收尾、统一 NPM 发布、GitHub release、changelog、release notes、版本更新说明、产品更新笔记、变更汇总，或担心并行会话导致发布内容靠记忆整理时使用。适用于需要进入用户可见发布说明的 NextClaw workspace 包变更、Changesets 聚合、AI 撰写版本更新笔记、可拉取结构化 release notes JSON，以及 update manifest releaseNotesUrl 闭环。
---

# NextClaw Release Notes Automation

## 目标

只把用户需要感知的产品变更写进发布说明。发布时直接收集这些发布说明片段，不靠记忆回忆。

本 skill 维护两层发布说明合同：

- 需要进入最终 changelog 的用户可见变更：添加 `.changeset/*.md`
- 不需要进入最终 changelog 的内部变更：不添加任何发布说明片段
- 面向最终用户的版本更新说明：发布时由 AI 基于 `.changeset`、commit 区间和必要 `docs/logs` 证据手写产品更新笔记，不能只机械拼接 changeset
- 面向产品更新提示的结构化版本说明：发布时同步生成可拉取 JSON，供更新 UI 在用户更新前展示本版本内容

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
2. 聚合受影响 packages、semver bump 和用户可读摘要，作为写作底稿。
3. 判断是否需要用户可见版本更新笔记：
   - 只要本批包含用户会感知的产品变化，并且发布结果会进入用户安装、自动更新、GitHub release、官网/docs 或 update manifest，就必须生成或更新版本更新笔记。
   - 如果本批只有内部治理、测试、纯发布元数据或无用户可见变化，可以不生成，但发布报告必须写明“不适用”的原因。
4. 需要版本更新笔记时，联动 `product-blog-storytelling`，由 AI 基于证据手写短文，不把写作讨论、分类依据、模板解释或内部治理内容写进正文。
5. 默认落点：
   - 中文：`apps/docs/zh/notes/YYYY-MM-DD-nextclaw-v<version>.md`
   - 英文：`apps/docs/en/notes/YYYY-MM-DD-nextclaw-v<version>.md`
   - 同步更新对应 `apps/docs/<locale>/notes/index.md`
   - 结构化 JSON：`apps/docs/public/release-notes/nextclaw-v<version>.json`
   - 如果本次只面向中文用户或发布窗口不足，可以先写中文，并在发布报告中明确英文缺口。
6. 对 runtime / desktop update channel，必须让 update manifest 的 `releaseNotesUrl` 指向本次用户可读版本更新笔记；更新 UI 可通过同源 `/release-notes/nextclaw-v<version>.json` 拉取结构化内容。不要为了 JSON URL 轻易新增签名 manifest 字段，除非已经审计旧客户端验签兼容性。
7. 用聚合结果生成 NPM changelog / GitHub release notes。
8. 再进入 `npm-beta-release` / `npm-release-contract-guard` / `desktop-release-contract-guard` 的发布闭环。

## 版本更新笔记要求

- 最终正文面向用户，不面向内部协作者。
- 允许按真实变化聚类，但不要在正文解释“为什么这样分组”或写模板说明。
- 必须能区分变更类型：`功能` / `增强` / `修复` / `默认行为与兼容性`，英文对应 `Features` / `Enhancements` / `Fixes` / `Defaults and Compatibility`。
- 每类默认保留 3 到 6 条。真实变化不足时不凑数；超过 6 条时先合并相近项，避免流水账。
- 内容优先覆盖：
  - 本版本用户会感受到什么；
  - 哪些体验、能力或稳定性变好了；
  - 是否有兼容性、升级或已知边界；
  - 需要时链接到完整 changelog、GitHub release 或相关指南。
- 不要写入：
  - 纯测试、lint、治理脚本、`.agents/skills`、`docs/logs`；
  - 内部讨论、复盘、取舍过程；
  - 包级 changeset 的机械重复列表。
- 发布前必须确认：
  - 笔记覆盖本批用户可见 changeset；
  - 人类页面和结构化 JSON 的分类、条目和主结论一致；
  - 笔记没有包含不应公开的内部治理内容；
  - docs index 已更新；
  - `apps/docs/public/_headers` 允许 `/release-notes/*.json` 被产品跨域拉取；
  - update manifest / GitHub release 的 release notes URL 能指向它或等价页面。

## 结构化 JSON 要求

结构化 JSON 面向产品读取，不是内部聚合底稿。字段保持稳定、克制：

- `schemaVersion`: 当前为 `1`
- `product`, `version`, `channel`, `releaseType`, `publishedAt`
- `title` / `summary`: 至少包含 `zh-CN` 和 `en-US`
- `links.html`: 指向中英文人类页面
- `sections[]`: 每个 section 包含 `kind`、本地化 `title`、`items[]`
- `kind` 只使用 `feature`、`enhancement`、`fix`、`compatibility`
- `items[]` 只写用户可见标题和简短说明，不写内部讨论、测试、治理或分类依据

## 自动化边界

当前仓库已有 Changesets 与 `pnpm release:auto:changeset`。后续若补脚本，只需要围绕这个简单合同：

```bash
pnpm release:notes:check
pnpm release:summary
```

`release:notes:check` 只检查“明显用户可见的 staged/package 改动是否缺 changeset”，不要要求内部治理、测试、docs/logs 生成排除记录。

如果后续补 `release:summary`，它只能生成证据底稿和缺口清单；最终用户可见版本更新笔记仍由 AI 审阅并手写，不能把脚本输出直接当正文。

## 禁止做法

- 不要发布当天只让 AI 扫 git diff 生成 changelog。
- 不要把自动聚合输出直接当成用户版本说明；聚合是底稿，最终说明必须经过 AI 归纳和人工/AI 审阅。
- 不要把内部治理、测试或纯工程文档写进用户 changelog。
- 不要为无用户可见变化的改动创建额外发布记录。
- 不要用一个 full public batch changeset 代替具体用户可读变更说明。
- 不要发布带 update manifest 的版本却让 `releaseNotesUrl` 为空，除非本批确实无用户可见变化且最终报告说明原因。
