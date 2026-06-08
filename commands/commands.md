# Commands

本文件只记录“本项目管理/协作/治理相关”的元指令，定位类似项目协作协议。不要收录 package 命令、产品 CLI 命令、部署脚本命令或业务执行命令；这些内容应写入对应产品、功能或发布文档。

命令细节应尽量指向可触发 skill，而不是在本文件展开长流程。

## `/new-command`

- 用途：新增一条项目管理/协作/治理元指令。
- 输入格式：`/new-command <command-name> <purpose>`
- 输出/期望行为：先判断是否属于本文件范围；若属于，补齐名称、用途、输入格式、输出/期望行为，并同步 `AGENTS.md` 命令索引。

## `/config-meta`

- 用途：调整或更新 `AGENTS.md`、命令机制、Rulebook / Project Rulebook 遗留内容、skill 分层或项目 AI 指令。
- 输入格式：`/config-meta <要调整的问题或目标>`
- 输出/期望行为：必须使用 `nextclaw-agent-instructions-governance`；先判断应删减、合并、迁入 skill、修正已有规则还是新增常驻规则；优先处理深层机制问题，避免表层补丁。默认把“规范”理解为包含 `AGENTS.md`、skills、`commands/commands.md`、相关 `docs/*`、`scripts/governance/*` 与对应 baseline/test 的完整系统，不能只改文档不检查脚本侧影响。收尾时按 `nextclaw-iteration-log-governance` 判断是否需要 `docs/logs` 留痕。

## `/add-to-plan`

- 用途：将想法或用户建议纳入规划体系。
- 输入格式：`/add-to-plan <一句话事项>`，可附来源、优先级、owner。
- 输出/期望行为：使用 `project-knowledge-governance`；先判断内容应进入 `docs/TODO.md`、`docs/thoughts`、`docs/designs`、`docs/plans`、`docs/prd` 还是 `docs/ROADMAP.md`。若仍是一句话事项，默认写入 `docs/TODO.md` 的 `Inbox`，给出 `Now / Next / Later / Roadmap Candidate` 分流建议，并生成 Issue 草案；若属于中长期方向，同步更新 `docs/ROADMAP.md`。

## `/capture-thought`

- 用途：沉淀尚未成熟到 design/plan 的产品、架构、交互、战略或机制思考。
- 输入格式：`/capture-thought <讨论主题或要沉淀的内容>`，可附来源、相关文档或升级条件。
- 输出/期望行为：使用 `project-knowledge-governance`；先判断内容是否应进入 `docs/TODO.md`、`docs/thoughts`、`docs/designs`、`docs/plans`、`docs/prd`、`docs/ROADMAP.md` 或 `docs/logs`。若进入 `docs/thoughts`，文件名使用 `YYYY-MM-DD-<kebab-topic>.thought.md`，正文至少包含背景、核心判断、方案空间、推荐倾向、未决问题和升级条件。

## `/check-meta`

- 用途：检查 `AGENTS.md`、命令机制和 skill 分层是否自洽。
- 输入格式：`/check-meta`，可附聚焦范围。
- 输出/期望行为：必须使用 `nextclaw-agent-instructions-governance`；检查过度常驻、重复规则、普通文档承载强制流程、skill 触发描述缺失、命令索引漂移等问题，并给出修复建议或直接修复低风险问题。

## `/new-rule`

- 用途：新增或固化一条项目协作/治理规则。
- 输入格式：`/new-rule <规则意图>`
- 输出/期望行为：必须先判断规则应进入 `AGENTS.md` 常驻内核、已有 skill、新 skill，还是普通文档；只有“每轮都必须知道”的高优先级规则才进入 `AGENTS.md`。规则本质若是约束系统行为，应优先固化清晰、可预测、无隐藏兜底的高层原则。

## `/commit`

- 用途：提交当前变更。
- 输入格式：`/commit`，可附提交范围或说明。
- 输出/期望行为：只有用户明确发出该命令或等价提交请求时才执行；提交信息必须使用英文。提交前必须先使用 `nextclaw-release-notes-automation` 判断是否需要 `.changeset`，使用 `nextclaw-iteration-log-governance` 判断是否需要更新 `docs/logs` 与 NPM 发布记录；必要更新完成后再确认暂存范围，不纳入无关用户改动。

## `/close-task`

- 用途：对当前任务执行标准交付收尾流程。
- 输入格式：`/close-task`，可附聚焦范围或说明。
- 输出/期望行为：使用 `nextclaw-delivery-workflow` 作为总流程 owner；统一检查是否完成实现前删减判断、定向验证、`tsc` 适用性、maintainability guard/review、用户 changelog / `.changeset` 适用性判断、总代码与非测试代码增减披露、复盘机制改进、迭代留痕决策与最终主动汇报。若相关项缺失，不得视为真正收尾完成。

