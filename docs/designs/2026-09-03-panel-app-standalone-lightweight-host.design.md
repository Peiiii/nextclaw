# Panel App 轻量独立宿主设计

日期：2026-09-03

状态：已实现并完成客观验证，待用户视觉验收

相关文档：

- [NextClaw 产品愿景](../VISION.md)
- [已废止的首版 standalone 表面设计](./2026-09-03-panel-app-standalone-browser-surface.design.md)
- [Panel App 稳定资源恢复设计](./2026-08-18-panel-app-stable-resource-resolution.design.md)
- [执行计划](../plans/2026-09-03-panel-app-standalone-lightweight-host.plan.md)

## 1. 用户任务与结论

用户从 Panel App 列表或已打开 App 的“更多操作”中执行独立打开：Desktop 在系统默认浏览器中打开，Web 在新标签页中打开。目标页面只显示指定 Panel App，连接当前 NextClaw 实例，并完整保留 client grant、Service Action、Agent、capability、sandbox、滚动恢复与错误语义。

首版实现把 standalone 作为 `AppContent -> ProtectedApp` 内的一条 React 路由，只移除了 `AppLayout`。真实浏览器验证显示：外层 HTML 约 13ms，但 Panel content 冷请求约 5.78s；首次刷新超过 10s iframe 仍未显示，热缓存刷新仍约 2.24s。模块链仍加载 Chat、Inbox、系统状态、更新、PWA、完整 AppPresenter、全量 i18n 和主 CSS，后端 list/content/open 还重复执行全部启用 App 的 SHA-256 完整性扫描。

修订结论：

> 用户侧继续使用稳定路由 `/apps/panel/:appId/standalone`；资源和生命周期侧使用独立 HTML 与独立 Vite 入口。主 App 与 standalone 只共享 Panel Host Runtime 和必要基础 owner，不共享主工作台 shell。

它不是新的 Panel App 类型、独立仓库、独立部署或微前端框架。

## 2. 最小完整链路

```text
用户打开 /apps/panel/:appId/standalone
  -> NextClaw/Vite 将路由映射到 panel-standalone.html
  -> panel-app-standalone.route.tsx 启动最小宿主
  -> 查询认证状态
  -> 按稳定 appId 查询单个 Panel descriptor
  -> 共享 PanelAppHostPresenter 执行 grant / bridge / sandbox
  -> iframe 请求同一 content API
  -> 指定 Panel App 占满视口并连接当前 NextClaw
```

浏览器 URL、认证 origin 和 API origin 不变；改变的是入口资源图与宿主生命周期。

## 3. 方案比较

### 方案 A：完整 App 内增加 React 路由

无法隔离静态 import、全局 provider、副作用和主 CSS。真实冷启动已经证明不可接受，拒绝并删除。

### 方案 B：同一 HTML 的 route-aware dynamic import

JS 能形成不同 chunk，但 `index.html` 仍携带 PWA、manifest、主 UI injection 和主题脚本；CSS、HTML 生命周期与回归边界容易重新耦合。仅作为部署环境无法返回第二份 HTML 时的备选，当前不选。

### 方案 C：稳定 URL 映射独立 HTML/入口

Vite 以 `index.html` 和 `panel-standalone.html` 作为两个入口；开发中间件和生产静态服务器把稳定 standalone 路由映射到后者。Rollup 只抽取两个入口真正共用的 vendor chunk，入口专属模块不会互相下载。推荐。

直接顶层打开 content API 会失去父窗口 bridge、权限 UI 和消息 source 校验，拒绝。

## 4. 应用与资源边界

### 4.1 Standalone 初始允许依赖

- React/React DOM；
- 最小 Theme owner 与 Panel 宿主所需设计 token；
- language owner 与 Panel/授权/核心错误文案；
- auth status 与未登录页面的延迟入口；
- 单个 Panel descriptor query；
- `PanelAppRuntimeSurface`；
- Panel bridge、client grant、Service Action 授权；
- iframe sandbox 与 scroll restoration。

