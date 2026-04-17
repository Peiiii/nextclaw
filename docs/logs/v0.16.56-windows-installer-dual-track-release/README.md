# v0.16.56-windows-installer-dual-track-release

## 迭代完成说明

- 新增 Windows `Setup.exe` 安装器交付路径，同时保留既有 `win-unpacked.zip` 便携分发路径，不再做“installer 替换 zip”。
- 新增方案文档：[Windows Installer Dual-Track Implementation Plan](../../plans/2026-04-18-windows-installer-dual-track-plan.md)。
- 更新 [apps/desktop/package.json](../../../apps/desktop/package.json)：
  - 保持现有 `electron-builder + nsis` Windows target。
  - 新增安装器文件名约定 `NextClaw.Desktop-Setup-<version>-<arch>.exe`。
  - 新增正式安装体验配置：非 one-click、允许改安装目录、创建桌面/开始菜单快捷方式、保留正式卸载项。
- 新增 [apps/desktop/scripts/smoke-windows-installer.ps1](../../../apps/desktop/scripts/smoke-windows-installer.ps1)：
  - 静默安装 `Setup.exe`
  - 定位安装后的 `NextClaw Desktop.exe`
  - 复用既有 [smoke-windows-desktop.ps1](../../../apps/desktop/scripts/smoke-windows-desktop.ps1) 做启动与 `/api/health` 烟测
  - 收尾静默卸载，避免污染 runner
- 更新 [scripts/desktop/desktop-package-build.mjs](../../../scripts/desktop/desktop-package-build.mjs)：
  - Windows 本地打包入口改为同时构建 `dir` 与 `nsis`
  - 本地输出同时展示 `win-unpacked` 和 `Setup.exe`
- 更新 [scripts/desktop/desktop-package-verify.mjs](../../../scripts/desktop/desktop-package-verify.mjs)：
  - Windows 本地校验改为先验 `win-unpacked`，再验 `Setup.exe`
  - 让 `pnpm desktop:package:verify` 在 Windows 平台具备双轨验证能力
- 更新 [desktop-validate.yml](../../../.github/workflows/desktop-validate.yml)：
  - 保留原 `desktop-windows-exe-smoke`
  - 新增 `desktop-windows-installer-smoke`
  - 两条 Windows 路径分别上传自己的产物与 smoke logs
- 更新 [desktop-release.yml](../../../.github/workflows/desktop-release.yml)：
  - 继续构建并上传 `NextClaw.Desktop-<version>-win32-x64-unpacked.zip`
  - 新增构建并上传 `NextClaw.Desktop-Setup-<version>-x64.exe`、`latest.yml`、`*.exe.blockmap`
  - Release 资产层面形成并存双轨
- 更新 [apps/desktop/README.md](../../../apps/desktop/README.md) 与 [docs/internal/desktop-install-unsigned.md](../../../docs/internal/desktop-install-unsigned.md)，统一成“推荐安装器、保留 zip 备用”的说明。

## 测试/验证/验收方式

- 已通过静态校验：
  - `node -e "JSON.parse(require('node:fs').readFileSync('apps/desktop/package.json','utf8')); console.log('apps/desktop/package.json ok')"`
  - `node --check scripts/desktop/desktop-package-build.mjs`
  - `node --check scripts/desktop/desktop-package-verify.mjs`
  - `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/desktop-validate.yml"); YAML.load_file(".github/workflows/desktop-release.yml"); puts "workflow yaml ok"'`
- 已通过桌面端本地校验：
  - `pnpm -C apps/desktop lint`
  - `pnpm -C apps/desktop tsc`
  - `pnpm -C apps/desktop build:main`
- 已通过治理回归：
  - `pnpm check:governance-backlog-ratchet`
- 未通过但确认非本次 installer 改动新增的问题：
  - `pnpm lint:new-code:governance`
    - 失败点来自当前工作区其它既有改动：`packages/nextclaw-core/src/agent/context.ts`、`packages/nextclaw-core/src/config/provider-runtime-resolution.ts`、`packages/nextclaw-core/src/config/schema.ts`、`packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts` 以及若干 Python / fixture 文件命名治理问题，不是本次 Windows installer 双轨改动触达的文件。
  - `pnpm lint:maintainability:guard`
    - 失败点来自当前工作区其它既有改动：`packages/nextclaw-core/src/agent` 目录预算超限、`workers/nextclaw-provider-gateway-api/src` 目录预算超限，不是本次 Windows installer 双轨改动新增的问题。
  - `pnpm desktop:package:verify`
    - 当前在 `bundle:seed` 阶段被仓库已有桌面发布合同问题挡住：`minimum launcher version 0.0.143 does not match the stable channel contract floor 0.0.141`
    - 该失败发生在 [prepare-seed-bundle.service.mjs](../../../apps/desktop/scripts/update/services/prepare-seed-bundle.service.mjs) 既有合同检查，不是本次新增 installer / zip 并存逻辑引入的问题。
