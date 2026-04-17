# Web/Desktop Browser Panel Design

日期：2026-04-17

相关文档：

- [NextClaw 产品愿景](../VISION.md)
- [Electron Desktop Packaging and Semi-Auto Update Plan](./electron-desktop-semi-auto-update-plan.md)
- [NextClaw UI API 设计（Phase 1）](./ui-gateway-api.md)

## 1. 背景

这份文档沉淀本次关于 “NextClaw 是否应该内建一个同时支持 Web 与 Desktop 的浏览器面板，以及该能力应该如何分层” 的讨论结果。

讨论起点不是抽象地争论 `iframe`、`webview` 或 Electron 哪个名词更先进，而是几个很具体的产品判断：

- 当前 `NextClaw` 已经有一个右侧内嵌文档浏览器原型：
  - UI 入口与布局位于 `packages/nextclaw-ui/src/components/layout/AppLayout.tsx`
  - 状态与多标签逻辑位于 `packages/nextclaw-ui/src/components/doc-browser/DocBrowserContext.tsx`
  - 实际内容承载位于 `packages/nextclaw-ui/src/components/doc-browser/DocBrowser.tsx`
- 当前原型本质上是 React UI 中的 `iframe` 面板，支持：
  - 右侧固定（docked）
  - 悬浮（floating）
  - 多标签
  - 简单前进后退与文档路由同步
- 未来目标不止是文档浏览，而是：
  - 能加载任意网页
  - 能逐步具备真正浏览器能力
  - 能被 AI / Agent 控制
  - 同时不能破坏 `NextClaw` 现有 “同一套 UI 同时支持 Web 与 Desktop” 的产品形态

这意味着我们需要回答的核心问题不是 “要不要再做一个 iframe”，而是：

**在保持统一产品壳层的前提下，NextClaw 应该如何引入一个跨 Web/Desktop 的浏览器面板子系统。**

## 2. 上位目标对齐

结合 [VISION.md](../VISION.md)，这项能力必须服务以下长期方向：

- 让 `NextClaw` 更像统一入口，而不是把用户频繁赶回传统浏览器再手工完成任务。
- 让 “意图 -> 浏览网页 -> 阅读/操作/协作” 这条链路尽量在 `NextClaw` 内闭环。
- 让桌面端与 Web 端共享同一套产品认知、交互习惯与操作入口，而不是长出两套完全不同的产品。
- 让未来 AI 对网页的读取、操作、自动化与结果回传，有清晰、可治理、可扩展的宿主边界。

这里追求的不是 “再塞一个功能点”，而是让 `NextClaw` 朝“默认入口 + 能力编排 + 自治操作层”再推进一层。

## 3. 本次结论

### 3.1 当前 `iframe` 方案适合作为起点，但不适合作为终局

当前 `DocBrowser` 方案适合：

- 自家文档
- 自家页面
- 可控域名内容
- 短期内的右侧信息面板

但它不适合作为最终浏览器能力底座，原因包括：

- 很多第三方站点会通过 `X-Frame-Options` 或 CSP `frame-ancestors` 拒绝被嵌入。
- `iframe` 只能做有限导航与外围控制，不适合作为强控制宿主。
- 若继续在 `DocBrowser` 上不断叠加 “任意网页、自动化、复杂 session、权限治理”，最终会把一个文档面板补丁式推成伪浏览器，复杂度高且边界模糊。

### 3.2 产品壳层可以统一，但浏览器宿主不能假装完全同构

`NextClaw` 应该保持：

- 同一套主 UI 壳层
- 同一套右侧浏览器面板产品体验
- 同一套标签、导航、控制、AI 协作入口

但不应强行要求 Web 与 Desktop 在底层实现完全相同。

推荐结论是：

- `Desktop`：作为强宿主，提供原生浏览器面板能力
- `Web`：作为轻宿主，提供弱能力面板，并为未来接入远程浏览器 runtime 预留能力

换句话说：

**统一的是产品与能力抽象，不是底层宿主实现。**

### 3.3 Desktop 端最终应走 Electron `WebContentsView`

对于 Electron 宿主，长期推荐方案不是继续扩大 `iframe`，也不是以 `<webview>` 为核心，而是使用 Electron 主进程管理的 `WebContentsView` 作为原生浏览器面板承载体。

