# Windows Installer Dual-Track Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不移除现有 `win-unpacked.zip` Windows 分发链路的前提下，新增一个无签名但正式可安装的 `Setup.exe` 安装器交付面，并为两条链路分别补齐真实验证。

**Architecture:** 继续以 `electron-builder` 为唯一打包引擎，不新增独立 installer pipeline。Windows 保留当前 `dir -> win-unpacked -> zip` 链路作为便携/兼容/排障路径，同时新增 `nsis -> Setup.exe` 链路作为面向普通用户的正式安装入口。CI 与 release workflow 采用双轨构建、双轨烟测、双轨上传，避免“新增安装器”对既有 zip 交付面造成破坏。

**Tech Stack:** Electron, electron-builder, NSIS, GitHub Actions, PowerShell smoke scripts, existing desktop bundle/update manifest contract

---

### Task 1: 写清并存发布策略与交付边界

**Files:**
- Create: `docs/plans/2026-04-18-windows-installer-dual-track-plan.md`
- Modify: `apps/desktop/README.md`
- Modify: `docs/internal/desktop-install-unsigned.md`

**Step 1: 定义双轨目标**

- 明确 `Setup.exe` 是主推荐下载路径。
- 明确 `win-unpacked.zip` 继续保留，不做删除或降级为内部产物。
- 明确无签名状态下的预期用户体验：可安装，但可能弹出 SmartScreen / 未知发布者。

**Step 2: 补齐用户文案**

- 外部文档写成：
  - 推荐：`Setup.exe`
  - 备用：`zip portable`
- 内部文档写成：
  - 如何放行 unsigned installer
  - 如何验证 installer 与 zip 两条路径

**Step 3: 验证文档边界**

Run: `rg -n "win-unpacked|Setup.exe|NSIS|SmartScreen" apps/desktop/README.md docs/internal/desktop-install-unsigned.md`
Expected: 文档同时覆盖 installer 与 zip，不再只剩单一路径。

### Task 2: 在桌面打包配置中新增 installer，但不替换 zip

**Files:**
- Modify: `apps/desktop/package.json`

**Step 1: 保持现有 Windows target 不破坏**

- 不移除现有 `win.target = nsis` 基础能力。
- 新增 `artifactName` 与 `nsis` 配置，让安装器具备更正式的文件名与安装体验。

**Step 2: 增加正式安装体验配置**

- `oneClick: false`
- `allowToChangeInstallationDirectory: true`
- `createDesktopShortcut: true`
- `createStartMenuShortcut: true`
- 图标和卸载名称对齐 `NextClaw Desktop`

**Step 3: 验证 package.json**

Run: `node -e "JSON.parse(require('node:fs').readFileSync('apps/desktop/package.json','utf8')); console.log('apps/desktop/package.json ok')"`
Expected: `apps/desktop/package.json ok`

### Task 3: 为 installer 新增独立烟测脚本

**Files:**
- Create: `apps/desktop/scripts/smoke-windows-installer.ps1`
- Reuse: `apps/desktop/scripts/smoke-windows-desktop.ps1`

**Step 1: 新脚本只负责安装器生命周期**

- 输入：`-InstallerPath`
- 行为：
  - 静默安装 `Setup.exe`
  - 定位安装后的 `NextClaw Desktop.exe`
  - 复用已有桌面启动烟测
  - 最后静默卸载，保持 runner 干净

**Step 2: 不复制已有桌面启动逻辑**

- 不重新实现 `/api/health` 轮询。
- 安装器脚本只负责“安装 / 卸载 / 调用已存在 smoke”。

**Step 3: 做脚本语法检查**

Run: `pwsh -NoProfile -Command "& { [ScriptBlock]::Create((Get-Content -Raw 'apps/desktop/scripts/smoke-windows-installer.ps1')) > $null; 'ok' }"`
Expected: `ok`

### Task 4: 扩展本地 desktop package build / verify 脚本到双轨模式

**Files:**
- Modify: `scripts/desktop/desktop-package-build.mjs`
- Modify: `scripts/desktop/desktop-package-verify.mjs`

**Step 1: build 脚本支持“同时看见两类 Windows 产物”**

