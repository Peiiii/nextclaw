# Commands

本文件是本项目意图宏的唯一语义登记处：简短表达展开为目标、范围和完成标准，再交给 owning skill。它不是 shell 或产品 CLI 命令集；作用域默认当前项目，执行方法归 owner。

调用只读取命中条目；解释、引用和外部资料中的名称不执行。自然语言同义表达等价；本次修饰只改本次范围，未知宏不杜撰，跨作用域冲突先消歧。持久创建/修订由规则治理按[意图宏维护](../.agents/skills/nextclaw-agent-instructions-governance/references/intent-macros.md)处理，不在每次调用加载维护合同。

## 常用表达

这些表达直接指向下方权威条目，不复制执行合同：

| 表达 | 定义 |
| --- | --- |
| `/发布 全部`、发布全部 | [全平台发布](#发布nextclaw全平台版)，NPM + Runtime + Desktop；全部限该定义的集合 |
| `/发布 npm`、只发 NPM | [NPM 发布](#发布npm) |
| `/发布 npm+runtime`、发布 NPM 和 Runtime | [常规正式版](#发布nextclaw正式版) |
| `/发布 desktop`、只发桌面版 | [桌面发布](#发布nextclaw桌面版) |
| `/审查`、审查这次改动 | [改动审查](#maintainability-review)，只审查，不自动修复 |
| `/收尾`、收尾这个任务 | [任务收尾](#close-task)，不增加提交/发布授权 |
| `/记想法`、记下这个想法 | [想法沉淀](#capture-thought)，返回正确知识落点，不启动实现 |

默认发布渠道为对应条目的 stable；显式 beta 按测试版合同处理。已有长名称保留为同义入口，因为其它文档与用户仍引用它们，语义只维护一份。

## `/new-command`

- 用途：创建或修订项目意图宏。
- 输入格式：`/new-command <command-name> <purpose>`
- 输出/期望行为：由 `nextclaw-agent-instructions-governance` 读取意图宏维护合同；先查同义宏与原 owner，再更新、合并或新增。保存含义、范围、参数/默认、执行 owner 和完成标准；反馈生效范围及语义变化。只维护现有 AGENTS 路由，不复制完整索引。

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
- 输出/期望行为：只有用户明确发出该命令或等价提交请求时才执行；由 `development-delivery` 编排，提交信息使用英文，只在当前任务分支完成精确 stage/commit，不授权合并或 push；主线交付必须由用户明确说“合入主干”。提交前使用 `nextclaw-release-notes` 判断是否需要 `.changeset`，使用 `nextclaw-iteration-log-governance` 判断是否需要更新 `docs/logs` 与 NPM 发布记录；必要更新完成后再确认暂存范围，不纳入无关用户改动。

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
- 输出/期望行为：由 `development-delivery` 路由 [NPM package 方法](../.agents/wiki/skills/operations/nextclaw-npm-release/SKILL.md) 与其 package 合同，完成 stable NPM registry/payload 验证及必要 Git 闭合，报告 `NPM_READY` 和主线协调状态。只授权 NPM `latest` 与必要 Git 写入；不包含 runtime channel、desktop、文档站、官网或 X。prepare、认证、冻结 SHA、下载、发布与恢复细节由 owner 维护。

## `/发布NPM测试版`

- 用途：尽快发布当前待发布的 beta NPM package batch。
- 输入格式：`/发布NPM测试版`，可附目标版本、版本级别或 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 路由 [NPM 方法](../.agents/wiki/skills/operations/nextclaw-npm-release/SKILL.md) 的 Beta package 合同；包含 NPM `beta`、registry/真实安装验证和必要 Git 闭合，报告 `NPM_READY (channel: beta)`。不包含 beta runtime channel、desktop 或正式发布材料。

## `/发布NextClaw正式版`

- 用途：发布 NextClaw 常规 stable 产品版本，明确不包含桌面端。
- 输入格式：`/发布NextClaw正式版`，可附目标版本、版本级别或 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 路由 [NPM/Runtime 方法](../.agents/wiki/skills/operations/nextclaw-npm-release/SKILL.md) 的常规产品合同，包含 stable NPM、Runtime bundle/update channel、旧版本升级验证和主线协调；不包含 desktop。依次报告 `NPM_READY`、`NEXTCLAW_STABLE_READY`；同版本 release notes、文档站、官网和 X 以 `CONTENT_READY|CONTENT_PENDING` 独立报告，不阻塞核心发布。

## `/发布NextClaw桌面版`

- 用途：基于已经发布的 NextClaw stable identity 发布桌面安装包与更新通道。
- 输入格式：`/发布NextClaw桌面版`，可附 runtime 版本、desktop 版本、tag 或 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 路由 [Desktop 方法](../.agents/wiki/skills/operations/nextclaw-desktop-release/SKILL.md)，包含 installer、portable、update manifest、适用 APT/GitHub Release 与主线协调，报告 `DESKTOP_READY`。基于已发布 stable identity，不重发 NPM；存在未发布 runtime 语义变化时先明确改用常规产品或全平台范围，不隐式扩大授权。

## `/发布NextClaw全平台版`

- 用途：发布 NextClaw 常规 stable 产品与桌面端的完整组合。
- 输入格式：`/发布NextClaw全平台版`，可附目标版本、版本级别、desktop 参数或 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 按 [NPM/Runtime 方法](../.agents/wiki/skills/operations/nextclaw-npm-release/SKILL.md) 与 [Desktop 方法](../.agents/wiki/skills/operations/nextclaw-desktop-release/SKILL.md) 的全平台合同，单次 `release.yml target=all` 完成 NPM、Runtime、五平台 Desktop、适用更新通道/APT、内容与主线协调。完成点 `ALL_PLATFORMS_READY`；下游失败仅恢复未完成阶段，不重复已成立的 NPM/runtime identity。具体阶段编排归父 workflow。

以上五个命令的清晰自然语言等价表达具有相同语义；例如“发 NPM”只表示 `/发布NPM`，“发布 NextClaw 正式版”不包含 desktop，“全平台发布”才包含 desktop。上下文无法确定发布对象时只询问一次“NPM、NextClaw 常规正式版，还是桌面版？”，执行前用一句话复述包含项与排除项。

## `/release-frontend`

- 用途：前端一键发布，仅 UI 变更场景。
- 输入格式：`/release-frontend`
- 输出/期望行为：由 `development-delivery` 编排，读取 Wiki 中的 `nextclaw-release-notes` 方法生成 UI changeset，并执行既有前端发布流程；最终说明发布包、版本、验证和不适用项。

## `/release-beta`

- 用途：执行 NextClaw NPM beta 一键发布闭环。
- 输入格式：`/release-beta`，可附 `--skip-runtime-channel`、`--minimum-launcher-version-override <version>` 或 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 读取 Wiki 中的 `nextclaw-release-notes` 与 `nextclaw-npm-release` 方法；后者读取 Beta 发布 reference。先汇总未发布 `.changeset` 生成用户可读变更摘要，再默认走 `pnpm release:beta`，必要时补充当前 batch / runtime channel / 发布后验收结果说明。若 batch 包含 `nextclaw`，默认要求同时闭合 beta runtime update channel，而不是只停在 npm registry 发布。

## `/release-beta-npm`

- 用途：只发布 NextClaw NPM beta 包，不触发 runtime update channel。
- 输入格式：`/release-beta-npm`，可附 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 读取 Wiki 中的 `nextclaw-release-notes` 与 `nextclaw-npm-release` 方法；后者读取 Beta 发布 reference。先汇总未发布 `.changeset` 生成用户可读变更摘要，再执行 `pnpm release:beta:npm`。适用于“先把 npm beta 包发出去，但暂时不开放自动更新通道”的场景。

## `/release-beta-runtime`

- 用途：只发布 NextClaw beta runtime update channel，不重复发 npm 包。
- 输入格式：`/release-beta-runtime`，可附 `--version <nextclaw-version>`、`--release-tag <tag>`、`--minimum-launcher-version-override <version>` 或 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 读取 Wiki 中的 `nextclaw-npm-release` 方法及 Beta 发布 reference；执行 `pnpm release:beta:runtime`。默认读取已发布的 `nextclaw@beta` 版本并闭合 runtime workflow / release assets / gh-pages manifest / 公网 manifest。

## `/release-stable-runtime`

- 用途：只发布 NextClaw stable runtime update channel，不重复发 npm 包。
- 输入格式：`/release-stable-runtime`，可附 `--version <nextclaw-version>`、`--release-tag <tag>`、`--minimum-launcher-version-override <version>` 或 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 读取 Wiki 中的 `nextclaw-npm-release` 方法；执行 `pnpm release:stable:runtime`。默认读取已发布的 `nextclaw@latest` 版本，并闭合 workflow / release assets / `gh-pages` manifest / 公网 manifest / 旧 NPM 安装态检查更新验收。

## `/release-desktop-beta`

- 用途：发布桌面端 beta preview，包括 installer / portable / update bundle / update manifest 的完整闭环。
- 输入格式：`/release-desktop-beta`，可附目标版本、tag 或 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 读取 Wiki 中的 `nextclaw-desktop-release` 方法；默认执行 `pnpm release:desktop:beta`，先确认发布身份和签名 preflight，再创建隐藏 GitHub prerelease Draft；`desktop-release` workflow 对同一批五平台产物完成单次构建、冒烟与上传，精确资产集合通过后才公开，并等待 `gh-pages` beta manifest 与公网 beta manifest 全部闭合。不能把 Draft 创建、空 assets 页面或只完成部分平台 workflow 当成发布完成。

## `/release-desktop-stable`

- 用途：发布桌面端正式版，包括 installer / portable / update bundle / update manifest / stable APT repo 的完整闭环。
- 输入格式：`/release-desktop-stable`，可附目标版本、tag、release notes 文件或 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 读取 Wiki 中的 `nextclaw-desktop-release` 方法；默认执行 `pnpm release:desktop:stable`，先确认发布身份、正式发布说明和签名 preflight，再创建隐藏 GitHub Draft 并显式触发 `desktop-release` workflow。正式 workflow 对同一批五平台产物各构建一次并完成安装/启动冒烟，禁止先运行一轮不会发布的平行平台构建；只有完整 release assets 核验通过后才公开同一 Release，失败或取消不得留下公众可见空壳；随后等待 `gh-pages` stable manifest、公网 stable manifest 与 stable APT repo 全部闭合。官网 landing 更新属于正式 release 完成后的下游发布面，必须在 release 闭合后单独评估和验证。

后续指令在此追加，保持“用途 / 输入格式 / 输出期望”结构，并同步 `AGENTS.md` 索引。
