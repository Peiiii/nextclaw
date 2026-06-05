# Desktop Beta Preview 0.21.4

## 迭代完成说明

本次完成 NextClaw Desktop beta preview 发布闭环。

- GitHub release tag: `v0.21.4-beta.1-desktop-beta.1`
- Release URL: `https://github.com/Peiiii/nextclaw/releases/tag/v0.21.4-beta.1-desktop-beta.1`
- Desktop app version: `0.0.207-beta.1`
- Runtime bundle version: `0.21.4-beta.1`
- Target commit: `50c40f9f62cc57f5a566e9411f1f019eba4f536a`
- Channel: `beta`
- `minimumLauncherVersion`: `0.0.143`

## 测试/验证/验收方式

- 运行 `PATH=/opt/homebrew/bin:$PATH pnpm release:desktop:beta -- --dry-run` 确认发布计划、tag、target、channel 与 launcher floor。
- 运行 `PATH=/opt/homebrew/bin:$PATH pnpm release:desktop:beta` 完成发布闭环。
- 发布脚本在隔离 release worktree 中完成本地 `desktop:package:verify`。
- 本地 package gate 覆盖 macOS arm64 DMG 生成、update public key ensure、update manifest signature 验证、seed runtime init、隔离 GUI smoke、command surface smoke 与 health check。
- GitHub Actions `desktop-release` run `27005216668` 完成，matrix 与发布 jobs 均成功。
- GitHub release assets 校验通过，包含 macOS DMG/zip、Windows installer/portable/unpacked、Linux AppImage/deb、runtime/update bundles、update manifests、`latest*.yml` 与 `update-bundle-public.pem`。
- `gh-pages` beta manifest 与公开 Pages manifest 均验证到 `latestVersion=0.21.4-beta.1`。

## 发布/部署方式

通过仓库桌面发布自动化执行：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm release:desktop:beta
```

发布结果：

- GitHub prerelease 已创建并上传资产。
- `publish-release-assets` 成功。
- `publish-desktop-update-channels` 成功。
- `publish-linux-apt-repo` 在 beta 场景按预期跳过。
- 公开 beta update channel 已更新到 `0.21.4-beta.1`。

## 用户/产品视角的验收步骤

- beta 用户通过桌面 beta update channel 检查更新时，应看到 runtime `0.21.4-beta.1`。
- 新安装用户可从 GitHub prerelease 下载对应平台安装包或 portable 包。
- beta update manifest 的 `minimumLauncherVersion` 为 `0.0.143`，符合 `apps/desktop/desktop-launcher-compatibility.json` 的 beta floor。

## 可维护性总结汇总

本次是发布执行与发布状态留痕，没有修改源码、脚本、测试或运行链路配置。

- 发布使用既有 `pnpm release:desktop:beta` 单入口，没有手工拼接 release 步骤。
- 发布目标使用已提交的 `HEAD`，本地未提交的无关 skill 文档改动未进入发布包。
- 不涉及代码增减，不适用非测试代码净增门槛。
- 不涉及新增抽象、目录移动或文件组织变更。
- `post-edit-maintainability-review` 不适用：本次没有代码实现改动。

## NPM 包发布记录

本次不涉及 NPM 包发布。

- 桌面 beta 发布使用已存在的 runtime 版本 `nextclaw@0.21.4-beta.1`。
- 没有新增 `.changeset`。
- 没有执行 NPM publish。