原因：

- `<webview>` 官方已不再是推荐优先路径，稳定性与长期演进风险较高。
- `BrowserView` 已被新路线替代，不应作为新设计核心。
- `WebContentsView` 更适合做桌面侧的真实浏览器面板，并具备更强的生命周期、权限、导航、隔离和后续自动化扩展能力。

### 3.4 Web 端必须承认能力边界

纯浏览器环境下，`NextClaw Web` 无法获得与 Electron 本地宿主等价的网页控制能力。

因此 Web 端的长期路线必须拆成两类模式：

- `web-basic`：`iframe` + 外部打开 + 受限控制
- `web-remote-runtime`：连接远程浏览器 runtime，由远端负责真实网页宿主与自动化

不应承诺 “Web 版也能无差别原生控制任意网页”。

## 4. 现状判断

### 4.1 现有桌面壳层与 UI 分工是正确方向

当前桌面应用的主链路是：

- `apps/desktop/src/main.ts` 创建 Electron `BrowserWindow`
- Electron 主窗口加载本地 `NextClaw UI`
- `packages/nextclaw-ui` 继续作为统一 renderer 前端

这说明当前仓库已经具备非常重要的结构基础：

**桌面壳层负责宿主能力，业务 UI 继续留在共享前端包内。**

这个原则应该继续保持。

### 4.2 当前桌面能力桥接模式可以直接复用

当前桌面端已经通过 `preload` 在 `window.nextclawDesktop` 上向 UI 暴露能力，例如：

- 更新管理
- 常驻与启动偏好
- Runtime 控制

这条模式体现在：

- `apps/desktop/src/preload.ts`
- `packages/nextclaw-ui/src/desktop/managers/*`

因此浏览器面板不应重新发明另一套跨层模式，而应沿用同样的桥接思路，例如新增：

- `window.nextclawBrowser`
- 或纳入 `window.nextclawDesktop.browser`

重点不是命名，而是保持：

- UI 不直接依赖 Electron API
- Electron 细节只停留在 desktop 宿主层

### 4.3 当前 `DocBrowser` 应视为 “右侧面板 UI 原型”，而不是最终浏览器内核

当前 `DocBrowser` 的价值主要在于：

- 已经跑通右侧 dock / float / tabs 交互形态
- 已经证明这类信息面板与主工作区可以共存
- 已经为未来浏览器面板提供了 UI 经验

但它不应继续承担最终浏览器内核职责。

推荐将其重新定位为：

**右侧面板 UI 框架的第一版实现。**

## 5. 设计原则

### 5.1 同一套产品壳层，平台化宿主实现

- `packages/nextclaw-ui` 保持统一产品壳层
- 宿主能力由平台实现注入
- UI 只消费抽象能力，不直接引用 Electron

### 5.2 先统一能力模型，再做平台增强

不要让 UI 通过“当前是不是 desktop”来散落判断功能，而应引入统一能力声明，例如：

- 能否嵌入任意 URL
- 能否读取页面 DOM
- 能否执行页面动作
- 能否持久化 cookie / session
- 能否捕获截图

这样 UI 依据 capabilities 做渐进增强，而不是写平台特判地狱。

### 5.3 平台差异应明确，而不是伪装无差别

如果 Web 端做不到某项能力，就明确标记 unsupported 或降级，不靠隐式 fallback 制造“有时能用、有时不能用”的惊喜或惊吓。

### 5.4 不让共享 UI 污染为桌面专属代码

禁止让 `packages/nextclaw-ui` 直接知道：

- `electron`
- `WebContentsView`
- `ipcRenderer`
- main process bounds 细节

这些都必须被桥接层吃掉。

## 6. 推荐总体架构

### 6.1 分层总览