- 当前机器上的真实 Windows installer 验证缺口：
  - 本地运行环境不是 Windows，且未安装 `pwsh`，因此无法在本机执行真实 `Setup.exe` 静默安装烟测。
  - 真实安装器验收门槛已经下沉到新增的 GitHub Actions Windows job：`desktop-windows-installer-smoke` 与 `desktop-release` 中的 `Smoke Desktop Installer (Windows)`。

## 发布/部署方式

- 继续沿用现有 [desktop-release.yml](../../../.github/workflows/desktop-release.yml)。
- Windows 平台发布后会同时对外提供两类资产：
  - `NextClaw.Desktop-<version>-win32-x64-unpacked.zip`
  - `NextClaw.Desktop-Setup-<version>-x64.exe`
- 同时保留安装器相关元数据：
  - `latest.yml`
  - `*.exe.blockmap`
- macOS / Linux 的 DMG / AppImage / deb / bundle / manifest / public key 发布合同保持不变。
- 本次不涉及数据库迁移、不涉及服务端部署步骤调整。

## 用户/产品视角的验收步骤

1. 打开 GitHub Release 页面，确认 Windows 资产同时存在：
   - `NextClaw.Desktop-Setup-<version>-x64.exe`
   - `NextClaw.Desktop-<version>-win32-x64-unpacked.zip`
2. 在普通用户路径上，优先下载 `Setup.exe`。
3. 双击安装器，若出现 SmartScreen，点击 `More info -> Run anyway`。
4. 在安装向导中完成安装，确认可从桌面快捷方式或开始菜单启动 `NextClaw Desktop`。
5. 进入主界面后确认应用可交互、首屏可打开。
6. 在兼容/便携场景下，再下载 zip，解压并直接运行 `NextClaw Desktop.exe`，确认也能正常启动。
7. 二次升级时，确认重新运行新的 `Setup.exe` 后不破坏已有核心配置；若走便携路径，替换目录后也可正常运行。

## 可维护性总结汇总

- 可维护性复核结论：通过
- 本次是否已尽最大努力优化可维护性：是
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是
  - 本次没有恢复旧的独立 installer pipeline，而是直接复用现有 `electron-builder + NSIS`。
  - 安装器烟测没有复制一套新的启动检查逻辑，而是把“安装/卸载”与既有 `smoke-windows-desktop.ps1` 组合起来，避免重复实现。
- 长期目标对齐 / 可维护性推进：
  - 这次改动顺着“开箱即用 + 统一入口”的长期方向推进了一小步：Windows 用户终于可以看到更正式的安装界面，而不是被迫先理解压缩包结构。
  - 同时没有破坏旧的便携入口，避免为了追求“看起来更正式”而牺牲兼容性、排障能力和已有用户路径。
- 代码增减报告：
  - 新增：261 行
  - 删除：18 行
  - 净增：+243 行
- 非测试代码增减报告：
  - 新增：261 行
  - 删除：18 行
  - 净增：+243 行
- 若总代码或非测试代码净增长，是否已做到最佳删减、已经删掉或收敛了什么、以及剩余增长为何仍属最小必要：
  - 已做到当前交付边界下的最佳删减。
  - 本次没有新增第二套桌面启动烟测，只新增安装器生命周期包装脚本。
  - 剩余增长主要来自新增一个 Windows installer validate job 与 release 并存 job，这是实现“双轨并存而非替换”不可避免的最小必要成本。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 代码量净增，但增长集中在 workflow 扩展和一个职责单一的新脚本上，没有把复杂度继续塞进已有桌面启动脚本。
  - 文件数只净增一个新的 installer smoke 脚本与一份计划文档，没有恢复额外独立 installer 子系统。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：
  - 是。installer 逻辑被收敛到专门脚本，zip 启动验证仍由既有脚本承接；workflow 只负责编排，不承载具体安装/启动细节。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 本次新增文件位置符合当前治理要求。
  - 当前工作区仍存在与本次无关的历史治理债务入口：`packages/nextclaw-core/src/agent`、`workers/nextclaw-provider-gateway-api/src`，本次未越界处理。
- 独立于实现阶段的主观复核：
  - no maintainability findings
  - 当前剩余风险不是结构失衡，而是需要等待真实 Windows runner 验证 `NSIS /S` 静默安装路径在 CI 环境下稳定通过。

## NPM 包发布记录

- 不涉及 NPM 包发布。
- 原因：本次只改桌面安装器配置、桌面构建/验证脚本、GitHub Actions workflow 与相关文档，没有修改任何需要单独发版的 npm package 对外契约。
