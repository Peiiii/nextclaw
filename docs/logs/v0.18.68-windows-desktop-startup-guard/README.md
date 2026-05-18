# Windows Desktop Startup Guard

## 迭代完成说明

- 目标：修复 Windows 桌面版启动时闪出控制台窗口、首次安装后长时间无可见窗口的问题，并把同类问题下沉到发布验证链路。
- 根因：
  - runtime `init` / `serve` 子进程由 Electron GUI 启动时没有设置 `windowsHide: true`，Windows 会短暂显示控制台窗口。
  - launcher 之前等 bundle bootstrap、seed 处理、runtime health 都完成后才创建 `BrowserWindow`，首次启动的慢路径会让用户长期看不到任何窗口。
  - Windows smoke 过去主要接受 `/api/health`，没有把当前 `main.log` 的 `ready-to-show`、`did-finish-load` 和启动 blocker 作为通过条件，因此 CI 可能漏掉“进程活着但窗口体验不可用”的候选包。
  - 后续验证发现，上述 smoke 仍把 `data:` startup shell 的窗口事件误判为真实 app ready，导致真实 runtime URL 超过 20 秒才加载也能通过；同时只验 health 端点会漏掉“窗口壳出来但主 UI/API 链路没真正可用”的候选包。
- 修复：
  - runtime 子进程 spawn 选项统一包含 `windowsHide: true`，并增加回归测试。
  - Electron `app.whenReady()` 后立即展示轻量 startup shell，再继续 bootstrap runtime；runtime ready 后复用同一个窗口加载真实 UI。
  - Windows desktop / installer smoke 增加 `MaxReadySec`，要求当前启动日志内 20 秒可见窗口就绪，并删除 runtime fallback 作为通过条件的路径。
  - 本地 package verify 与 GitHub desktop validate/release workflow 显式传递 `-MaxReadySec 20`。
  - 真实 readiness 契约收紧为：当前日志必须出现真实 `http://127.0.0.1:<port>` runtime URL，窗口必须加载这个 URL，且 `/api/health`、`/api/auth/status`、`/api/config`、`/api/ncp/sessions` 必须全部从这个 URL 打通；`data:` startup shell 不再计入成功。
  - 首启路径优先使用包内 runtime 启动，把 seed bundle 安装/替换挪到 runtime 启动后的后台准备；只有包内 runtime 不存在时才回退到同步 seed 安装，避免首次打开被大目录解压或清理阻塞。
  - Electron GUI 到 runtime 的 `init` 子进程被移除，`serve` 直接依赖 runtime 自身懒初始化；相关服务/remote/autostart/launcher 子进程统一补 `windowsHide: true`，避免 Windows 控制台闪窗继续从旁路出现。
- 机制沉淀：
  - `desktop-release-contract-guard` 已补充 Windows GUI smoke、启动 blocker、runtime fallback 禁止通过、`windowsHide` 回归测试要求。
  - `desktop-release-contract-guard` 已追加：startup shell 只能作为感知反馈，不能作为 app readiness；固定默认端口或 stale health 不能作为当前 GUI 启动的通过证据。
  - 2026-05-18 追加根因闭环：真正导致 Windows 首次启动三五分钟量级卡住的核心，不是窗口显示时机，而是 seed/update product bundle 里直接塞了 `pnpm deploy` 产出的 raw `runtime/node_modules` 树。旧 seed zip 约 1.5 万个 entry，其中约 1.49 万个来自 `bundle/runtime/node_modules`；Windows 首启需要解压、替换、清理这棵大目录，放大成 `ENOTEMPTY`、`ENAMETOOLONG` 和长时间无可用 runtime。
  - 2026-05-18 修复：`build-product-bundle.service.mjs` 不再用 raw `pnpm deploy` 作为桌面 seed runtime；改为用 `tsdown` 打包 `packages/nextclaw/src/cli/app/index.ts`，只复制运行时必需资产和 session-search worker 文件，并在构建阶段强制断言 `runtime/node_modules` 不存在、runtime 文件数不超过预算。
  - 2026-05-18 防复发：`desktop:package:verify` 和 `desktop-release-contract-guard` 已把 seed runtime shape 变成发布合同：要求 runtime entry、UI、session-search worker 存在，禁止 `runtime/node_modules`，并打印/检查 runtime file budget。后续再出现上万文件 seed bundle 会在打包验证阶段失败，而不是等 Windows 用户首次打开才暴露。

## 测试/验证/验收方式