```text
┌────────────────────────────────────────────────────────────┐
│ Shared Product Shell (packages/nextclaw-ui)               │
│ - 右侧栏 UI                                                │
│ - tabs / 地址栏 / 工具栏 / AI 入口                         │
│ - 页面布局与面板状态                                        │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│ Browser Domain / Bridge Layer                             │
│ - BrowserPanelManager                                     │
│ - Browser capability model                                │
│ - BrowserBridge interface                                 │
└────────────────────────────────────────────────────────────┘
                │                                │
                ▼                                ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│ Desktop Browser Host         │   │ Web Browser Host             │
│ - Electron WebContentsView   │   │ - iframe host                │
│ - IPC bridge                 │   │ - external open fallback     │
│ - session/cookie/download    │   │ - optional remote runtime    │
└──────────────────────────────┘   └──────────────────────────────┘
```

### 6.2 三个核心边界

#### A. Shared Product Shell

职责：

- 定义用户看到的浏览器面板体验
- 管理标签页列表、地址输入、前进后退按钮、页面状态展示
- 提供 AI 浏览器操作入口与结果展示区

不负责：

- 持有真实网页宿主
- 直接操作 Electron
- 决定平台级权限与网络策略

#### B. Browser Domain / Bridge Layer

职责：

- 定义跨平台统一的浏览器面板抽象
- 收敛 UI 与平台能力的交互协议
- 暴露 capabilities
- 隐藏 Desktop / Web 具体差异

这是本设计最关键的一层。

#### C. Platform Browser Host

职责：

- 真正承载网页内容
- 管理平台特有宿主资源
- 管理权限、下载、cookie、生命周期、自动化可达性

## 7. 能力模型

推荐定义一套统一能力模型：

```ts
type BrowserPanelCapabilities = {
  canEmbedArbitraryUrl: boolean;
  canControlPage: boolean;
  canReadDom: boolean;
  canCaptureScreenshot: boolean;
  canPersistSession: boolean;
  canInjectScript: boolean;
  canUseLocalNativeHost: boolean;
  supportsFloatingMode: boolean;
  supportsDockedMode: boolean;
};
```

这套能力模型的意义不是炫技，而是避免 UI 写成：

- `if desktop then ...`
- `if web then ...`
- `if iframe blocked then ...`

而是统一写成：

- 如果 `canControlPage` 为 `false`，则隐藏或禁用控制入口
- 如果 `canEmbedArbitraryUrl` 为 `false`，则切换到外部打开或提示远程 runtime

## 8. Desktop 方案

### 8.1 宿主实现

Desktop 端推荐新增一个原生浏览器面板宿主，由 Electron 主进程负责：

- 创建 `WebContentsView`
- 加载目标 URL
- 管理 bounds
- 响应导航、刷新、关闭、创建 tab 等操作
- 对外提供事件订阅与状态快照

UI 侧不直接渲染网页本体，而是渲染：

- 占位区
- 标签栏
- 地址栏
- 控制按钮
- 状态层

真正网页内容由主进程挂入窗口中对应区域。

### 8.2 Bounds 同步

Desktop 最大的实现关键不在导航，而在 “如何让原生浏览器面板准确贴合 React 布局区域”。

推荐机制：

1. React 右侧栏组件测量自身容器位置与尺寸
2. 通过 bridge 发送 `panelBounds`
3. Electron main 根据窗口坐标系更新 `WebContentsView` bounds
4. 窗口 resize、sidebar 宽度变化、float/dock 切换时重复同步

这要求 React 侧只输出：

- `x`
- `y`
- `width`
- `height`
- `visible`
- `mode`

而不关心主进程具体如何摆放 native view。

### 8.3 推荐桌面桥接

可以沿用现有 desktop bridge 模式，新增：

- `apps/desktop/src/preload.ts` 暴露 `browser` API
- `packages/nextclaw-ui` 中增加 browser manager / store

示意接口：

```ts
type BrowserBridge = {
  getCapabilities(): Promise<BrowserPanelCapabilities>;
  createTab(input?: { url?: string }): Promise<{ tabId: string }>;
  closeTab(tabId: string): Promise<void>;
  setActiveTab(tabId: string): Promise<void>;
  navigate(tabId: string, url: string): Promise<void>;
  goBack(tabId: string): Promise<void>;
  goForward(tabId: string): Promise<void>;
  reload(tabId: string): Promise<void>;
  setPanelBounds(input: PanelBounds): Promise<void>;
  getSnapshot(): Promise<BrowserPanelSnapshot>;
  subscribe(listener: (event: BrowserPanelEvent) => void): () => void;
};
```

