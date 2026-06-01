# Panel App 目录资源令牌化加载方案

## 背景

目录式 Panel App 允许应用拆成 `index.html`、`styles.css`、`app.js` 和图片等多个文件，这是长期正确的开发形态。但远程访问并启用 UI auth 后，目录资源会出现加载失败：

```text
GET /api/panel-apps/<id>/assets/styles.css 401
GET /api/panel-apps/<id>/assets/app.js 401
A resource is blocked by OpaqueResponseBlocking
```

直接原因是目录应用的 HTML 由已认证的宿主请求加载，而 HTML 内的相对资源会在 sandbox iframe 中继续请求 `/api/panel-apps/<id>/assets/*`。这个资源请求不是 `window.nextclaw` bridge 调用，也不会自动带上前端 SDK 的 Bearer header；在远程 UI auth 下，server 返回 401 JSON，浏览器期望 CSS/JS 却收到 JSON，最终被 ORB 阻断。

这不是用户应用写错 CSS/JS，也不是 MIME 映射错误。现有代码已经能把 `.css` 映射成 `text/css`，`.js/.mjs` 映射成 `application/javascript`。问题在于资源请求被 UI auth 拦住。

## 目标

1. 目录式 Panel App 的相对 CSS、JS、图片资源在远程 UI auth 下稳定可加载。
2. 继续保持 iframe sandbox 隔离，不为了资源加载给用户应用打开宿主同源能力。
3. 不把 Panel App 目录资源变成全公开静态目录。
4. Server 保持薄层，资源访问授权、token 生成和 token 校验归 kernel 的 Panel App 领域 owner。
5. 开发者体验保持简单：Panel App 仍只写相对路径，不需要自己处理 token、认证 header 或特殊 SDK。

## 非目标

- 不把 Panel App 资源接入 Service App 授权系统。
- 不把用户应用提升为宿主同源脚本。
- 不支持跨 Panel App 共享资源 token。
- 不在第一版做复杂 CDN、强缓存、ETag 或持久化资源签名。
- 不修复用户应用里写死绝对外链、跨域脚本或浏览器策略不允许的第三方资源。

## 现有链路

当前目录式 Panel App 的加载链路：

```text
宿主 UI
  -> GET /api/panel-apps/:id/content
  -> PanelAppManager.getPanelAppContent()
  -> read index.html
  -> inject <base href="/api/panel-apps/:id/assets/">
  -> iframe 渲染 HTML
  -> iframe 请求 /api/panel-apps/:id/assets/app.js
  -> UI auth middleware 拦截
  -> 401 JSON
  -> 浏览器 ORB 阻断脚本/样式
```

关键代码位置：

- `packages/nextclaw-kernel/src/managers/panel-app.manager.ts`
- `packages/nextclaw-kernel/src/services/panel-app-source.service.ts`
- `packages/nextclaw-kernel/src/utils/panel-app-source.utils.ts`
- `packages/nextclaw-server/src/features/panel-apps/controllers/panel-apps.controller.ts`
- `packages/nextclaw-server/src/app/router.ts`
- `packages/nextclaw-ui/src/features/panel-apps/utils/panel-app-doc-browser.utils.tsx`

## 候选方案

### 方案 A：iframe 增加 `allow-same-origin`

做法：让 Panel App iframe 保持宿主 origin，资源请求自然携带 cookie 或同源凭据。

优点：

- 实现成本最低。
- 对 HTML 资源引用最透明。

问题：

- `allow-scripts` 和 `allow-same-origin` 组合会显著削弱 sandbox 隔离。
- 用户可写 HTML/JS 会更接近宿主同源脚本，安全边界不干净。
- 未来 Panel App 能力越来越强时，这条路会变成长期风险。

结论：不推荐。只有当 Panel App 被迁移到独立 origin 后，才可以重新评估。

### 方案 B：让 `/api/panel-apps/:id/assets/*` 完全免认证

做法：auth middleware 对 Panel App assets 路由放行。

优点：

- 实现简单。
- 不影响 iframe sandbox。

问题：

- `id` 是 base64url 编码的 source name，不是 secret。
- 用户的 Panel App 目录资源会在远程服务上变成可枚举的公开资源。
- 未来资源里可能包含本地生成数据、配置快照或隐私素材，风险过大。

