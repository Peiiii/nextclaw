# Desktop 无签名安装内部说明（macOS / Windows）

> 内部文档：仅用于团队验证与问题排查，不对外公开。

## 目的

- 在未签名阶段，统一团队对 macOS / Windows 安装放行步骤的口径。
- 为桌面端可用性验证提供标准操作流程。
- 与 launcher / bundle 解耦相关的长期发布约定，统一参考 [Desktop Launcher / Bundle 治理约定](./desktop-launcher-bundle-governance.md)。

## 安装产物

- macOS（Apple Silicon）：`NextClaw Desktop-<version>-arm64.dmg`
- macOS（Intel）：`NextClaw Desktop-<version>-x64.dmg`
- Windows 安装器：`NextClaw.Desktop-Setup-<version>-x64.exe`
- Windows 备用便携包：`NextClaw.Desktop-<version>-win32-x64-unpacked.zip`

## macOS 验证步骤

1. 双击打开 `.dmg`，拖拽 `NextClaw Desktop.app` 到 `Applications`。
2. 从 `Applications` 里直接双击应用，系统若弹出拦截提示，先点击“完成”关闭提示窗。
3. 打开 `系统设置 -> 隐私与安全性`，在页面底部点击“仍要打开”，按系统提示确认。
4. 回到 `Applications`，再次启动应用；若仍被拦截，再使用右键（Control + 点击）`NextClaw Desktop.app`，选择“打开”。
5. 若提示“已损坏”，执行：

```bash
xattr -cr "/Applications/NextClaw Desktop.app"
open -a "NextClaw Desktop"
```

## Windows 验证步骤

### 路径 A：安装器（推荐）

1. 双击 `NextClaw.Desktop-Setup-<version>-x64.exe`。
2. 若出现 SmartScreen，点击 `More info -> Run anyway`。
3. 在安装向导中点击 `Next`，按需调整安装目录，再点击 `Install`。
4. 安装完成后从安装器完成页、开始菜单或桌面快捷方式启动应用。
5. 验证主界面可正常进入并可交互。

### 路径 B：便携压缩包（备用）

1. 解压 `NextClaw.Desktop-<version>-win32-x64-unpacked.zip`。
2. 打开解压目录，双击 `NextClaw Desktop.exe`。
3. 若出现 SmartScreen，点击 `More info -> Run anyway`。
4. 启动后验证主界面可正常进入并可交互。

## 验收口径（内部）

- 安装器成功：用户无需命令行即可完成安装向导，并获得 `NextClaw Desktop` 的桌面或开始菜单入口。
- 便携包成功：用户无需命令行即可完成解压并看到 `NextClaw Desktop.exe`。
- 首次启动成功：无论通过安装器还是便携包启动，主界面都可打开且可交互。
- 二次启动成功：关闭后再次双击仍可正常使用。
- 升级成功：再次运行新的 `Setup.exe` 或替换新的便携目录后，仍可正常启动并保留核心配置。
