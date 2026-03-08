# Iteration v0.12.41-desktop-exe-validation-first

## 迭代完成说明（改了什么）
- 按“桌面端本体优先”调整自动验证策略：Windows 验证从“安装器优先”改为“桌面 exe 优先”。
- 新增脚本 `apps/desktop/scripts/smoke-windows-desktop.ps1`，直接对 `NextClaw Desktop.exe` 做启动与 `/api/health` 健康检查。
- 更新 `desktop-validate` 工作流：
  - Windows 构建改为 `electron-builder --win dir --x64 --publish never`，生成 `win-unpacked` 桌面可执行目录。
  - 烟测改为执行 `smoke-windows-desktop.ps1`，不再依赖安装器路径。
  - 上传产物改为 `win-unpacked` 目录，便于回溯桌面本体行为。

## 测试/验证/验收方式
- 本地已执行：
  - `pnpm -C apps/desktop lint`
  - `pnpm -C apps/desktop tsc`
  - `pnpm -C apps/desktop smoke`
- 结构校验已执行：
  - `.github/workflows/desktop-validate.yml` YAML 语法解析通过。
- CI 预期：
  - `desktop-windows-exe-smoke` 在 Windows Runner 上构建 `win-unpacked` 并完成桌面 exe 启动烟测。

## 发布/部署方式
- 本次仅调整 CI 自动验证与烟测脚本，无需额外服务部署。
- 合并后自动生效于桌面相关 PR/Push。

## 用户/产品视角的验收步骤
- 提交包含桌面改动的 PR。
- 在 GitHub Actions 查看 `desktop-validate`。
- 确认 `desktop-windows-exe-smoke` 通过。
- 下载 `desktop-validate-win32-x64-unpacked` 产物，确认存在 `NextClaw Desktop.exe` 及运行目录。
