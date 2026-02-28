# v0.0.1-installer-release-assets

## 迭代完成说明（改了什么）

- 调整安装器工作流 `.github/workflows/installer-build.yml`：
  - 触发条件增加 `push tags (v*)`，推送版本 tag 时可自动创建/更新 Release 并上传安装器。
  - 触发条件改为 `release.published`（发布 Release 后自动运行）。
  - `workflow_dispatch` 新增 `release_tag` 输入，支持对已存在 Release 手动补传安装器。
  - 安装器构建改为直接使用 `nextclaw@<version>`（npm registry）作为输入，不再依赖仓库内 `pnpm install + pnpm build`，降低 CI 失败面并显著缩短时长。
- 调整安装器脚本 `scripts/installer/build-installer.mjs`：
  - Windows 默认临时工作目录改为短路径（`C:\nci-<timestamp>`），降低长路径导致的依赖安装失败概率。
  - Windows 解压 Runtime 时优先 `pwsh`，失败再回退 `powershell`，提高 runner 兼容性。
  - 权限改为 `contents: write`，允许写入 Release Assets。
  - 在矩阵任务中新增 `asset_glob`，按平台/架构匹配产物。
  - 新增 `softprops/action-gh-release@v2` 上传步骤，将安装器和 manifest 直接上传到当前 Release。
  - 保留 `upload-artifact`，便于构建失败排查与手动下载。
- 根据当前决策撤回 README 中“桌面安装包”对外展示：
  - `README.md` 恢复为仅 npm 快速开始。
  - `README.zh-CN.md` 恢复为仅 npm 快速开始。

关键文件：

- `.github/workflows/installer-build.yml`
- `README.md`
- `README.zh-CN.md`

## 测试 / 验证 / 验收方式

基础验证（规则要求）：

- `PATH=/opt/homebrew/bin:$PATH pnpm build`
- `PATH=/opt/homebrew/bin:$PATH pnpm lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm tsc`

发布链路验证（线上观察点）：

1. 在 GitHub 创建/发布一个带 tag 的 Release（如 `v0.8.42`）。
2. 确认 `installer-build` workflow 自动触发并完成 4 个矩阵任务。
3. 在该 Release 的 `Assets` 中确认出现：
   - `NextClaw-<version>-beta-macos-arm64-installer.pkg`
   - `NextClaw-<version>-beta-macos-x64-installer.pkg`
   - `NextClaw-<version>-beta-windows-x64-installer.exe`
   - `NextClaw-<version>-beta-windows-arm64-installer.exe`
   - 以及 4 个 `manifest-<platform>-<arch>.json`

## 发布 / 部署方式

1. 推送代码到主分支。
2. 在 GitHub Release 页面发布对应版本（`published`）。
3. 等待 workflow 完成并自动附加安装包到同一 Release。
4. 若历史 Release 缺少安装包，手动触发 workflow 并传入 `release_tag` 回填。
5. 对外仅引用 Release 的 Assets 下载链接。

本次不涉及后端/数据库变更：

- 远程 migration：不适用（无后端或数据库 schema 改动）。

## 用户 / 产品视角的验收步骤

1. 打开版本 Release 页面。
2. 在 `Assets` 里看到 macOS 与 Windows 安装包。
3. 下载对应安装包并安装。
4. 启动 `Start NextClaw`，浏览器自动打开 `http://127.0.0.1:18791`。
5. 在 UI 完成基础配置并发送一条消息确认可用。

## 文档影响检查

- 已更新：
  - `README.md`
  - `README.zh-CN.md`
- `commands/commands.md`：不适用（未新增指令）。
