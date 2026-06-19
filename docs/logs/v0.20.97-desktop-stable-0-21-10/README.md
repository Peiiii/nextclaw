# v0.20.97 Desktop Stable 0.21.10 Release

## 背景

2026-06-19 发布 NextClaw desktop 正式版，对齐已经发布的 NPM runtime `0.21.10`，并闭合 macOS、Windows、Linux 安装包、desktop update channel、GitHub Pages manifest 与稳定 APT 仓库。

## 范围

- 发布 tag：`v0.21.10-desktop.1`
- Desktop launcher 版本：`0.0.213`
- Runtime bundle 版本：`0.21.10`
- Stable minimum launcher：`0.0.141`
- 目标提交：`6064b8b3a3d7cde8e1f78af6378ba2a7ec247bd9`

## 发布执行

- 运行 `pnpm release:desktop:stable -- --dry-run` 确认 tag、版本、分支、目标提交和 ahead 状态。
- 运行 `pnpm release:desktop:stable` 完成隔离 worktree 本地验证、preflight、GitHub Release 创建、desktop-release workflow、update channel 与 APT 发布。
- GitHub Release：`https://github.com/Peiiii/nextclaw/releases/tag/v0.21.10-desktop.1`
- Workflow run：`https://github.com/Peiiii/nextclaw/actions/runs/27823324058`

## 验证

- 本地 macOS DMG smoke 通过，确认 packaged app 启动、health check、command surface、runtime bundle `0.21.10` 和 stable update snapshot。
- `desktop-release` workflow 全部 job 成功：darwin arm64/x64、win32 x64/arm64、linux x64、release assets、desktop update channels、stable APT repo。
- 公开 stable manifests 已更新到 `latestVersion=0.21.10`，`minimumLauncherVersion=0.0.141`。
- 公开 stable APT repo 已更新到 launcher `0.0.213`。
- `apps/landing` 下载页 fallback 已同步到 `v0.21.10-desktop.1` / `0.0.213`，并更新 Windows portable ZIP 资产命名匹配。

## 后续

- 本次不涉及数据库 migration、后端 deploy 或 NPM 再发布；NPM stable `0.21.10` 已在前序闭环完成。
- 当前主工作区存在无关 workspace single-source WIP，本次只提交 desktop release 官网 fallback 与发布记录。
