# 展示内容参数合同设计

## 背景与目标

NextClaw 已经有一条统一的内容展示主链路：

```text
Agent 输出 / 展示工具
  -> UiShowContentTarget / ChatInlineDisplayTarget
  -> ChatThreadManager / ChatUiManager
  -> 内联卡片或右侧栏
  -> Panel App iframe / rendered HTML iframe
```

现有 `panel_app` 目标只能携带 `appId` 与可选来源 `path`，`file` 目标只能携带文件定位与 viewer。调用者无法把本次展示所需的数据交给内容运行时，导致 Panel App 和 rendered HTML 往往需要把数据写死、再查一次外部状态，或为每份数据生成一份新文件，无法作为可复用的展示组件使用。

本次目标是让 `panel_app` 与 rendered HTML 的同一次展示请求可以携带可序列化 `params`，并让内联卡片与右侧栏使用同一合同、同一宿主入口。典型场景包括：

- 图表 Panel App 接收本次图表数据与标题；
- 图片编辑 Panel App 接收文件路径和初始工具配置；
- 本地 HTML 可视化接收数据，而不需要把数据内嵌进 HTML 文件；
- 内联展示展开到右侧栏后继续使用相同输入。

成功标准：

1. `show_panel_app`、`show_file`、`nextclaw-inline` 可以携带 JSON object `params`。
2. Panel App 与 rendered HTML 在自己的首段脚本执行时即可同步读取 `window.nextclaw.params`。
3. 内联与右侧栏、工具事件与 Markdown 声明都保留同一份参数。
4. 参数不进入 URL、服务端日志或长期服务端状态。
5. 未传参数时现有行为、URL、去重和 bridge 能力保持不变。

## 现状证据

### Panel App

- `UiShowContentTarget`、`ChatUiShowContentTarget` 与 `ChatInlineDisplayTarget` 已经是现有展示合同 owner。
- `show_panel_app` 通过 `ui.show-content` 事件进入现有 `ChatThreadManager -> ChatUiManager` 路径。
- 内联 Panel App 通过 `nextclaw-inline` 解析成同一类 target，并复用 Panel App content URL。
- `PanelAppManager` 在 HTML `<head>` 起始位置注入 bridge，确保 `window.nextclaw.serviceActions`、`window.nextclaw.agent` 与可选 Client SDK 在应用脚本前可用。
- 内联和右侧栏 Panel App 都使用同一个 sandbox 与 `PanelAppBridgeManager`。

因此 `params` 应扩展既有 target，并进入既有 `window.nextclaw` namespace；不应新建另一套 Panel App 类型、API endpoint、store 或 bridge。

### rendered HTML

- 本地 HTML 由 server-path content route 原样提供，并在 `WorkspaceHtmlPreview` 的 iframe 中渲染。
- 内联 HTML 与右侧栏 HTML 复用 `ChatSessionWorkspaceFilePreview -> WorkspaceFileContentPreview`。
- 当前 iframe 是同源、允许脚本和交互的 rendered preview，不是 Panel App，也不应被转换成 Panel App。

因此 rendered HTML 可以复用同一宿主参数 bootstrap，但不能获得 Panel App 的 service action、agent 或 Client SDK 能力。

## 合同

### 调用侧

共享类型新增 JSON 递归类型和对象参数：

```ts
type UiContentParamValue =
  | null
  | boolean
  | number
  | string
  | UiContentParamValue[]
  | { [key: string]: UiContentParamValue };

type UiContentParams = Record<string, UiContentParamValue>;
```

`params` 放在 target 的 `payload` 中：

```json
{
  "type": "panel_app",
  "payload": {
    "appId": "chart",
    "params": {
      "title": "Weekly usage",
      "series": [12, 18, 9]
    }
  }
}
```

```json
{
  "type": "file",
  "payload": {
    "path": "/absolute/path/chart.html",
    "viewer": "rendered",
    "params": {
      "title": "Weekly usage",
      "series": [12, 18, 9]
    }
  }
}
```

