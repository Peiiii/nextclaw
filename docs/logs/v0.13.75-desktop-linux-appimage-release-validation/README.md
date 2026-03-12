# v0.13.75-desktop-linux-appimage-release-validation

## 迭代完成说明（改了什么）
- 为 Desktop 发布链路新增 Linux（x64）产物支持，发布格式为 `AppImage`。
- 新增 Linux 冒烟脚本：`apps/desktop/scripts/smoke-linux-appimage.sh`。
  - 通过 `--appimage-extract` 提取产物。
  - 使用 `ELECTRON_RUN_AS_NODE` 调用内置 `nextclaw` CLI 完成 `init + serve`。
  - 对 `/api/health` 做可用性探测并超时失败。
- 更新 `desktop-release` 工作流：
  - 新增 `ubuntu-latest` 的 `linux/x64` 矩阵任务。
  - 构建 `AppImage` 后统一标准化产物名为 `NextClaw.Desktop-<version>-linux-x64.AppImage`。
  - 执行 Linux 冒烟并上传 Linux 冒烟日志与 AppImage 资产。
  - Release 资产上传范围增加 `*.AppImage` 与 `*.AppImage.blockmap`。
- 更新 `desktop-validate` 工作流：新增 `desktop-linux-appimage-smoke` 作业，覆盖 Linux 构建与冒烟。
- 更新本地打包/校验脚本：
  - `scripts/desktop-package-build.mjs` 新增 Linux AppImage 打包分支。
  - `scripts/desktop-package-verify.mjs` 新增 Linux AppImage 校验分支。
- 更新 landing 下载页（中英）：
  - 新增 Linux（x64）下载入口（AppImage）。
  - 增加 Linux 首次打开教程。
  - 设备识别支持 Linux 自动推荐。
  - 下载页 SEO 文案与结构化数据更新为 macOS + Windows + Linux。

## 测试/验证/验收方式
- 本地语法与构建验证：
  - `bash -n apps/desktop/scripts/smoke-linux-appimage.sh`
  - `node --check scripts/desktop-package-build.mjs`
  - `node --check scripts/desktop-package-verify.mjs`
  - `pnpm -C apps/desktop tsc`
  - `pnpm -C apps/landing build`
- 发布链路验证（需执行）：
  - 触发 `desktop-release`，确认 `desktop-linux-x64` job 构建 + 冒烟通过。
  - 确认 Release 资产包含 `NextClaw.Desktop-<version>-linux-x64.AppImage`。
  - 下载 Release 的 Linux AppImage，执行最小可用性验证（`chmod +x` 后可启动或可完成脚本化健康检查）。

## 发布/部署方式
- 桌面版：
  - 创建/更新 release tag（示例：`v0.9.21-desktop.10`）。
  - 触发 `desktop-release` workflow 并等待全部平台 job 完成。
  - 检查 Release 资产列表包含 macOS arm64/x64、Windows x64、Linux x64 AppImage。
- 官网下载页：
  - `pnpm deploy:landing` 发布 landing。
  - 上线后验证 `/en/download/` 与 `/zh/download/` 可见 Linux 入口与教程。

## 用户/产品视角的验收步骤
1. 打开官网下载页，确认出现 Linux（x64）下载卡片与 AppImage 按钮。
2. Linux 用户下载 AppImage 后执行：
   - `chmod +x NextClaw.Desktop-<version>-linux-x64.AppImage`
   - `./NextClaw.Desktop-<version>-linux-x64.AppImage`
3. 首次启动后可进入 Desktop UI（或通过冒烟流程验证 `api/health` 可达）。
4. macOS、Windows 入口仍可正常下载且不回归。
