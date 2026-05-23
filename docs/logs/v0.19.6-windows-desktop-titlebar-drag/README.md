# v0.19.6-windows-desktop-titlebar-drag

## 迭代完成说明

- 排查 Windows 桌面端移除原生标题栏后窗口拖拽失效的问题；resize 已修复，拖拽仍未关闭。
- 二次修正：用户在 Windows 真机验证后确认仍无法拖拽，并发现窗口最小尺寸过大。
- 三次修正：用户验证 `0.0.180 / 0.19.23` 后确认 resize 已修复，但标题栏仍然完全无法拖拽。
- 七次排查：用户验证 `0.0.181 / 0.19.24` 后确认 resize 已修复，但 Windows 标题栏仍完全无法拖拽；当前拖拽问题未关闭，暂停手写 IPC 拖拽方案，回到 Electron 官方 `app-region` 合同继续缩圈。
- 八次排查：`v0.19.24-desktop-beta.2` 发布前被 Windows x64 CI 拦截，renderer 空白标题栏点命中 `app-region: drag`，但 Win32 `WM_NCHITTEST` 返回 `HTCLIENT(1)`；继续参考 VS Code 的生产实践，将 Windows hidden titlebar 合同调整为 `frame: false` + `titleBarStyle: hidden` + `titleBarOverlay`，仍禁止恢复 `thickFrame`。
- 九次排查：`v0.19.24-desktop-beta.3` 继续在 Windows x64 CI 返回 `nativeHitTest=1`，说明主进程 `frame:false` 不是最后一跳；renderer titlebar 改为 VS Code 式专用 absolute drag region，避免复杂 flex item 作为 drag surface。
- 十次排查：`v0.19.24-desktop-beta.4` 证明专用 absolute drag region 在真实 `/chat` 页面命中正确，`(320,24)`、`(400,24)`、`(700,24)` 均命中 `desktop-window-chrome-drag-region` 且 computed `app-region: drag`，但 Windows x64 smoke 仍失败；下一步把 Win32 smoke 从单一 main HWND 扩展为检查鼠标点下方 HWND、root HWND 与 parent 链，确认是 Electron 未返回 `HTCAPTION` 还是 smoke 之前测错 HWND。
- 十一次排查：`v0.19.24-desktop-beta.5` 证明 main HWND `Chrome_WidgetWin_1` 与鼠标点下方 HWND `Chrome_RenderWidgetHostHWND` 都返回 `HTCLIENT(1)`，没有任何相关 HWND 返回 `HTCAPTION(2)`；因此问题不是测错窗口，而是 Windows `titleBarOverlay` 合同下 Electron 没有把 renderer drag region 转成 native caption。下一步移除 `titleBarOverlay`，改为纯 `frame:false` frameless + renderer 自绘窗口按钮。
- 十二次排查：`v0.19.24-desktop-beta.6` 移除 `titleBarOverlay` 后，Windows x64 CI 的 `WM_NCHITTEST` 仍然返回 `HTCLIENT(1)`；因此不能再把 `HTCAPTION` 当作唯一验收真理，下一轮 smoke 保留 HWND 诊断，但最终用真实鼠标拖动后的窗口几何变化判断是否可拖拽。
- 十三次排查：`v0.19.24-desktop-beta.7` 使用真实鼠标拖动窗口标题栏空白点后，窗口几何位置仍为 `delta=(0,0)`；因此当前 Electron 官方 `app-region` 链路在本应用的 Windows packaged 环境中确实未生效，不能继续把问题归因到 renderer DOM/CSS 命中面。根因未完全定位，下一步必须做同 Electron 版本的最小复现，对比是 Electron/CI/版本层问题，还是本应用窗口生命周期或 runtime 加载路径阻断了 draggable region 注册。
- 十四次排查修正十三次结论：同 Electron 版本的最小 `frame:false` 应用在 Windows CI 中返回 `HTCAPTION(2)`，证明官方 `app-region` 能注册到 native hit-test；但同一个最小应用的 synthetic mouse drag 仍为 `delta=(0,0)`，证明 CI 鼠标几何拖动不能作为最终验收。当前更准确的结论是：NextClaw 应用链路没有让标题栏点返回 `HTCAPTION(2)`，而不是 Electron 官方方案整体不可用。
- 十五次修正：把 Windows titlebar 的 drag owner 从空的透明 absolute overlay 改为真实可见的 header 背景元素，保留侧栏、窗口按钮和顶部 resize strip 为 `no-drag`；这针对的是“DOM 命中空 overlay 正确，但 Electron native draggable region 未聚合”的差异。
- 十六次排查：新增最小 HTTP variant 后，`http://127.0.0.1` 页面同样返回 `HTCAPTION(2)`，因此 NextClaw 的问题也不是因为 renderer 通过本地 HTTP 加载；当前剩余差异继续指向应用结构、窗口生命周期或更细的 webPreferences / preload 组合。
- 根因：
  - 窗口最小尺寸由 [desktop-window-options.utils.ts](../../../apps/desktop/src/utils/desktop-window-options.utils.ts) 写死为 `1080x720`，导致只能缩小一点点。
  - 首轮只补齐 CSS 拖拽声明，但 Windows title bar overlay 的右上角 native controls 区域仍被同一个 draggable DOM 矩形覆盖。Electron 的 Window Controls Overlay 合同要求 overlay 下方 DOM 不可用，因此拖拽命中区不能伸到 caption buttons 下方。
  - 二次修正曾误把 Windows 窗口参数推进到 `frame: false` + `thickFrame: true` 的 frameless 合同；后续 CI 证明 renderer drag 命中面正确但原生窗口仍不移动，这个方向属于错误收敛。
  - 三次修正的第一错误 hop：标题栏空白区域里存在用于撑开布局的空 `div`。`elementFromPoint` 证明用户实际点击到的是这个空 filler 元素，而不是带 `desktop-window-drag` 的父容器；该 filler 的 computed `-webkit-app-region` / `app-region` 均为 `none`，因此 Windows/Electron 没有拿到可拖拽命中面。
  - 六次修正通过 Windows CI 证明 packaged `/chat` 页面标题栏空白点已命中 `app-region: drag`，但窗口仍不移动；根因收敛到主进程窗口 chrome 合同，`frame: false` / `thickFrame: true` 与 `titleBarOverlay` 组合偏离 Electron 官方 Window Controls Overlay 推荐形态。
  - 七次排查证明只使用 Electron 官方文档示例里的 `titleBarStyle: hidden` + `titleBarOverlay` 仍没有让 Windows 原生命中层返回 caption；VS Code 在 Windows/Linux custom titlebar 场景使用 `frame: false`，因此本轮收敛为“保留 frameless，但删除 `thickFrame` 双合同”。
  - 八次排查证明 `frame:false` 后 native hit-test 仍为 `HTCLIENT(1)`；剩余可疑点转向 renderer drag region 形状，当前 flex item 上的 `app-region` 虽能被 `getComputedStyle` 看到，但可能没有形成 Electron 期望的专用 draggable rect。
  - 十次排查证明 renderer drag region 形状也不是唯一原因：专用 absolute drag layer 在真实 `/chat` 页面已被 `elementFromPoint` 和 computed style 共同确认，但原生命中测试仍未通过；剩余问题必须进入 HWND 层诊断。
  - 十一次排查证明 HWND 层也没有 `HTCAPTION`：`titleBarOverlay` 是当前最可疑的合同分叉。为了回到 Electron 最基础的 frameless draggable contract，本轮删除 Windows overlay 原生按钮，改由 renderer 通过 IPC 调用 minimize / maximize / close。
  - 十二次排查证明纯 frameless 后 `WM_NCHITTEST` 仍然不能代表 Electron draggable region 的全部行为；release gate 改为真实鼠标输入造成窗口移动，`WM_NCHITTEST` 降级为诊断日志。
  - 十三次排查证明真实鼠标拖动也不会移动窗口；当前已确认 renderer 侧官方 `app-region` 条件成立，但 native 窗口没有执行拖拽。根因未完全定位，剩余不确定因素在 Electron/Chromium draggable region 注册、Windows packaged runtime 窗口生命周期、或当前 Electron 版本/CI 交互环境之间。
  - 十四次最小复现修正根因边界：最小 Electron `frame:false` 应用的同一客户区点返回 `HTCAPTION(2)`，但 synthetic mouse drag 仍不会移动窗口；因此 CI synthetic mouse 不能证明真实拖拽，`HTCAPTION(2)` 才是当前可自动化的 native registration gate。NextClaw 的差异仍是返回 `HTCLIENT(1)`。
  - 十五次修正的当前假设：Electron/Chromium 对空透明 absolute app-region overlay 的 native draggable region 聚合与普通 DOM hit-test 不等价；即使 `elementFromPoint` 与 computed style 都显示 `drag`，也可能不进入 Win32 `HTCAPTION`。因此将 drag contract 放到真实承载背景和尺寸的 header 上。
  - 十六次排查排除本地 HTTP 加载来源：最小 Electron 通过 `http://127.0.0.1` 加载同一 titlebar 时仍返回 `HTCAPTION(2)`。
  - 二十三至二十五次排查继续排除标题栏 DOM 形状、GPU、packaged 主进程窗口参数：真实 UI dist 在最小 Electron 壳中同样返回 `HTCLIENT(1)`，而同一壳加载手写 NextClaw-like 布局返回 `HTCAPTION(2)`。当前根因边界已收敛到真实 UI bundle 的 CSS/JS/runtime 行为，尚需继续区分 CSS 本身、React 挂载后 DOM 更新、还是可通过独立 fixed drag layer 修复。
