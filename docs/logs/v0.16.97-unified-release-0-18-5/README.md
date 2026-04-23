# v0.16.97-unified-release-0-18-5

## 迭代完成说明（改了什么）

- 本次迭代用于记录 `nextclaw@0.18.5` 与 `@nextclaw/ui@0.12.13` 的统一 NPM 发版，以及桌面稳定版 `v0.18.5-desktop.1 / 0.0.148` 的完整发布闭环。
- 本次桌面 release 指向提交 `5561af9c chore: release nextclaw 0.18.5`，对应 GitHub release：[`v0.18.5-desktop.1`](./GITHUB_RELEASE.md)。
- 桌面下载 fallback 已切到新的稳定线：
  - `apps/landing/src/desktop-release.service.ts`
  - `apps/landing/en/index.html`
  - `apps/landing/en/download/index.html`
  - `apps/landing/zh/index.html`
  - `apps/landing/zh/download/index.html`
- 本次发布过程中出现过一次真实阻断：
  - 根因状态：未完全定位。
  - 现象：GitHub Actions 首次桌面 release workflow `24850921704` 的 `desktop-win32-x64` 在 `Smoke Desktop Installer (Windows)` 阶段失败，安装器进程直接以 `-1073741819` 退出，导致后续 release asset、stable update channel 与 Linux APT 发布链路被阻断。
  - 当前证据：我对比了上一次成功桌面 release `24848029793` 与这次失败前的仓库状态，Windows installer smoke 脚本、desktop release workflow、electron-builder Windows 安装器配置都没有功能性差异；本次与上一条成功 release 的直接差异主要是版本号与本轮产物内容。失败后对同一条 run 执行 failed jobs rerun，新的 Windows job `72752197708` 在不改任何仓库代码的情况下通过了 `Smoke Desktop Installer (Windows)`，随后整条 workflow 恢复为成功。
  - 当前判断：这次更像 GitHub Windows runner / NSIS 安装阶段的瞬时崩溃，而不是一个已经确认的稳定仓库回归。由于未拿到足以复现的额外崩溃证据，本次属于“通过重跑恢复发布”的止血闭环，不应声称已彻底定位该瞬时崩溃根因。
- 首次失败后的补救方式：
  - 保留同一个 release tag `v0.18.5-desktop.1`
  - 原地重跑 `24850921704` 的 failed jobs
  - 在 Windows installer smoke 通过后继续完成 release assets、stable update channel 与 Linux APT repo 发布
- 新增本次桌面正式版 release note：[`GITHUB_RELEASE.md`](./GITHUB_RELEASE.md)

## 测试/验证/验收方式

- 已通过：`PATH=/opt/homebrew/bin:$PATH pnpm release:check`
- 已通过：`PATH=/opt/homebrew/bin:$PATH pnpm release:publish`
  - 已确认实际发布包为 `nextclaw@0.18.5`、`@nextclaw/ui@0.12.13`
  - 已确认 `pnpm release:verify:published` 完成线上版本校验
- 已通过：`PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify`
  - 已验证 stable update manifest 验签
  - 已验证 seed bundle version `0.18.5`
  - 已验证 seed runtime `init` 路径 `dist/cli/app/index.js`
  - 已验证 `apps/desktop/release/NextClaw Desktop-0.0.148-arm64.dmg` 的 macOS arm64 安装级 smoke
- 已通过：`PATH=/opt/homebrew/bin:$PATH pnpm -C apps/landing build`
- 已通过：`gh run view 24850921704 --repo Peiiii/nextclaw --json status,conclusion,url`
  - 已确认 workflow 最终为 `completed / success`
  - 已确认 `desktop-darwin-arm64`、`desktop-darwin-x64`、`desktop-win32-x64`、`desktop-linux-x64` 全部成功
  - 已确认 `publish-release-assets`、`publish-desktop-update-channels`、`publish-linux-apt-repo` 全部成功
- 已通过：`gh release view v0.18.5-desktop.1 --repo Peiiii/nextclaw --json assets,url,tagName,targetCommitish,publishedAt`
  - 已确认 release 页面挂载 macOS / Windows / Linux 安装包、portable zip、bundle zip、manifest、`latest*.yml` 与 `update-bundle-public.pem`