- 保留现有 `dir` 构建输出与 zip 说明。
- 额外增加 installer 构建模式或让脚本能打印 installer 产物。
- 不要把现有 zip 分支改没。

**Step 2: verify 脚本扩展到 installer 验证**

- 保留当前 Windows EXE 校验能力。
- 追加 installer 校验，或明确脚本在 Windows 上可同时验证两种路径。

**Step 3: 语法校验**

Run:
- `node --check scripts/desktop/desktop-package-build.mjs`
- `node --check scripts/desktop/desktop-package-verify.mjs`
Expected: 两个脚本都通过。

### Task 5: 扩展 desktop-validate 为双轨 Windows 验证

**Files:**
- Modify: `.github/workflows/desktop-validate.yml`

**Step 1: 保留现有 `desktop-windows-exe-smoke`**

- 构建 `--win dir`
- 冒烟 `win-unpacked/NextClaw Desktop.exe`
- 上传 `win-unpacked/**`

**Step 2: 新增 `desktop-windows-installer-smoke`**

- 构建 `--win nsis`
- 冒烟 `smoke-windows-installer.ps1`
- 上传 `*Setup*.exe`、`latest.yml`、`*.exe.blockmap`

**Step 3: 校验 workflow**

Run: `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/desktop-validate.yml"); puts "desktop-validate yaml ok"'`
Expected: `desktop-validate yaml ok`

### Task 6: 扩展 desktop-release 为双轨 Windows 发布

**Files:**
- Modify: `.github/workflows/desktop-release.yml`

**Step 1: 保留旧 release 产物**

- 继续构建 `--win dir`
- 继续手工归档 `win-unpacked.zip`
- 继续上传 zip 给 GitHub Release

**Step 2: 新增 installer release 产物**

- 额外构建 `--win nsis`
- 冒烟 `Setup.exe`
- 上传 `Setup.exe`、`latest.yml`、`*.exe.blockmap`

**Step 3: 发布资产同时包含两类 Windows 包**

- `NextClaw.Desktop-<version>-win32-x64-unpacked.zip`
- `NextClaw.Desktop-Setup-<version>-x64.exe`

**Step 4: workflow 校验**

Run: `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/desktop-release.yml"); puts "desktop-release yaml ok"'`
Expected: `desktop-release yaml ok`

### Task 7: 做最小充分验证并补迭代留痕

**Files:**
- Create: `docs/logs/v0.16.56-windows-installer-dual-track-release/README.md`

**Step 1: 运行静态验证**

Run:
- `node -e "JSON.parse(require('node:fs').readFileSync('apps/desktop/package.json','utf8')); console.log('apps/desktop/package.json ok')"`
- `node --check scripts/desktop/desktop-package-build.mjs`
- `node --check scripts/desktop/desktop-package-verify.mjs`
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/desktop-validate.yml"); YAML.load_file(".github/workflows/desktop-release.yml"); puts "workflow yaml ok"'`

**Step 2: 运行治理验证**

Run:
- `pnpm check:governance-backlog-ratchet`
- `pnpm lint:maintainability:guard`

Expected:
- 若失败，必须区分是本次触达文件导致，还是工作区其它既有改动导致。

**Step 3: 真实验证缺口说明**

- 若当前机器不是 Windows，明确说明本地无法完成真实 `Setup.exe` 安装冒烟。
- 将最终真实验收门槛落到新增的 Windows GitHub Actions job 上，不得虚报“已经验证通过”。

**Step 4: 迭代 README 必须覆盖**

- 改了什么
- 测试/验证/验收方式
- 发布/部署方式
- 用户/产品视角验收步骤
- 可维护性总结汇总
- NPM 包发布记录

---

## 推荐实施顺序

1. 先写文档，再加 installer 脚本。
2. 再改 package config。
3. 之后改本地 build/verify 脚本。
4. 再改 `desktop-validate`。
5. 最后改 `desktop-release`，避免中途 release 合同失配。

## 关键约束

- 不得删除 `win-unpacked` 相关构建、冒烟、上传链路。
- 不得把 installer 作为唯一 Windows 交付物。
- 不得破坏桌面更新 bundle / manifest / public-key 合同。
- 不得把“静态检查通过”误写成“真实 Windows 安装已通过”。
