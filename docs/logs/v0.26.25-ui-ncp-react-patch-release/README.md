# UI 与 NCP React 稳定 NPM Patch 发布

> 2026-07-28 纠正：本记录最初把低层包发布误判为完整产品交付。`nextclaw` 会把 UI 构建产物复制到自身的 `ui-dist`，运行时并不消费 registry 中的 `@nextclaw/ui`。因此本批实际只完成了低层包发布，没有让 `nextclaw@latest` 用户获得这些变化。纠正发布与发布门禁修复记录在 `docs/logs/v0.26.26-nextclaw-artifact-release-closure/README.md`。

## 迭代完成说明

本批次统一交付三个已经提交并带 changeset 的用户可见修复：

- 手动压缩上下文后，当前会话立即显示进行中反馈，并在完成或失败后正确清理；
- 发送消息后立即出现在当前会话中，实时连接中断后自动补回遗漏内容；
- 全新会话切换 Agent Runtime 时，恢复用户最近为该 Runtime 选择的模型。

发布范围由现有 changeset 与依赖闭包共同确定：

- `@nextclaw/ncp-react@0.5.16`
- `@nextclaw/ui@0.15.18`

本批当时未包含顶层 `nextclaw`、runtime update channel 或桌面安装包；这是实际发布范围，但不是完整的 NextClaw 产品交付范围。

## 测试/验证/验收方式

- NPM 身份已验证为 `peiiii`，发布与验证统一使用仓库根目录 `.npmrc`。
- `pnpm release:check:health`：通过，当前批次之外无未发布漂移，workspace 版本不落后于稳定 tag。
- `pnpm release:check-readmes`、`pnpm release:check:groups`：通过。
- `pnpm release:check:strict`：两个包的 build、TypeScript、lint 均完成；lint 为 `0` 个错误，`@nextclaw/ncp-react` 有 `2` 个既有治理 warning。
- Runtime 模型偏好修复的相关 `53` 个测试、UI `tsc --noEmit`、lint、build 与隔离源码浏览器真实验收均已通过。
- `pnpm release:publish`：两个包均发布成功，仓库校验在 registry 传播完成后确认 `2/2` 版本可见。
- registry 独立复核：`@nextclaw/ncp-react@0.5.16` 与 `@nextclaw/ui@0.15.18` 的 `latest` dist-tag 均指向本次版本。
- 隔离安装精确版本成功，共安装 `567` 个依赖；读取到 NCP React `13` 个导出，且已发布 UI 包把 `@nextclaw/ncp-react` 解析为 `0.5.16`。

## 发布/部署方式

- NPM：已通过仓库标准 `pnpm release:publish` 发布，没有使用包目录内的 raw `npm publish`。
- 独立产品更新说明：本批当时未生成；由于顶层产品包被错误排除，这项“不适用”判断无效。
- Runtime update、桌面 installer、数据库 migration、后端部署与 Docs Deploy：不适用。
- 当前用户运行中的 NextClaw 实例：不重启。
- Git：功能、版本与发布记录均已提交到本地 `master`；未获得 `git push` 授权，因此 `origin/master` 与远端 tag 尚未更新。

## 用户/产品视角的验收步骤

1. 在全新会话中为不同 Agent Runtime 选择不同模型，来回切换并确认恢复各自最近模型。
2. 在会话中手动压缩上下文，确认时间线立即显示进行中状态，并在请求结束后清理。
3. 发送新消息，确认消息立即出现在当前会话；模拟实时连接中断后，确认遗漏消息能自动补回。

## 可维护性总结汇总

- 本次发布阶段只生成版本号、changelog 与发布记录，没有新增产品语义源码。
- Runtime 模型偏好修复的生产代码为 `+13 / -13 / net 0`，通过删除未使用动作保持非功能改动净增长为零。
- 三项修复均复用既有 owner 与主链路，没有为发布增加平行实现、兼容分支或新的抽象层。
- 目录、文件角色、generated-clean、new-code governance 与 backlog ratchet 已通过。
- 发布复盘纠正：原复盘遗漏了构建产物消费者关系。Changesets、release health 与 generic publish gate 都没有把 `@nextclaw/ui -> nextclaw` 建模为强制闭包，导致一个可以通过全部检查、但用户拿不到 UI 变化的发布批次。

## NPM 包发布记录

- `@nextclaw/ncp-react@0.5.16`：已发布，registry 与隔离安装验证通过。
- `@nextclaw/ui@0.15.18`：已发布，registry、依赖闭包与隔离安装验证通过。
- dist-tag：两个包均为 `latest`。
- 本地 tag：`@nextclaw/ncp-react@0.5.16`、`@nextclaw/ui@0.15.18`。
- 顶层 `nextclaw`：本批次遗漏，待由纠正发布补齐。
