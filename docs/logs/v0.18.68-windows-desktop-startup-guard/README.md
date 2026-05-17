# Windows Desktop Startup Guard

## 迭代完成说明

- 目标：修复 Windows 桌面版启动时闪出控制台窗口、首次安装后长时间无可见窗口的问题，并把同类问题下沉到发布验证链路。
- 根因：
  - runtime `init` / `serve` 子进程由 Electron GUI 启动时没有设置 `windowsHide: true`，Windows 会短暂显示控制台窗口。
  - launcher 之前等 bundle bootstrap、seed 处理、runtime health 都完成后才创建 `BrowserWindow`，首次启动的慢路径会让用户长期看不到任何窗口。
  - Windows smoke 过去主要接受 `/api/health`，没有把当前 `main.log` 的 `ready-to-show`、`did-finish-load` 和启动 blocker 作为通过条件，因此 CI 可能漏掉“进程活着但窗口体验不可用”的候选包。
- 修复：
  - runtime 子进程 spawn 选项统一包含 `windowsHide: true`，并增加回归测试。
  - Electron `app.whenReady()` 后立即展示轻量 startup shell，再继续 bootstrap runtime；runtime ready 后复用同一个窗口加载真实 UI。
  - Windows desktop / installer smoke 增加 `MaxReadySec`，要求当前启动日志内 20 秒可见窗口就绪，并删除 runtime fallback 作为通过条件的路径。
  - 本地 package verify 与 GitHub desktop validate/release workflow 显式传递 `-MaxReadySec 20`。
- 机制沉淀：
  - `desktop-release-contract-guard` 已补充 Windows GUI smoke、启动 blocker、runtime fallback 禁止通过、`windowsHide` 回归测试要求。

## 测试/验证/验收方式

- 已通过：`pnpm -C apps/desktop tsc`
- 已通过：`pnpm -C apps/desktop build:main && node --test $(find apps/desktop/dist/src -name '*.test.js' | sort)`
- 已通过：`pnpm lint:new-code:governance -- apps/desktop/src/main.ts apps/desktop/src/runtime-service.ts apps/desktop/src/services/runtime-process.service.test.ts apps/desktop/src/utils/desktop-startup-loading.utils.ts apps/desktop/src/utils/desktop-publish-target.utils.ts apps/desktop/scripts/smoke-windows-desktop.ps1 apps/desktop/scripts/smoke-windows-installer.ps1 scripts/desktop/desktop-package-verify.mjs .github/workflows/desktop-release.yml .github/workflows/desktop-validate.yml .agents/skills/desktop-release-contract-guard/SKILL.md`
- 已通过：`pnpm check:governance-backlog-ratchet`
- 已通过：`git diff --check`
- 已通过：Windows PowerShell smoke 脚本的本地静态检查，确认括号平衡、包含 `MaxReadySec`、不再包含 runtime fallback。
- 未在本机完成：真实 Windows GUI smoke。本机是 macOS，最终仍需发布后由 GitHub Windows runner 和用户 Windows 真机验证控制台闪窗与首次启动耗时。

## 发布/部署方式

- 当前代码修复已进入提交与验证闭环；新的 desktop preview beta 需要在提交后由 release tag 触发。
- 由于修复包含 launcher 代码，下一次 Windows 可测包必须重新发布桌面安装器/launcher，不能只发布 runtime update bundle。
- 下一步创建新的 desktop preview beta tag，让 `desktop-release` workflow 产出 Windows 安装器并执行新的 `MaxReadySec` GUI smoke。

## 用户/产品视角的验收步骤

- 在干净 Windows 机器安装新的 preview beta。
- 第一次打开不应出现可见终端/控制台闪窗。
- 打开后 20 秒内必须出现 NextClaw 窗口；理想目标是 10 秒内出现 startup shell。
- 若 runtime 仍在初始化，应先看到 NextClaw startup shell，而不是任务栏长时间弹跳或完全无反馈。
- 主 UI 加载完成后确认 `/api/health` 可达，并继续执行一次真实聊天冒烟。

## 可维护性总结汇总

- 通过 `DesktopApplication.showStartupWindow` 把“先给用户可见窗口”收敛到 launcher owner，没有把延迟掩盖到 renderer。
- 通过 `createRuntimeScriptSpawnOptions` 集中子进程启动选项，避免 `init` / `serve` 各自重复配置。
- 通过 `desktop-publish-target` 与 `desktop-startup-loading` 小工具拆出 main 中的辅助职责，让 `main.ts` 保持在 400 行预算内。
- 已运行 maintainability guard；当前无错误，`apps/desktop/src/main.ts` 仍接近 400 行预算，需要后续继续拆分 launcher orchestration。
- 本次为事故修复与验证补强，生产/脚本代码有必要净增；净增主要来自 Windows smoke 的日志观察点和 startup shell，换来发布门槛可观察化。

## NPM 包发布记录

- 不涉及 NPM 包发布。
- 涉及 desktop preview beta 发布；提交后需要触发 GitHub desktop release，让 Windows runner 执行新的 GUI smoke。
