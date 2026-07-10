# v0.22.9 Desktop Beta Preview Release

## 迭代完成说明

本次完成 NextClaw Desktop beta preview release 发布闭环，发布 tag 为 `v0.22.1-desktop-beta.1`。

- GitHub Release: https://github.com/Peiiii/nextclaw/releases/tag/v0.22.1-desktop-beta.1
- Desktop app version: `0.0.217`
- Runtime bundle version: `0.22.1`
- Beta `minimumLauncherVersion`: `0.0.143`
- Release target commit: `6355700db16fed4a682d26f54424634aea2102e0`
- Release workflow run: https://github.com/Peiiii/nextclaw/actions/runs/28762130365

本次目标是发布可供跨平台下载与更新测试的 desktop beta preview，而不是生成本地安装包。发布脚本使用隔离 worktree 进行本地 package verify，随后推送当前 release target、执行远端 preflight、创建 GitHub prerelease，并等待 `desktop-release` workflow、release assets、`gh-pages` beta manifest 与公开 Pages manifest 全部闭合。

## 测试/验证/验收方式

- `pnpm release:desktop:beta -- --dry-run`
  - 确认发布计划为 `v0.22.1-desktop-beta.1`
  - 确认 `desktopVersion=0.0.217`
  - 确认 `runtimeVersion=0.22.1`
  - 确认 `minimumLauncherVersion=0.0.143`
  - 确认 target 为 `6355700db16fed4a682d26f54424634aea2102e0`
- `pnpm release:desktop:beta`
  - 本地隔离 worktree package verify 通过
  - macOS 本地 DMG smoke 通过，GUI ready 约 `4911ms`
  - seed bundle runtime shape 通过，runtime file count `135`，plugin file count `31`
  - seed runtime `init` 通过
  - release workflow `28762130365` 完成且 conclusion 为 `success`
  - `desktop-linux-x64`、`desktop-win32-arm64`、`desktop-darwin-arm64`、`desktop-win32-x64`、`desktop-darwin-x64` 均为 `success`
  - `publish-release-assets` 与 `publish-desktop-update-channels` 均为 `success`
  - beta release assets 检查通过
  - `origin/gh-pages` beta manifest 检查通过
  - 公开 Pages beta manifest 已传播到 `0.22.1`
- 独立核验：
  - `gh release view v0.22.1-desktop-beta.1 --repo Peiiii/nextclaw --json tagName,name,url,isDraft,isPrerelease,targetCommitish,assets,body`
  - `gh run view 28762130365 --repo Peiiii/nextclaw --json status,conclusion,url,jobs`
  - `https://peiiii.github.io/nextclaw/desktop-updates/beta/manifest-beta-win32-x64.json`

公开 beta manifest 核验结果：

```json
{
  "latestVersion": "0.22.1",
  "minimumLauncherVersion": "0.0.143",
  "releaseNotesUrl": "https://github.com/Peiiii/nextclaw/releases/tag/v0.22.1-desktop-beta.1",
  "bundleUrl": "https://github.com/Peiiii/nextclaw/releases/download/v0.22.1-desktop-beta.1/nextclaw-bundle-win32-x64-0.22.1.zip",
  "manifestSignature": true,
  "bundleSignature": true
}
```

## 发布/部署方式

通过仓库标准桌面 beta 发布入口发布：

```bash
pnpm release:desktop:beta
```

发布结果：

- GitHub prerelease 已创建，`isDraft=false`，`isPrerelease=true`
- workflow 整体完成并成功
- release assets 已上传，包含 Windows portable、Windows installer、macOS DMG/zip、Linux AppImage/deb、跨平台 update bundles、update manifests、`latest*.yml` 与 `update-bundle-public.pem`
- `gh-pages` beta update channel 已更新
- public Pages beta manifest 已更新
- stable-only `publish-linux-apt-repo` 对 beta preview 按预期 skipped

本次发布会把本地 `master` 已提交但未推送的 5 个提交推到 `origin/master`，以便 GitHub release target 可被远端 workflow checkout。主工作区未提交 WIP 未进入隔离发布包。

## 用户/产品视角的验收步骤

用户或测试者可以从 GitHub prerelease 下载对应平台安装包：

- Windows x64 installer: `NextClaw.Desktop-Setup-0.0.217-x64.exe`
- Windows x64 portable: `NextClaw-Portable-0.0.217-win-x64.zip`
- Windows arm64 portable: `NextClaw-Portable-0.0.217-win-arm64.zip`
- macOS arm64 DMG: `NextClaw.Desktop-0.0.217-arm64.dmg`
- macOS x64 DMG: `NextClaw.Desktop-0.0.217-x64.dmg`
- Linux AppImage: `NextClaw.Desktop-0.0.217-linux-x64.AppImage`
- Linux deb: `nextclaw-desktop_0.0.217_amd64.deb`

已安装 beta channel 的桌面端执行检查更新时，应能看到 runtime bundle `0.22.1`，且 manifest 的 `minimumLauncherVersion` 为 `0.0.143`。更新说明入口指向 GitHub prerelease 页面。

## 可维护性总结汇总

本次没有修改产品源码、脚本、测试或运行链路配置，只执行发布自动化并新增发布留痕，因此不适用代码可维护性净增/减统计与 post-edit maintainability review。

维护性层面的正向结果是发布闭环继续走标准 `pnpm release:desktop:beta` 单入口，避免手动串联 GitHub release、workflow polling、asset 检查和 manifest 检查。现有主工作区 WIP 通过 release worktree 隔离，未被发布流程覆盖或混入包产物。

## NPM 包发布记录

本次不涉及新的 NPM 包发布。

桌面 beta preview 使用已发布的 `nextclaw@0.22.1` runtime bundle 版本，NPM patch 发布记录已在 `docs/logs/v0.22.8-npm-patch-release/README.md` 中记录。本次发布只创建 desktop beta GitHub prerelease、desktop update bundles 与 beta update channel。