- 已通过：`pnpm -C apps/desktop tsc`
- 已通过：`pnpm -C apps/desktop build:main && node --test $(find apps/desktop/dist/src -name '*.test.js' | sort)`
- 已通过：`pnpm -C packages/nextclaw-service tsc`
- 已通过：`pnpm -C packages/nextclaw-service build`
- 已通过：`pnpm -C apps/desktop lint`
- 已通过：`pnpm -C packages/nextclaw-service lint`（0 errors，已有 warning 未扩大）
- 已通过：`pnpm -C packages/nextclaw-service test -- --run src/shared/services/runtime/tests/service-managed-startup.service.test.ts`
- 已通过：`pnpm -C packages/nextclaw-service test -- --run src/launcher/npm-runtime-update.manager.test.ts`
- 已通过：`pnpm lint:new-code:governance -- apps/desktop/src/main.ts apps/desktop/src/runtime-config.ts apps/desktop/src/runtime-service.ts apps/desktop/src/services/runtime.service.test.ts apps/desktop/src/services/desktop-runtime-command.service.ts apps/desktop/src/services/desktop-runtime-command.service.test.ts apps/desktop/scripts/smoke-windows-desktop.ps1 packages/nextclaw-service/src/shared/services/runtime/service-managed-startup.service.ts packages/nextclaw-service/src/shared/services/runtime/tests/service-managed-startup.service.test.ts packages/nextclaw-service/src/shared/services/runtime/runtime-command.service.ts packages/nextclaw-service/src/service-runtime.service.ts packages/nextclaw-service/src/shared/services/ui/companion-runtime.service.ts packages/nextclaw-service/src/shared/utils/cli.utils.ts packages/nextclaw-service/src/commands/service/services/autostart/windows-task-autostart.service.ts packages/nextclaw-service/src/launcher/npm-runtime-launcher.service.ts`
- 已通过：`pnpm check:governance-backlog-ratchet`
- 已通过：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`，非测试代码净增 `-4`
- 已通过：`pnpm desktop:package:verify`，macOS DMG package verify 成功，isolated GUI smoke `4557ms`，日志显示 `Runtime source: packaged-runtime` 与 `Desktop runtime startup finished in 1116ms`
- 已通过：对本地打出的 `.app` 独立执行真实 API probe，当前日志解析 runtime base URL 后 `/api/health`、`/api/auth/status`、`/api/config`、`/api/ncp/sessions` 全部 2xx，真实窗口加载 `http://127.0.0.1:<port>/`，runtime startup `1115ms`
- 已通过：`git diff --check`
- 2026-05-18 root-fix 追加验证：
  - 已通过：`PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify`。seed bundle runtime shape verified：`runtimeFiles=124`，DMG `117.5 MB`，seed bundle `5.0 MB`，GUI smoke `4497ms`，GUI-launched runtime startup `745ms`，真实 runtime URL 的 `/api/health` 通过。
  - 已通过：`pnpm -C apps/desktop bundle:seed -- --channel stable`。最终 seed bundle 构建输出 `runtimeFileCount=124`、`runtimeFileBudget=400`。
  - 已通过：从最终提交用 `apps/desktop/build/update/seed-product-bundle.zip` 解包后直接启动 `node bundle/runtime/dist/cli/app/index.js serve --ui-port 62340`，`/api/health`、`/api/auth/status`、`/api/config`、`/api/ncp/sessions` 全部 2xx；zip entry 数 `235`，runtime 文件数 `124`，无 `bundle/runtime/node_modules`，日志未出现 `ERR_FAILED`、`ENOTEMPTY`、`ENAMETOOLONG`、`Failed to bootstrap runtime`、`Deferred startup failed`、`bundled plugin package not resolvable`。
  - 已通过：`pnpm -C packages/nextclaw-core tsc`、`pnpm -C packages/nextclaw-service tsc`、`pnpm -C packages/nextclaw-openclaw-compat tsc`。
  - 已通过：`pnpm -C packages/nextclaw-core exec vitest run src/features/session-search/worker/session-search-worker.controller.test.ts`。
  - 已通过：`pnpm -C packages/nextclaw-service exec vitest run src/shared/services/extensions/extension-lifecycle.service.test.ts`。
  - 已通过：`pnpm -C packages/nextclaw-core lint`、`pnpm -C packages/nextclaw-service lint`、`pnpm -C packages/nextclaw-openclaw-compat lint`，均为 0 errors；保留既有 warnings。
  - 已通过：`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`node scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`、`git diff --check`。
- 2026-05-18 desktop preview beta.2 远端发布验证：
  - 已通过：GitHub `desktop-release` workflow run `26037994292` 整体成功，包含 `desktop-win32-x64`、`desktop-darwin-arm64`、`desktop-darwin-x64`、`desktop-linux-x64`、`publish-release-assets`、`publish-desktop-update-channels`。
  - 已通过：Windows runner 的 `Smoke Desktop (Windows)` 与 `Smoke Desktop Installer (Windows)` 均成功；这两个 smoke 使用真实 runtime URL 和 API readiness，而不是只接受 startup shell。
  - 已通过：release `v0.19.9-desktop-beta.2` 已上传 `NextClaw.Desktop-Setup-0.0.165-x64.exe`、`NextClaw.Desktop-0.0.165-win32-x64-unpacked.zip`、各平台 manifest、各平台 product bundle 与 `update-bundle-public.pem`。
  - 已通过：发布出的 `nextclaw-bundle-win32-x64-0.19.9.zip` 大小 `5,185,326` bytes，zip entry 数 `233`，`bundle/runtime/` 文件数 `139`，且不存在 `bundle/runtime/node_modules`。
  - 已通过：GitHub Pages beta update channel 的 win32、darwin、linux manifest 均指向 `v0.19.9-desktop-beta.2`，`minimumLauncherVersion` 为 `0.0.143`，并包含 manifest signature。
- 未在本机完成：Windows PowerShell 语法本地静态检查，因为本机没有 `pwsh`/`powershell`；真实 Windows GUI/API smoke 需要发布后由 GitHub Windows runner 执行。
- 未在本机完成：真实 Windows 控制台闪窗视觉验证。本机是 macOS；GitHub Windows runner 已覆盖启动 smoke 与 installer smoke，最终视觉确认仍建议在用户 Windows 真机上执行。

## 发布/部署方式

- 当前代码修复已进入提交与验证闭环；新的 desktop preview beta 需要在提交后由 release tag 触发。
- 由于修复包含 launcher 代码，下一次 Windows 可测包必须重新发布桌面安装器/launcher，不能只发布 runtime update bundle。
- 下一步创建新的 desktop preview beta tag，让 `desktop-release` workflow 产出 Windows 安装器并执行新的 `MaxReadySec` GUI smoke。
- 2026-05-18 root-fix 本轮只提交并 push 到 `master`，不涉及 NPM 发布；后续 desktop preview beta 应基于本提交重新触发，确保 Windows 安装器携带 slim seed bundle。
- 2026-05-18 已发布 desktop preview beta：`v0.19.9-desktop-beta.2`，对应 tag commit `7716dcb574c005361a4555d615946b587a940dd2`，release 地址 `https://github.com/Peiiii/nextclaw/releases/tag/v0.19.9-desktop-beta.2`。该 release 已通过远端 Windows exe smoke、Windows installer smoke、release asset 检查、product bundle shape 检查与 beta update channel manifest 检查。