结论：不推荐。

### 方案 C：把目录资源全部内联进 HTML

做法：服务端返回 content 时，把 CSS/JS 读入并内联。

优点：

- 不需要新增公开资源路由。
- 对 auth 最安全，因为仍只有一个 content 请求。

问题：

- 破坏目录式应用的核心价值：多文件组织、图片、字体、模块脚本、动态 import 都会变差。
- 内联规则会很快变复杂，容易变成简陋 bundler。
- 开发体验和真实 Web 心智不一致。

结论：可作为极端止血，不作为长期主线。

### 方案 D：短期签名资源 token

做法：

1. `/api/panel-apps/:id/content` 仍然需要宿主认证。
2. `PanelAppManager.getPanelAppContent()` 读取目录应用时，生成一个短期 asset token。
3. HTML 注入 `<base href="/api/panel-app-assets/<token>/">`。
4. 新增 `GET /api/panel-app-assets/:token/*`，这条路由在 auth middleware 层允许进入 controller。
5. controller 调 `PanelAppManager.getPanelAppAssetByToken(token, assetPath)`。
6. kernel 校验 token 是否有效、是否只绑定当前 Panel App、是否过期，再复用 `PanelAppSourceService.getAsset()` 读取资源。

优点：

- 保留 sandbox 隔离。
- 目录资源不全公开，必须拿到 content 阶段注入的短期 token。
- 对开发者透明，仍写相对路径。
- Server 只做路由和 HTTP response，领域语义留在 kernel。
- 未来可扩展到缓存、轮换、失效、审计，而不改变 Panel App 开发合同。

问题：

- 需要新增一个 token 校验域对象或 service。
- token 出现在 HTML 和资源 URL 中，浏览器开发者工具可见；因此 token 必须短期、窄作用域、只读资源。
- content 刷新后旧 token 是否继续有效需要明确策略。

结论：推荐。

## 推荐方案

采用方案 D：短期签名资源 token。

### 为什么这是正确 owner

命中的设计原则：

- `information-expert`：Panel App 资源 token 绑定哪个应用、资源根目录在哪、资源路径是否合法，最了解这些事实的是 Panel App 领域 owner。
- `complete-owner`：`PanelAppManager` 已经拥有 list/content/asset/bridge session/capability grant 的领域闭环，资源 token 是 content 与 asset 的同一领域内授权事实，不应外包给 server。
- `cqs-pure-read`：list/content/asset 仍是读路径。生成短期只读 asset token 是 content 响应的访问凭证派生，不启动外部资源、不写用户持久状态。
- `boundary-normalization`：server 只处理 HTTP 和 middleware 例外；token 解析、过期、scope 校验属于 kernel 业务边界。

### 资源 token 语义

资源 token 是短期、只读、只绑定一个 Panel App source 的访问凭证。

建议字段：

```ts
type PanelAppAssetTokenClaims = {
  panelAppId: string;
  sourceName: string;
  expiresAt: number;
  nonce: string;
};
```

token 形态推荐：

```text
base64url(json).base64url(hmacSha256(json, secret))
```

secret 来源：

- 第一版可由 `PanelAppAssetTokenService` 在进程内随机生成。
- token 只用于当前服务进程内短期资源加载，不要求重启后继续可用。
- 如果未来需要跨进程或重启后保持 content HTML 可用，再改为从 config 派生或持久化 secret。

TTL 建议：

- 默认 2 小时。
- 理由：足够覆盖用户打开一个应用后的正常使用，不会因为几分钟超时导致图片/动态 import 突然失败；同时泄露窗口有限。
- 过期后 iframe 刷新会重新请求 content，获得新 token。

错误语义：

- token 缺失、格式非法、签名错误：`401 PANEL_APP_ASSET_TOKEN_INVALID`。
- token 过期：`401 PANEL_APP_ASSET_TOKEN_EXPIRED`。
- token 有效但资源不存在：`404 PANEL_APP_NOT_FOUND`。
- token 有效但路径越界：`400 PANEL_APP_INVALID_ASSET_PATH`。

### 路由设计

保留现有认证资源路由：

```text
GET /api/panel-apps/:id/assets/*
```

它继续需要 UI auth，可供宿主 UI、测试或未来管理界面使用。

新增 tokenized route：