- 修复方式：
  - Windows `BrowserWindow` 最小尺寸降到 `420x320`，允许真实小窗使用。
  - Windows 窗口参数调整为 VS Code 风格的 custom titlebar 合同：`frame: false`、`titleBarStyle: "hidden"` 与 `titleBarOverlay`；不再混用 `thickFrame: true`。
  - 十一次排查后，Windows 窗口参数进一步收敛为纯 frameless 合同：保留 `frame: false` 与 `titleBarStyle: "hidden"`，移除 `titleBarOverlay`，右上角窗口按钮改由 renderer 自绘并通过 preload IPC 调用主进程窗口动作。
  - renderer titlebar 增加专用 absolute `.desktop-window-drag` 命中层，避开右上角 caption controls 和顶部 4px resize edge；品牌区作为 `desktop-window-no-drag` 交互层覆盖在上方。
  - renderer titlebar 将 draggable main chrome 从 padding 避让改为 `margin-right` 避让，确保 draggable 矩形不再覆盖右上角原生窗口控制区。
  - 三次修正删除 titlebar 内部空 filler DOM，让空白区域的实际 topmost hit element 直接就是 `desktop-window-drag` 元素。
  - 保留 `.desktop-window-drag` / `.desktop-window-no-drag` 的 `app-region` 与 `-webkit-app-region` 双声明，不新增 JS 手写拖拽兜底。

