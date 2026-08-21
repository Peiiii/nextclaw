# 桌面端外部链接导航设计

## 用户任务与现状

用户从 NextClaw 桌面端消息、文档或页面点击网页链接后，应在系统默认浏览器中继续浏览，并确认 NextClaw 主窗口仍停留在原任务上下文。

当前消息 Markdown 会把 `http/https` 链接渲染为 `target="_blank"`，但 Electron 主窗口没有统一处理新窗口请求。Electron 因此按默认行为创建内部 `BrowserWindow`。少数显式按钮已经通过桌面 host capability 调用 `shell.openExternal()`，原生链接点击则绕过了这条主链路。

## 方案比较

1. 只在 Markdown 链接组件中调用 host capability：改动局部，但其他 `target="_blank"`、`window.open()` 和跨源当前页导航仍会创建内部窗口或带走主界面，形成平行路径。
2. 在 Electron 主进程统一治理导航：主进程拦截所有新窗口和跨源主窗口导航，校验后交给系统浏览器。覆盖完整、owner 唯一，也符合 Electron 官方安全建议。
3. 保留内部浏览器并补返回、地址栏和复制能力：用户体验与安全边界都更复杂，相当于额外建设浏览器产品，不符合当前任务和 NextClaw 的能力编排方向。

采用方案 2。

## 行为与 owner

- `DesktopHostCapabilityService` 继续作为外部宿主能力 owner，唯一负责校验并调用 `shell.openExternal()`。
- `DesktopWindowManager` 在创建主窗口时把 `webContents` 接入该能力，不在渲染层逐个链接补丁。
- 新窗口请求一律返回 `deny`，不创建内部网页窗口；其中合法的 `http/https` URL 异步交给系统默认浏览器。
- 主窗口的同源导航继续留在 NextClaw；跨源导航先阻止主窗口跳转，再把合法的 `http/https` URL 交给系统浏览器。
- `file:`、`javascript:`、自定义协议和无效 URL 不交给系统 shell，也不创建内部窗口。

## 失败边界与非目标

系统没有可用默认浏览器或 `shell.openExternal()` 失败时，本次不降级为内部浏览窗口。内部窗口既不是完整浏览器，也会重新扩大不可信网页的宿主权限边界；后续如要提供失败反馈，应作为独立、可见的宿主错误体验设计。

本次不改变本地文件链接的工作台预览，不新增浏览器设置，不支持任意外部协议，也不修改 Web/PWA 的链接行为。

## 最小验证标准

- `https` 与 `http` 的新窗口请求被拒绝创建内部窗口，并调用一次系统外部打开能力。
- 非 `http/https` 新窗口请求被拒绝且不调用系统 shell。
- 同源主窗口导航不被阻止。
- 跨源 `http/https` 主窗口导航被阻止并调用系统外部打开能力。
- 跨源不安全协议导航被阻止且不调用系统 shell。
- 桌面包 TypeScript 检查、定向测试和 diff-only maintainability 检查通过。
