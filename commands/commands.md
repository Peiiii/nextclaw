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
- 输出/期望行为：只有用户明确发出该命令或等价提交请求时才执行；该请求默认表示“主线交付”，由 `development-delivery` 编排，提交信息使用英文，完成精确 commit 后必须安全集成本地 `master`，再从本地 `master` 普通推送 `origin/master`；只有用户明确说“只合入本地”或“不要推送”时才跳过远程推送，仅停在隔离分支不算完成。提交前使用 `nextclaw-release-notes` 判断是否需要 `.changeset`，使用 `nextclaw-iteration-log-governance` 判断是否需要更新 `docs/logs` 与 NPM 发布记录；必要更新完成后再确认暂存范围，不纳入无关用户改动。

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
- 输出/期望行为：由 `development-delivery` 路由 `nextclaw-npm-release` 的 package 阶段。先从 `.github/workflows/release.yml`、最近一次 successful run 和目标 registry identity 输出 `EXISTING_RELEASE_PATH`；已经跑通的正式主链路必须复用，远端证据暂时不可读只能标记 evidence gap，不能推断流程不存在。release-bearing `master` commit 的 version、strict check、artifact audit 和 tarball pack 必须已由 `npm-release-prepare` workflow 提前完成；用户无需知道或补说 prepare 命令。授权后从远程 `master` 的冻结 SHA dispatch GitHub Actions `release.yml`，选择 `target=npm`；workflow 在 `npm-production` environment 中使用受控 `NPM_TOKEN`，定位/下载 HEAD 对应预制物、并发首次上传、逐包 version/integrity/latest registry 验证、空缓存公网精确 tarball/payload 审计和 Git 目标分支闭合。下载计入 `NPM_READY` 的 60 秒性能观测目标，但超时不推翻已经成立的发布事实。远程完成门后自动运行 `pnpm release:reconcile:mainline`，不得把本地 pull/rebase 留给用户。缺少有效预制物时快速失败，不在发布窗口重建。该命令只授权 NPM `latest` 及必要 Git 写入；不授权 runtime channel、desktop、文档站、官网或 X。

## `/发布NPM测试版`

- 用途：尽快发布当前待发布的 beta NPM package batch。
- 输入格式：`/发布NPM测试版`，可附目标版本、版本级别或 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 路由 `nextclaw-npm-release` 的 Beta package 阶段，执行 `pnpm release:npm:beta`。只授权 NPM `beta`、registry 验证、真实安装和必要的 Git 版本闭合；不授权 beta runtime channel、desktop 或正式版发布材料。完成后报告 `NPM_READY` 并显式标注 `channel: beta`。

## `/发布NextClaw正式版`

- 用途：发布 NextClaw 常规 stable 产品版本，明确不包含桌面端。
- 输入格式：`/发布NextClaw正式版`，可附目标版本、版本级别或 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 先路由 `nextclaw-npm-release`，复用 `/发布NPM` 的 `EXISTING_RELEASE_PATH` 证据门，再从远程 `master` 的冻结 SHA dispatch GitHub Actions `release.yml`，选择 `target=product`。workflow 先闭合 NPM package 并报告 `NPM_READY`，再继续 stable runtime channel 与旧版本升级验证；结构化 release notes、文档站、官网和 X 以同一版本的 `CONTENT_READY|CONTENT_PENDING` 独立报告，不阻塞核心发布，也不调用 desktop owner。远程完成门后自动运行 `pnpm release:reconcile:mainline`，最终报告 `NEXTCLAW_STABLE_READY` 和本地主线协调状态。

## `/发布NextClaw桌面版`

- 用途：基于已经发布的 NextClaw stable identity 发布桌面安装包与更新通道。
- 输入格式：`/发布NextClaw桌面版`，可附 runtime 版本、desktop 版本、tag 或 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 路由 `nextclaw-desktop-release`，执行 `pnpm release:desktop:stable`。只授权 desktop installer、portable artifacts、desktop update manifest、适用的 APT/GitHub Release 和自动主线对账闭环；不得发布或重发 NPM。若工作区包含尚未发布的 runtime 语义变化，停止并建议改用 `/发布NextClaw正式版` 或 `/发布NextClaw全平台版`。远程完成门后自动运行 `pnpm release:reconcile:mainline`，完成后报告 `DESKTOP_READY` 和本地主线协调状态。

## `/发布NextClaw全平台版`

- 用途：发布 NextClaw 常规 stable 产品与桌面端的完整组合。
- 输入格式：`/发布NextClaw全平台版`，可附目标版本、版本级别、desktop 参数或 dry-run 说明。
- 输出/期望行为：由 `development-delivery` 从远程 `master` 的冻结 SHA 单次 dispatch GitHub Actions `release.yml target=all`，随后只监控同一父 workflow。Actions 内部顺序达到 `NPM_READY`、`NEXTCLAW_STABLE_READY`、`DESKTOP_READY` 和 `ALL_PLATFORMS_READY`：NPM/Runtime 成功后自动创建 Desktop 隐藏 Draft、触发五平台子 workflow、闭合 assets/update manifest/APT，并统一运行主线对账。AI、本地 CLI 和用户都不负责跨阶段编排；Desktop 失败只恢复未完成 job，不得重复已成立的 NPM/runtime identity。

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
- 输出/期望行为：使用 `nextclaw-desktop-release`；默认执行 `pnpm release:desktop:beta`，先确认发布身份和签名 preflight，再创建隐藏 GitHub prerelease Draft；`desktop-release` workflow 对同一批五平台产物完成单次构建、冒烟与上传，精确资产集合通过后才公开，并等待 `gh-pages` beta manifest 与公网 beta manifest 全部闭合。不能把 Draft 创建、空 assets 页面或只完成部分平台 workflow 当成发布完成。

## `/release-desktop-stable`

- 用途：发布桌面端正式版，包括 installer / portable / update bundle / update manifest / stable APT repo 的完整闭环。
- 输入格式：`/release-desktop-stable`，可附目标版本、tag、release notes 文件或 dry-run 说明。
- 输出/期望行为：使用 `nextclaw-desktop-release`；默认执行 `pnpm release:desktop:stable`，先确认发布身份、正式发布说明和签名 preflight，再创建隐藏 GitHub Draft 并显式触发 `desktop-release` workflow。正式 workflow 对同一批五平台产物各构建一次并完成安装/启动冒烟，禁止先运行一轮不会发布的平行平台构建；只有完整 release assets 核验通过后才公开同一 Release，失败或取消不得留下公众可见空壳；随后等待 `gh-pages` stable manifest、公网 stable manifest 与 stable APT repo 全部闭合。官网 landing 更新属于正式 release 完成后的下游发布面，必须在 release 闭合后单独评估和验证。

后续指令在此追加，保持“用途 / 输入格式 / 输出期望”结构，并同步 `AGENTS.md` 索引。
