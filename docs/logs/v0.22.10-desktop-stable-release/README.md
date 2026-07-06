# v0.22.10 Desktop Stable 0.22.1 Release

## 迭代完成说明

本次完成 NextClaw Desktop 正式版发布闭环，并同步更新官网桌面下载 fallback 链接。

- GitHub Release: https://github.com/Peiiii/nextclaw/releases/tag/v0.22.1-desktop.1
- Desktop app version: `0.0.217`
- Runtime bundle version: `0.22.1`
- Stable `minimumLauncherVersion`: `0.0.141`
- Release target commit: `32bc019cce68d9cde45fdcb4c715fa6785391395`
- Preflight run: https://github.com/Peiiii/nextclaw/actions/runs/28806335490
- Release workflow run: https://github.com/Peiiii/nextclaw/actions/runs/28806386298
- 官网部署: https://2e6c0bb4.nextclaw-landing.pages.dev

## 测试/验证/验收方式

已执行：

- `pnpm release:desktop:stable -- --branch master --notes-file docs/logs/v0.22.10-desktop-stable-release/github-release.md --dry-run`
  - 确认计划 tag 为 `v0.22.1-desktop.1`
  - 确认 desktop version 为 `0.0.217`
  - 确认 runtime version 为 `0.22.1`
  - 确认 stable `minimumLauncherVersion` 为 `0.0.141`
  - 确认 target 为 `32bc019cce68d9cde45fdcb4c715fa6785391395`
- `pnpm release:desktop:stable -- --branch master --notes-file docs/logs/v0.22.10-desktop-stable-release/github-release.md`
  - 本地隔离 worktree package verify 通过
  - seed bundle runtime shape 通过，runtime file count `135`，plugin file count `31`
  - seed runtime `init` 通过
  - 本地 macOS arm64 DMG smoke 通过，GUI ready 约 `4831ms`
  - desktop command surface smoke 返回 runtime `0.22.1`
  - 远端 preflight `28806335490` 完成且 `success`
  - release workflow `28806386298` 完成且 `success`
  - `desktop-win32-x64`、`desktop-win32-arm64`、`desktop-darwin-arm64`、`desktop-darwin-x64`、`desktop-linux-x64` 均为 `success`
  - `publish-release-assets`、`publish-desktop-update-channels`、`publish-linux-apt-repo` 均为 `success`
  - release assets 检查通过，包含 Windows portable、Windows installer、runtime bundle、stable manifest、public key 与 Linux deb
  - `gh-pages` stable manifest 检查通过，latest version 为 `0.22.1`
  - public Pages stable manifest 检查通过，latest version 为 `0.22.1`
  - `gh-pages` stable APT repo 检查通过，desktop version 为 `0.0.217`
  - public stable APT repo 检查通过，desktop version 为 `0.0.217`
- `pnpm --filter @nextclaw/landing build`
  - 结果：通过，生成 `main-c1mxJuL1.js`
  - dist 中 fallback tag/version 为 `v0.22.1-desktop.1 / 0.0.217`
- `pnpm deploy:landing`
  - 结果：通过，部署到 Cloudflare Pages
- 正式域名验证：
  - `https://nextclaw.io/en/download/`
  - `https://nextclaw.io/zh/download/`
  - `https://nextclaw.io/assets/main-c1mxJuL1.js`
  - 结果：HTML schema 和 JS bundle 均为 `v0.22.1-desktop.1 / 0.0.217`，未发现旧 `v0.22.0-desktop.1 / 0.0.216`
- 独立核验：
  - `gh release view v0.22.1-desktop.1 --repo Peiiii/nextclaw --json tagName,name,url,isDraft,isPrerelease,publishedAt,targetCommitish,assets`
  - `gh run view 28806386298 --repo Peiiii/nextclaw --json status,conclusion,url,jobs`
  - `https://peiiii.github.io/nextclaw/desktop-updates/stable/manifest-stable-win32-x64.json`
  - `https://peiiii.github.io/nextclaw/apt/dists/stable/main/binary-amd64/Packages`

公开 stable manifest 核验结果：

```json
{
  "latestVersion": "0.22.1",
  "minimumLauncherVersion": "0.0.141",
  "releaseNotesUrl": "https://github.com/Peiiii/nextclaw/releases/tag/v0.22.1-desktop.1",
  "bundleUrl": "https://github.com/Peiiii/nextclaw/releases/download/v0.22.1-desktop.1/nextclaw-bundle-win32-x64-0.22.1.zip",
  "manifestSignature": "string",
  "bundleSignature": "string"
}
```

公开 stable APT repo 核验结果：

```text
Package: nextclaw-desktop
Version: 0.0.217
Filename: pool/main/n/nextclaw-desktop/nextclaw-desktop_0.0.217_amd64.deb
```

## 发布/部署方式

桌面正式版通过仓库标准入口发布：

```bash
pnpm release:desktop:stable -- --branch master --notes-file docs/logs/v0.22.10-desktop-stable-release/github-release.md
```

官网通过仓库标准入口部署：

```bash
pnpm deploy:landing
```

本次发布使用干净 release worktree 基于 `origin/master` 执行，避免主工作区未提交的 landing / screenshot WIP 混入桌面 release target 或官网 fallback 提交。

不适用项：

- 数据库 migration：不涉及后端数据库结构变更。
- 后端 deploy：不涉及服务端运行环境变更。
- NPM release：本次复用已发布的 `nextclaw@0.22.1` runtime bundle，不重复发布 NPM。
- docs 站部署：`0.22.1` 用户更新说明和结构化 release notes 已在前序 NPM patch 发布中完成。

## 用户/产品视角的验收步骤

用户可以从 GitHub Release 或官网下载安装包：

- GitHub Release: https://github.com/Peiiii/nextclaw/releases/tag/v0.22.1-desktop.1
- 英文下载页: https://nextclaw.io/en/download/
- 中文下载页: https://nextclaw.io/zh/download/

已安装 stable channel 的桌面端检查更新时，应看到 runtime bundle `0.22.1`，manifest 的 `minimumLauncherVersion` 为 `0.0.141`，release notes URL 指向 `v0.22.1-desktop.1`。

Linux APT 用户应能在 stable repo 中看到 `nextclaw-desktop` `0.0.217`。

## 可维护性总结汇总

本次源码改动只同步官网 desktop release fallback 常量和静态 HTML 结构化数据，不引入新的产品逻辑或抽象。

维护性正向结果：

- 桌面正式版继续走 `pnpm release:desktop:stable` 单入口，统一闭合本地 verify、远端 preflight、GitHub Release、workflow、manifest 和 APT repo。
- 官网下载 fallback 只在既有 owner `desktop-release.utils.ts` 中更新版本和 tag，不新增平行配置。
- 使用隔离 worktree 发布和部署，保护主工作区既有未提交 WIP。

未运行 maintainability guard；原因是本次没有新增源码实现逻辑，主要验证口径是 release contract、desktop packaging smoke、update manifest、APT repo、landing build/deploy 和正式域名核验。

## NPM 包发布记录

本次不涉及新的 NPM 包发布。

桌面正式版使用已发布的 `nextclaw@0.22.1` runtime bundle 版本。NPM patch 发布记录见 `docs/logs/v0.22.8-npm-patch-release/README.md`。