## 测试/验证/验收方式

- 已通过：`pnpm -C packages/nextclaw-ui test -- src/platforms/desktop/components/desktop-app-shell.test.tsx`
- 已通过：`pnpm -C apps/desktop tsc`
- 已通过：`pnpm -C apps/desktop build:main`
- 已通过：`node --test apps/desktop/dist/src/utils/desktop-window-options.utils.test.js`
- 已通过：`pnpm -C apps/desktop lint`
- 七次排查已通过：基于 `origin/master` 的干净 release worktree 中重新执行 `pnpm install --frozen-lockfile --prefer-offline`、`pnpm -C packages/nextclaw-kernel build`、`pnpm -C apps/desktop tsc`、`pnpm -C apps/desktop build:main`、`pnpm -C apps/desktop lint`、`node --test apps/desktop/dist/src/utils/desktop-window-options.utils.test.js`。
- 已通过：`pnpm -C packages/nextclaw-ui tsc`
- 已通过：`pnpm -C packages/nextclaw-ui build`
- 已通过：`PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify`
- 已通过：`pnpm -C packages/nextclaw-ui exec eslint src/platforms/desktop/components/desktop-window-chrome.tsx src/platforms/desktop/components/desktop-app-shell.test.tsx`
- 已通过：构建产物 grep，确认 CSS 中包含 `-webkit-app-region:drag`、`app-region:drag`、`-webkit-app-region:no-drag`、`app-region:no-drag`。
- 三次修正新增验证：通过 Playwright 对 dev renderer 执行 `document.elementFromPoint`，确认标题栏空白点 `(260,20)`、`(320,20)`、`(700,20)` 的 topmost element 已直接命中 computed `app-region: drag` 的 `desktop-window-drag` 元素；右侧 caption safe area `(1180,20)`、`(1230,20)` 保持非 drag。
- 四次修正新增验证门禁：Windows desktop smoke 增加原生标题栏命中探针，启动打包后的 exe 后先把窗口恢复到 `760x520` 小窗，再检查标题栏空白客户区点是否被 Windows 判定为 `HTCAPTION`。
- 五次修正删除旧的 CI 鼠标拖动模拟断言，避免把 runner 交互限制误判为 Electron titlebar 合同失败。
- 六次修正新增 packaged renderer 观察点：Windows smoke 临时打开 `NEXTCLAW_DESKTOP_SMOKE_TITLEBAR_HIT_TEST`，主进程日志确认 `/chat` 页面标题栏空白坐标命中 `desktop-window-drag`，computed `app-region` / `-webkit-app-region` 均为 `drag`。
- 七次排查新增 Windows 原生命中观察点：Windows smoke 在模拟拖拽前发送 `WM_NCHITTEST`，要求标题栏空白客户区点返回 `HTCAPTION(2)`；若返回 `HTCLIENT(1)`，说明 renderer CSS 命中没有进入 Win32 native hit-test。
- 七次排查新增用户侧低成本观察点：桌面主进程启动日志输出 `Runtime source`、`bundleVersion` 与 `bundleDirectory`，用于确认 Windows 真机实际加载的是哪个 runtime/UI bundle，无需打开 DevTools。
- 八次排查失败证据：`v0.19.24-desktop-beta.2` 的 Windows x64 CI 中，`titlebar-hit-test` 确认 `(400,24)` 命中 `desktop-window-chrome-main` 且 computed `app-region` / `-webkit-app-region` 均为 `drag`；随后 Win32 `nativeHitTest=1`，即 `HTCLIENT`，workflow 因未达到 `HTCAPTION(2)` 失败。
- 九次排查失败证据：`v0.19.24-desktop-beta.3` 使用 `frame:false` 后，Windows x64 CI 仍然在 `(400,24)` 返回 `nativeHitTest=1`。
- 十次排查失败证据：`v0.19.24-desktop-beta.4` 中 `titlebar-hit-test` 确认真实 `/chat` 页面的 `(320,24)`、`(400,24)`、`(700,24)` 均命中 `desktop-window-chrome-drag-region`，computed `app-region` / `-webkit-app-region` 均为 `drag`；但 Windows x64 smoke 未通过，因此 `beta.4` 未完成 release closure，不能交付用户测试。
- 十一次排查新增验证门禁：Windows titlebar smoke 同时记录 main window HWND、`WindowFromPoint` 命中的 HWND、root HWND、parent 链、class name 和各自 `WM_NCHITTEST` 返回值；只有这些真实相关 HWND 至少一个返回 `HTCAPTION(2)`，才允许进入后续 release closure。
- 十一次排查失败证据：`v0.19.24-desktop-beta.5` 中 main HWND `Chrome_WidgetWin_1` 返回 `HTCLIENT(1)`，point HWND `Chrome_RenderWidgetHostHWND` 也返回 `HTCLIENT(1)`，无相关 HWND 返回 `HTCAPTION(2)`，因此 `beta.5` 未完成 release closure，不能交付用户测试。
- 十二次排查失败证据：`v0.19.24-desktop-beta.6` 移除 `titleBarOverlay` 并启用 renderer 自绘窗口控制按钮后，Windows x64 CI 仍显示 main HWND 与 point HWND 都返回 `HTCLIENT(1)`；这说明 `WM_NCHITTEST` 不是足够可靠的最终验收方式。
- 十三次排查失败证据：`v0.19.24-desktop-beta.7` 的 Windows x64 CI 同时记录 `mainHitTest=1`、`pointHitTest=1`，并执行真实鼠标拖动几何验收；窗口拖动前为 `(80,80)`，拖动后仍为 `(80,80)`，`delta=(0,0)`，因此 `beta.7` 未完成 release closure，不能交付用户测试。
- 十四次排查新增验证门禁：`desktop-validate` 的 Windows exe smoke 前新增最小 Electron app-region smoke，分别测试纯 `frame:false` 和 `frame:false + titleBarStyle:"hidden"` 两个最小窗口；用于判断官方 draggable region 在同 Electron 版本和同 Windows runner 上是否能独立工作。
- 十四次排查失败后修正：首轮最小复现脚本证明 `frame:false` minimal app 的 main / point / root HWND 都返回 `HTCAPTION(2)`，但 synthetic mouse drag 仍 `delta=(0,0)`；因此桌面 smoke 重新以 `HTCAPTION(2)` 作为自动化 gate，只有没有 `HTCAPTION` 时才把几何拖动作为辅助 fallback。
- 十五次修正已通过：`pnpm -C packages/nextclaw-ui tsc`
- 十五次修正已通过：`pnpm -C packages/nextclaw-ui test -- src/platforms/desktop/components/desktop-app-shell.test.tsx`
- 十五次修正已通过：`pnpm -C packages/nextclaw-ui exec eslint src/platforms/desktop/components/desktop-window-chrome.tsx src/platforms/desktop/components/desktop-app-shell.test.tsx`
- 十五次修正已通过：`pnpm -C packages/nextclaw-ui build`，仍有既有 Vite chunk size warning。
- 十六次排查修正：最小 Electron app-region smoke 改为直接启动 `node_modules/electron/dist/electron.exe`，避免 `electron.cmd` wrapper 进程清理不完整影响后续 Windows build step。
- 十七次排查失败证据：`desktop-validate` run `26324272658` 中，最小 Electron app-region 的 `frame:false`、`frame:false + titleBarStyle:"hidden"`、HTTP 加载三种官方对照均返回 `HTCAPTION(2)`；但 NextClaw `/chat` 页面的 `(320,24)`、`(400,24)`、`(700,24)` 已命中 `desktop-window-chrome` 且 computed `app-region=drag` 时，main / point HWND 仍返回 `HTCLIENT(1)`。因此“空 overlay DOM”“local HTTP 直载”“基础 hidden frameless 配置”均不是根因。
- 十七次排查新增对照实验：最小 Electron app-region smoke 继续补充 `sandbox:false + preload`、先加载 `data:` 启动页再跳 HTTP、以及接近 NextClaw 的 rounded/flex/overflow titlebar 布局；下一轮 Windows CI 先用这些对照定位差异层，再决定是否进入产品代码修复。
- 十八次排查收敛根因：`desktop-validate` run `26324463530` 中，`sandbox:false + preload + HTTP 直载` 仍返回 `HTCAPTION(2)`，但 `sandbox:false + preload + 先加载无 app-region 的 data: 启动页再跳 HTTP` 首次返回 `HTCLIENT(1)`。这与 NextClaw 当前启动路径一致，因此根因收敛为 Windows/Electron 在启动页到运行时页面导航后没有恢复 draggable region native registry。
- 十八次修正尝试：`data:` 启动页的 `body` 从第一帧开始声明 `app-region: drag` / `-webkit-app-region: drag` / `user-select: none`；该尝试随后被十九次排查证明不足以恢复同一 BrowserWindow 在 `data:` -> HTTP 导航后的 native registry。
- 十九次排查收敛根因：`desktop-validate` run `26324618950` 证明“启动页本身也声明 drag”仍不足以恢复同一 BrowserWindow 在 `data:` -> HTTP 导航后的 native registry，`frame-false-hidden-data-http-preload-sandbox-false-startup-drag` 仍返回 `HTCLIENT(1)`。因此根因是 Windows/Electron 对同一窗口经历 `data:` 导航后的 draggable region registry 不刷新，而不是启动页缺少 drag。
- 十九次修正：删除桌面主窗口启动阶段的 `data:` loading 页，让 Windows BrowserWindow 从创建后直接加载 runtime HTTP 页面；最小 smoke 保留 `data:` 启动页后新建窗口再加载 HTTP 的对照，证明问题属于同一窗口的 `data:` -> HTTP 导航链，而不是 HTTP 页面本身。
- 二十次排查：`desktop-validate` run `26324859439` 证明“删除 data: 启动页”仍不足以让 packaged NextClaw 返回 `HTCAPTION(2)`；日志显示窗口先 `loadURL` 到 runtime 根路径 `/`，随后 React Router 在同一页面内执行 `did-navigate-in-page` 到 `/chat`，此时 DOM 命中仍是 `desktop-window-chrome` 且 computed `app-region=drag`，但 main / point HWND 继续返回 `HTCLIENT(1)`。当前根因继续收窄为 Windows/Electron 对同一窗口经历前端 in-page navigation 后没有恢复 draggable region native registry。
- 二十次修正：桌面主进程第一帧直接加载 `${baseUrl}/chat`，避免先进入 `/` 再由 renderer 重定向到 `/chat`，让 Windows app-region 注册路径保持在最接近 Electron 官方 HTTP 直载对照的形态。
- 二十一次排查：`desktop-validate` run `26325023080` 证明直接加载 `/chat` 后仍会出现同 URL 的 `did-navigate-in-page`，来源是前端 BrowserRouter 初始化期间的 History API state 写入；此时 DOM 命中继续正确但 native hit-test 仍为 `HTCLIENT(1)`。
- 二十一次修正：真实 Windows Electron 环境改用 `MemoryRouter`，避免桌面端初始化路由时调用浏览器 History API；普通 Web 与 dev 浏览器模拟继续使用 `BrowserRouter`。同时 Windows 窗口合同进一步收敛为纯 `frame:false`，删除不再必要的 `titleBarStyle:"hidden"`。
- 二十二次排查：`desktop-validate` run `26325257296` 证明 `MemoryRouter` 已消除 `did-navigate-in-page`，加载链路只剩 `about:blank -> /chat`，但真实 NextClaw 窗口在 `(400,24)` 仍返回 `HTCLIENT(1)`；因此根因不再是前端 History API 导航，而是真实标题栏矩形和最小可通过页面之间的 DOM/paint 差异。
- 二十二次修正：把 Windows 自定义标题栏中间空白区改成显式 `desktop-window-drag flex-1` 子元素，不再只依赖父 `header` 的空白背景参与 Electron native draggable region 聚合；同时删除品牌区多余 wrapper，保持非测试生产代码净减少。最小 Electron smoke 新增 `nextclaw-layout-empty-http-preload-sandbox-false` 与 `nextclaw-layout-http-preload-sandbox-false` 对照，用 Windows CI 验证“空白父背景”与“显式中间 drag 子区域”的差异。
- 二十三次排查：`desktop-validate` run `26325496003` 证明显式 `desktop-window-chrome-main-drag-region` 在真实 packaged `/chat` 中已被 `elementFromPoint` 命中，computed `app-region=drag`，但 native hit-test 仍为 `HTCLIENT(1)`；同轮最小 `nextclaw-layout-empty-http-preload-sandbox-false` 与显式布局对照均返回 `HTCAPTION(2)`，排除“空白父背景”和“显式 flex 子区域”作为根因。
- 二十四次排查：`desktop-validate` run `26325644666` 证明最小 NextClaw-like 布局在 GPU enabled 时仍返回 `HTCAPTION(2)`，排除 `disable-gpu` 与真实 GPU 状态差异作为根因。
- 二十五次排查：`desktop-validate` run `26325898320` 首次证明“最小 Electron 壳 + 真实 NextClaw UI dist”会返回 `HTCLIENT(1)`，而同一壳的手写 NextClaw-like 布局返回 `HTCAPTION(2)`；根因边界由 packaged 主进程/窗口 options 进一步缩小到真实 UI bundle 的 CSS/JS/runtime 行为。
- 二十五次实验改造：最小 Windows app-region smoke 改为一次 CI 覆盖多个互斥假设：真实 UI CSS 静态页、完整 UI dist、完整 UI dist + inline 强制 titlebar drag、完整 UI dist + fixed titlebar drag layer、完整 UI dist + body drag，并把 renderer DOM hit-test 结果写入文件后由 PowerShell 打印，避免继续一轮只验证一个猜测。
- 二十六次探针修正：`desktop-validate` run `26326229815` 发现 `760px` 宽的 UI-dist 最小对照会进入 mobile layout，命中移动端 `H1` 而非 desktop chrome；该结果不能代表真实 packaged 桌面链路。最小对照窗口改为 `1024x720`，与真实 smoke 中 renderer `innerWidth=1024` 对齐，并允许 UI-dist 探针失败后继续收集后续 rescue 变体结果。
- 已通过：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- 已通过：`pnpm lint:new-code:governance -- apps/desktop/src/utils/desktop-window-options.utils.ts apps/desktop/src/utils/desktop-window-options.utils.test.ts packages/nextclaw-ui/src/platforms/desktop/components/desktop-window-chrome.tsx packages/nextclaw-ui/src/platforms/desktop/components/desktop-app-shell.test.tsx docs/logs/v0.19.6-windows-desktop-titlebar-drag/README.md`
- 已通过：`pnpm check:governance-backlog-ratchet`
- 已通过：`git diff --check`
- 已通过：`pnpm lint:new-code:governance -- .github/workflows/desktop-validate.yml apps/desktop/scripts/smoke-windows-electron-app-region-minimal.ps1 docs/logs/v0.19.6-windows-desktop-titlebar-drag/README.md`
- 已通过：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths .github/workflows/desktop-validate.yml apps/desktop/scripts/smoke-windows-electron-app-region-minimal.ps1 docs/logs/v0.19.6-windows-desktop-titlebar-drag/README.md`，结果为本次诊断脚本/工作流/记录改动不适用 code-like maintainability 检查。
- 七次排查本机完整包验证阻塞：`PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify` 已完成通用 build、seed bundle 与 macOS DMG 打包前置校验，但在本机 GUI smoke 打开 unsigned macOS DMG 时被 AMFI / AppleSystemPolicy 拦截；该阻塞属于本机未签名 macOS 信任策略，不是 Windows titlebar 合同的判定结果。
- 已知阻塞：`pnpm -C packages/nextclaw-ui lint` 被既有 UI lint 债务阻塞，错误集中在未触达的 chat/marketplace/system-status/doc-browser 等文件；本次触达 UI 文件的 targeted ESLint 已通过。
- 二次修正已触达 TypeScript 源码，因此桌面包与 UI 包 `tsc` 均已执行。
- Windows 真机拖拽未在本机执行：当前环境不是 Windows 桌面 GUI。

## 发布/部署方式

- 已发布 desktop preview beta：[`v0.19.24-desktop-beta.1`](https://github.com/Peiiii/nextclaw/releases/tag/v0.19.24-desktop-beta.1)。
- 用户真机验收结论：该 beta 的 resize 行为已符合预期，但 Windows 标题栏拖拽仍失败，因此该 beta 不能作为拖拽问题完成版本。
- 发布失败记录：[`v0.19.24-desktop-beta.2`](https://github.com/Peiiii/nextclaw/releases/tag/v0.19.24-desktop-beta.2) 目标提交 `c63222eb9f777845180de17fa09b0034e09b9843`，Windows x64 smoke 因 `nativeHitTest=1` 失败，未完成 release closure，不能交付用户测试。
- 发布失败记录：[`v0.19.24-desktop-beta.3`](https://github.com/Peiiii/nextclaw/releases/tag/v0.19.24-desktop-beta.3) 目标提交 `6df03b87b1fcdaccc3f231b70a52385cd6e6816a`，Windows x64 smoke 仍因 `nativeHitTest=1` 失败，未完成 release closure，不能交付用户测试。
- 发布失败记录：[`v0.19.24-desktop-beta.4`](https://github.com/Peiiii/nextclaw/releases/tag/v0.19.24-desktop-beta.4) 目标提交 `8c4065969693b328b459d8fda484f44930899035`，Windows x64 smoke 仍未完成 titlebar 原生命中验收，未完成 release closure，不能交付用户测试。
- 发布失败记录：[`v0.19.24-desktop-beta.5`](https://github.com/Peiiii/nextclaw/releases/tag/v0.19.24-desktop-beta.5) 目标提交 `7f00c43e0178a9e8dd5c185927703cfd89026f11`，Windows x64 smoke 证明 main / point HWND 都返回 `HTCLIENT(1)`，未完成 release closure，不能交付用户测试。
- 发布失败记录：[`v0.19.24-desktop-beta.6`](https://github.com/Peiiii/nextclaw/releases/tag/v0.19.24-desktop-beta.6) 目标提交 `519dce01991af60d6dfd6a6748ed74cfb5238539`，Windows x64 smoke 仍因 `WM_NCHITTEST` 未返回 `HTCAPTION(2)` 阻断，未完成 release closure，不能交付用户测试。
- 发布失败记录：[`v0.19.24-desktop-beta.7`](https://github.com/Peiiii/nextclaw/releases/tag/v0.19.24-desktop-beta.7) 目标提交 `cb63092e735361212b84cf2d467649fa2230a0f9`，Windows x64 smoke 通过真实鼠标拖动验证窗口位置没有变化，未完成 release closure，不能交付用户测试。
- 后续发布计划：暂停继续发布给用户试错；先做同 Electron 版本的最小 Windows app-region 复现，并把结果作为下一轮代码方向的入口。
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
- 五次修正减少验证噪声：原生拖拽 smoke 不再依赖 Electron 初始窗口尺寸是否适配 CI runner 分辨率，而是主动规整窗口几何后再观察移动。
- 六次修正删除错误方向的窗口参数叠加：不再把 Window Controls Overlay 与 frameless/thick frame 混成双合同。
- 八次修正收敛到更具体的主进程合同：frameless 本身不是问题，`thickFrame` 与 overlay 的双合同才是需要删除的异常项；后续 smoke 必须继续以 Win32 原生命中返回值拦截。
- 九次修正继续向 VS Code 的 renderer 结构靠拢：把 drag surface 从承担布局的 flex item 拆成单一绝对定位命中层，减少 DOM 结构对 Electron draggable region 聚合的干扰。
- 十一次排查把“验证是否测错窗口”自动化：Windows smoke 不再只看 process main window handle，而是记录鼠标点下方 HWND 与父级链路，避免错误结论继续消耗人工测试。
- 十二次修正删除不稳定合同：不再依赖 Windows `titleBarOverlay` 同时提供原生按钮和 app-region 映射，改为一个更单纯的 frameless window owner；窗口按钮交互集中到 `DesktopWindowControlService`。
- 十三次修正降低错误验证风险：不再把 `WM_NCHITTEST` 与真实用户拖拽等同，避免一个可能不适用的 Win32 观测点反复阻断 release。
- 十三次排查后的维护结论：继续调 renderer CSS 或 titlebar DOM 已经不是高性价比方向；后续必须先建立最小 Electron 复现或明确改用可验证的 JS/native 手动拖拽 fallback，避免把复杂度继续堆在 UI 表层。
- 十四次排查把最小复现前移到 CI：用独立 PowerShell smoke 直接启动最小 Electron app，避免继续把 NextClaw 应用复杂度和 Electron 官方能力混在一起判断。
- 十四次排查后的验证减债：删除“CI synthetic mouse drag 等价于用户真实拖拽”的错误假设；保留 HWND/native hit-test 作为可自动化信号，减少后续 release 被 CI 输入限制误导。
- 十五次修正删除一个空 overlay DOM，把 drag 语义收回 titlebar header owner，减少“看起来命中正确但 native 不承认”的中间层。
- `post-edit-maintainability-guard` 二次修正结果：total `+65/-8/net +57`，non-test `+7/-7/net +0`，无可维护性发现。

## NPM 包发布记录

- 不涉及 NPM 包发布。
