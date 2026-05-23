# v0.19.6-windows-desktop-titlebar-drag

## 迭代完成说明

- 修复 Windows 桌面端移除原生标题栏后窗口拖拽失效的问题。
- 二次修正：用户在 Windows 真机验证后确认仍无法拖拽，并发现窗口最小尺寸过大。
- 三次修正：用户验证 `0.0.180 / 0.19.23` 后确认 resize 已修复，但标题栏仍然完全无法拖拽。
- 根因：
  - 窗口最小尺寸由 [desktop-window-options.utils.ts](../../../apps/desktop/src/utils/desktop-window-options.utils.ts) 写死为 `1080x720`，导致只能缩小一点点。
  - 首轮只补齐 CSS 拖拽声明，但 Windows title bar overlay 的右上角 native controls 区域仍被同一个 draggable DOM 矩形覆盖。Electron 的 Window Controls Overlay 合同要求 overlay 下方 DOM 不可用，因此拖拽命中区不能伸到 caption buttons 下方。
  - Windows 窗口参数只设置 `titleBarStyle: "hidden"` 与 `titleBarOverlay`，没有显式进入 `frame: false` + `thickFrame: true` 的 frameless resize/move 合同，排查时容易误以为 renderer CSS 是唯一 owner。
  - 三次修正的第一错误 hop：标题栏空白区域里存在用于撑开布局的空 `div`。`elementFromPoint` 证明用户实际点击到的是这个空 filler 元素，而不是带 `desktop-window-drag` 的父容器；该 filler 的 computed `-webkit-app-region` / `app-region` 均为 `none`，因此 Windows/Electron 没有拿到可拖拽命中面。
- 修复方式：
  - Windows `BrowserWindow` 最小尺寸降到 `420x320`，允许真实小窗使用。
  - Windows 窗口参数显式设置 `frame: false`、`thickFrame: true`，使用 frameless 窗口并保留 Windows 标准 resize frame。
  - renderer titlebar 将 draggable main chrome 从 padding 避让改为 `margin-right` 避让，确保 draggable 矩形不再覆盖右上角原生窗口控制区。
  - 三次修正删除 titlebar 内部空 filler DOM，让空白区域的实际 topmost hit element 直接就是 `desktop-window-drag` 元素。
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
- 三次修正新增验证：通过 Playwright 对 dev renderer 执行 `document.elementFromPoint`，确认标题栏空白点 `(260,20)`、`(320,20)`、`(700,20)` 的 topmost element 已直接命中 computed `app-region: drag` 的 `desktop-window-drag` 元素；右侧 caption safe area `(1180,20)`、`(1230,20)` 保持非 drag。
- 四次修正新增验证门禁：Windows desktop smoke 增加原生拖拽探针，启动打包后的 exe 后用 Win32 API 在标题栏空白坐标执行鼠标按下、移动、松开，并断言窗口矩形坐标发生变化。该验证用于区分 renderer `app-region` 正确但 Windows 原生层没有产生窗口移动的情况。
- 已通过：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- 已通过：`pnpm lint:new-code:governance -- apps/desktop/src/utils/desktop-window-options.utils.ts apps/desktop/src/utils/desktop-window-options.utils.test.ts packages/nextclaw-ui/src/platforms/desktop/components/desktop-window-chrome.tsx packages/nextclaw-ui/src/platforms/desktop/components/desktop-app-shell.test.tsx docs/logs/v0.19.6-windows-desktop-titlebar-drag/README.md`
- 已通过：`pnpm check:governance-backlog-ratchet`
- 已知阻塞：`pnpm -C packages/nextclaw-ui lint` 被既有 UI lint 债务阻塞，错误集中在未触达的 chat/marketplace/system-status/doc-browser 等文件；本次触达 UI 文件的 targeted ESLint 已通过。
- 二次修正已触达 TypeScript 源码，因此桌面包与 UI 包 `tsc` 均已执行。
- Windows 真机拖拽未在本机执行：当前环境不是 Windows 桌面 GUI。

## 发布/部署方式

- 已发布 desktop preview beta：[`v0.19.24-desktop-beta.1`](https://github.com/Peiiii/nextclaw/releases/tag/v0.19.24-desktop-beta.1)。
- 本次 release 名称：`NextClaw Desktop 0.0.181 Preview Beta 1`。
- 本次 release 对应源码提交：`588185ba20578e36d2646eaf7d2100c5869b59da`。
- 本次 Windows 主要验收资产：
  - `NextClaw.Desktop-Setup-0.0.181-x64.exe`
  - `NextClaw-Portable-0.0.181-win-x64.zip`
  - `nextclaw-bundle-win32-x64-0.19.24.zip`
  - `manifest-beta-win32-x64.json`
- 远端发布闭环已通过：`desktop-release` workflow `26302767030` 成功；Windows x64 / arm64 build 与 smoke 成功；release assets 检查成功；`gh-pages` 与公网 beta manifest 均指向 `0.19.24`。
- 不涉及 NPM 包发布。

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
- 三次修正继续减债：删除 2 个空 filler DOM，避免用无语义子节点覆盖拖拽命中面；同时把该验证缺口沉淀到 `desktop-release-contract-guard` 的 Windows custom titlebar drag gate。
- 四次修正继续把人工验证前移到 CI：用 Windows native drag smoke 替代让用户反复下载试错；如果后续 release 仍不能拖拽，CI 会先给出窗口是否真的移动的硬证据。
- `post-edit-maintainability-guard` 二次修正结果：total `+65/-8/net +57`，non-test `+7/-7/net +0`，无可维护性发现。

## NPM 包发布记录

- 不涉及 NPM 包发布。
