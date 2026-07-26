# UI 与 NCP React 稳定 NPM Patch 发布

## 迭代完成说明

本批次统一交付三个已经提交并带 changeset 的用户可见修复：

- 手动压缩上下文后，当前会话立即显示进行中反馈，并在完成或失败后正确清理；
- 发送消息后立即出现在当前会话中，实时连接中断后自动补回遗漏内容；
- 全新会话切换 Agent Runtime 时，恢复用户最近为该 Runtime 选择的模型。

发布范围由现有 changeset 与依赖闭包共同确定：

- `@nextclaw/ncp-react@0.5.16`
- `@nextclaw/ui@0.15.18`

本批不包含顶层 `nextclaw`、runtime update channel 或桌面安装包，不建立新的 NextClaw 产品版本号。

## 测试/验证/验收方式

- NPM 身份已验证为 `peiiii`，发布与验证统一使用仓库根目录 `.npmrc`。
- `pnpm release:check:health`：通过，当前批次之外无未发布漂移，workspace 版本不落后于稳定 tag。
- `pnpm release:check-readmes`、`pnpm release:check:groups`：通过。
- `pnpm release:check:strict`：两个包的 build、TypeScript、lint 均完成；lint 为 `0` 个错误，`@nextclaw/ncp-react` 有 `2` 个既有治理 warning。
- Runtime 模型偏好修复的相关 `53` 个测试、UI `tsc --noEmit`、lint、build 与隔离源码浏览器真实验收均已通过。
- 发布后还需验证 registry 版本、`latest` dist-tag 与隔离安装结果。

## 发布/部署方式

- NPM：通过仓库标准 `pnpm release:publish` 发布，不使用包目录内的 raw `npm publish`。
- 独立产品更新说明：不适用；本批没有新的顶层 `nextclaw` 产品版本、runtime manifest 或 GitHub Release，用户可见变更由包 changelog 承载。
- Runtime update、桌面 installer、数据库 migration、后端部署与 Docs Deploy：不适用。
- 当前用户运行中的 NextClaw 实例：不重启。

## 用户/产品视角的验收步骤

1. 在全新会话中为不同 Agent Runtime 选择不同模型，来回切换并确认恢复各自最近模型。
2. 在会话中手动压缩上下文，确认时间线立即显示进行中状态，并在请求结束后清理。
3. 发送新消息，确认消息立即出现在当前会话；模拟实时连接中断后，确认遗漏消息能自动补回。

## 可维护性总结汇总

- 本次发布阶段只生成版本号、changelog 与发布记录，没有新增产品语义源码。
- Runtime 模型偏好修复的生产代码为 `+13 / -13 / net 0`，通过删除未使用动作保持非功能改动净增长为零。
- 三项修复均复用既有 owner 与主链路，没有为发布增加平行实现、兼容分支或新的抽象层。
- 目录、文件角色、generated-clean、new-code governance 与 backlog ratchet 已通过。

## NPM 包发布记录

- `@nextclaw/ncp-react@0.5.16`：版本已准备，等待 registry publish。
- `@nextclaw/ui@0.15.18`：版本已准备，等待 registry publish。
- dist-tag：计划发布到 `latest`。
- 顶层 `nextclaw`：不在本批次。
