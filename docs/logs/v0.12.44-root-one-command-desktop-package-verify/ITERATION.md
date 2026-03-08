# Iteration v0.12.44-root-one-command-desktop-package-verify

## 迭代完成说明（改了什么）
- 在仓库根目录新增一键命令入口：`pnpm desktop:package:verify`。
- 新增脚本 `scripts/desktop-package-verify.mjs`，按当前操作系统自动执行“桌面打包 + 安装后可用性验证”：
  - macOS：构建 DMG（按当前架构）→ 调用 `apps/desktop/scripts/smoke-macos-dmg.sh` 做安装后健康检查。
  - Windows：构建 NSIS 安装器（按当前架构）→ 调用 `apps/desktop/scripts/smoke-windows-installer.ps1` 做安装后健康检查。
- 根 `package.json` 新增脚本项：`desktop:package:verify`。

## 测试/验证/验收方式
- 本地执行：
  - `pnpm desktop:package:verify`
- 预期结果：
  - macOS 输出 `macOS package verified: <dmg path>`。
  - Windows 输出 `Windows package verified: <setup exe path>`。
- 失败时行为：
  - 命令返回非 0，直接暴露失败步骤（构建或烟测）。

## 发布/部署方式
- 本次为本地开发/CI 验证入口增强，无需额外部署。
- 合并后，团队成员可在根目录统一使用一条 `pnpm` 命令执行桌面端打包验收。

## 用户/产品视角的验收步骤
- 在仓库根目录执行：`pnpm desktop:package:verify`。
- 等待命令自动完成：
  - 打包产物生成到 `apps/desktop/release`。
  - 自动执行安装后可用性验证。
- 观察命令最终状态：
  - 成功：代表当前平台桌面安装包可安装且可用。
  - 失败：按终端报错定位具体失败环节。