选择 `params` 而不是 `payload`，因为 `payload` 已经是 target transport envelope；这里表达的是被展示内容的调用参数。只允许 object，避免标量根值导致未来参数扩展时反复改变合同。

### 内容侧

Panel App 与显式携带参数的 rendered HTML 都使用：

```js
const params = window.nextclaw?.params;
```

`params` 在内容自有脚本执行前同步可用。未传参数时不创建该字段，调用方可以用可选链判断。

第一版不新增 `ready()`、`getParams()`、订阅事件或异步 postMessage handshake。参数是单次展示的不可变初始输入，不是双向状态通道；运行中数据更新应继续走内容自身状态或已有 NextClaw 能力。

## 传输设计

### 保留在客户端，不进入 URL

宿主把带版本的参数 envelope 序列化到 iframe 的 `name`：

```text
nextclaw:content-params:v1:<json>
```

选择 `window.name` 的理由：

- iframe 导航前即可由父页面设置，内容首段脚本可以同步读取；
- 不需要新增服务端 session、注册 API 或清理任务；
- 不进入 query、fragment、浏览历史或服务端访问日志；
- 对较完整的图表数据比 URL 参数更稳定；
- 内联与右侧栏、Panel App 与 HTML iframe 都能使用。

bootstrap 只解析带 NextClaw 版本前缀的 `window.name`。成功或失败后立即清空保留 envelope，避免后续导航继续携带。普通未命名 iframe 与非 NextClaw `window.name` 不受影响。

### bootstrap owner

Kernel 提供唯一的 HTML bootstrap 注入 owner：

- 解析并校验版本 envelope；
- 把参数挂到既有 `window.nextclaw`；
- 冻结参数对象，表达只读初始输入；
- 清空保留的 `window.name`；
- 通过 marker 保证不会重复注入。

Panel App bridge 复用该 bootstrap，再追加既有 `serviceActions`、`agent` 和可选 `client`。

server-path controller 只在以下条件同时满足时注入 bootstrap：

1. 内容类型是 HTML；
2. UI 通过一个不含业务数据的显式 query flag 请求 host params bootstrap。

server 只承担 HTML transport 适配，不解析、不保存、不拥有参数。

## Owner 与数据流

### 共享合同 owner

- `@nextclaw/shared`：JSON 参数类型、校验、大小上限、iframe name 序列化合同和 HTML bootstrap query flag。
- 参数最大 UTF-8 序列化大小为 64 KiB。这个上限足以覆盖首版图表数据、文件路径和组件配置，同时避免任意大对象进入 DOM 属性、Zustand persistence 或截图运行时。
- 非有限数字、函数、symbol、`undefined`、循环引用、过深对象和超限对象都在边界被拒绝，不做静默归一化。

### Kernel owner

- `ui-content-params-injection`：生成与注入同步 bootstrap。
- `show-content.tools`：工具 schema 与外部参数边界校验。
- `panel-app-bridge`：复用 bootstrap，保持单一 `window.nextclaw` namespace。

### UI owner

- `ChatThreadManager` / `ChatUiManager`：保留现有展示编排，只把 target 的参数交给真实展示 owner。
- `DocBrowserManager`：Panel App 右侧栏 tab 持有本次 transient content params；URL 与资源 URI 不携带参数。
- workspace file tab：持有 rendered HTML 参数；持久化仍受共享 64 KiB 严格边界约束，使刷新后的右侧栏不会无提示丢失输入。
- iframe view：只负责把序列化 envelope 写入 `name`，不解析业务字段。

### Agent Chat UI owner

- `nextclaw-inline` parser 校验并保留 `params`。
- view model 原样表达 target，不承担序列化或运行时注入。

## HTML 适用边界

`file.payload.params` 只对 rendered HTML 生效：

- `.html` / `.htm` 且 viewer 最终为 `rendered`：支持。
- source viewer、目录、Markdown、图片、PDF、Office、音视频和其它二进制类型：不支持参数。

