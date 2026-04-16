# NextClaw UI Installable PWA Shell Design

**Goal:** 为 `packages/nextclaw-ui` 定义一套一次性可落地的 PWA 产品与实现方案，让同一套 NextClaw 主产品 UI 同时支持三种进入方式：浏览器直接访问、本机 `localhost` 访问后安装为 PWA、部署到服务器后通过 HTTPS 访问并安装为 PWA。目标不是把 NextClaw 变成离线优先应用，而是让 UI 更像一个稳定、自然、低门槛的默认入口。

**Architecture:** 采用“同一套 Web UI，增加 installable shell 能力”的路线。PWA 只负责安装入口、窗口化体验、启动元信息、最小静态壳缓存与版本更新协调；业务数据、运行时控制、聊天、配置、远端连接等仍然沿用现有 Web 架构，不为 PWA 再分叉一套产品逻辑。桌面宿主能力继续由 `window.nextclawDesktop` 桥接提供，PWA 不模拟桌面桥接，也不承诺在浏览器沙箱中替代 Electron 或本地宿主管理能力。

**Tech Stack:** Vite、React、TypeScript、`@nextclaw/ui`、Web App Manifest、Service Worker、安装提示状态管理、最小离线兜底页、现有 runtime control / desktop bridge / router 结构。

---

## 长期目标对齐 / 可维护性推进

- 这项设计直接服务 `docs/VISION.md` 中“统一入口、统一体验、开箱即用”的目标。NextClaw 想成为 AI 时代的个人操作层，就需要让用户更自然地把它当成一个可长期停留在桌面和浏览器启动面的入口，而不是每次都先想“打开哪个网址”或“这是网页还是应用”。
- 这次不是在堆一个孤立前端 feature，而是在补齐 NextClaw 主 UI 的“可安装入口形态”：
  - 本地运行时，`http://localhost` 访问的 UI 可以被安装为类应用入口。
  - 远端部署时，HTTPS 访问的 UI 也可以被安装为类应用入口。
  - 浏览器访问和 PWA 安装访问保持同一产品语义，而不是衍生双轨行为。
- 维护性方向：
  - 不为 PWA 引入第二套页面入口、第二套路由、第二套宿主能力判断。
  - 不把“支持安装”误写成“支持完整离线”，避免后续被迫叠加复杂缓存、状态同步和兼容分支。
  - 把 PWA 增量收敛为少量清晰 owner：manifest、service worker、install manager、install UI、入口注册。

---

## 问题重新定义

当前讨论的重点不是“要不要支持断网缓存聊天”，而是下面四个更基础的问题：

1. NextClaw 主产品 UI 能不能被用户自然地安装成一个桌面入口？
2. 本地运行与远端部署，能否共用同一套可安装入口模型？
3. PWA 是否应该只增强入口体验，而不是承担宿主和运行时本体职责？
4. 这次能否一次性实现完整，而不引入后续高维护成本的双轨逻辑？

本方案的回答是：

- `是`，应该支持安装。
- `是`，本地与远端共用同一套 UI PWA 壳。
- `是`，PWA 只做入口壳，不做宿主替代。
- `是`，可以一次性完成，但必须先把边界写清楚。

---

## 当前现状

### UI 现状

- `packages/nextclaw-ui` 当前是标准 Vite React 应用。
- 入口位于 `packages/nextclaw-ui/src/main.tsx`，当前只负责挂载 `ThemeProvider`、`I18nProvider`、`BrowserRouter` 和 `App`。
- `packages/nextclaw-ui/index.html` 已有基础 `title`、`viewport`、`favicon`，并已有 `public/logo.svg` 可作为初始图标来源。
- 当前没有 manifest、没有 service worker、没有安装提示、没有 PWA 注册流程。

### 宿主边界现状

- 当前 UI 已通过 `window.nextclawDesktop` 感知 Electron 桌面宿主能力。
- `packages/nextclaw-ui/src/runtime-control/runtime-control.manager.ts` 会在存在桌面桥接时将运行环境装饰为 `desktop-embedded`。
- 这说明现有 UI 已经有“Web 宿主 / Desktop 宿主”差异感知，但 PWA 尚未作为一种明确安装形态进入产品模型。

