# v0.15.49 Auto Release Batch Closure

## 迭代完成说明

- 新增自动化发布入口，解决“发布前还要人工逐个核对 tag / registry / 包目录漂移”的低效问题：
  - [`scripts/sync-published-release-tags.mjs`](../../../scripts/sync-published-release-tags.mjs)
  - [`scripts/release-auto-changeset.mjs`](../../../scripts/release-auto-changeset.mjs)
  - 复用并补强 [`scripts/release-scope.mjs`](../../../scripts/release-scope.mjs) 的发布真相源能力。
- 根 `package.json` 新增一键命令：
  - `pnpm release:sync:published-tags`
  - `pnpm release:sync:published-tags:write`
  - `pnpm release:auto:changeset`
  - `pnpm release:auto:prepare`
  - `pnpm release:auto`
- 发布流程文档新增“自动发布 shortcut”说明，明确先同步“已发但缺本地 tag”的历史版本，再只为真正有 post-version drift 的包自动生成 changeset：
  - [`docs/workflows/npm-release-process.md`](../../workflows/npm-release-process.md)
- 本轮真实执行了统一 npm 发布闭环，并成功把昨天到今天未完整闭环的改动一次性发出。实际新发布的 public package 共 26 个：
  - `@nextclaw/agent-chat@0.1.7`
  - `@nextclaw/channel-plugin-dingtalk@0.2.32`
  - `@nextclaw/channel-plugin-discord@0.2.32`
  - `@nextclaw/channel-plugin-email@0.2.32`
  - `@nextclaw/channel-plugin-mochat@0.2.32`
  - `@nextclaw/channel-plugin-qq@0.2.32`
  - `@nextclaw/channel-plugin-slack@0.2.32`
  - `@nextclaw/channel-plugin-telegram@0.2.32`
  - `@nextclaw/channel-plugin-wecom@0.2.32`
  - `@nextclaw/channel-plugin-weixin@0.1.26`
  - `@nextclaw/channel-plugin-whatsapp@0.2.32`
  - `@nextclaw/channel-runtime@0.4.18`
  - `@nextclaw/core@0.12.1`
  - `@nextclaw/feishu-core@0.2.3`
  - `@nextclaw/mcp@0.1.66`
  - `@nextclaw/ncp-mcp@0.1.68`
  - `@nextclaw/ncp-react@0.4.16`
  - `@nextclaw/ncp-toolkit@0.5.1`
  - `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk@0.1.45`
  - `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk@0.1.45`
  - `@nextclaw/openclaw-compat@1.0.1`
  - `@nextclaw/remote@0.1.78`
  - `@nextclaw/runtime@0.2.33`
  - `@nextclaw/server@0.12.1`
  - `@nextclaw/ui@0.12.1`
  - `nextclaw@0.17.2`
- 在真实发布过程中顺手修复了一个发布链 bug：[`scripts/verify-release-published.mjs`](../../../scripts/verify-release-published.mjs) 的轮询会复用第一次失败时缓存下来的 `null` 结果，导致 npm 已可查询到版本后仍误报缺失。本次通过在每轮轮询前清空 registry cache 收敛了这个误报。
- 本次方案沉淀见 [`2026-04-08-auto-release-batch-plan.md`](../../plans/2026-04-08-auto-release-batch-plan.md)。

## 测试/验证/验收方式

- 脚本语法检查：
  - `PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.6.1/bin:$PATH node --check scripts/release-scope.mjs`
  - `PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.6.1/bin:$PATH node --check scripts/sync-published-release-tags.mjs`
  - `PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.6.1/bin:$PATH node --check scripts/release-auto-changeset.mjs`
  - `PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.6.1/bin:$PATH node --check scripts/verify-release-published.mjs`
- 自动化 dry-run：
  - `PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.6.1/bin:$PATH pnpm release:sync:published-tags`
  - `PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.6.1/bin:$PATH node scripts/release-auto-changeset.mjs --check`
  - 结果：自动识别出 29 个“已发布但缺本地 tag”的历史版本，以及 7 个真正有 publish drift 的根包。
- 自动化准备：
  - `PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.6.1/bin:$PATH pnpm release:auto:prepare`
  - 结果：成功补齐 29 个本地 git tag，并自动生成本轮 changeset。
- 版本推进：
  - `PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.6.1/bin:$PATH NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:version`
  - 结果：成功更新版本号、内部依赖与 changelog。
- 统一发布：
  - `PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.6.1/bin:$PATH NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:publish`
  - 结果：26 个 public package 发布成功；发布后触发 `release:verify:published` 时暴露 cache 误报问题。
- 发布校验热修复后重新核验：
  - `PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.6.1/bin:$PATH NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:verify:published`
  - 结果：`published 26/26 package versions`。
