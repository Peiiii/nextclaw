# v0.19.23 Desktop Mobile Chrome Fix

## 迭代完成说明

- 根因：桌面 host 窄屏时仍由 `DesktopAppShell` 承接外层 shell，聊天内容内部虽然切到 mobile 布局，但全局 `MobileAppShell` 的 topbar / bottom nav 没有挂载；macOS `hiddenInset` titlebar 下，窄屏移动头部也没有给系统 traffic lights 预留左侧安全距。
- 确认方式：对比 `AppLayout` 的桌面 host 分支、`MobileAppShell` 的移动 chrome，以及 `ChatPageLayout` 内部 mobile 切换后确认问题出在 shell owner，而不是单个搜索栏或底部导航样式。
- 修复：macOS 桌面窄屏走 `MobileAppShell` 并注入 topbar 左侧安全距；Windows 桌面窄屏继续保留 `DesktopWindowChrome`，同时由 `DesktopAppShell` 补齐 `MobileBottomNav`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui exec eslint src/platforms/desktop/components/desktop-app-shell.tsx src/platforms/mobile/components/mobile-topbar.tsx src/platforms/mobile/components/mobile-app-shell.tsx src/platforms/mobile/index.ts src/app/components/layout/app-layout.tsx src/app/hooks/use-viewport-layout.ts src/platforms/desktop/components/desktop-app-shell.test.tsx src/app/components/layout/app-layout.test.tsx src/platforms/mobile/components/mobile-app-shell.test.tsx`
- `pnpm --filter @nextclaw/ui test -- src/platforms/desktop/components/desktop-app-shell.test.tsx src/app/components/layout/app-layout.test.tsx src/platforms/mobile/components/mobile-app-shell.test.tsx`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- Playwright 窄宽冒烟：`420x700` 下分别打开 `?nextclawDesktopPlatform=darwin` 与 `?nextclawDesktopPlatform=win32`，确认 `mobile-bottom-nav` 位于 viewport 底部可见，macOS topbar 内容左侧 padding 为 `88px`，Windows 保留 `desktop-window-chrome`。
- 已知无关阻塞：`pnpm --filter @nextclaw/ui lint` 仍被既有无关错误阻塞，包括未使用 import、历史 `import()` type annotation 与既有 React refs 规则问题；本次触达文件 targeted ESLint 已通过。

## 发布/部署方式

- 未执行发布或部署。
- 本次为桌面 UI shell bugfix，需随下一次 UI / desktop 版本发布进入用户安装包。

## 用户/产品视角的验收步骤

- 在 macOS 桌面端把窗口收窄到移动断点，聊天根页顶部搜索区域不再与系统窗口按钮重叠，底部导航可见。
- 在 Windows 桌面端把窗口收窄到移动断点，自定义 titlebar 仍可见，底部导航可见。
- 在普通浏览器移动宽度下，原有底部导航与移动 topbar 行为保持不变。

## 可维护性总结汇总

- 已使用 `post-edit-maintainability-guard` 与主观复核。
- 非测试代码净增为负；本次通过删除桌面 shell 的单用 style helper、移除 `useViewportLayout` 未使用的 `mode` 返回，以及复用移动平台公共出口，抵消了 bugfix 所需新增路径。
- owner 边界保持在 `AppLayout` / `DesktopAppShell` / `MobileAppShell`，没有把平台判断散落到聊天搜索栏或导航项内部。

## NPM 包发布记录

不涉及 NPM 包发布。
