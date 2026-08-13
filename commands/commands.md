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
- 输出/期望行为：必须使用 `nextclaw-agent-instructions-governance`；检查过度常驻、重复规则、普通文档承载强制流程、skill 触发描述缺失、命令索引漂移等问题，并至少运行 `pnpm check:skill-progressive-loading`，给出修复建议或直接修复低风险问题。

## `/new-rule`

- 用途：新增或固化一条项目协作/治理规则。
- 输入格式：`/new-rule <规则意图>`
- 输出/期望行为：必须先判断规则应进入 `AGENTS.md` 常驻内核、已有 skill、新 skill，还是普通文档；只有“每轮都必须知道”的高优先级规则才进入 `AGENTS.md`。规则本质若是约束系统行为，应优先固化清晰、可预测、无隐藏兜底的高层原则。

## `/commit`

- 用途：提交当前变更。
- 输入格式：`/commit`，可附提交范围或说明。
- 输出/期望行为：只有用户明确发出该命令或等价提交请求时才执行；由 `development-delivery` 编排，提交信息必须使用英文。提交前使用 `nextclaw-release-notes` 判断是否需要 `.changeset`，使用 `nextclaw-iteration-log-governance` 判断是否需要更新 `docs/logs` 与 NPM 发布记录；必要更新完成后再确认暂存范围，不纳入无关用户改动。

## `/close-task`

- 用途：对当前任务执行标准交付收尾流程。
- 输入格式：`/close-task`，可附聚焦范围或说明。
- 输出/期望行为：使用 `development-lifecycle` 作为唯一流程 owner，确认当前适用阶段、有效验证、Review findings、Delivery、Retrospective 和未完成边界；只加载当前阶段，不预读或罗列未触发的专项步骤。

## `/maintainability-review`

- 用途：对本次代码相关改动执行独立于实现阶段的可维护性复核。
- 输入格式：`/maintainability-review`，可附 `<paths...>` 聚焦范围。
- 输出/期望行为：使用 `development-review`；先运行其 diff-only maintainability 自动检查，再按 `references/subjective-review.md` 做用户明确要求的主观复核，只报告真实 findings、结论和最小修正方向。

## `/validate`

- 用途：按改动影响范围执行最小充分验证。
- 输入格式：`/validate`，可附验证范围。
- 输出/期望行为：使用 `development-validation` 按 L0-L4 风险分级选择最小充分验证；TypeScript/运行链路触达时执行匹配范围的 `tsc`。Review、maintainability guard、governance ratchet 和真实冒烟分别由对应阶段或风险触发，不组成 `/validate` 的默认全家桶。

## `/发布NPM`

- 用途：尽快发布当前待发布的 stable NPM package batch。
- 输入格式：`/发布NPM`，可附目标版本、版本级别或 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 路由 `nextclaw-npm-release` 的 package 阶段，执行 `pnpm release:npm:stable`。只授权 NPM `latest`、registry 验证、精确版本冷安装和必要的 Git 版本闭合；不授权 runtime channel、desktop、文档站、官网或 X 写入。完成后明确报告 `NPM_READY`、实际上传包数、验证闭包、版本与排除项。

## `/发布NPM测试版`

- 用途：尽快发布当前待发布的 beta NPM package batch。
- 输入格式：`/发布NPM测试版`，可附目标版本、版本级别或 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 路由 `nextclaw-npm-release` 的 Beta package 阶段，执行 `pnpm release:npm:beta`。只授权 NPM `beta`、registry 验证、真实安装和必要的 Git 版本闭合；不授权 beta runtime channel、desktop 或正式版发布材料。完成后报告 `NPM_READY` 并显式标注 `channel: beta`。

## `/发布NextClaw正式版`

- 用途：发布 NextClaw 常规 stable 产品版本，明确不包含桌面端。
- 输入格式：`/发布NextClaw正式版`，可附目标版本、版本级别或 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 先路由 `nextclaw-npm-release`，执行 `pnpm release:product:stable`。先闭合 NPM package 并立即报告 `NPM_READY`，再继续结构化 release notes、stable runtime channel、旧版本升级验证和适用的文档站/官网/X 合同；这些下游材料不得前置阻塞 NPM publish。最终报告 `NEXTCLAW_STABLE_READY`；不调用 desktop owner。

## `/发布NextClaw桌面版`

- 用途：基于已经发布的 NextClaw stable identity 发布桌面安装包与更新通道。
- 输入格式：`/发布NextClaw桌面版`，可附 runtime 版本、desktop 版本、tag 或 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 路由 `nextclaw-desktop-release`，执行 `pnpm release:desktop:stable`。只授权 desktop installer、portable artifacts、desktop update manifest 和适用的 APT/GitHub Release 闭环；不得发布或重发 NPM。若工作区包含尚未发布的 runtime 语义变化，停止并建议改用 `/发布NextClaw正式版` 或 `/发布NextClaw全平台版`。完成后报告 `DESKTOP_READY`。

## `/发布NextClaw全平台版`

