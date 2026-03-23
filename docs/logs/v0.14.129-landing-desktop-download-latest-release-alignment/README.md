# v0.14.129 Landing Desktop Download Latest Release Alignment

## 迭代完成说明（改了什么）
- 更新 landing 页桌面下载兜底元数据：
  - 将 [`apps/landing/src/main.ts`](/Users/peiwang/Projects/nextbot/apps/landing/src/main.ts) 中的 `DESKTOP_RELEASE_FALLBACK` 从旧正式版 `v0.9.21-desktop.10 / 0.0.27` 切换到当前最新正式版 `v0.13.24-desktop.5 / 0.0.60`。
  - macOS Intel 兜底下载地址同步改为显式 `-x64` 命名的 `NextClaw.Desktop-0.0.60-x64.dmg`。
  - macOS arm64、Windows x64、Linux x64 的兜底地址也全部切到 `v0.13.24-desktop.5`。
- 更新四个 landing HTML 的结构化 `downloadUrl`：
  - [`apps/landing/en/index.html`](/Users/peiwang/Projects/nextbot/apps/landing/en/index.html)
  - [`apps/landing/en/download/index.html`](/Users/peiwang/Projects/nextbot/apps/landing/en/download/index.html)
  - [`apps/landing/zh/index.html`](/Users/peiwang/Projects/nextbot/apps/landing/zh/index.html)
  - [`apps/landing/zh/download/index.html`](/Users/peiwang/Projects/nextbot/apps/landing/zh/download/index.html)
  - 统一指向最新正式 Desktop release：`v0.13.24-desktop.5`
- 发布提交验证：
  - 通过 GitHub API 校验 `releases/latest` 当前返回：
    - release tag：`v0.13.24-desktop.5`
    - release 页面：`https://github.com/Peiiii/nextclaw/releases/tag/v0.13.24-desktop.5`
    - release notes 中声明的发布提交：`0a1832bf`
  - 并确认最新正式 release 资产列表已包含：
    - `NextClaw.Desktop-0.0.60-arm64.dmg`
    - `NextClaw.Desktop-0.0.60-x64.dmg`
    - `NextClaw.Desktop-win32-x64-unpacked.zip`
    - `NextClaw.Desktop-0.0.60-linux-x64.AppImage`

## 测试/验证/验收方式
- 落地页源码验证：
  - `rg -n "v0\\.13\\.24-desktop\\.5|0\\.0\\.60-x64|0\\.0\\.60-arm64|0\\.0\\.60-linux-x64" apps/landing/src/main.ts apps/landing/en/index.html apps/landing/en/download/index.html apps/landing/zh/index.html apps/landing/zh/download/index.html -S`
  - 结果：命中最新正式版 tag 与对应四平台下载地址。
- Build 验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/landing build`
  - 结果：通过，生成 `dist/en/index.html`、`dist/en/download/index.html`、`dist/zh/index.html`、`dist/zh/download/index.html`。
- 发布提交验证：
  - 使用 GitHub API 校验 `https://api.github.com/repos/Peiiii/nextclaw/releases/latest`
  - 结果：
    - `tag_name = v0.13.24-desktop.5`
    - `prerelease = false`
    - `body_commit = 0a1832bf`
    - 资产列表与 landing fallback 指向一致
- 冒烟/上线验证：
  - 部署后访问落地页首页与下载页，检查 release 链接、默认版本号与四平台下载按钮是否都指向 `v0.13.24-desktop.5`。

## 发布/部署方式
- 代码发布：
  - 合并当前改动后执行 `pnpm deploy:landing`，将最新 landing 发布到 Cloudflare Pages。
- 本次变更不涉及桌面二进制重发、不涉及 npm publish、不涉及数据库 migration。

## 用户/产品视角的验收步骤
1. 打开 landing 首页和下载页，确认“Current desktop version”或对应中文版本号显示为 `0.0.60`。
2. 点击“Release / GitHub Release”链接，确认跳转到 `v0.13.24-desktop.5`。
3. 在 macOS Intel 设备或对应下载卡片中，确认下载链接为 `NextClaw.Desktop-0.0.60-x64.dmg`，不再指向旧的无后缀 Intel 包。
4. 在 macOS Apple Silicon、Windows、Linux 的下载卡片中，确认也都指向 `v0.13.24-desktop.5` 的对应正式资产。
5. 若浏览器未拿到 GitHub API 动态数据，仍应因为 fallback 已更新而下载到最新正式版，而不是旧版 `0.0.27`。
