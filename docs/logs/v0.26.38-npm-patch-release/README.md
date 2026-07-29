# NextClaw v0.27.7 NPM patch 正式发布

## 迭代完成说明

本轮把当前主干上已提交、已带 changeset 的五类变化统一纳入 `nextclaw@0.27.7` stable patch：

- 聊天输入框可以通过 `@` 引用已登记项目，并把受限项目概览作为本次消息上下文；
- Codex 长命令输出会维持活动状态，真实超时后保留原 thread 身份；
- Codex 默认使用完整本地执行权限和无审批策略；
- 停止回复并启动排队消息时，输入框队列立即刷新；
- Marketplace skill 卸载被限制在它管理的 workspace 直属 skill 目录内。

发布范围为 49 个公开 workspace 包的完整 patch 批次。主工作区中未提交的官网联系人图片与引用调整不属于本次发布范围，已在隔离发布工作树之外原样保留。

## 测试/验证/验收方式

- 发布前 `master` 与 `origin/master` 完全一致，目标提交冻结为 `215a61feb3b488e006f4f20a0f6d17db5897f147`。
- `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc npm whoami` 返回 `peiiii`。
- `pnpm release:check:health` 通过，仓库批次外无发布漂移，workspace 版本不落后于稳定标签。
- 完整发布批次检查确认 49 个公开包，其中已有 changeset 覆盖 12 个包，自动 changeset 覆盖其余 37 个包。
- `pnpm release:version` 完成 49 个公开包版本与 changelog 更新，顶层版本为 `nextclaw@0.27.7`。
- 严格发布检查、治理检查、文档构建、Registry tarball、全新安装与旧版升级结果将在发布完成后回填。

## 发布/部署方式

- NPM、GitHub tags、GitHub Release、stable runtime 和文档站将通过仓库既有单一发布链路完成。
- 数据库 migration、后端服务部署和 Desktop installer：不适用；本次没有数据库、远程后端或桌面安装包变更。
- 本次 release note 不附图：没有一张来自最终版本、同时覆盖项目选择入口和发送后上下文结果的统一真实截图，避免用旧图或弱证据图替代产品链路。

## 用户/产品视角的验收步骤

1. 从 `nextclaw@0.27.6` 检查 stable 更新，确认发现 `0.27.7`。
2. 下载并应用更新，确认新进程报告 `0.27.7`。
3. 在聊天输入框输入 `@`，选择已登记项目，确认生成项目令牌且不切换会话工作目录。
4. 在 Codex 会话中运行持续输出的长命令，确认不会被误判为空闲超时；真实超时后继续下一轮，确认恢复同一 thread。
5. 从 Marketplace 卸载合法 workspace skill，并确认路径越界目标被拒绝。

## 可维护性总结汇总

- 发布元数据沿用 Changesets、docs notes、结构化 release notes JSON、GitHub Release 和 stable runtime 既有 owner，没有新增平行发布链路。
- 本次版本化只生成 package version、changelog 和发布文档，不修改产品源码；生产语义代码净增门槛不适用于机械发布元数据。
- 各功能改动的代码增减、owner 边界和定向验证已记录在对应迭代日志；发布收尾将补充本次元数据 diff 与发布机制复盘。

## NPM 包发布记录

- 发布范围：49 个公开 workspace 包，统一 patch。
- 顶层包：`nextclaw@0.27.7`，目标 dist-tag 为 `latest`。
- Registry 精确版本、完整包清单、runtime manifest 与更新烟测结果将在发布完成后回填。