### 8.4 会话与数据隔离

Desktop 端需要从一开始就明确浏览器 session 策略：

- 默认共享一个浏览器 partition，还是按工作区/标签页隔离
- 登录态是否持久化
- 用户清空浏览数据如何定义
- AI 自动化与用户浏览是否共享 cookie jar

第一阶段推荐：

- 支持持久化 session
- 支持用户显式清空
- 默认同一浏览器面板共享一套 session

但应预留未来按 workspace 或 persona 隔离的扩展点。

### 8.5 `WebContentsView` 与前端壳层的协作模型

这部分必须明确，否则团队很容易误以为 “既然 `NextClaw UI` 是网页，为什么还能把另一个网页塞进右侧栏，而且还不是普通 DOM 组件”。

正确理解方式是：

- `NextClaw UI` 本身是一张运行在 Electron 主窗口里的网页
- 这个网页继续负责画：
  - 整个应用壳层
  - 左侧导航
  - 主工作区
  - 右侧浏览器面板的工具栏、tabs、地址栏、状态层
- 但右侧面板中真正显示网页内容的那一块，不再由 React 渲染，而是由 Electron main 创建并挂载一个 `WebContentsView`

也就是说，最终用户看到的是一个整体界面，但内部其实是两类渲染对象协作：

- 一类是 React DOM
- 一类是 Electron 原生 `WebContentsView`

React 不直接“持有网页 DOM”，而是只持有一个布局占位区，并持续告诉主进程：

- 这个占位区现在在哪里
- 宽高多少
- 当前显示哪个 tab
- 是否隐藏 / 悬浮 / 固定

随后主进程把对应的 `WebContentsView` 准确摆到这个区域上。

所以从实现本质上说，这不是：

- “把一个网页组件塞到另一个网页组件里”

而是：

- “一个网页壳层 UI + 一个原生浏览器视图” 的协作布局

这也是为什么共享 UI 可以继续保持前端实现，而桌面宿主又能拥有比普通 Web 页面强得多的浏览器承载能力。

## 9. Web 方案

### 9.1 `web-basic` 模式

Web 端第一阶段应明确采用弱宿主模式：

- 能嵌入的 URL 使用 `iframe`
- 不能嵌入的 URL 走外部打开
- 控制能力限制在最小必要范围

这时 Web 端的主要价值是：

- 保持统一交互与 UI 结构
- 让文档、内部工具页、允许嵌入的内容仍可在右侧工作区展示
- 不阻塞共享前端架构演进

### 9.2 `web-remote-runtime` 模式

如果未来希望 `NextClaw Web` 也具备强浏览器能力，不能只靠浏览器页面自身，需要引入远程浏览器 runtime。

这条路线本质上是：

- 浏览器真实运行在远程容器 / 服务端宿主
- `NextClaw Web` 作为控制台连接远程浏览器会话
- 右侧展示的不是普通第三方网页 iframe，而是远程浏览器的受控投影

这类投影未来可以是：

- 截图流 / 画面流
- DOM 投影
- 结构化动作与状态同步

第一阶段不建议直接实现远程浏览器 runtime，但必须在抽象层为其预留：

- `remote` host type
- browser session id
- 远程事件流
- AI 动作协议

### 9.3 Web 端必须明确的降级语义

Web 端如果遇到：

- `iframe` 被拒绝
- 跨站策略阻断
- 控制能力不可用

必须显式反馈，而不是表现为无解释白屏。

推荐语义：

- `embedded`
- `blocked-by-site-policy`
- `open-externally-required`
- `remote-runtime-required`

## 10. 性能模型与治理策略

### 10.1 性能判断

引入浏览器面板后，性能不会天然崩，但也绝不能默认乐观。

总体判断是：

- 做对隔离，主 UI 可以继续保持流畅
- 做错边界，卡顿、内存膨胀、布局抖动会非常明显

这里最容易误判的一点是：

- 问题不在于 “有没有浏览器面板”
- 而在于 “浏览器面板是否被当成正式子系统治理”

### 10.2 Desktop 端的主要性能风险

Desktop 端使用 `WebContentsView` 的主要风险通常不是纯粹 FPS，而是：

