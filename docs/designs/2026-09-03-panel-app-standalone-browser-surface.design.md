# Panel App 独立浏览器表面设计

> 已由 [Panel App 轻量独立宿主设计](./2026-09-03-panel-app-standalone-lightweight-host.design.md) 取代。真实浏览器验证证明本文把 standalone 装配在 `ProtectedApp` 内会继续加载完整主 App、全量文案/CSS和后台 runtime；本文仅保留为首版决策记录，不再作为实现依据。

日期：2026-09-03

状态：Design Ready

相关文档：

- [NextClaw 产品愿景](../VISION.md)
- [Single HTML Panel Apps Design](./2026-05-26-single-html-panel-apps-design.md)
- [Panel App 稳定资源恢复设计](./2026-08-18-panel-app-stable-resource-resolution.design.md)

## 1. 用户任务与结论

用户从 Panel App 列表或已打开 App 的“更多操作”中执行独立打开：Desktop 在系统默认浏览器中打开，Web 在新标签页中打开。目标页面只显示 App，不显示 NextClaw 主侧栏、会话、右侧面板或普通工具栏；它仍连接当前 NextClaw 实例，并完整保留 Panel App 的 client grant、Service Action、Agent、capability 和错误语义。

这不是新的 App 类型、部署方式或运行时。推荐模型是让同一 Panel App 拥有三个展示位置：

```text
同一 Panel App
├── 右侧面板
├── NextClaw 主工作区
└── 独立浏览器表面
```

独立表面使用受保护的稳定路由：

```text
/apps/panel/:appId/standalone
```

路由使用稳定 `appId`，不暴露内容路径、安装路径、runtime token 或授权结果。

## 2. 现状证据与不变量

- `/apps/panel/:appId` 和 `PanelAppMainPage` 已经提供全尺寸 Panel App iframe。
- `PanelAppMainPage` 已拥有 App 查询、client grant、打开记录、sandbox、scroll restoration 和 bridge message 接入。
- kernel 按稳定 `appId` 解析 App 内容，并向响应注入 runtime token、`window.nextclaw` bridge 和获批后的 client SDK。
- `PanelAppBridgeManager` 绑定 iframe `contentWindow`，统一处理 Service Action、Agent、grant 和 capability 调用。
- `ServiceActionAuthorizationDialog` 与 `DesktopAuthorizationDialog` 已位于 `AppPresenterProvider` 下、`AppLayout` 外，可以由不同页面 shell 共享。
- Desktop 已拦截新窗口导航并交给系统浏览器；Web 原生支持 `target="_blank"`。

必须保持的不变量：展示位置不能改变 App 身份、内容来源、sandbox、bridge、授权、client SDK、Service Action allowlist 或 Agent 能力。

## 3. 方案比较

### 方案 A：直接打开内容 API

把 `/api/panel-apps/:appId/content` 作为顶层页面打开。静态内容能显示，但 `window.parent` 变成当前页面，宿主 bridge manager 和授权 UI 不存在，完整能力失效。拒绝。

### 方案 B：复用 `AppLayout`，用参数或 CSS 隐藏 chrome

短期 diff 较小，但独立页面仍初始化并依赖工作区布局、DocBrowser 和侧栏状态；后续 App shell 变化会持续污染独立表面。拒绝。

### 方案 C：无 chrome 受保护路由，共享唯一 runtime surface

在认证、query client、presenter 和授权 dialog 的公共父层新增 standalone 路由，但不挂载 `AppLayout`。从现有 `PanelAppMainPage` 抽出最窄的 `PanelAppRuntimeSurface`，让主工作区和 standalone 页面共同消费。推荐。

它只隔离真实变化点：页面 chrome、document title、scroll restoration key 和错误后的返回动作；Panel App 的运行行为仍只有一个实现。

## 4. 冻结技术结构

```text
QueryClientProvider
└── AuthGate
    └── AppPresenterProvider
        ├── common background runtimes
        ├── /apps/panel/:appId/standalone
        │   └── PanelAppStandalonePage
        │       └── PanelAppRuntimeSurface
        ├── all other routes
        │   └── AppLayout
        │       └── existing routes
        │           └── PanelAppMainPage
        │               └── PanelAppRuntimeSurface
        ├── ServiceActionAuthorizationDialog
        └── DesktopAuthorizationDialog
```

### 4.1 `PanelAppRuntimeSurface`

唯一拥有：

- 按 `appId` 找到当前 `PanelAppEntryView`；
- client grant 检查、拒绝和重试；
- 打开记录；
- iframe 创建与统一 sandbox；
- message source 交给同一个 `PanelAppBridgeManager`；
- loading、load error、not found、permission error；
- 按调用表面提供的 key 恢复滚动。

它不认识 `AppLayout`、ChatSidebar、DocBrowser、系统浏览器或独立页面文案。

`PanelAppMainPage` 和 `PanelAppStandalonePage` 只作为 adapter。前者拥有“打开应用管理”的工作区恢复动作，后者拥有 document title；两者不能复制 iframe、grant 或 bridge 代码。