- 发布健康检查：
  - `PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.6.1/bin:$PATH pnpm release:report:health`
  - 结果：`Repository release health is clean.`
- 冒烟：
  - `PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.6.1/bin:$PATH node packages/nextclaw/dist/cli/index.js --version`
  - 结果：`0.17.2`
  - `PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.6.1/bin:$PATH npm view nextclaw version --userconfig /Users/peiwang/Projects/nextbot/.npmrc`
  - 结果：`0.17.2`
  - `PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.6.1/bin:$PATH npm view @nextclaw/core version --userconfig /Users/peiwang/Projects/nextbot/.npmrc`
  - 结果：`0.12.1`
  - `PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.6.1/bin:$PATH npm view @nextclaw/ui version --userconfig /Users/peiwang/Projects/nextbot/.npmrc`
  - 结果：`0.12.1`
- Maintainability guard：
  - `PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.6.1/bin:$PATH pnpm lint:maintainability:guard`
  - 结果：通过；仅保留 1 条既有治理 warning：
  - `scripts` 目录平铺超预算，当前为 64 个文件，较上次 +2；已存在 exception，但后续仍应按职责拆分目录。

## 发布/部署方式

- 本次属于 npm 生态统一发版，不涉及数据库 migration，也不涉及单独后端 deploy。
- 推荐闭环命令已收敛为：
  1. `pnpm release:auto`
- 本次真实执行的闭环顺序为：
  1. `pnpm release:auto:prepare`
  2. `pnpm release:version`
  3. `pnpm release:publish`
  4. 修复 `release:verify:published` cache 误报
  5. `pnpm release:verify:published`
  6. `pnpm release:report:health`
- 当前状态：
  - npm 发布：已完成
  - npm exact-version 核验：已完成
  - git tag：已完成
  - release health：已清洁

## 用户/产品视角的验收步骤

1. 在仓库根执行 `pnpm release:auto`，确认不再需要人工逐个包核对 tag / registry / drift。
2. 观察输出，确认它会先同步“已发但缺 tag”的历史版本，再只为真正有 publish drift 的包自动生成 changeset。
3. 执行 `npm view nextclaw version`，确认线上版本为 `0.17.2`。
4. 执行 `npm view @nextclaw/core version` 与 `npm view @nextclaw/ui version`，确认线上版本分别为 `0.12.1` 与 `0.12.1`。
5. 在本地运行 `node packages/nextclaw/dist/cli/index.js --version`，确认构建产物可正常输出 `0.17.2`。
6. 执行 `pnpm release:report:health`，确认仓库输出 `Repository release health is clean.`

## 可维护性总结汇总

- 可维护性复核结论：保留债务经说明接受
- 本次顺手减债：是
- 1. 可维护性发现：本次确实新增了两个仓库级 release 脚本，导致 `scripts` 目录文件数从 62 增加到 64，继续压迫了本就超预算的平铺目录。
  - 为什么伤害长期维护：如果继续把所有仓库自动化都平铺在根 `scripts`，后续可发现性会越来越依赖命名而不是结构。
  - 更小更简单的修正方向：下一步应把 release 相关脚本集中进 `scripts/release-*` 子域或按责任拆目录，而不是继续平铺新增。
- 代码增减报告：
  - 新增：435 行
  - 删除：268 行
  - 净增：+167 行
- 非测试代码增减报告：
  - 新增：435 行
  - 删除：268 行
  - 净增：+167 行
- 本次是否已尽最大努力优化可维护性：是。自动化新增没有重做第二套发布系统，而是复用了既有 `release-scope`、`release:version`、`release:publish` 主链路，只补齐缺失的 tag 同步、drift 归并和 verify cache 修复。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。没有继续要求人工逐个包核对，也没有新增隐藏 fallback；核心做法是把已有发布判断逻辑收敛为可重复执行的自动化入口。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到。仓库总代码因自动化脚本、changelog、版本元数据与迭代留痕出现净增，其中逻辑增长主要用于消除重复人工判断；目录平铺度在 `scripts` 上略有恶化，这是本次接受的唯一结构性债务，已明确下一步拆分入口。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：更清晰。`sync-published-release-tags` 负责补历史闭环，`release-auto-changeset` 负责识别真实 drift，`release-scope` 继续承担真相源读取，没有把多种职责塞进一个万能脚本。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足，但 `scripts` 目录预算 warning 仍在；本次未继续新开平行文档体系，计划文档与迭代留痕均落在既有目录下。
- no maintainability findings beyond the accepted `scripts` directory budget warning
- 可维护性总结：这次增长主要来自把原本依赖人工判断的发布闭环真正落成自动化，以及 release version/changelog 元数据的必需增长。功能层没有新增隐藏兜底，发布语义反而更明确了；剩余债务集中在 `scripts` 目录继续平铺，后续应优先做按职责拆分。
