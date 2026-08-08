---
name: nextclaw-release-notes-automation
description: 当用户要求提交、收尾、changelog、release notes、版本更新笔记或发布变更汇总时使用；先选择提交范围判断、版本笔记、配图/社交一个阶段并读取对应 reference。
---

# Release Notes 自动化

## 阶段路由

- 提交/收尾，判断 changeset 与 staged 范围：读取 [提交与 changeset](references/commit-and-changeset.md)。
- NPM/GitHub/runtime/desktop 发布，生成版本笔记与 JSON：读取 [版本更新笔记](references/version-notes.md)。
- 需求截图、版本配图或 X 宣发：读取 [配图与社交](references/media-and-social.md)。

一次只读当前阶段；内部治理、测试和纯工程文档不进入用户 changelog。

## 核心合同

- 用户会感知并需要在 changelog 看到的变化才添加 `.changeset/*.md`。
- 发布时以 changeset、commit 区间和必要迭代证据为底稿，由 AI 写用户结果，不机械拼接内部记录。
- Runtime/desktop manifest 的 `releaseNotesUrl` 必须指向本次用户笔记；结构化 JSON 与人类页面保持一致。
- `pnpm release:summary -- --json` 是证据聚合与素材校验入口，不是最终文案生成器。

输出当前阶段、适用判断、产物路径和缺口；不要预读未来发布、图片和社交规则。
