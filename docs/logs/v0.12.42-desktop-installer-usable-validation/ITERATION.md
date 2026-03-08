# Iteration v0.12.42-desktop-installer-usable-validation

## 迭代完成说明（改了什么）
- 将桌面端自动验证的验收标准明确为“可安装 + 安装后可用”，覆盖 Windows 与 macOS 两条真实用户安装路径。
- 新增 macOS DMG 安装烟测脚本：`apps/desktop/scripts/smoke-macos-dmg.sh`。
  - 自动挂载 DMG。
  - 从 DMG 拷贝 `.app`（模拟用户安装）。
  - 启动安装后的 app 并轮询 `/api/health`，验证功能可用。
  - 自动清理进程树与挂载点，支持重试。
- 调整 `.github/workflows/desktop-validate.yml`：
  - 新增 `desktop-macos-dmg-install-smoke`：构建 DMG 后执行 macOS 安装可用性烟测。
  - Windows Job 改回安装器链路：构建 NSIS 安装器并执行 `smoke-windows-installer.ps1`。
  - 两平台均上传 smoke logs 与安装产物。
- 调整 `.github/workflows/desktop-release.yml`：
  - macOS 构建后新增 DMG 安装可用性烟测，确保 release 产物可安装可用再上传。
  - 新增 macOS smoke logs 上传。

## 测试/验证/验收方式
- 本地已执行并通过：
  - `pnpm -C packages/nextclaw-ui build`
  - `pnpm -C packages/nextclaw build`
  - `pnpm -C apps/desktop lint`
  - `pnpm -C apps/desktop tsc`
  - `CSC_IDENTITY_AUTO_DISCOVERY=false pnpm -C apps/desktop exec electron-builder --mac dmg --arm64 --publish never`
  - `apps/desktop/scripts/smoke-macos-dmg.sh <生成的dmg> 120`（通过，health check passed）
- 结构校验：
  - `bash -n apps/desktop/scripts/smoke-macos-dmg.sh`
  - workflow YAML 解析通过（`desktop-validate.yml`、`desktop-release.yml`、`installer-build.yml`）。

## 发布/部署方式
- 本次改动为桌面 CI 验证机制升级，无需单独服务部署。
- 合并后，桌面相关 PR/Push 将自动执行“安装后可用”验证。

## 用户/产品视角的验收步骤
- 提交任意桌面端相关 PR。
- 在 GitHub Actions 确认以下 Job 通过：
  - `desktop-macos-dmg-install-smoke`
  - `desktop-windows-installer-install-smoke`
- 查看 artifacts：
  - `desktop-validate-macos-arm64`（含 DMG）
  - `desktop-validate-win32-x64`（含 Setup 安装器）
  - 对应 `desktop-validate-smoke-logs-*`
- 对 release 工作流：确认 macOS/Windows 在 smoke 步骤通过后再上传发布资产。
