# v0.19.16 Windows Desktop Window Controls State

## 迭代完成说明

- 修复 Windows 自绘标题栏最大化按钮不会随窗口状态切换的问题。
- 根因：渲染层的 `DesktopWindowChrome` 使用静态按钮配置，`toggle-maximize` 永远绑定同一个 maximize 图标和 `Maximize` label；主进程只执行 `BrowserWindow` 动作，没有把 `isMaximized()` 状态暴露给 preload / UI。
- 确认方式：检查 `DesktopWindowControlService`、`preload` bridge 与 `DesktopWindowChrome` 后确认没有 window state 查询或订阅链路。
- 修复方式：主进程新增窗口状态查询与 `maximize` / `unmaximize` 事件通知，preload 暴露 `getWindowState` 与 `onWindowStateChanged`，UI 根据 `isMaximized` 在 maximize / restore 图标和 label 之间切换。
- 同批次减债：删除上一轮 Windows titlebar 排查留下的常驻 renderer debug 注入，只保留 release smoke 仍需要的 titlebar hit-test 探针。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C apps/desktop tsc`：通过。
- `pnpm -C packages/nextclaw-ui test -- src/platforms/desktop/components/desktop-app-shell.test.tsx`：通过，覆盖 maximized 后按钮切换为 `Restore`。
- `pnpm -C packages/nextclaw-ui build`：通过。
- `pnpm -C apps/desktop build:main`：通过。
- `pnpm -C apps/desktop lint`：通过。
- `pnpm -C packages/nextclaw-ui lint`：未通过，阻塞点为既有无关 lint 错误，涉及未触达的 chat / marketplace / system-status / i18n 等文件。
- `pnpm -C apps/desktop exec eslint src/main.ts src/preload.ts src/services/desktop-window-control.service.ts src/utils/desktop-ipc.utils.ts src/utils/window-diagnostics.utils.ts`：通过。
- `pnpm -C packages/nextclaw-ui exec eslint src/platforms/desktop/components/desktop-app-shell.test.tsx src/platforms/desktop/components/desktop-window-chrome.tsx src/platforms/desktop/types/desktop-update.types.ts`：通过。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：通过。

## 发布/部署方式

- 本次仅提交源码修复，未执行 desktop 正式或 beta 发布。

## 用户/产品视角的验收步骤

- 在 Windows desktop 中打开应用。
- 点击右上角最大化按钮后，按钮应切换为 restore 样式和 `Restore` label。
- 再次点击 restore 后，窗口恢复普通尺寸，按钮切回 maximize 样式和 `Maximize` label。
- 通过拖拽或系统触发窗口最大化 / 取消最大化时，按钮状态也应跟随真实窗口状态变化。

## 可维护性总结汇总

- 使用 `DesktopWindowControlService` 作为窗口控制与窗口状态 owner，避免把状态猜测放在 React UI。
- preload 只暴露查询和订阅接口，渲染层只消费状态，不直接接触 Electron。
- 非测试代码净减 3 行；新增的状态链路由删除过期 renderer debug 注入抵消。
- `post-edit-maintainability-review` 已执行：本次通过，正向减债动作为删除过期调试代码和职责收敛。
- `apps/desktop/src/main.ts` 接近文件预算，后续继续扩 desktop bootstrap 时应优先拆出更清晰的 window lifecycle owner。

## NPM 包发布记录

不涉及 NPM 包发布。
