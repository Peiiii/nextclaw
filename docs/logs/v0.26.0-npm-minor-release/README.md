# NextClaw v0.26.0 NPM minor 发布

## 迭代完成说明

- 将完整公开 workspace 发布批次统一版本化，并把 `nextclaw` 从 `0.25.3` 升级到新的 minor 版本 `0.26.0`。
- 本版本集中交付长会话虚拟时间线、定时任务工作台、AI 回复运行信息、内置 Agent Browser、移动端新任务入口、运行时身份表达和内联结果稳定性改进。
- 已生成中英文产品更新说明、stable 更新提示 JSON 和各公开包 Changelog；发布配图不适用，因为现有候选截图仍显示旧版本号，避免把不准确资产带入正式发布。

## 测试/验证/验收方式

- 发布前健康检查：已通过 `pnpm release:check:health` 与 `pnpm release:check-readmes`。
- `pnpm release:check -- --reset` 已通过，49 个公开包全部完成依赖闭包检查、构建和 TypeScript 检查；`pnpm docs:i18n:check` 与 `pnpm --filter @nextclaw/docs build` 已通过。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、Release Notes JSON 解析和 `git diff --check` 已通过；NPM 发布验证、stable runtime manifest 验证和真实安装/更新冒烟待执行。
- 可观察验收标准：NPM `latest` 指向 `0.26.0`；四个平台 stable manifest 指向 `0.26.0` 且包含正确发布说明链接；全新安装与 `0.25.3 -> 0.26.0` 更新链路均可运行。

## 发布/部署方式

- 使用隔离 worktree 生成完整 changeset 批次和版本文件，避免触碰主工作区中的其他工作。
- 计划按“发布分支提交与推送 → NPM 全量发布 → 合并本地 `master` 并推送 → stable runtime workflow → 文档部署 → 公网验证”的单一闭环执行。
- NPM stable runtime 更新只负责发现和手动应用更新，不自动下载或应用；本批次不发布新的桌面安装包。

## 用户/产品视角的验收步骤

1. 在现有 `nextclaw@0.25.3` 安装中重启应用，确认立即发现 `0.26.0`，且不会自动下载或应用。
2. 手动下载并应用更新，确认运行版本切换到 `0.26.0`，会话、配置和内置技能保持可用。
3. 在长会话中向上加载历史消息，检查阅读位置；打开定时任务工作台，检查创建、搜索、筛选和任务会话跳转。
4. 检查 AI 回复的运行时、模型与 token 信息，并在移动端从聊天标题栏创建新任务。

## 可维护性总结汇总

- 本次发布只生成版本元数据、Changelog、Release Notes、项目动态索引和发布记录，不新增生产运行链路。
- 全量发布批次继续由 Changesets、release health、统一发布脚本和 stable runtime workflow 作为单一 owner，避免手工逐包发布或平行更新通道。
- 发布提交共变更 120 个文件，新增 1947 行、删除 164 行；生产源码与测试均无新增，maintainability guard 判定为不适用。
- 发布后复盘：待完整发布闭环后补充。

## NPM 包发布记录

- 目标版本：`nextclaw@0.26.0`，dist-tag `latest`。
- 公开 workspace 包：按本次 Changesets 生成的完整批次统一发布，具体 registry 验证结果待发布后补充。
- Git tag、GitHub Release、stable runtime workflow、文档部署和 X 发布：待执行。