### 4.2 路由装配

standalone 路由必须在 `AppLayout` 外，但仍在 `AuthGate`、`AppPresenterProvider` 和授权 dialogs 内。正常状态下页面 DOM 中不出现 NextClaw 工作区 chrome。

`PwaInstallBanner` 在 standalone 路由隐藏；Toaster 保留用于错误反馈，但使用不依赖侧栏宽度的边距。普通路由保持现有行为。

### 4.3 打开动作

目标是有稳定 URL 的导航，使用真实链接而不是命令按钮：

```html
<a href="/apps/panel/<appId>/standalone"
   target="_blank"
   rel="noopener noreferrer">
</a>
```

- Desktop：现有 Electron `setWindowOpenHandler` 接管新窗口请求并调用系统默认浏览器。
- Web：浏览器原生打开新标签页。

不新增 Desktop IPC、window manager、store 或 `window.open` 分支。真实链接还保留复制链接、右键打开和原生可访问性。

文案按可靠宿主事实变化：

| 宿主 | 中文 | 英文 |
| --- | --- | --- |
| NextClaw Desktop | 在浏览器中打开 | Open in Browser |
| Web | 在新标签页中打开 | Open in New Tab |

第一期把共享链接菜单项放入 Panel App 列表项和右侧 Panel App toolbar 的“更多操作”。默认点击行为不变。

## 5. 一致性与边界

| 行为 | 统一 owner |
| --- | --- |
| App 身份与来源 | stable `appId` + kernel Panel App manager |
| HTML 与资源 | 同一个 content API |
| token 与 client SDK 注入 | kernel 内容装载链路 |
| iframe 隔离 | 同一个 sandbox 常量 |
| Service Action / Agent | 同一个 `PanelAppBridgeManager` |
| client grant | 同一个 runtime hook |
| 授权 UI | 公共 authorization manager/dialog |
| 打开记录与 query cache | 同一 Panel App hook |

右侧 DocBrowser iframe 保留其通用容器，不为本功能重构整个 DocBrowser；它继续复用同一个 content API、sandbox 常量、bridge manager 和授权 owner。首次 client grant 在右侧列表打开前确认，在 standalone 直接访问时由目标 runtime surface 确认；授权结果与风险语义相同，发生位置可以不同。

## 6. 失败与恢复

- standalone URL 需要登录时显示既有登录页；认证完成后仍停留在原 URL。
- App 禁用、卸载或删除时显示产品化不可用状态，不显示原始 API JSON。
- grant 被拒绝时 App 不加载 client SDK，页面提供原地重试。
- 刷新页面重新创建内容 runtime session，并按稳定 `appId` 解析当前来源。
- 多个标签页各自拥有 iframe 和 runtime token；message source 校验保持独立。
- 关闭页面只销毁该页面视图，不停止 NextClaw runtime、Service App 或其它 Panel App 表面。
- 当前 NextClaw 实例停止后页面不可用；本功能不创建备用 runtime 或离线副本。

## 7. 非目标与抽象审计

不包含独立部署、公开分享、匿名访问、跨 origin token、独立 Electron 窗口、PWA 子应用安装、窗口尺寸 manifest、云 runtime 或 App 状态复制。

过小方案会用 CSS 隐藏错误 owner；过大方案会引入无消费者的 multi-surface registry 或 Window Manager。平衡点只新增显式 route、两个轻 adapter、一个被真实双消费者复用的 runtime surface 和一个共享菜单链接，不修改 backend contract。

命中原则：`equivalence-by-construction`、`single-complete-owner`、`minimal-responsibility-surface`、`simple-structure-first`、`abstractions-pay-rent`。

## 8. 最小验证标准

1. Web 菜单显示“在新标签页中打开”，链接具有正确 standalone URL、`_blank` 和 `noopener noreferrer`。
2. Desktop 菜单显示“在浏览器中打开”，同一链接由现有 Desktop 新窗口拦截链交给系统浏览器。
3. 列表与已打开 App toolbar 复用同一个菜单项。
4. standalone 路由不挂载 `AppLayout`、主侧栏、会话、DocBrowser 或 PWA banner，iframe 占满视口。
5. 主工作区和 standalone 共同使用 `PanelAppRuntimeSurface`；没有第二份 iframe、grant 或 bridge 实现。
6. standalone 直接进入、刷新、not found、grant 允许/拒绝/重试均有定向测试。
7. 同一测试 App 在右侧与 standalone 执行 Service Action、Agent/client 调用时，授权和结果语义一致。
8. 受影响 UI TypeScript 检查、定向测试、diff-only maintainability review 和真实浏览器页面验证通过。

## 9. 执行判断

本功能是用户可见 L2 设计，必须保留本设计文档。实现路径已经冻结且可以在一个批次内闭环，不另建 `docs/plans`；执行清单由当前开发任务 plan 维护。实现完成时同步中英文 Panel Apps 用户文档，纯设计和内部记录不能替代用户说明。
