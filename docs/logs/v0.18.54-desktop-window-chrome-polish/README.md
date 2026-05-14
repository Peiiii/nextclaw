# v0.18.54 desktop window chrome polish

## 迭代完成说明

- 优化 NextClaw Desktop 窗口 chrome 的第一版试验方案：Windows 使用系统 caption controls + `titleBarOverlay`，让顶栏背景跟随 NextClaw warm / cool 主题；Linux 隐藏默认菜单栏；macOS 保留平台菜单与 traffic lights 习惯。
- 将 BrowserWindow 选项从 `main.ts` 拆入 `desktop-window-options.utils.ts`，避免继续推高 desktop main 入口文件体积。
- 新增 `DesktopShellThemeService`，用很窄的 `warm | cool` IPC contract 接收前端主题变化，并更新 Windows title bar overlay；没有引入自绘窗口按钮或窗口控制 IPC。
- Windows/Linux 不再安装 Electron 默认 `File / Edit / View / Window / Help` 应用菜单，降低桌面壳感；macOS 继续保留平台必要菜单。
- 打包复查发现本地 DMG 从 100 多 MB 飙升到约 700MB 的根因不是窗口 chrome 改动，而是 `nextclaw` production 依赖 `@nextclaw/companion`，间接把 `electron` 带进 desktop app 和 seed runtime bundle。已移除 `nextclaw -> @nextclaw/companion` 依赖，并删除 `nextclaw companion ...` 主 CLI 暴露面；内部自动启动路径在未安装 companion 时降级为提示，不阻塞主 runtime。
- 桌面打包与 runtime update bundle 增加 Electron 嵌套防线：desktop app 和 seed bundle 中若再次出现 `node_modules/electron`，验证脚本会失败，避免同类体积事故回归。

## 测试/验证/验收方式

- `pnpm -C apps/desktop lint`：通过。
- `pnpm -C packages/nextclaw-ui exec eslint src/app/components/theme-provider.tsx src/platforms/desktop/types/desktop-update.types.ts`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths apps/desktop/src/main.ts apps/desktop/src/services/desktop-update-shell.service.ts apps/desktop/src/utils/desktop-window-options.utils.ts`：通过；提示 `main.ts` 仍接近 400 行预算，需要后续持续拆分。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm -C packages/nextclaw-shared build`、`pnpm -C packages/nextclaw-core build`、`pnpm -C packages/nextclaw-kernel build`：通过，用于尝试解除 desktop tsc 的依赖产物阻塞。
- `pnpm -C packages/nextclaw-service tsc`：通过。
- `pnpm -C packages/nextclaw tsc`：通过。
- `docs/USAGE.md` 与 `packages/nextclaw/resources/USAGE.md`：已同步移除 `nextclaw companion ...` 命令说明；本次直接同步两份文档，未额外运行 `sync-usage-resource`。
- `pnpm why @nextclaw/companion --filter nextclaw --prod`：无输出，确认 `nextclaw` production 依赖树不再包含 companion。
- `pnpm why electron --filter nextclaw --prod`：无输出，确认 `nextclaw` production 依赖树不再通过 companion 带入 electron。
- `pnpm --config.node-linker=hoisted --filter nextclaw --prod deploy tmp/nextclaw-deploy-check` 后检查 `node_modules/@nextclaw/companion` 与 `node_modules/electron` 均不存在；部署产物约 198MB。
- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop bundle:seed -- --channel stable`：通过；生成的 seed bundle 约 20MB，zip 内未发现 `bundle/runtime/node_modules/electron` 或 `bundle/runtime/node_modules/@nextclaw/companion`。
- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop exec electron-builder --mac dmg --arm64 --publish never`：通过；新的本地 DMG 约 144MB，`.app` 约 381MB，`app.asar.unpacked` 约 1.1MB。
- `codesign --verify --deep --strict --verbose=2 apps/desktop/release/mac-arm64/NextClaw\ Desktop.app`：通过。
- `bash apps/desktop/scripts/smoke-macos-dmg.sh apps/desktop/release/NextClaw\ Desktop-0.0.162-arm64.dmg 120`：未通过；GUI 与 fallback 均被 macOS system policy 拒绝加载 `ReactiveObjC.framework`，当前判断是本地 unsigned/ad-hoc 签名与 macOS 安全策略问题，独立于本次 companion/electron 体积根因。
- `pnpm -C apps/desktop tsc`：未通过；阻塞在 `packages/nextclaw-kernel/src` 对多个 workspace package 的既有 moduleResolution / 隐式 any 诊断，不是本次触达文件新增错误。
- `pnpm -C packages/nextclaw-ui tsc`：未通过；阻塞在 `packages/nextclaw-agent-chat-ui` 的既有 `@/components/chat/...` alias 解析与隐式 any 诊断，以及 `chat-message-list.container.tsx` 的既有隐式 any 诊断，不是本次触达文件新增错误。

## 发布/部署方式

- 不涉及部署。
- 已生成本地 macOS arm64 DMG 供人工验证：`apps/desktop/release/NextClaw Desktop-0.0.162-arm64.dmg`。
- 不涉及正式桌面安装包发布；由于 DMG smoke 仍被 unsigned/ad-hoc 签名策略挡住，本地包只能作为体积和内容检查通过后的人工验证候选，不能视为可发布构建。

## 用户/产品视角的验收步骤

1. 在 Windows 启动 NextClaw Desktop。
2. 确认默认菜单栏不再显示 `File / Edit / View / Window / Help`。
3. 确认右上角仍是系统窗口控制按钮，而不是应用自绘按钮。
4. 在 warm 主题下确认窗口顶部背景接近 `#F9F8F5`，按钮符号为暖灰；切换到 cool 主题后确认窗口顶部切换到 `#F8FAFB`，按钮符号为冷灰。
5. 确认窗口顶部不再出现突兀黑色系统标题栏。
6. 在 macOS 启动时确认左上角 traffic lights 仍符合平台习惯。
7. 检查新 DMG 体积应回到约 144MB，不再是约 700MB。
8. 若 macOS 双击仍无法启动，优先按 unsigned/ad-hoc 签名与 Gatekeeper 路径继续排查；不要再回到 companion/electron 体积根因。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。第一版把窗口选项直接放入 `main.ts` 后触发文件预算错误，随后拆入专门的 `desktop-window-options.utils.ts`，让 `main.ts` 从 397 行降到 389 行。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。没有自绘标题栏按钮，也没有新增窗口控制 IPC，只新增一个主题同步 IPC；窗口控制继续复用 Electron / OS 平台能力。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到。总生产代码净增来自新增窗口选项 owner 与主题同步 service，但主入口文件体积下降，避免把平台差异和 IPC 细节散落在 `main.ts`。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：是。窗口创建仍由 `DesktopApplication` 调用，平台窗口选项集中在 desktop utils；主题 IPC 由 `DesktopShellThemeService` 拥有；菜单安装逻辑仍由 `DesktopUpdateShellService` 拥有；前端主题变更仍由既有 `ThemeProvider` owner 发起。
- 目录结构与文件组织是否满足当前项目治理要求：满足；新增文件命名和落点通过 governance。
- 是否使用 `post-edit-maintainability-review`：是，收尾阶段完成主观复核；无额外 maintainability finding。
- 本次 follow-up 的正向减债动作：删除错误 production 依赖并增加打包验证防线。相比单纯在 electron-builder 中排除文件，主修复把 `nextclaw` 主 runtime 与 standalone companion shell 的依赖边界重新切开；打包排除和验证只作为防回归措施保留。

## NPM 包发布记录

- 不涉及 NPM 包发布。