### 4.2 Standalone 初始禁止依赖

- `AppContent`、`ProtectedApp`、`AppLayout`、`AppPresenter`；
- Chat、Inbox、DocBrowser、SideDock、Remote；
- 系统状态、runtime update、PWA runtime；
- 主 App event consumers 与无条件 WebSocket；
- 完整 Panel App 列表 query；
- 全领域 i18n catalog；
- 主 `index.css` 与工作台专属 Tailwind utilities；
- `/api/ui-inject.js`。

必要能力按事实延迟加载；不能用“以后可能用到”把主运行时重新塞进入口。

### 4.3 CSS、Theme 与 i18n

standalone 使用独立最小样式入口。Panel App 自身样式在 sandbox iframe 内；宿主 CSS 只覆盖页面背景、loading/error、登录和授权表面。

Theme 状态 owner 与 PWA shell projection 分离：共享 Theme owner 只维护主题选择与 DOM token；主 App 单独挂载 PWA 同步，standalone 不加载 PWA。

语言选择继续由同一个 language owner 管理，但 catalog 改为入口注册：主入口注册完整 catalog，standalone 只注册实际使用的 core、Panel 和授权域。`t()` 的同步读取合同保持不变，不复制语言状态 owner。

## 5. Panel Host Runtime：行为一致性的唯一 owner

建立窄的 `PanelAppHostPresenter` 装配边界，拥有 `PanelAppServiceActionAuthorizationManager`、`PanelAppBridgeManager` 和对应授权表面。`PanelAppRuntimeSurface` 继续唯一拥有 descriptor、client grant、iframe/sandbox、bridge source、loading/error 和 scroll restoration。

主 App adapter 与 standalone adapter 都依赖这些共享 owner。主 App 不再通过包含 Chat/Inbox 等字段的 `AppPresenter` 间接向 Panel Runtime 提供 bridge；现有其它 Panel consumer 可以引用同一个 host runtime，不能创建第二套 bridge/grant 语义。

## 6. 后端目标读取与组件索引

### 6.1 当前错误

`PanelAppPackageStateManager.readContentSourceByIdOrAppId()` 先调用 `listSources()`。它调用 `listActiveComponentSourcesWithDiagnostics()`，并对每个启用 App 执行 `assertVersionIntegrity()`；该校验递归读取版本目录全部文件并计算 SHA-256。页面的 list、content 和 record-open 重复触发它。

完整性校验被错误放入 read 热路径，而且它没有覆盖 token 化 asset 的后续读取，因此也不是完整的逐请求安全边界。

### 6.2 正确 owner 与生命周期

App Package 生命周期 owner 维护已启用组件的内存 catalog：

```text
start / install / update / rollback / enable
  -> 验证目标版本完整性
  -> 构建或替换该 package component snapshot

disable / uninstall
  -> 删除该 package snapshot

read / list / status
  -> 只读 snapshot，不扫描版本目录
```

catalog 以 `packageId`、component id 和 Panel appId 建立稳定索引，保存已验证的 component source。刷新是显式 lifecycle mutation；查询必须保持纯读。

### 6.3 API

提供按稳定身份读取单个 descriptor 的合同：

```text
GET /api/panel-apps/:id
```

它返回与列表 entry 相同的 `PanelAppEntryView`，支持 source id、manifest appId 和 package component id，但不暴露本地路径。standalone 不再先请求 `/api/panel-apps`。

content 和 record-open 复用同一个 target resolver；不能为了判断 package 来源再次全量扫描 catalog。

### 6.4 完整性与恢复

- 安装目录继续只读保护；
- host start 和激活版本变化在发布 snapshot 前校验；
- 显式 verify 保留全量校验；
- catalog 构建失败时 package 不进入 snapshot，并保留 unavailable diagnostic；
- lifecycle mutation 失败时不发布半成品；
- 不新增 TTL、mtime 猜测或请求级 fallback。