```text
GET /api/panel-app-assets/:token/*
```

这条路由由 auth middleware 特例放行，但只放行到 Panel Apps controller，controller 必须让 kernel 校验 token 后才能读资源。

不推荐使用 query token：

```text
<base href="/api/panel-apps/:id/assets/?token=...">
```

原因是 `<base>` 下的相对路径、子目录资源和动态 import 对 query 拼接不稳定；path segment 更符合浏览器 URL 解析直觉。

## 代码结构方案

### Kernel

新增或调整：

```text
packages/nextclaw-kernel/src/services/panel-app-asset-token.service.ts
packages/nextclaw-kernel/src/types/panel-app.types.ts
packages/nextclaw-kernel/src/utils/panel-app-source.utils.ts
packages/nextclaw-kernel/src/managers/panel-app.manager.ts
packages/nextclaw-kernel/src/managers/__tests__/panel-app.manager.test.ts
```

职责划分：

- `PanelAppManager`
  - 长期持有 `PanelAppSourceService`。
  - 长期持有 `PanelAppAssetTokenService`。
  - `getPanelAppContent(id)` 为目录式应用创建 asset base。
  - `getPanelAppAssetByToken(token, assetPath)` 校验 token 并读取资源。

- `PanelAppSourceService`
  - 继续只负责 source 发现、manifest 读取、asset 文件读取。
  - 不感知 token、不感知 HTTP、不感知 UI auth。

- `PanelAppAssetTokenService`
  - 负责 issue/verify asset token。
  - 持有进程内 secret。
  - 不读文件、不知道 workspace 路径。

- `panel-app-source.utils.ts`
  - 将 `injectPanelAppAssetBase(html, baseHref)` 调整为接收完整 base href，而不是只接收 id。
  - 继续保留路径归一化和 content-type 解析。

建议 public API：

```ts
class PanelAppManager {
  getPanelAppContent = async (id: string): Promise<PanelAppContent>;
  getPanelAppAsset = async (id: string, assetPath: string): Promise<PanelAppAsset>;
  getPanelAppAssetByToken = async (
    token: string,
    assetPath: string,
  ): Promise<PanelAppAsset>;
}
```

`getPanelAppAsset()` 保持为认证路由使用；`getPanelAppAssetByToken()` 是 tokenized route 使用。

### Server

调整：

```text
packages/nextclaw-server/src/app/router.ts
packages/nextclaw-server/src/features/panel-apps/controllers/panel-apps.controller.ts
packages/nextclaw-server/src/features/panel-apps/controllers/panel-apps.controller.test.ts
packages/nextclaw-server/src/app/router.auth.test.ts
```

职责划分：

- `router.ts`
  - 在 UI auth middleware 中只新增一个窄放行条件：
    `path.startsWith("/api/panel-app-assets/")`。
  - 注册 `GET /api/panel-app-assets/:token/*`。

- `PanelAppsRoutesController`
  - 新增 `getPanelAppAssetByToken`。
  - 只负责读 URL path、调用 manager、返回 content-type/cache-control。
  - 不解析、不验证 token 业务语义。

`cache-control` 第一版建议继续使用：

```text
no-store
```

原因是 token 有 TTL，第一版先保证行为可预测；后续如果要优化性能，再引入带 token scope 的短缓存策略。

### UI

UI iframe sandbox 不需要变化：

```ts
allow-scripts
allow-forms
allow-modals
allow-popups
allow-popups-to-escape-sandbox
allow-downloads
allow-pointer-lock
allow-presentation
```

明确不增加 `allow-same-origin`。

`allow="clipboard-read; clipboard-write"` 在部分浏览器出现“不支持 feature name”警告，不是本次样式丢失的根因。它可以另开体验清理任务；不要和资源 token 修复混在一起。

## 体验问题与处理

### 1. 资源过期后应用突然失效

风险：用户长时间停留在一个 Panel App 页面，token 过期后，后续动态 import、懒加载图片或新 CSS 请求失败。

第一版处理：

- TTL 设为 2 小时。
- 静态 CSS/JS 通常在首次加载完成后不再请求，实际影响有限。
- 过期返回明确错误码，宿主刷新 iframe 可恢复。

后续增强：

- bridge 可监听 asset token expired 的资源加载失败并提示“刷新应用”。
- 或 content route 注入轻量 reload helper，但第一版不做。

