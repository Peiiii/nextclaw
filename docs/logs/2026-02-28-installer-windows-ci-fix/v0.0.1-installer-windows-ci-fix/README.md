# v0.0.1-installer-windows-ci-fix

## 迭代完成说明（改了什么）

- 修复并加固 Windows 安装器构建链路：
  - `scripts/installer/build-installer.mjs` 新增 `makensis` 定位兜底逻辑，按顺序尝试 `PATH`、`C:\\Program Files (x86)\\NSIS\\makensis.exe`、`C:\\Program Files\\NSIS\\makensis.exe` 以及 Chocolatey 常见目录。
  - 找不到 `makensis` 时抛出明确错误并打印当前 `PATH`，避免“静默失败”。
  - NSIS 参数 `APP_NAME` 改为无空格值（`NextClaw-Beta`），避免 Windows 下参数分词差异导致编译失败。
  - 对 `--package-spec=nextclaw@x.y.z` 的版本读取改为优先本地解析，并优先从 npm registry tarball URL 直接下载包，绕开 Windows runner 上 `npm view / npm pack` 的非确定性失败。
  - Windows 默认临时目录前缀从 `nci-` 改为 `zci-`，规避路径中 `\\n` 片段对 npm 命令参数解析的潜在干扰。
- 改造 CI 工作流 `.github/workflows/installer-build.yml`：
  - Windows 安装 NSIS 后记录 `makensis` 路径状态（PATH 命中或绝对路径候选），不再因 PATH 未刷新而提前失败。
  - Windows 构建步骤改为 `continue-on-error: true` + 日志落盘（`build-installer-windows.log`），失败时也会上传日志 artifact。
  - Windows 产物上传仅在 `steps.build_windows.outcome == success` 时执行，避免构建失败后上传空产物。
  - 增加失败收敛步骤：`steps.build_windows.outcome == failure` 时显式 fail job，并提示查看上传日志。

关键文件：

- `.github/workflows/installer-build.yml`
- `scripts/installer/build-installer.mjs`

## 测试 / 验证 / 验收方式

基础验证（按规则执行）：

- `PATH=/opt/homebrew/bin:$PATH pnpm build`
- `PATH=/opt/homebrew/bin:$PATH pnpm lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm tsc`

冒烟验证（可运行链路）：

- `PATH=/opt/homebrew/bin:$PATH node scripts/installer/build-installer.mjs --platform=darwin --arch=arm64 --package-spec=nextclaw@0.8.41 --output-dir=dist/installers`
- 观察点：成功生成 `dist/installers/NextClaw-0.8.41-beta-macos-arm64-installer.pkg`，体积约 `67.3 MB`。

CI 验收（线上）：

1. 推送包含上述修复的 tag（`v*`）。
2. 确认 `installer-build` 的四个矩阵任务都完成。
3. 若 Windows 失败，下载 `nextclaw-installer-build-log-win32-<arch>` 定位原因。
4. 四端都成功时，确认 Release Assets 包含 2 个 `.pkg` + 2 个 `.exe`。

## 发布 / 部署方式

1. 提交并推送修复代码。
2. 推送新的版本 tag（`v*`）触发自动构建。
3. 工作流自动将安装包上传到对应 GitHub Release 的 Assets。
4. 若仅补传历史版本，可用 `workflow_dispatch` 并填写 `release_tag`。

本次不涉及后端/数据库变更：

- 远程 migration：不适用（无后端或数据库 schema 变更）。

## 用户 / 产品视角的验收步骤

1. 打开目标版本的 GitHub Release 页面。
2. 在 `Assets` 中看到以下文件：
   - `NextClaw-<version>-beta-macos-arm64-installer.pkg`
   - `NextClaw-<version>-beta-macos-x64-installer.pkg`
   - `NextClaw-<version>-beta-windows-x64-installer.exe`
   - `NextClaw-<version>-beta-windows-arm64-installer.exe`
3. 用户下载与系统匹配的安装包并完成安装。
4. 启动 `Start NextClaw`，浏览器自动打开 `http://127.0.0.1:18791`。
5. 在 UI 内完成最小配置并发送消息，确认可用。