### 现有风险

- 如果直接“顺手加个 PWA 插件”而不定义边界，后面很容易把 PWA 误当成 Electron 替代或误承诺完整离线。
- 如果把安装能力散落到入口、路由、若干页面按钮里，会迅速形成一组难以维护的浏览器分支。
- 如果强行为局域网非安全上下文兜底，会把产品逻辑和浏览器安全限制缠在一起，制造大量 surprise failure。

---

## 产品定位

### 结论

`packages/nextclaw-ui` 的 PWA 应定义为：

**Installable PWA Shell for NextClaw UI**

它的职责是：

- 让用户更容易把 NextClaw 安装成入口
- 让安装后的体验更像应用窗口，而不是普通标签页
- 让本地运行与远端部署共享同一套进入方式
- 让安装流程、图标、名称、启动页、更新体验更正式

它不负责：

- 替代 Electron 桌面桥接
- 替代本地服务管理器
- 提供完整离线聊天、离线配置或离线执行
- 为断网场景兜底出一套隐藏的业务行为

### 核心产品原则

1. 同一套 UI，同一套路由，同一套业务逻辑。
2. PWA 是安装形态，不是第二产品线。
3. 本地与远端都可安装，但必须尊重浏览器安全上下文约束。
4. 默认行为应诚实可预测，不制造“像能离线，其实不能”的错觉。

---

## 范围定义

### 本次必须包含

1. 为 `packages/nextclaw-ui` 增加 manifest。
2. 为 `packages/nextclaw-ui` 增加最小 service worker。
3. 增加安装能力检测与安装引导 UI。
4. 增加安装后窗口化体验所需的 metadata、图标和 display 配置。
5. 增加一个“安装可用 / 已安装 / 当前环境不支持安装”的统一状态模型。
6. 增加最小离线壳与明确文案，防止 service worker 存在但用户看到空白页。
7. 增加验证与验收方案，覆盖本地 `localhost` 与 HTTPS 远端部署两类场景。

### 本次明确不做

1. 不做离线聊天。
2. 不做业务数据离线缓存。
3. 不做消息草稿或配置改动的离线持久同步。
4. 不做 push notification。
5. 不做局域网普通 HTTP 地址安装兜底。
6. 不为 PWA 增加独立路由前缀或独立 UI 皮肤。

---

## 用户场景

### 场景 A：本地运行，本机访问

- 用户通过本地启动的 NextClaw runtime 打开 UI。
- 浏览器访问 `http://localhost:<port>` 或 `http://127.0.0.1:<port>`。
- 用户看到“安装 NextClaw”入口。
- 安装后，NextClaw 以独立窗口打开，成为本地桌面入口之一。

### 场景 B：远端部署，浏览器访问

- 用户通过 HTTPS 域名访问部署在服务器上的 NextClaw UI。
- 用户可继续在浏览器中使用，也可安装为 PWA。
- 安装后，窗口化体验与浏览器访问共享同一账号、同一站点、同一路由。

### 场景 C：桌面宿主中访问 UI

- 当 UI 运行在 Electron 宿主内，现有 `window.nextclawDesktop` 继续作为桌面专属能力来源。
- PWA 逻辑不应干扰桌面桥接，也不应在 Electron 宿主中强推安装提示。
- 桌面宿主优先级高于 PWA 安装形态。

---

## 统一能力模型

建议在 UI 内显式定义一个安装形态状态模型，而不是散落布尔判断。

### `InstallabilityState`

- `unsupported`
  - 当前环境不满足安装前提，或浏览器根本不支持相关能力。
- `available`
  - 当前可触发安装。
- `installed`
  - 当前以已安装形态运行，或浏览器明确标记为 standalone。
- `suppressed`
  - 理论可安装，但当前宿主不应展示安装入口，例如 Electron 内嵌宿主。