- 已通过：`origin/gh-pages` 与公开 Pages 双重抽查
  - `origin/gh-pages:desktop-updates/stable/manifest-stable-win32-x64.json`
  - `origin/gh-pages:desktop-updates/stable/manifest-stable-darwin-arm64.json`
  - `https://peiiii.github.io/nextclaw/desktop-updates/stable/manifest-stable-win32-x64.json`
  - `https://peiiii.github.io/nextclaw/desktop-updates/stable/manifest-stable-darwin-arm64.json`
  - 以上清单均已确认 `releaseNotesUrl` 与 `bundleUrl` 指向 `v0.18.5-desktop.1`

## 发布/部署方式

- NPM：
  - 执行 `pnpm release:auto:prepare`
  - 执行 `pnpm release:version`
  - 提交 release commit `5561af9c chore: release nextclaw 0.18.5`
  - 推送 `master`
  - 执行 `pnpm release:publish`
  - 推送 package tags：`nextclaw@0.18.5`、`@nextclaw/ui@0.12.13`
- Desktop：
  - 基于 `5561af9c` 创建 GitHub release tag `v0.18.5-desktop.1`
  - 首次 workflow 在 Windows installer smoke 阶段失败
  - 对同一 run 执行 failed jobs rerun
  - 等待 release assets、stable update channel 与 Linux APT repo 全部完成
- Landing：
  - 将 fallback 下载目标更新到 `v0.18.5-desktop.1 / 0.0.148`

## 用户/产品视角的验收步骤

1. 运行 `npm view nextclaw version`，确认线上版本为 `0.18.5`。
2. 运行 `npm view @nextclaw/ui version`，确认线上版本为 `0.12.13`。
3. 打开 `https://www.npmjs.com/package/nextclaw`，确认展示 `0.18.5`。
4. 打开桌面正式 release 页面 `https://github.com/Peiiii/nextclaw/releases/tag/v0.18.5-desktop.1`。
5. 下载对应平台安装包：
   - macOS arm64：`NextClaw.Desktop-0.0.148-arm64.dmg`
   - macOS x64：`NextClaw.Desktop-0.0.148-x64.dmg`
   - Windows x64：`NextClaw.Desktop-Setup-0.0.148-x64.exe`
   - Linux x64：`NextClaw.Desktop-0.0.148-linux-x64.AppImage` 或 `nextclaw-desktop_0.0.148_amd64.deb`
6. 启动桌面端并触发检查更新，确认稳定通道返回 `0.18.5` bundle。
7. 打开 landing 下载页，确认 fallback 下载目标落到 `v0.18.5-desktop.1 / 0.0.148`。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次没有为了恢复发布再追加新的隐藏 fallback，而是保持既有发布合同，只对 release 元数据与稳定线指向做必要更新。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：基本没有继续恶化。本次主要是版本号、changelog、landing fallback 版本指向与 UI dist 快照更新，未引入新的结构性复杂度。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。本次没有引入新的发布补丁层，也没有把一次 runner 瞬时失败固化为长期代码分叉。
- 目录结构与文件组织是否满足当前项目治理要求：满足。本次新增迭代目录符合 `docs/logs` 命名要求，发布说明、release notes 分工清晰。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：不适用。本次主要是统一发版、版本快照与发布元数据落盘，没有新增业务逻辑或新的长期维护面；因此本节以发布后主观复核结论记录即可。

## NPM 包发布记录

- 本次是否需要发包：需要。
- 需要发布的包：
  - `nextclaw`
  - `@nextclaw/ui`
- 每个包当前发布状态：
  - `nextclaw@0.18.5`：已发布
  - `@nextclaw/ui@0.12.13`：已发布
- 本次不需要额外发布但已核验存在的相关包：
  - `@nextclaw/app-runtime@0.7.0`：已发布，无需补发
- 待统一发布状态：
  - 无
- 阻塞与触发条件：
  - 无剩余 NPM 发包阻塞；桌面 release、stable update channel 与 Linux APT 仓库也已完成远端发布。
