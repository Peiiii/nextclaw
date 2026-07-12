# v0.22.30 desktop stable release

## 迭代完成说明

本轮完成 `nextclaw@0.22.3` NPM 正式版后的桌面端 stable 发布闭环，将桌面壳版本推进到 `0.0.219`，runtime bundle 版本为 `0.22.3`，最低 launcher 版本为 `0.0.141`。

最终成功的桌面端正式版 tag 为 `v0.22.3-desktop.8`，GitHub Actions run 为 `29208773834`，GitHub Release 地址为 `https://github.com/Peiiii/nextclaw/releases/tag/v0.22.3-desktop.8`。

本轮发布过程中先后修复了桌面端打包链路中的两个真实阻塞点：Linux AppImage 缺失 `sharp-libvips-linux-x64` native resource，以及 Linux APT `.deb` 超过 GitHub Pages 分支单文件 100MB 限制。

## 测试/验证/验收方式

- 本地执行 `pnpm desktop:package:verify`，覆盖 macOS DMG 构建、seed runtime `0.22.3` 校验、native runtime dependencies 校验、runtime init、GUI smoke、health check 和 stable update check。
- 本地执行 `node --check apps/desktop/scripts/prepare-native-app-resources.mjs`、`git diff --check`、`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`pnpm check:generated-clean`。
- GitHub Actions run `29208773834` 的 `desktop-darwin-arm64`、`desktop-darwin-x64`、`desktop-win32-x64`、`desktop-linux-x64`、`desktop-win32-arm64`、`publish-release-assets`、`publish-desktop-update-channels`、`publish-linux-apt-repo` 全部成功。
- 公开 Pages stable manifest 验证 `latestVersion=0.22.3`、`minimumLauncherVersion=0.0.141`，release notes 指向 `v0.22.3-desktop.8`。
- 公开 APT `Packages` 验证 `Version: 0.0.219`，`.deb` size 为 `101152852` bytes。
- 官网执行 `pnpm --filter @nextclaw/landing build` 与 `pnpm deploy:landing`，部署后验证生产 bundle 只包含 `v0.22.3-desktop.8` 和 `0.0.219`。

## 发布/部署方式

- NPM 正式版：`nextclaw@0.22.3` 已发布到 npm registry。
- 桌面端正式版：执行 `pnpm release:desktop:stable -- --branch master --tag v0.22.3-desktop.8 --notes-file docs/logs/v0.22.30-desktop-stable-release/github-release.md --skip-local-verify`。
- 官网：执行 `pnpm deploy:landing`，Cloudflare Pages 部署地址为 `https://50ca9998.nextclaw-landing.pages.dev`，生产域名为 `https://nextclaw.io`。

## 用户/产品视角的验收步骤

- 用户访问 `https://nextclaw.io/en/download/` 或 `https://nextclaw.io/zh/download/` 时，默认下载 fallback 指向 `v0.22.3-desktop.8`。
- Windows stable runtime update manifest 指向 `nextclaw-bundle-win32-x64-0.22.3.zip`，release notes 指向 `v0.22.3-desktop.8`。
- Linux 用户通过 APT stable 仓库安装时获得 `nextclaw-desktop` 版本 `0.0.219`。
- macOS、Windows、Linux release assets 均在 GitHub Release 中可见；Linux AppImage smoke 与 APT fresh install / upgrade smoke 已在 CI 通过。

## 可维护性总结汇总

- 将 sharp libvips 桌面壳资源准备收敛为 `apps/desktop/scripts/prepare-native-app-resources.mjs`，由 `pack`、`dist`、本地 package verify 和 release workflow 统一调用，避免手写 pnpm store 路径。
- release workflow 在三端构建前显式运行 native resource 准备步骤，平台包只携带目标平台需要的 sharp/native 资源。
- 通过 `electronLanguages` 只保留 `en-US`、`zh-CN`、`zh-TW`，让 Linux `.deb` 低于 GitHub Pages 分支单文件限制，同时不改变 NextClaw runtime bundle。
- 本轮非测试语义代码有净新增，原因是新增可复用打包脚本与发布配置闭环；新增代码用于消除发布链路阻塞，不是临时热修分支。

## NPM 包发布记录

- 已发布：`nextclaw@0.22.3`。
- 桌面端使用已经发布的 `nextclaw@0.22.3` 作为 runtime bundle。
- 本轮桌面端后续修复未发布新的 NPM 包；修复范围只影响 desktop installer / AppImage / deb / update bundle 打包链路与官网 fallback 链接。