### 判断来源

- `window.matchMedia('(display-mode: standalone)')`
- iOS Safari navigator 兜底判断
- `beforeinstallprompt` 事件
- `window.nextclawDesktop` 是否存在
- 当前 origin 是否是允许注册 SW 和 manifest 的安全上下文

### 为什么要单独建模

- 这样安装 UX、状态提示、菜单入口、设置页说明都能复用同一真相源。
- 后续若要扩展“已安装后隐藏提示”“解释当前为何不可安装”等能力，也不会继续长条件分支。

---

## 架构方案

### 推荐路线

采用“最小 PWA 基建 + 显式安装管理器”的结构：

- `manifest` 负责名称、图标、主题色、展示模式、启动 URL。
- `service worker` 只负责安装需要的最小静态壳和版本更新。
- `install manager` 作为清晰 owner，统一处理安装状态、浏览器事件、宿主抑制逻辑和 UI 可见性。
- 页面层只消费 `installability` 视图，不直接碰浏览器原始事件。

### 不推荐路线

1. 纯插件黑盒路线
   - 风险：生成物方便，但状态模型与产品文案容易散落，后续不好治理。

2. 页面局部随处塞安装按钮路线
   - 风险：条件判断碎片化，宿主冲突和提示时机不可控。

3. 离线优先路线
   - 风险：远超本次需求，会引入缓存一致性、数据同步、故障恢复等长期成本。

### 推荐 owner 划分

- `PwaInstallManager`
  - 安装事件捕获
  - 安装状态归一化
  - 宿主抑制逻辑
  - 安装动作执行
- `PwaRuntimeManager`
  - service worker 注册
  - 更新发现与刷新提示
  - 最小运行环境判断
- `PwaInstallEntry` 组件
  - 安装按钮 / 提示条 / 不支持原因展示

这能保持“业务页面不直接碰浏览器底层 API”，符合现有代码中 manager owner 的方向。

---

## 具体实现设计

### 1. Manifest

新增 `packages/nextclaw-ui/public/manifest.webmanifest`。

建议内容：

- `name`: `NextClaw`
- `short_name`: `NextClaw`
- `description`: 面向用户的统一 AI 操作入口
- `display`: `standalone`
- `background_color`: 与当前 UI 背景主色对齐
- `theme_color`: 与品牌主色对齐
- `start_url`: `/`
- `scope`: `/`
- `icons`: 至少提供 `192x192` 与 `512x512`

注意点：

- 首版不要使用独立的 `start_url` 参数拼 query 作为模式分支。
- 不要为 PWA 单独创建 `/app` 或 `/pwa` 路径。

### 2. 图标资源

新增或生成：

- `packages/nextclaw-ui/public/pwa-192.png`
- `packages/nextclaw-ui/public/pwa-512.png`
- 视需要补一个 `maskable` 版本

图标应优先复用现有 NextClaw 品牌资产，而不是临时生成一套与桌面端不一致的视觉形态。

### 3. Service Worker

首版建议采用最小手写 SW 或可控插件产物，目标只有两个：

- 缓存应用壳关键静态资源
- 在新版本 ready 时给出刷新提示

缓存范围：

- `index.html`
- 入口 JS/CSS 构建产物
- manifest
- icons
- 最小离线 fallback 页面

明确不缓存：

- `/api`
- `/ws`
- 聊天数据接口
- 配置读写接口
- marketplace 动态数据

请求策略建议：

- 静态壳：`stale-while-revalidate` 或版本化 precache
- HTML 导航：网络优先，失败时返回离线 fallback
- API / WS：直接透传，不进 SW 业务代理

### 4. 安装状态 owner

新增一个独立 manager，例如：

- `packages/nextclaw-ui/src/pwa/managers/pwa-install.manager.ts`

职责：

- 监听 `beforeinstallprompt`
- 持有 deferred prompt
- 暴露 `getInstallability()` / `promptInstall()` / `dismissInstallHint()`
- 基于 `window.nextclawDesktop` 判断是否压制 PWA 安装入口
- 基于 `display-mode` 判断当前是否已安装