- 多个活跃 tab 带来的内存占用
- 重网页自身的 CPU 消耗
- 高频 bounds 同步带来的布局抖动
- 自动化、截图、DOM 读取带来的额外开销

因此 Desktop 端的性能治理重点应是：

- 同一时刻只保持一个前台活跃网页
- 后台 tab 默认降频、暂停或必要时 discard
- bounds 变化只在必要时同步，并进行节流
- 截图、页面分析、自动化操作都按需触发，而不是高频轮询

### 10.3 Web 端的主要性能风险

Web 端的主要风险更容易体现为：

- 多个 `iframe` 同时存在造成的页面卡顿
- 页面重排与 repaint 频繁触发
- `iframe` 阻塞、白屏、重试导致的体验抖动

因此 Web 端更应坚持：

- 默认只保留一个活跃嵌入面板
- 不为后台 tab 长时间保留真实 `iframe`
- 遇到不可嵌入站点尽快降级，而不是重复重试

### 10.4 推荐硬规则

无论 Web 还是 Desktop，第一版就应建立以下硬规则：

- 只让当前活动 tab 成为真实渲染宿主
- 后台 tab 默认不自动刷新
- bounds 同步仅在尺寸或位置变化时触发，且必须节流
- 自动化动作默认按需触发，不做常驻监听页面
- 截图、DOM 读取、分析任务必须异步，不阻塞主 UI 交互
- 避免让 React 高频 state 更新直接驱动原生浏览器宿主变化

### 10.5 验收视角下的性能目标

第一阶段不要求把浏览器面板做到浏览器产品级极致优化，但至少需要满足：

- 主导航、聊天区、设置页在打开浏览器面板后仍保持可用流畅度
- 打开一个常规网页时不会造成整个应用明显掉帧
- 切换 tab 或 dock/float 模式时不出现肉眼明显卡死
- 长时间打开后内存增长可控，且后台 tab 不呈线性恶化

## 11. 控制与自动化模型

### 11.1 能力目标

未来 “AI 可以控制浏览器” 不应被理解为 UI 组件直接执行 DOM hack，而应设计为正式的浏览器动作协议。

建议从一开始把自动化能力抽象成：

- 页面导航
- 页面可见状态读取
- 截图
- 元素定位
- 点击
- 输入
- 滚动
- 等待条件

### 11.2 不建议的做法

不建议把未来自动化能力设计成：

- UI 直接访问页面 DOM
- 在共享前端里散落脚本注入代码
- AI action 直接等价于 “execute arbitrary JS”

原因：

- 安全边界模糊
- 平台不一致
- 维护性与可审计性差

### 11.3 推荐动作协议

长期建议引入单独的 Browser Automation 接口，例如：

```ts
type BrowserAutomationAction =
  | { type: 'navigate'; url: string }
  | { type: 'click'; target: BrowserTarget }
  | { type: 'input'; target: BrowserTarget; value: string }
  | { type: 'scroll'; x?: number; y?: number }
  | { type: 'capture' }
  | { type: 'wait-for'; condition: BrowserCondition };
```

这样无论底层是：

- Desktop 本地 `WebContentsView`
- 还是 Web 远程 runtime

都能走同一套高层动作协议。

## 12. 安全与治理基线

### 12.1 共享 UI 不直接信任浏览器宿主

UI 只拿状态快照与有限动作，不直接触达底层宿主对象。

### 12.2 Desktop 端坚持 preload 白名单

浏览器面板 bridge 必须复用现有 Electron 安全基线：

- `contextIsolation: true`
- `nodeIntegration: false`
- preload 白名单暴露 API

### 12.3 明确用户与 AI 的权限边界

未来 AI 控制浏览器时，需要从产品层明确：

- 哪些动作默认允许
- 哪些动作需要确认
- 哪些动作涉及账号、支付、隐私输入
- 哪些动作必须保留可审计轨迹

第一阶段可以不实现完整权限中心，但文档中必须先承认这是正式问题，而不是后面再临时补。

## 13. 推荐文件与模块方向

以下是推荐的实现落点，不代表本次文档已实现：

### 13.1 Shared UI / Domain

