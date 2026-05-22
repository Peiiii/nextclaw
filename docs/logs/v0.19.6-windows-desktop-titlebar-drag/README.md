# v0.19.6-windows-desktop-titlebar-drag

## 迭代完成说明

- 修复 Windows 桌面端移除原生标题栏后窗口拖拽失效的问题。
- 二次修正：用户在 Windows 真机验证后确认仍无法拖拽，并发现窗口最小尺寸过大。
- 根因：
  - 窗口最小尺寸由 [desktop-window-options.utils.ts](../../../apps/desktop/src/utils/desktop-window-options.utils.ts) 写死为 `1080x720`，导致只能缩小一点点。
  - 首轮只补齐 CSS 拖拽声明，但 Windows title bar overlay 的右上角 native controls 区域仍被同一个 draggable DOM 矩形覆盖。Electron 的 Window Controls Overlay 合同要求 overlay 下方 DOM 不可用，因此拖拽命中区不能伸到 caption buttons 下方。
  - Windows 窗口参数只设置 `titleBarStyle: "hidden"` 与 `titleBarOverlay`，没有显式进入 `frame: false` + `thickFrame: true` 的 frameless resize/move 合同，排查时容易误以为 renderer CSS 是唯一 owner。
- 修复方式：
  - Windows `BrowserWindow` 最小尺寸降到 `420x320`，允许真实小窗使用。
  - Windows 窗口参数显式设置 `frame: false`、`thickFrame: true`，使用 frameless 窗口并保留 Windows 标准 resize frame。
  - renderer titlebar 将 draggable main chrome 从 padding 避让改为 `margin-right` 避让，确保 draggable 矩形不再覆盖右上角原生窗口控制区。
  - 保留 `.desktop-window-drag` / `.desktop-window-no-drag` 的 `app-region` 与 `-webkit-app-region` 双声明，不新增 JS 手写拖拽兜底。

## 测试/验证/验收方式

- 已通过：`pnpm -C packages/nextclaw-ui test -- src/platforms/desktop/components/desktop-app-shell.test.tsx`
- 已通过：`pnpm -C apps/desktop tsc`
- 已通过：`pnpm -C apps/desktop build:main`
- 已通过：`node --test apps/desktop/dist/src/utils/desktop-window-options.utils.test.js`
- 已通过：`pnpm -C apps/desktop lint`
- 已通过：`pnpm -C packages/nextclaw-ui tsc`
- 已通过：`pnpm -C packages/nextclaw-ui build`
- 已通过：`PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify`
- 已通过：`pnpm -C packages/nextclaw-ui exec eslint src/platforms/desktop/components/desktop-window-chrome.tsx src/platforms/desktop/components/desktop-app-shell.test.tsx`
- 已通过：构建产物 grep，确认 CSS 中包含 `-webkit-app-region:drag`、`app-region:drag`、`-webkit-app-region:no-drag`、`app-region:no-drag`。
- 已通过：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- 已通过：`pnpm lint:new-code:governance -- apps/desktop/src/utils/desktop-window-options.utils.ts apps/desktop/src/utils/desktop-window-options.utils.test.ts packages/nextclaw-ui/src/platforms/desktop/components/desktop-window-chrome.tsx packages/nextclaw-ui/src/platforms/desktop/components/desktop-app-shell.test.tsx docs/logs/v0.19.6-windows-desktop-titlebar-drag/README.md`
- 已通过：`pnpm check:governance-backlog-ratchet`
- 已知阻塞：`pnpm -C packages/nextclaw-ui lint` 被既有 UI lint 债务阻塞，错误集中在未触达的 chat/marketplace/system-status/doc-browser 等文件；本次触达 UI 文件的 targeted ESLint 已通过。
- 二次修正已触达 TypeScript 源码，因此桌面包与 UI 包 `tsc` 均已执行。
- Windows 真机拖拽未在本机执行：当前环境不是 Windows 桌面 GUI。

## 发布/部署方式

- 未发布、未部署。
- 后续发布桌面 beta / stable 时，需要让 `packages/nextclaw-ui` 构建产物进入 `nextclaw` runtime bundle，并走桌面发布验证链路。

## 用户/产品视角的验收步骤

1. 在 Windows 上启动 NextClaw Desktop。
2. 在顶部自定义标题栏空白区域按住鼠标左键拖动。
3. 观察窗口应跟随鼠标移动，右上角原生最小化、最大化、关闭按钮仍正常可用。
4. 将窗口缩小到接近 `420x320`，确认横向和纵向都能进入小窗形态。
5. 点击标题栏里的按钮或状态入口时，不应被拖拽区域吞掉点击事件。

## 可维护性总结汇总

- 本次遵守单一路径：继续使用 Electron 标准 app-region 合同，没有增加 JS 拖拽兜底或平台特判。
- 二次修正确认 owner 分层：窗口尺寸和 frameless/resizable 合同属于 Electron 主进程窗口 options；titlebar 命中矩形属于 UI desktop chrome。
- 正向减债动作：删除了“padding 视觉避让但矩形仍覆盖 caption controls”的隐性错误模型，改为不新增 DOM 的 margin safe area。
- `post-edit-maintainability-guard` 二次修正结果：total `+65/-8/net +57`，non-test `+7/-7/net +0`，无可维护性发现。

## NPM 包发布记录

- 不涉及 NPM 包发布。
