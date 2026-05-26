# Panel Apps 启动器设计

## 背景

Panel Apps 第一版已经能从 workspace 的 `panels/` 目录发现并打开 `*.panel.html` 单文件应用，但它仍然更像文件列表，而不是长期可用的轻量应用入口。随着应用数量增长，列表需要回答三个问题：

- 默认按什么顺序展示。
- 用户如何看到必要的时间与描述信息。
- 用户如何把常用应用固定到更靠前的位置。

这次设计目标不是把 Panel Apps 做成完整 marketplace 或 package 系统，而是在保持单 HTML 低门槛的前提下，补齐启动器需要的最小信息层。

## 设计原则

Panel Apps 使用三层叠加模型：

1. **文件事实层**：永远存在，保证 `*.panel.html` 无 manifest、无状态也能打开。
2. **用户偏好层**：记录用户怎么使用这个应用，例如收藏、最近打开、打开次数。
3. **极轻 manifest 层**：允许应用用 HTML 内 meta 提供标题、描述和图标。

三层职责不能混：

- 文件事实描述“它从哪里来、什么时候变了”。
- 用户偏好描述“用户怎么用它”。
- manifest 描述“应用想如何被展示”。

## 文件事实层

`PanelAppManager` 继续扫描 workspace 下的 `panels/` 目录，只识别直接子文件中的 `*.panel.html`。

基础字段：

- `id`
- `fileName`
- `title`
- `contentPath`
- `updatedAt`
- `sizeBytes`

默认标题推导顺序：

1. `nextclaw-panel-title` meta
2. HTML `<title>`
3. 文件名去掉 `.panel.html` 后的人类可读名称

## 极轻 Manifest 层

manifest 暂时不单独引入 `.json` 文件，而是用 HTML meta，保持单文件应用心智。

支持字段：

```html
<meta name="nextclaw-panel-title" content="番茄便签">
<meta name="nextclaw-panel-description" content="轻量番茄钟和任务清单">
<meta name="nextclaw-panel-icon" content="🍅">
```

第一版只支持这三个字段。不支持 permissions、version、author、category、commands、sortWeight 等更重字段。

## 用户偏好层

偏好由 kernel 的 `PanelAppManager` 管理，server 只暴露薄 API，UI 不直接用 localStorage 持久化。

状态文件建议放在 `panels/.panel-apps.state.json`：

```json
{
  "version": 1,
  "apps": {
    "app-id": {
      "favorite": true,
      "lastOpenedAt": "2026-05-27T10:00:00.000Z",
      "openCount": 12
    }
  }
}
```

第一版只支持：

- `favorite`
- `lastOpenedAt`
- `openCount`

打开应用时记录 `lastOpenedAt` 与 `openCount`。点击星标时更新 `favorite`。

## 排序

默认排序为智能排序：

1. 收藏优先。
2. 收藏内部按最近打开倒序。
3. 非收藏按最近打开倒序。
4. 没打开过的按最近更新倒序。
5. 最后按标题排序。

UI 提供胶囊式模块切换，而不是原生下拉选择：

- 智能排序
- 收藏
- 最近打开
- 最近更新
- 名称

模块切换本身是视图偏好，不需要第一版持久化。`收藏` 只展示收藏应用；`最近打开` 只展示已经打开过的应用；其他模块展示全部应用并按对应规则排序。

## UI

Panel Apps 列表从“文件列表”收敛为“应用启动器”。

顶部：

- 标题：面板应用
- 目录说明：问号 tooltip
- 刷新按钮

标题下方：

- 胶囊式模块切换：智能排序、收藏、最近打开、最近更新、名称

应用项：

- icon：manifest icon 或默认 AppWindow 图标
- title：manifest/title/fileName 推导标题
- description：manifest description，有则展示
- secondary line：最近打开时间优先，否则更新时间
- favorite：右侧星标按钮

点击应用项打开应用，同时记录打开状态。点击星标只更新收藏，不打开应用。

Panel App iframe 使用比普通文档更偏应用化的 sandbox：

- `allow-scripts`
- `allow-same-origin`
- `allow-forms`
- `allow-modals`
- `allow-popups`
- `allow-popups-to-escape-sandbox`
- `allow-downloads`
- `allow-pointer-lock`
- `allow-presentation`

第一版选择允许同源脚本能力，是因为 Panel Apps 的目标不是只展示静态 HTML，而是允许用户写出真正能交互、能使用浏览器本地状态、未来也能调用 NextClaw API 的轻应用。安全边界后续应升级为独立 origin / webview 权限模型，而不是在 MVP 里把本地应用能力锁死。

## API

现有：

- `GET /api/panel-apps`
- `GET /api/panel-apps/:id/content`

新增：

- `PATCH /api/panel-apps/:id/preferences`
  - request: `{ favorite?: boolean }`
  - response: 更新后的 `PanelAppEntry`
- `POST /api/panel-apps/:id/open`
  - 记录打开状态
  - response: 更新后的 `PanelAppEntry`

server controller 只做参数读取、错误映射和响应包装；文件扫描、manifest 解析、状态读写与排序字段合成都在 `PanelAppManager`。

## 验收标准

- 没有 manifest 的 `.panel.html` 仍然可以被列出并打开。
- 有 meta 的应用能展示自定义标题、描述和 icon。
- 收藏应用排在智能排序前面。
- 打开应用后，最近打开时间和打开次数会更新。
- UI 可以切换智能排序、最近打开、最近更新、名称。
- 文件路径不作为主信息展示，只在 tooltip 中辅助说明。