## 用户/产品视角的验收步骤

- 在干净 Windows 机器安装新的 preview beta。
- 第一次打开不应出现可见终端/控制台闪窗。
- 打开后 20 秒内必须出现 NextClaw 窗口；理想目标是 10 秒内出现 startup shell。
- 若 runtime 仍在初始化，应先看到 NextClaw startup shell，而不是任务栏长时间弹跳或完全无反馈。
- 主 UI 加载完成后确认 `/api/health` 可达，并继续执行一次真实聊天冒烟。
- 追加验收点：安装后的首次启动不应再发生 seed bundle 解压/清理大目录导致的分钟级等待；如果出现问题，应先检查当前 seed zip 是否仍满足 `runtimeFiles <= 400` 且不含 `bundle/runtime/node_modules`。

## 可维护性总结汇总

- 通过 `DesktopApplication.showStartupWindow` 把“先给用户可见窗口”收敛到 launcher owner，没有把延迟掩盖到 renderer。
- 通过 `createRuntimeScriptSpawnOptions` 集中子进程启动选项，避免 `init` / `serve` 各自重复配置。
- 通过 `desktop-publish-target` 与 `desktop-startup-loading` 小工具拆出 main 中的辅助职责，让 `main.ts` 保持在 400 行预算内。
- 已运行 maintainability guard；当前无错误，`apps/desktop/src/main.ts` 仍接近 400 行预算，需要后续继续拆分 launcher orchestration。
- 本次为事故修复与验证补强，生产/脚本代码有必要净增；净增主要来自 Windows smoke 的日志观察点和 startup shell，换来发布门槛可观察化。
- 2026-05-18 root-fix 可维护性补充：本次删除了 seed bundle 的 raw deploy/prune 路线，改为单一 slim runtime bundle owner；新增的 in-process bundled channel plugin loader 是为了让没有 `runtime/node_modules` 的打包产物仍能加载内置 channel 插件。
- 2026-05-18 root-fix maintainability guard 结果：无错误，警告为 `packages/nextclaw-openclaw-compat/src/plugins` 目录仍超预算、`scripts/desktop/desktop-package-verify.mjs` 接近 500 行预算；本次还把 `worker` 作为 feature-local 合法目录纳入 module-structure governance，并给 progressive plugin loader 子模块补局部 contract。

## NPM 包发布记录

- 不涉及 NPM 包发布。
- 涉及 desktop preview beta 发布；提交后需要触发 GitHub desktop release，让 Windows runner 执行新的 GUI smoke。
- 2026-05-18 root-fix：不涉及 NPM 包发布。