## 7. 路由与宿主适配

- Vite build 声明主 HTML 与 standalone HTML 两个 input；
- 开发中间件只 rewrite 匹配的 document request；API、assets 和 iframe content 不参与；
- 生产静态 server 对 standalone 路由返回第二份 HTML，其它 SPA route 继续返回 `index.html`；
- Web 使用真实 `_blank` + `rel="opener"` 链接：NextClaw PWA 的 scope 是 `/`，Chrome 139+ 会捕获 scope 内的非辅助浏览上下文；显式 `opener` 使该同源、可信 standalone 页保持 auxiliary context，由当前浏览器按新标签页处理，同时用 `referrerPolicy="no-referrer"` 不传递来源。
- 不依赖尚未稳定的 `handle_links` manifest 提案，不改变 PWA scope，不新增 IPC/window manager。

## 8. 状态与恢复

| 场景 | 用户表面 | owner | 恢复 |
| --- | --- | --- | --- |
| 首次进入 | 全屏 App 或最小 loading | standalone host | descriptor/content 完成后替换 |
| 未登录 | 既有登录表面 | auth owner | 登录后保留 URL |
| App 不存在/禁用/卸载 | 产品化不可用状态 | target resolver | 原地重试 |
| client grant | 同风险说明与允许/拒绝 | shared host runtime | 拒绝后可重试 |
| Service Action/Agent | 同 bridge、allowlist 与结果 | shared host runtime | 错误回传 iframe |
| 刷新/重进 | 新 token、同 appId、独立 scroll key | kernel + runtime surface | 无旧 token fallback |
| NextClaw 停止 | 明确连接失败 | standalone host | 后端恢复后重试 |

## 9. 抽象审计

命中 `equivalence-by-construction`、`single-complete-owner`、`cqs-pure-read`、`minimal-responsibility-surface` 和 `abstractions-pay-rent`。

- 过小端：CSS/React 条件隐藏，或只切 JS entry，仍保留 HTML/provider/CSS/后端扫描污染。
- 平衡点：两个 UI entry、一个共享 Panel Host Runtime、一个 App Package component catalog、一个单目标 API。
- 过大端：独立仓库/部署、通用微前端 registry、窗口框架、跨 origin token、每个 Panel 独立构建；没有当前消费者，延后。

删除：`ProtectedApp` 内 standalone route、standalone 对 AppPresenter 和全列表 query 的依赖。

保留：稳定 URL、同源认证、现有 content/asset/token/bridge/sandbox contract、真实链接打开方式。

## 10. 验收标准

1. standalone 由独立 HTML/entry 提供，DOM 只包含 Panel 宿主与必要授权表面。
2. 构建依赖闭包不包含主 App、Chat、Inbox、PWA、系统状态、DocBrowser 或 AppPresenter。
3. 初始网络不请求完整 `/api/panel-apps`、系统状态、更新接口或无条件 `/ws`。
4. standalone 与主 App 共同使用同一 runtime surface、bridge、grant、sandbox 和 SDK 合同。
5. descriptor、content 和 record-open 不执行全量安装包 SHA-256 扫描。
6. host start/enable/update/rollback 在发布 component snapshot 前校验；disable/uninstall 正确失效。
7. 直接进入、刷新、登录、not found、grant 允许/拒绝/重试可恢复。
8. 本地生产构建下，后端已运行时首次打开至 iframe 可见不超过 1 秒；热刷新不超过 500ms。开发态首次 transform 单独披露，但不得出现秒级后端扫描。
9. 主 App Panel 和打开菜单无行为退化。
10. UI/Kernel/Server tsc、定向测试、构建图、可维护性和真实浏览器验证通过。

## 11. 非目标

不做独立部署、公开分享、匿名访问、跨 origin token、微前端框架、独立 Electron 窗口、PWA 子应用、云 runtime 或 Panel 状态复制。
