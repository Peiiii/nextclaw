---
name: panel-app-creator
description: Create or update NextClaw single-file HTML Panel Apps shown in the right-side Panel Apps view. Use for lightweight dashboards, tools, forms, boards, visualizations, calculators, and disposable UI experiments.
description_zh: 创建或修改 NextClaw 右侧面板里的单文件 HTML Panel App。适用于轻量 dashboard、工具、表单、看板、可视化、计算器和可随时丢弃的临时 UI。
---

# NextClaw Panel App Creator

当用户想做一个轻量 UI、小工具、dashboard、todo board、表单、计算器、数据可视化或一次性 HTML 应用时，优先使用这个 skill。

## 输出位置

- Panel App 必须写入 NextClaw workspace 的 `panels/` 目录。
- 默认 workspace 是 `~/.nextclaw/workspace`；如果当前任务能读取 NextClaw 配置，则以 `agents.defaults.workspace` 为准。
- 文件名必须使用 kebab-case，并以 `.panel.html` 结尾，例如 `todo-board.panel.html`。

## 文件形态

- 每个 Panel App 只允许一个 HTML 文件。
- CSS 和 JavaScript 默认内联在同一个 HTML 文件里。
- 不创建 manifest、不创建多文件资源目录、不要求服务器部署。
- 需要后端能力时，优先配套 `service-app-creator` 创建 Service App，并在 Panel App 中声明 action allowlist。
- `<head>` 里必须提供用于 Panel Apps 启动器展示的标题、描述和图标。

## 启动器元信息

每个 Panel App 默认都要写清启动器元信息，让用户在 Panel Apps 列表中能快速识别它：

```html
<title>番茄便签</title>
<meta name="nextclaw-panel-title" content="番茄便签">
<meta name="nextclaw-panel-description" content="番茄钟、任务清单和专注记录">
<meta name="nextclaw-panel-icon" content="🍅">
```

图标规则：

- 最简单优先使用 `nextclaw-panel-icon` 放一个语义明确的 emoji 或 1-2 个短字符。
- 如果用户要求正式图片图标，再使用 Web 标准 favicon，例如 `<link rel="icon" href="data:image/svg+xml,...">`。
- 不要省略图标；没有用户指定时，按应用主题选择一个克制、可识别的 emoji。
- 不要使用相对图片路径如 `./icon.png`，因为第一版 Panel App 是单 HTML 文件，没有资源目录。

## Service Actions

Panel App 调用 Service App 前，必须在 `<head>` 声明允许使用的 action：

```html
<meta name="nextclaw-panel-actions" content="workspace-notes.readNote workspace-notes.writeNote">
```

运行时通过宿主注入的 SDK 调用：

```js
const result = await window.nextclaw.serviceActions.invoke("workspace-notes.readNote", {
  path: "notes/today.md"
});
```

不要在 Panel App 里伪造 caller、保存 token 或直接请求 Service Gateway；首次调用授权由宿主处理。

## 实现建议

1. 明确用户要解决的实际工作流，不把临时工具做成复杂产品。
2. 生成完整可打开的 HTML：`<!doctype html>`、`<meta charset="utf-8">`、响应式布局、可访问的按钮和输入。
3. 每次新建或重写 Panel App 时，都要先补齐 `<title>`、`nextclaw-panel-title`、`nextclaw-panel-description` 和 `nextclaw-panel-icon`。
4. 本地状态优先用 `localStorage`；需要导入导出时，用文本框、复制、下载 JSON 等浏览器原生能力。
5. 视觉保持克制、清晰、信息密度适中，避免营销页式 hero 和装饰性堆叠。
6. 完成后告诉用户在 NextClaw 左下角设置菜单打开“面板应用”，再选择对应应用。