为什么必须单独 owner：

- 安装是“宿主级产品状态”，不是某个页面自己的局部 UI 状态。
- 后续聊天页、设置页、欢迎页都可能消费这个状态，manager 化更稳。

### 5. 安装入口 UI

首版推荐两个入口，避免既太隐藏又太打扰：

1. 全局轻提示入口
   - 在首页或主布局中展示一次可关闭提示。
   - 只在 `available` 状态下出现。

2. 设置页常驻入口
   - 在设置或运行环境相关页面里展示“安装 NextClaw”卡片。
   - `unsupported` 时展示原因说明。
   - `installed` 时展示“已作为应用安装”状态。

文案原则：

- 不写“离线可用”。
- 不写“替代桌面应用”。
- 明确表达“安装后可像应用一样从桌面或启动器打开 NextClaw”。

### 6. 运行时行为

PWA 安装后，业务逻辑仍与普通 Web 访问一致：

- 远端访问继续连远端服务。
- 本地访问继续连本地服务。
- 若服务不可用，继续按现有 runtime / auth / remote access 逻辑反馈。
- 不因为“已安装”而新增静默 fallback。

### 7. 更新体验

PWA 首版需要最小更新策略：

- 新 SW 安装完成后，UI 可提示“发现新版本，刷新后生效”。
- 不做静默强刷。
- 不做复杂多标签页协商。

这能让安装形态更像正式产品，同时不把更新协议复杂化。

---

## 宿主与环境边界

### 安全上下文约束

PWA 可安装的基础前提：

- `http://localhost` / `http://127.0.0.1`
- 或 HTTPS 域名

普通非安全上下文的局域网 HTTP 地址不应作为首版承诺能力。

### 与 Electron 的关系

- Electron 宿主已经是更高优先级的本地应用壳。
- 当 `window.nextclawDesktop` 存在时，PWA 安装入口默认应压制为 `suppressed`。
- 不应该在 Electron 内嵌 UI 中继续鼓励用户“再安装一个 PWA”。

### 与 self-hosted Web 的关系

- self-hosted Web 可以安装为 PWA，但服务生命周期仍由宿主控制。
- PWA 不接管服务启动、停止、后台常驻或系统自启动。

---

## 文件与模块改动建议

### 新增文件

- `packages/nextclaw-ui/public/manifest.webmanifest`
- `packages/nextclaw-ui/public/pwa-192.png`
- `packages/nextclaw-ui/public/pwa-512.png`
- `packages/nextclaw-ui/public/offline.html`
- `packages/nextclaw-ui/src/pwa/managers/pwa-install.manager.ts`
- `packages/nextclaw-ui/src/pwa/managers/pwa-runtime.manager.ts`
- `packages/nextclaw-ui/src/pwa/components/pwa-install-entry.tsx`
- `packages/nextclaw-ui/src/pwa/pwa.types.ts`
- `packages/nextclaw-ui/src/pwa/register-pwa.ts`

### 修改文件

- `packages/nextclaw-ui/vite.config.ts`
  - 接入 PWA 产物配置或注册构建逻辑。
- `packages/nextclaw-ui/index.html`
  - 引入 manifest、theme-color、apple touch meta 等最小头信息。
- `packages/nextclaw-ui/src/main.tsx`
  - 增加 PWA 注册入口。
- `packages/nextclaw-ui/src/app.tsx`
  - 挂载全局安装提示入口或 provider。
- `packages/nextclaw-ui/src/vite-env.d.ts`
  - 补充 PWA 相关 Window / Event 类型扩展。

### 可选复用位点

- 若当前已有全局 presenter/provider 适合接入宿主级状态，可把 PWA manager 通过现有 presenter context 暴露，而不是再开一套杂乱 hook。
- 若当前设置页已有“运行环境 / 桌面更新 / 远程访问”类入口，PWA 安装卡片可优先放到这一区域，避免新增独立页面。

---

## 测试与验证

### 自动化验证

