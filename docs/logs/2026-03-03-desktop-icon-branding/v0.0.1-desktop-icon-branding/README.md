# 2026-03-03 v0.0.1-desktop-icon-branding

## 迭代完成说明（改了什么）

- 桌面端打包改为使用 NextClaw 自有品牌图标，不再使用 Electron 默认图标。
- 新增图标生成脚本：`apps/desktop/scripts/generate-icons.mjs`。
- 新增图标资源：`apps/desktop/build/icons/icon.icns`、`apps/desktop/build/icons/icon.ico`、`apps/desktop/build/icons/icon.png`。
- 更新打包配置：`apps/desktop/package.json` 中配置 macOS / Windows 的图标路径。
- 桌面端版本从 `0.0.4` 升级到 `0.0.5`，用于发布后可更新识别。

## 测试 / 验证 / 验收方式

- 代码校验：
  - `pnpm -C apps/desktop lint`
  - `pnpm -C apps/desktop tsc`
  - `pnpm -C apps/desktop build:main`
- 运行冒烟：
  - `pnpm -C apps/desktop smoke`
- 打包验证：
  - `CSC_IDENTITY_AUTO_DISCOVERY=false pnpm -C apps/desktop exec electron-builder --mac dmg --publish never`
  - `CSC_IDENTITY_AUTO_DISCOVERY=false pnpm -C apps/desktop exec electron-builder --win nsis --x64 --publish never`
- 关键观察点：
  - 打包日志不再出现 `default Electron icon is used`。
  - 产物包含 `NextClaw Desktop-0.0.5-arm64.dmg` 与 `NextClaw Desktop Setup 0.0.5.exe`。

## 发布 / 部署方式

- 提交桌面端图标与配置变更代码到 `master`。
- 创建桌面端发布 tag（beta）。
- 发布 GitHub Release，并上传桌面端安装包：
  - macOS：`.dmg`
  - Windows：`.exe`
- 不上传 installer 相关产物（如 `.pkg`）。

## 用户 / 产品视角的验收步骤

1. 打开 GitHub Release 页面，确认下载区仅含桌面端安装包（`.dmg` + `.exe`，无 `.pkg`）。
2. macOS 下载并安装 `.dmg`，查看应用图标为 NextClaw 品牌图标。
3. Windows 下载并安装 `.exe`，查看安装器与应用图标为 NextClaw 品牌图标。
4. 进入发布说明，确认含“超短安装指引 + 常见报错处理 + 中英文教程链接”。
