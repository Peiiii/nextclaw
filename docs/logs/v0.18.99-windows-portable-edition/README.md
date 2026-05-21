# v0.18.99 Windows Portable Edition

## 迭代完成说明

本次交付 Windows Portable Edition：release workflow 会产出 `NextClaw-Portable-<version>-win-x64.zip` 和 `NextClaw-Portable-<version>-win-arm64.zip`。Portable 启动时通过 `nextclaw-portable.json` 识别安装形态，数据落在 portable 根目录的 `data/` 下，并与普通安装版共存。

根因/背景：原有 Windows release 只有 installer 和 unpacked 备用包，unpacked 不是严格 portable 合同，运行数据仍可能走安装版默认路径。现在通过 `DesktopInstallationProfile` 把安装形态、路径、更新能力收敛为单一事实源。

## 测试/验证/验收方式

- `pnpm -C apps/desktop tsc`
- `pnpm -C apps/desktop lint`
- `pnpm -C apps/desktop build:main`
- `node --test apps/desktop/dist/src/utils/desktop-installation-profile.utils.test.js apps/desktop/dist/src/launcher/__tests__/update-coordinator.service.test.js`
- `pnpm -r --filter @nextclaw/desktop... build`
- `pnpm -C apps/desktop smoke`
- `pnpm lint:maintainability:guard`
- `ruby -e "require 'yaml'; ..."` 校验 desktop workflow YAML 可解析

Windows x64 portable 的真实启动冒烟由 GitHub Actions `desktop-release` / `desktop-validate` 在 Windows runner 上执行；arm64 portable 在 CI 中验证 zip 结构与 marker。

## 发布/部署方式

通过 GitHub preview release 触发 `.github/workflows/desktop-release.yml`，上传 Windows portable zip 到 release assets。Portable Edition 暂不发布应用内 update channel；用户下载新版 zip 并保留或迁移 `data/` 完成升级。

## 用户/产品视角的验收步骤

1. 从 GitHub beta preview release 下载 `NextClaw-Portable-<version>-win-x64.zip`。
2. 解压到 U 盘或本地任意目录。
3. 双击 `NextClaw-Portable/NextClaw Desktop.exe`。
4. 确认主界面可进入，且目录下生成 `data/desktop`、`data/runtime-home`、`data/logs`。
5. 同时启动普通安装版，确认两者互不覆盖数据。

## 可维护性总结汇总

本次新增抽象控制在一个安装形态 owner：`DesktopInstallationProfile`。它只负责安装形态事实、路径、实例隔离和更新能力，不接管窗口、runtime 或 release 业务。portable package / verify 脚本用于固化 release 合同。已避免把 portable 拆成多个空心 service，也没有为跨包导入新增 alias。

Maintainability guard 已通过。代码增减报告：总计新增 604 行、删除 13 行、净增 591 行；非测试新增 468 行、删除 13 行、净增 455 行。该增长对应新的用户可见能力、Windows release 合同和 CI 验证闭环。保留的债务：`apps/desktop/scripts` 已超目录文件数预算，后续可按 package/smoke/update 三类脚本拆目录。

## NPM 包发布记录

不涉及 NPM 包发布。桌面包版本从 `0.0.173` 提升到 `0.0.174`，用于 GitHub desktop beta preview release 资产命名。