### 2. 用户复制 HTML 后资源 URL 带 token

风险：token 暴露在 devtools、复制链接、日志里。

处理：

- token 只读、只绑定单个 Panel App assets、短期过期。
- token 不允许调用 bridge、Service Action、Agent 或宿主 API。
- token 不包含明文 secret。

### 3. 路由放行被误认为公开资产

风险：server auth middleware 放行新路由，看起来像公开入口。

处理：

- 路由命名使用 `panel-app-assets`，和认证管理路由区分。
- controller 方法命名必须带 `Token`，例如 `getPanelAppAssetByToken`。
- 测试覆盖 bad token 不能读资源。

### 4. 图标资源是否也改走 token

Panel App 列表里的 icon 当前由宿主 UI 渲染，不在 sandbox iframe 内。宿主 UI 自己有认证上下文，因此可以继续走 `/api/panel-apps/:id/assets/*`。

第一版不强行统一 icon 路径，避免把列表展示和 iframe 内容加载耦合起来。

### 5. 单文件 Panel App 是否受影响

单文件 Panel App 没有目录资源，不需要 asset token。

不过开发者合同仍应只推荐目录式 Panel App。单文件可作为历史兼容存在，不在 skill 主路径里宣传。

## 安全边界

资源 token 只解决“HTML 内相对静态资源如何加载”的问题，不扩大 Panel App 权限。

它不能：

- 读 Panel App 目录外文件。
- 调用 `/api/service-actions`。
- 调用 `/api/panel-app-agent/*`。
- 读取 workspace 其他目录。
- 绕过 Panel App manifest capability/action allowlist。

路径安全仍由 `resolvePanelAppRelativePath()` 兜底，token 只决定“这个请求是否有权进入这个 Panel App 的资源目录”。

## 验收标准

### 单元测试

Kernel：

1. 目录式 `getPanelAppContent()` 注入 `/api/panel-app-assets/<token>/` base。
2. `getPanelAppAssetByToken(validToken, "styles.css")` 返回 `text/css`。
3. bad token 返回 `PANEL_APP_ASSET_TOKEN_INVALID`。
4. expired token 返回 `PANEL_APP_ASSET_TOKEN_EXPIRED`。
5. path traversal 仍返回 `PANEL_APP_INVALID_ASSET_PATH`。

Server：

1. UI auth 开启时，`/api/panel-apps/:id/assets/*` 无认证仍返回 401。
2. UI auth 开启时，`/api/panel-app-assets/:token/styles.css` 使用有效 token 返回 200。
3. UI auth 开启时，bad token 不能读取资源。
4. tokenized asset response 带正确 `content-type`。

### 冒烟验收

使用临时 workspace 创建目录式 Panel App：

```text
panels/health-tracker.panel/
  panel-app.json
  index.html
  styles.css
  app.js
```

在开启 UI auth 的服务中验证：

- 打开 Panel App，无 ORB 报错。
- Network 中 `styles.css` 返回 `200 text/css`。
- Network 中 `app.js` 返回 `200 application/javascript`。
- 页面样式生效，脚本执行。
- iframe sandbox 仍不包含 `allow-same-origin`。

### 回归验收

- Panel App bridge session 创建、Service Action 授权、Agent capability 授权不受影响。
- Panel App 列表 icon 仍正常展示。
- 单文件 Panel App 仍能打开。

## 发布与文档

这是运行时 bugfix，建议按 patch 发布。

如同时调整内置 `panel-app-creator` skill，可补充一句：

> 目录式 Panel App 内的 CSS、JS、图片使用相对路径即可；NextClaw 会在加载时自动处理安全资源基址，不要手写 `/api/panel-apps/.../assets/...`。

不需要让应用开发者理解 token 机制。

## 决策结论

推荐一次性实现“短期签名资源 token”方案。

它比 `allow-same-origin` 更安全，比完全公开 assets 更可控，比内联资源更符合目录式应用长期方向。代码上保持单一职责：kernel 拥有 Panel App 资源访问语义，server 只做薄路由，UI 继续保持 sandbox 隔离。这个方案符合 NextClaw 的生态扩展方向：让用户和 AI 能轻松创建可分发的小应用，同时不把宿主安全边界和远程鉴权体验做脏。