- `packages/nextclaw-ui/src/components/browser-panel/*`
- `packages/nextclaw-ui/src/browser/managers/browser-panel.manager.ts`
- `packages/nextclaw-ui/src/browser/stores/browser-panel.store.ts`
- `packages/nextclaw-ui/src/browser/browser-bridge.types.ts`
- `packages/nextclaw-ui/src/browser/browser-capabilities.ts`

### 13.2 Web Host

- `packages/nextclaw-ui/src/browser/bridges/web-iframe-browser.bridge.ts`
- `packages/nextclaw-ui/src/browser/bridges/web-remote-browser.bridge.ts`（预留）

### 13.3 Desktop Host

- `apps/desktop/src/browser/browser-panel.service.ts`
- `apps/desktop/src/browser/browser-tab.service.ts`
- `apps/desktop/src/browser/browser-session.store.ts`
- `apps/desktop/src/browser/browser-ipc.channels.ts`
- `apps/desktop/src/browser/browser-window-bounds.service.ts`
- `apps/desktop/src/preload.ts` 增加 browser bridge 暴露

### 13.4 现有代码迁移方向

- `packages/nextclaw-ui/src/components/doc-browser/*`
  - 短期作为旧实现保留
  - 中期迁移为 `browser-panel` 的早期 host 或兼容层
- `packages/nextclaw-ui/src/components/layout/AppLayout.tsx`
  - 保留右侧面板插槽
  - 由新 browser panel manager 接管面板渲染逻辑

## 14. 阶段推进建议

### 阶段 A：统一抽象，不改变桌面宿主本质

目标：

- 把当前 `DocBrowser` 抽象成通用 Browser Panel UI
- 建立 capabilities 模型
- 建立 browser bridge interface
- Web 继续走 `iframe`
- Desktop 暂时也可先兼容旧 `iframe` UI 方案

意义：

- 先统一前端架构，不急着同时切底层

### 阶段 B：Desktop 引入 `WebContentsView`

目标：

- 在桌面端切到原生浏览器面板
- 跑通 bounds 同步、tab 管理、基础导航、session 持久化
- UI 保持共享

意义：

- 让桌面端先成为真正强宿主

### 阶段 C：补浏览器控制能力

目标：

- 页面截图
- 页面状态读取
- 基础点击/输入/滚动
- AI 动作协议

意义：

- 从 “能看网页” 进入 “能协作操作网页”

### 阶段 D：Web 远程浏览器 runtime

目标：

- 让 Web 端通过远程宿主获得接近桌面端的强能力

意义：

- 让 “统一入口” 不被平台差异完全切断

## 15. 非目标

本设计当前不包含：

- 第一阶段就让 Web 端获得与 Desktop 完全对等的浏览器能力
- 第一阶段就实现全量浏览器自动化
- 第一阶段就实现多 profile / 多 partition 的复杂账户体系
- 第一阶段就替换所有现有右侧面板与详情面板能力

## 16. 验收标准

### 16.1 架构验收

- 共享 UI 不直接依赖 Electron API
- Web / Desktop 都通过统一 browser bridge 抽象接入
- 共享 UI 根据 capabilities 渐进增强，而不是靠散落平台特判

### 16.2 产品验收

- 用户在 Web 与 Desktop 上看到统一的浏览器面板形态
- Web 端遇到不可嵌入网页时有明确降级语义
- Desktop 端可在右侧面板打开真实网页并完成基础导航

### 16.3 长期扩展验收

- 后续新增自动化能力时，不需要重写 UI 壳层
- 后续新增远程浏览器 runtime 时，不需要重写产品结构

## 17. 最终判断

本次设计的核心判断是：

**NextClaw 应该把浏览器面板当成正式子系统来建设，而不是继续把 `DocBrowser` 作为局部 UI 特性不断补丁式长大。**

更具体地说：

- 右侧浏览器面板的产品体验应统一
- 浏览器宿主能力必须平台化
- Desktop 应成为本地强宿主
- Web 应先接受弱宿主现实，再为远程强宿主预留空间

这样做的好处不是“工程上更优雅”而已，而是它真正符合 `NextClaw` 作为统一入口与能力编排层的长期方向：

用户未来不只是“在 NextClaw 里聊天”，而是越来越多地“在 NextClaw 里看网页、理解网页、操作网页、让 AI 与网页协作”。