## `/maintainability-review`

- 用途：对本次代码相关改动执行独立于实现阶段的可维护性复核。
- 输入格式：`/maintainability-review`，可附 `<paths...>` 聚焦范围。
- 输出/期望行为：使用 `post-edit-maintainability-review`；输出固定模块 `长期目标对齐 / 可维护性推进`、`可维护性复核结论`、`本次顺手减债`、`代码增减报告`、`非测试代码增减报告` 与简短 `可维护性总结`。

## `/validate`

- 用途：按改动影响范围执行最小充分验证。
- 输入格式：`/validate`，可附验证范围。
- 输出/期望行为：使用 `nextclaw-validation-workflow`；若触达 TypeScript 源码、类型声明、导入导出边界或运行链路，必须包含实际执行的 `tsc` 命令；代码改动需覆盖 maintainability guard、governance ratchet、主观可维护性复核和必要冒烟。

## `/release-frontend`

- 用途：前端一键发布，仅 UI 变更场景。
- 输入格式：`/release-frontend`
- 输出/期望行为：生成 UI changeset，并执行既有前端发布流程；最终说明发布包、版本、验证和不适用项。

## `/release-beta`

- 用途：执行 NextClaw NPM beta 一键发布闭环。
- 输入格式：`/release-beta`，可附 `--skip-runtime-channel`、`--minimum-launcher-version-override <version>` 或 dry-run 说明。
- 输出/期望行为：使用 `nextclaw-release-notes-automation`、`npm-beta-release` 与 `npm-release-contract-guard`；先汇总未发布 `.changeset` 生成用户可读变更摘要，再默认走 `pnpm release:beta`，必要时补充当前 batch / runtime channel / 发布后验收结果说明。若 batch 包含 `nextclaw`，默认要求同时闭合 beta runtime update channel，而不是只停在 npm registry 发布。

## `/release-beta-npm`

- 用途：只发布 NextClaw NPM beta 包，不触发 runtime update channel。
- 输入格式：`/release-beta-npm`，可附 dry-run 说明。
- 输出/期望行为：使用 `nextclaw-release-notes-automation`、`npm-beta-release` 与 `npm-release-contract-guard`；先汇总未发布 `.changeset` 生成用户可读变更摘要，再执行 `pnpm release:beta:npm`。适用于“先把 npm beta 包发出去，但暂时不开放自动更新通道”的场景。

## `/release-beta-runtime`

- 用途：只发布 NextClaw beta runtime update channel，不重复发 npm 包。
- 输入格式：`/release-beta-runtime`，可附 `--version <nextclaw-version>`、`--release-tag <tag>`、`--minimum-launcher-version-override <version>` 或 dry-run 说明。
- 输出/期望行为：使用 `npm-beta-release` 与 `npm-release-contract-guard`；执行 `pnpm release:beta:runtime`。默认读取已发布的 `nextclaw@beta` 版本并闭合 runtime workflow / release assets / gh-pages manifest / 公网 manifest。

## `/release-desktop-beta`

- 用途：发布桌面端 beta preview，包括 installer / portable / update bundle / update manifest 的完整闭环。
- 输入格式：`/release-desktop-beta`，可附目标版本、tag 或 dry-run 说明。
- 输出/期望行为：使用 `desktop-release-contract-guard`；默认执行 `pnpm release:desktop:beta`，先确认发布身份和桌面验证门禁，再创建 GitHub prerelease/tag 并等待 `desktop-release` workflow、release assets、`gh-pages` beta manifest 与公网 beta manifest 全部闭合。不能把 `gh release create`、空 assets 页面或只完成部分平台 workflow 当成发布完成。

## `/release-desktop-stable`

- 用途：发布桌面端正式版，包括 installer / portable / update bundle / update manifest / stable APT repo 的完整闭环。
- 输入格式：`/release-desktop-stable`，可附目标版本、tag、release notes 文件或 dry-run 说明。
- 输出/期望行为：使用 `desktop-release-contract-guard`；默认执行 `pnpm release:desktop:stable`，先确认发布身份、正式发布说明和桌面验证门禁，再创建 GitHub release/tag 并等待 `desktop-release` workflow、release assets、`gh-pages` stable manifest、公网 stable manifest 与 stable APT repo 全部闭合。官网 landing 更新属于正式 release 完成后的下游发布面，必须在 release 闭合后单独评估和验证。

后续指令在此追加，保持“用途 / 输入格式 / 输出期望”结构，并同步 `AGENTS.md` 索引。