- 用途：发布 NextClaw 常规 stable 产品与桌面端的完整组合。
- 输入格式：`/发布NextClaw全平台版`，可附目标版本、版本级别、desktop 参数或 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 顺序编排，不并行扩大 owner：先按 `/发布NextClaw正式版` 达到 `NPM_READY` 与 `NEXTCLAW_STABLE_READY`，再以同一 stable identity 按 `/发布NextClaw桌面版` 达到 `DESKTOP_READY`，最终报告 `ALL_PLATFORMS_READY`。desktop 阶段失败不得回退或重复发布已完成的 NPM/runtime 阶段。

以上五个命令的清晰自然语言等价表达具有相同语义；例如“发 NPM”只表示 `/发布NPM`，“发布 NextClaw 正式版”不包含 desktop，“全平台发布”才包含 desktop。上下文无法确定发布对象时只询问一次“NPM、NextClaw 常规正式版，还是桌面版？”，执行前用一句话复述包含项与排除项。

## `/release-frontend`

- 用途：前端一键发布，仅 UI 变更场景。
- 输入格式：`/release-frontend`
- 输出/期望行为：由 `development-delivery` 编排，使用 `nextclaw-release-notes` 生成 UI changeset，并执行既有前端发布流程；最终说明发布包、版本、验证和不适用项。

## `/release-beta`

- 用途：执行 NextClaw NPM beta 一键发布闭环。
- 输入格式：`/release-beta`，可附 `--skip-runtime-channel`、`--minimum-launcher-version-override <version>` 或 dry-run 说明。
- 输出/期望行为：使用 `nextclaw-release-notes` 与 `nextclaw-npm-release`；后者读取 Beta 发布 reference。先汇总未发布 `.changeset` 生成用户可读变更摘要，再默认走 `pnpm release:beta`，必要时补充当前 batch / runtime channel / 发布后验收结果说明。若 batch 包含 `nextclaw`，默认要求同时闭合 beta runtime update channel，而不是只停在 npm registry 发布。

## `/release-beta-npm`

- 用途：只发布 NextClaw NPM beta 包，不触发 runtime update channel。
- 输入格式：`/release-beta-npm`，可附 dry-run 说明。
- 输出/期望行为：使用 `nextclaw-release-notes` 与 `nextclaw-npm-release`；后者读取 Beta 发布 reference。先汇总未发布 `.changeset` 生成用户可读变更摘要，再执行 `pnpm release:beta:npm`。适用于“先把 npm beta 包发出去，但暂时不开放自动更新通道”的场景。

## `/release-beta-runtime`

- 用途：只发布 NextClaw beta runtime update channel，不重复发 npm 包。
- 输入格式：`/release-beta-runtime`，可附 `--version <nextclaw-version>`、`--release-tag <tag>`、`--minimum-launcher-version-override <version>` 或 dry-run 说明。
- 输出/期望行为：使用 `nextclaw-npm-release` 并读取 Beta 发布 reference；执行 `pnpm release:beta:runtime`。默认读取已发布的 `nextclaw@beta` 版本并闭合 runtime workflow / release assets / gh-pages manifest / 公网 manifest。

## `/release-stable-runtime`

- 用途：只发布 NextClaw stable runtime update channel，不重复发 npm 包。
- 输入格式：`/release-stable-runtime`，可附 `--version <nextclaw-version>`、`--release-tag <tag>`、`--minimum-launcher-version-override <version>` 或 dry-run 说明。
- 输出/期望行为：使用 `nextclaw-npm-release`；执行 `pnpm release:stable:runtime`。默认读取已发布的 `nextclaw@latest` 版本，并闭合 workflow / release assets / `gh-pages` manifest / 公网 manifest / 旧 NPM 安装态检查更新验收。

## `/release-desktop-beta`

- 用途：发布桌面端 beta preview，包括 installer / portable / update bundle / update manifest 的完整闭环。
- 输入格式：`/release-desktop-beta`，可附目标版本、tag 或 dry-run 说明。
- 输出/期望行为：使用 `nextclaw-desktop-release`；默认执行 `pnpm release:desktop:beta`，先确认发布身份和桌面验证门禁，再创建 GitHub prerelease/tag 并等待 `desktop-release` workflow、release assets、`gh-pages` beta manifest 与公网 beta manifest 全部闭合。不能把 `gh release create`、空 assets 页面或只完成部分平台 workflow 当成发布完成。

## `/release-desktop-stable`

- 用途：发布桌面端正式版，包括 installer / portable / update bundle / update manifest / stable APT repo 的完整闭环。
- 输入格式：`/release-desktop-stable`，可附目标版本、tag、release notes 文件或 dry-run 说明。
- 输出/期望行为：使用 `nextclaw-desktop-release`；默认执行 `pnpm release:desktop:stable`，先确认发布身份、正式发布说明和桌面验证门禁，再创建 GitHub release/tag 并等待 `desktop-release` workflow、release assets、`gh-pages` stable manifest、公网 stable manifest 与 stable APT repo 全部闭合。官网 landing 更新属于正式 release 完成后的下游发布面，必须在 release 闭合后单独评估和验证。

后续指令在此追加，保持“用途 / 输入格式 / 输出期望”结构，并同步 `AGENTS.md` 索引。
