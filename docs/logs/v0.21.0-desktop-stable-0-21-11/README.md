# v0.21.0 Desktop Stable 0.21.11 Release

## 背景

2026-06-22 发布 NextClaw Desktop 正式版，对齐已经发布的 NPM runtime `0.21.11`，并闭合桌面安装包、desktop update channel、GitHub Pages stable manifest、稳定 APT 仓库和官网下载入口。

## 范围

- 发布 tag：`v0.21.11-desktop.1`
- Desktop launcher 版本：`0.0.214`
- Runtime bundle 版本：`0.21.11`
- Stable minimum launcher：`0.0.141`
- 目标提交：`f8142698a328dd9a9bd6478f1ca94232113b73be`

## 发布执行

- 运行 `pnpm release:desktop:stable -- --dry-run` 确认 tag、版本、分支、目标提交和 ahead 状态。
- 运行 `pnpm release:desktop:stable -- --notes-file docs/logs/v0.21.0-desktop-stable-0-21-11/github-release.md` 完成隔离 worktree 本地验证、preflight、GitHub Release 创建、`desktop-release` workflow、update channel 与 APT 发布。
- GitHub Release：`https://github.com/Peiiii/nextclaw/releases/tag/v0.21.11-desktop.1`
- Preflight run：`https://github.com/Peiiii/nextclaw/actions/runs/27964086760`
- Workflow run：`https://github.com/Peiiii/nextclaw/actions/runs/27964120225`

## 验证

- 本地 macOS DMG smoke、packaged app health check、command surface、runtime bundle `0.21.11` 与 stable update snapshot：通过。
- `desktop-release` workflow：通过，所有平台构建、release asset 发布、desktop update channel 发布、stable APT repo 发布 job 均为 `success`。
- Release assets：确认 macOS DMG、Windows installer、Windows portable、Linux AppImage、Linux deb、runtime bundle、stable manifest 和 public key 均已发布到 `v0.21.11-desktop.1`。
- Stable manifests：`gh-pages` 源文件和公开 URL 均已更新，`manifest-stable-win32-x64.json` 返回 `latestVersion=0.21.11`、`minimumLauncherVersion=0.0.141`。
- Stable APT repo：`gh-pages` 源文件和公开 URL 均已包含 `nextclaw-desktop` `0.0.214` 和 `pool/main/n/nextclaw-desktop/nextclaw-desktop_0.0.214_amd64.deb`。
- 官网下载页 fallback：已更新到 `v0.21.11-desktop.1` / `0.0.214`，并部署到 Cloudflare Pages。
- 官网部署：`https://8afed9ad.nextclaw-landing.pages.dev`；正式域名 `https://nextclaw.io/en/download/` 的 HTML schema 和 JS bundle 均验证为 `v0.21.11-desktop.1` / `0.0.214`。

## 后续

- 本次不涉及数据库 migration、后端 deploy 或 NPM 再发布；NPM stable `0.21.11` 已在前序闭环完成。
- `peiiii.github.io` 边缘节点在发布后曾短时间继续返回旧 stable manifest；后续公开 URL 已传播到新版本。
