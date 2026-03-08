# Iteration v0.12.40-desktop-windows-auto-validation

## 迭代完成说明（改了什么）
- 新增 GitHub Actions 工作流 `.github/workflows/desktop-validate.yml`，在 `push/pull_request/workflow_dispatch` 下自动执行桌面端验证。
- 自动验证覆盖两条链路：
  - Linux 侧桌面运行时基础校验：`lint + tsc + smoke`。
  - Windows 侧完整安装器校验：构建 `nextclaw-ui`/`nextclaw`、打包 Desktop NSIS 安装器并执行真实安装烟测。
- 修复 `apps/desktop/scripts/smoke-windows-installer.ps1`：
  - 避免使用 PowerShell 只读自动变量 `$PID/$pid` 作为循环变量，消除脚本直接失败问题。
  - 增加临时目录回退策略（`RUNNER_TEMP -> TEMP -> TMP -> 系统临时目录`）。
  - 增强端口探测：默认端口 + 环境变量端口 + `Get-NetTCPConnection` 动态端口，降低 Windows 烟测误判概率。
- 修复 `.github/workflows/installer-build.yml` 的矩阵配置，补齐 Windows（`win32-x64`、`win32-arm64`）构建任务，避免 Windows 流程长期未执行。

## 测试/验证/验收方式
- 本地已执行：
  - `pnpm -C apps/desktop lint`
  - `pnpm -C apps/desktop tsc`
  - `pnpm -C apps/desktop build`
  - `pnpm -C apps/desktop smoke`
- 预期 CI 验证：
  - `desktop-validate` 工作流在 PR/Push 自动运行。
  - Windows Job 产出安装器并执行 `apps/desktop/scripts/smoke-windows-installer.ps1`。
  - 失败时保留 smoke logs 和安装器产物以便定位。

## 发布/部署方式
- 本次为 CI 与脚本增强，无需单独部署服务。
- 合并到目标分支后，GitHub Actions 将按触发条件自动执行桌面端验证。

## 用户/产品视角的验收步骤
- 提交一个包含桌面端改动的 PR（例如修改 `apps/desktop/**`）。
- 在 GitHub Actions 中确认 `desktop-validate` 自动触发。
- 确认两个 Job 均通过：
  - `desktop-runtime-smoke`
  - `desktop-windows-installer-smoke`
- 打开 Windows Job 的产物，确认可下载：
  - `desktop-validate-smoke-logs-win32-x64`
  - `desktop-validate-win32-x64`
