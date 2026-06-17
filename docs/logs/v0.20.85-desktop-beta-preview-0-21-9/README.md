# v0.20.85 Desktop Beta Preview 0.21.9

## 迭代完成说明

本次完成桌面端 beta preview 发布，release tag 为 `v0.21.9-desktop-beta.1`。

发布身份：

- Desktop app version：`0.0.212`
- Runtime bundle version：`0.21.9`
- Beta minimum launcher version：`0.0.143`
- GitHub prerelease：`https://github.com/Peiiii/nextclaw/releases/tag/v0.21.9-desktop-beta.1`
- Desktop release workflow：`https://github.com/Peiiii/nextclaw/actions/runs/27708396810`

本次同时发现并修复一个发布自动化串线问题：`npm-runtime-update-release.yml` 监听所有 GitHub release published 事件，桌面 beta release 创建后误触发 NPM runtime workflow，把 `nextclaw-runtime-*` 资产上传到桌面 release，并把 NPM stable manifest 的 bundle URL 临时改到了 desktop beta tag。

修复方式：

- 限制 `npm-runtime-update-release.yml` 的 release 事件触发范围，仅允许 `nextclaw@...` 或 `npm-beta` 类 NPM runtime tag。
- 在 `desktop-release-closure.mjs` 中增加反向资产断言：desktop release 中出现 `nextclaw-runtime-*.zip` 直接失败。
- 删除 `v0.21.9-desktop-beta.1` 上误混入的 4 个 `nextclaw-runtime-*` assets。
- 重新运行 NPM runtime stable workflow `27709611070`，恢复公开 NPM stable manifests 指向 `nextclaw@0.21.9`。

## 测试/验证/验收方式

桌面 beta preview 一键发布：

- `pnpm release:desktop:beta -- --dry-run`
- `pnpm release:desktop:beta`

本地自动验证：

- 脚本在临时 release worktree 中运行 `pnpm desktop:package:verify`。
- macOS arm64 DMG 验证通过。
- packaged app 包含 `Contents/Resources/update/update-bundle-public.pem`。
- stable update manifest signature 验证通过。
- seed bundle version 为 `0.21.9`，runtime file count 为 120，plugin file count 为 31。
- seed runtime `nextclaw init` 验证通过。
- macOS isolated GUI smoke 通过，command surface `nextclaw --version` 输出 `0.21.9`。

远端发布验证：

- remote signing-secret preflight：`27708366014`，结论 `success`。
- desktop release workflow：`27708396810`，结论 `success`。
- matrix jobs 均成功：
  - `desktop-darwin-arm64`
  - `desktop-darwin-x64`
  - `desktop-linux-x64`
  - `desktop-win32-x64`
  - `desktop-win32-arm64`
- follow-on jobs：
  - `publish-release-assets`：`success`
  - `publish-desktop-update-channels`：`success`
  - `publish-linux-apt-repo`：beta release 下按预期 `skipped`

桌面 release closure：

- `node scripts/release/desktop-beta-preview-closure.mjs --tag v0.21.9-desktop-beta.1 --desktop-version 0.0.212 --runtime-version 0.21.9 --minimum-launcher-version 0.0.143 --run-id 27708396810`
- release assets 检查通过。
- gh-pages beta manifest 检查通过。
- public Pages beta manifest 检查通过，五个平台 manifests 均指向 `v0.21.9-desktop-beta.1`。

串线修复验证：

- 删除 desktop beta release 上误混入的 `nextclaw-runtime-darwin-arm64-0.21.9.zip`、`nextclaw-runtime-darwin-x64-0.21.9.zip`、`nextclaw-runtime-linux-x64-0.21.9.zip`、`nextclaw-runtime-win32-x64-0.21.9.zip`。
- 更新后的 desktop closure gate 对同一 tag/run 重新验证通过，且 release 上不再存在 `nextclaw-runtime-*`。
- NPM stable restore workflow：`27709611070`，结论 `success`。
- 公开 NPM stable manifests 已恢复到 `https://github.com/Peiiii/nextclaw/releases/download/nextclaw@0.21.9/...`。
- `node --check scripts/release/desktop-release-closure.mjs`
- `git diff --check -- .github/workflows/npm-runtime-update-release.yml scripts/release/desktop-release-closure.mjs`

## 发布/部署方式

桌面 beta preview 通过一键命令发布：

```bash
pnpm release:desktop:beta
```

该命令完成以下步骤：

- 忽略主工作区未跟踪文件，在临时 release worktree 中运行本地 package verify。
- 运行远端 signing-secret preflight。
- 创建 GitHub prerelease `v0.21.9-desktop-beta.1`。
- 等待 `desktop-release` workflow 完成。
- 验证 release assets、gh-pages beta manifest 和 public Pages beta manifest。

本次不发布桌面 stable，不更新 stable APT repo，不更新官网 stable download links。

## 用户/产品视角的验收步骤

1. 打开 GitHub release `v0.21.9-desktop-beta.1`。
2. 下载对应平台的 preview artifact，例如 Windows x64 portable、Windows installer、macOS DMG、Linux AppImage 或 deb。
3. 安装或启动 preview 版本。
4. 检查桌面端运行时版本为 `0.21.9`。
5. 在 beta 更新通道检查更新，预期 manifest 指向 `v0.21.9-desktop-beta.1` 的 `nextclaw-bundle-*` 资产。
6. 对 NPM launcher 检查 stable 更新，预期仍指向 `nextclaw@0.21.9` 的 `nextclaw-runtime-*` 资产，不指向 desktop beta tag。

## 可维护性总结汇总

本次核心目标是发布闭环和自动化加固，不新增产品功能。

正向减债动作：

- 将 release 事件的 owner 边界前移到 workflow 触发条件，避免 desktop release 被 NPM runtime workflow 消费。
- 将资产污染从人工发现变成 desktop closure 的自动失败条件，未来一键发布不会静默通过同类错误。
- 对已污染的远端状态做恢复：清理 desktop release 多余 assets，并恢复 NPM stable manifest。

代码增减报告：

- `.github/workflows/npm-runtime-update-release.yml`：增加 release tag gate。
- `scripts/release/desktop-release-closure.mjs`：增加 desktop release 资产污染断言。
- 本文档记录发布和修复闭环。

可维护性风险：

- NPM runtime workflow 仍同时支持 `release` 和 `workflow_dispatch` 两种入口；本次已用 release tag gate 降低串线风险，后续如果新增 release 类型，需要同步扩展 tag contract。
- Desktop beta preview release 当前仍是 unsigned preview；正式 stable release 仍需走 stable desktop release contract。

## NPM 包发布记录

本次不发布新的 NPM 包。

本次触发了 NPM runtime stable restore workflow，但仅用于恢复 update channel manifest 到已发布的 `nextclaw@0.21.9`，没有产生新的 NPM package version。