工具入口对明显不符合的请求直接报错。Markdown inline parser 对非法组合不生成展示 target，避免看似成功但参数被忽略。

HTML 只获得 `window.nextclaw.params`，不会因为参数支持而获得 Panel App bridge、App Client 或额外权限。现有 rendered HTML 已经允许自身脚本运行；本次不扩大文件读取、网络或宿主能力边界。

## 生命周期与更新语义

- 参数属于一次展示实例，不是 app identity。
- 相同 `appId/path` 再次打开并传入不同参数时，现有 dedupe tab 更新参数并重载 iframe，使新输入确定性生效。
- 内联卡片的 React identity 继续由消息内容与现有稳定 key 管理；参数变化随 target 变化进入同一组件，不新建动态组件类型。
- 内联展开到右侧栏时复制同一参数值。
- iframe 内部修改 `window.nextclaw.params` 不会回写宿主；参数对象被冻结。

## 兼容与可预测行为

主合同只有一条：`payload.params -> iframe name envelope -> window.nextclaw.params`。

- 不保留 `payload`、`input`、`data` 等别名。
- 不把 JSON 同时复制到 query、fragment 或 postMessage。
- 不建立缺参时的隐式数据查询 fallback。
- 不根据环境或页面内容猜测是否注入。
- 未传参数的旧调用不产生 envelope，旧 Panel App 与 HTML 行为不变。

这是一条纯数据观察路径，不执行安装、加载、授权或外部调用。页面自动重渲染或 iframe reload 只重复提供同一份初始数据，不产生额外副作用。

## 实施范围

1. 扩展 shared target 与 chat view-model 类型。
2. 增加 shared 参数校验、序列化合同和单元测试。
3. 扩展 `show_panel_app` / `show_file` schema、归一化和 reply-format 合同。
4. 扩展 Markdown inline parser 和工具结果 parser。
5. 增加 Kernel HTML bootstrap，并让 Panel App bridge 复用。
6. 让 DocBrowser tab、workspace file tab 和 iframe surface 保留并注入参数。
7. 让 server-path HTML route 按显式 flag 注入 bootstrap。
8. 补充定向测试、类型检查、lint、build、governance、真实 Panel App 与 HTML 冒烟。
9. 生成并上传包含 Panel App 与 rendered HTML 参数展示结果的截图。

## 非目标

- 不做运行中 params 更新、双向 binding 或宿主状态同步。
- 不把 params 变成 Panel App manifest 配置或持久业务数据。
- 不为 URL、图片、PDF、Office、音视频或 source viewer 注入参数。
- 不新增任意 HTML 的 NextClaw privileged API。
- 不发布、部署、迁移、重启现有实例或修改生产数据。

## 验证标准

### 合同与单元测试

- JSON object 接受嵌套对象、数组、字符串、布尔值、有限数字与 null。
- 非 JSON 值、循环、过深、非 object 根值和超限输入被明确拒绝。
- iframe name round-trip 保真，reserved envelope 被 bootstrap 读取后清空。
- Panel App 旧 bridge 与 Client SDK namespace 不被覆盖。
- `show_panel_app`、rendered `show_file`、inline parser 和工具结果 parser 保留参数。
- 非 HTML/source/unsupported viewer 不会静默接受参数。

### UI 路径

- Panel App 内联 iframe 与右侧栏 iframe 都收到相同 `name` envelope。
- 内联 Panel App 展开后保留参数。
- rendered HTML 内联与右侧栏都请求 bootstrap 并收到相同参数。
- 无参数 iframe 不产生 `name` envelope 或 HTML bootstrap flag。
- 相同去重 tab 的新参数替换旧参数并触发确定性 reload。

### 真实冒烟

在独立源码运行实例中：

1. 用参数驱动一个本地 Panel App 渲染数据卡片；
2. 用相同合同驱动一个普通 rendered HTML 渲染数据卡片；
3. 验证内联与右侧栏读取结果；
4. 截图并回读检查可见数据与输入一致；
5. 把截图作为 NC-148 附件上传。