至少补以下层次：

1. Unit
   - `PwaInstallManager` 状态归一化
   - `beforeinstallprompt` 捕获与 prompt 生命周期
   - `display-mode: standalone` 判断
   - Electron 宿主抑制逻辑

2. Component
   - 安装按钮在 `available / installed / unsupported / suppressed` 下的展示差异
   - 设置页卡片文案是否正确

3. Build
   - manifest、icons、SW 是否进入产物
   - 构建后入口 HTML 是否引用正确资源

### 冒烟验证

至少覆盖两类真实场景：

1. 本机 `localhost`
   - 启动 NextClaw UI
   - 用 Chromium 访问本地地址
   - 确认可出现安装入口
   - 执行安装
   - 确认安装后以 standalone 窗口打开
   - 确认聊天、设置、runtime 页面正常工作

2. HTTPS 远端部署
   - 构建并部署到测试域名
   - 浏览器访问
   - 确认 manifest、SW、安装入口可用
   - 安装后验证主要路由和登录态正常

### 首版可接受的“不适用”

- 非安全上下文局域网 HTTP 安装能力：不适用，由浏览器限制决定。
- 完整离线业务能力：不适用，本次目标不是离线产品。

---

## 验收标准

满足以下条件即可认为本方案落地完成：

1. `packages/nextclaw-ui` 可被浏览器识别为可安装 PWA。
2. `localhost` 访问场景可完成真实安装。
3. HTTPS 部署场景可完成真实安装。
4. 已安装形态与普通浏览器访问共用同一套业务 UI。
5. Electron 宿主内不会错误展示 PWA 安装提示。
6. 断网或资源更新时不会出现无解释空白页。
7. 没有把 `/api`、`/ws`、业务动态数据错误缓存进 SW。

---

## 实施顺序

### Phase 1: 基建

- 补 manifest
- 补图标
- 补 index.html meta
- 接入 SW 构建与注册

### Phase 2: 产品状态 owner

- 新增 `PwaInstallManager`
- 新增状态模型与类型
- 挂接到应用入口

### Phase 3: UI 入口

- 增加全局安装提示
- 增加设置页常驻安装入口
- 明确 unsupported / installed 文案

### Phase 4: 验证与收尾

- 单测与组件测试
- 本地 `localhost` 冒烟
- HTTPS 冒烟
- 校准安装后窗口体验

这四个阶段可以在一个 implementation batch 内一次性完成，不需要拆成多轮产品设计。

---

## 风险与防漂移约束

### 风险 1：被误解为“既然装成 PWA，就应该完整离线”

处理方式：

- 文案不承诺离线。
- SW 明确不缓存业务接口。
- 离线 fallback 只表达“应用壳已加载，但需要连接 NextClaw 服务”。

### 风险 2：Electron 与 PWA 提示冲突

处理方式：

- 统一由 install manager 基于 `window.nextclawDesktop` 压制安装入口。

### 风险 3：局域网普通 HTTP 安装诉求

处理方式：

- 文档和 UI 原则上说明浏览器限制。
- 不在首版实现自定义 hack 或环境分叉。

### 风险 4：实现时偷懒把浏览器原始事件散落到多个组件

处理方式：

- 强制以 manager owner 收敛。
- 页面和组件只消费归一化状态。

---

## 最终结论

NextClaw 主产品 UI 应该一次性接入 PWA，但必须把它定义成：

**“可安装的统一入口壳”**

而不是：

**“浏览器里另一套宿主”**

只要坚持这个边界，这项工作就会同时增强：

- 统一入口地位
- 本地开箱即用体验
- 远端部署的可安装能力
- 主 UI 的产品完成度

同时不会把系统拖进高成本的离线双轨复杂度。

---

## 本次文档留痕说明

- 本次仅新增设计文档，默认写入 `docs/plans`。
- 这属于设计沉淀，不自动新增 `docs/logs` 迭代目录；后续若进入代码实现，再在收尾阶段按迭代制度判断是否需要新增或合并迭代记录。
