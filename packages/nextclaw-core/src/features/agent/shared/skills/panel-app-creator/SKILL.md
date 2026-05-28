---
name: panel-app-creator
description: Create or update NextClaw single-file HTML Panel Apps shown in the right-side Panel Apps view. Use for lightweight dashboards, tools, forms, boards, visualizations, calculators, disposable UI experiments, Service Actions via window.nextclaw.serviceActions, and Agent calls via window.nextclaw.agent.send or window.nextclaw.agent.generateObject.
description_zh: 创建或修改 NextClaw 右侧面板里的单文件 HTML Panel App。适用于轻量 dashboard、工具、表单、看板、可视化、计算器、可随时丢弃的临时 UI、通过 window.nextclaw.serviceActions 调用 Service Actions，以及通过 window.nextclaw.agent.send 或 window.nextclaw.agent.generateObject 调用 Agent。
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
- 需要后端能力时，可配套 `service-app-creator` 创建 Service App，但必须先执行 Service App 可用性检查（见下方"Service App 可用性"节）。
- **永远以 `localStorage` 作为默认持久化**，Service App 仅作为可选增强。不要让 Panel App 的核心功能依赖 Service App——如果 Service App 不可用，Panel App 必须仍能完整工作。
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

action id 必须来自对应 `service-app.json.actions`：`<service-app-id>.<tool-name>`。`service-app-id` 不包含点号，tool name 可以包含点号。

运行时通过宿主注入的 SDK 调用：

```js
// Service App 调用必须在 try/catch 中，并始终有 localStorage 回退
try {
  if (window.nextclaw?.serviceActions?.invoke) {
    // invoke() 返回 action 的业务结果 payload，不需要读取 response.result
    const note = await window.nextclaw.serviceActions.invoke("workspace-notes.readNote", {
      path: "notes/today.md"
    });
    renderNote(note.content ?? "");
  } else {
    // Service App 不可用，回退到 localStorage
    const data = JSON.parse(localStorage.getItem("my-app-data") || "[]");
  }
} catch (e) {
  console.warn("Service App unavailable, using localStorage:", e);
  // localStorage 回退
}
```

`invoke()` 已由宿主 SDK 解包，返回值就是 Service App tool 的 result。不要写 `response.result`、`response.files` 这种不确定访问；如果 action 返回 `{ files: [...] }`，应写：

```js
const payload = await window.nextclaw.serviceActions.invoke("workspace-files.list", {});
const files = payload.files ?? [];
```

错误提示要区分原因：bridge 不存在才说 Service Actions 不可用；调用抛错才说 Service Action 调用失败；返回结构不符合预期要说返回格式未识别，不要统一误报为 Service App 不可用。

不要在 Panel App 里伪造 caller、保存 token 或直接请求 Service Gateway；首次调用授权由宿主处理。
不要为了发现 action 在 Panel App 启动时自行触发后端探测；Service Actions 列表由宿主读取静态 manifest，运行时 discovery 由服务应用面板中的显式操作完成。

## Service App 可用性

当前版本的 NextClaw 可能尚未支持 Service App（`window.nextclaw.serviceActions` 可能不存在或不可用）。构建 Panel App 时必须遵循以下原则：

1. **先检查，后调用**：在调用任何 service action 前，检查 `window.nextclaw?.serviceActions?.invoke` 是否存在。
2. **localStorage 为主**：所有数据持久化必须默认使用 `localStorage`。Service App 调用仅作为可选增强路径。
3. **try/catch 包裹**：所有 service action 调用必须在 try/catch 中，catch 里回退到 localStorage。
4. **功能完整性**：即使 Service App 完全不可用，Panel App 的所有核心功能（增删改查、展示、交互）必须仍能正常工作。
5. **运行时探测**：不要假设 Service App 可用或不可用——在代码中动态检测，而非硬编码跳过。
6. **运行时失败快速决策**：如果 Service App 已部署但返回错误（如 Internal Server Error），不要反复重试或在 assistant 输出中反复描述同一诊断计划。最多调试 2 次（检查 manifest、检查 server 日志），如果仍然失败，立刻告知用户并切换到 localStorage-only 方案。调试循环是 token 浪费——快速降级比完美诊断更重要。

## Agent API

Panel App 可以通过宿主注入的 `window.nextclaw.agent` 调用 NextClaw Agent。需要 Agent 能力时，必须先在 `<head>` 声明 capability：

```html
<meta name="nextclaw-panel-capabilities" content="agent:send agent:generateObject">
```

只声明实际会用到的能力：

- 只触发会话 run：声明 `agent:send`。
- 需要结构化对象返回：声明 `agent:generateObject`。

### generateObject

`generateObject` 适合把当前 UI 状态交给持续 Agent 会话，并拿回可以直接写入应用状态的 JSON object：

```js
if (!window.nextclaw?.agent?.generateObject) {
  throw new Error("当前环境不支持 NextClaw Agent API");
}

const result = await window.nextclaw.agent.generateObject({
  peerId: "mood-summary",
  prompt: "总结这些心情记录，并给出三个具体建议。",
  context: { entries },
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      suggestions: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["summary", "suggestions"],
    additionalProperties: false
  }
});
```

关键约定：

- `peerId` 由 Panel App 自己生成并保持稳定；同一个 Panel App + 同一个 `peerId` 会复用同一个 Agent 会话。
- `schema` 必须描述期望返回对象；不要要求 Agent 在自然语言里输出 JSON。
- 返回值就是结构化对象本身，不是字符串，也不是 `{ result: ... }` envelope。
- 第一次调用受保护 Agent capability 时，宿主会负责弹授权，不要自己实现授权 UI。

### send

`send` 适合只触发一次 Agent 会话 run，不等待最终回复：

```js
const handle = await window.nextclaw.agent.send({
  content: [{ type: "text", text: "请根据当前数据生成一份后续分析。" }]
});
```

后续可以用返回的 `handle.sessionId` 继续向同一会话投送：

```js
await window.nextclaw.agent.send({
  sessionId: handle.sessionId,
  content: [{ type: "text", text: "继续上一轮，补充风险点。" }]
});
```

不要在未声明 `nextclaw-panel-capabilities` 时调用 `window.nextclaw.agent.*`。调用失败时展示明确错误，不要静默当作成功，也不要退回到直接请求某个本地 Agent HTTP 接口。

## 实现建议

0. **信任 write_file 结果**：`write_file` 返回成功即表示文件已写入。不要用 `exec ls -la`、`head` 或 `read_file` 去"验证"刚写入的文件——这会浪费工具调用，并可能因批量执行的时间戳不一致导致分析循环。需要验证时，只在全部写入完成后的验收阶段做一次。
1. 明确用户要解决的实际工作流，不把临时工具做成复杂产品。
2. 生成完整可打开的 HTML：`<!doctype html>`、`<meta charset="utf-8">`、响应式布局、可访问的按钮和输入。
3. 每次新建或重写 Panel App 时，都要先补齐 `<title>`、`nextclaw-panel-title`、`nextclaw-panel-description` 和 `nextclaw-panel-icon`。
4. 本地状态优先用 `localStorage`；需要导入导出时，用文本框、复制、下载 JSON 等浏览器原生能力。
5. 视觉保持克制、清晰、信息密度适中，避免营销页式 hero 和装饰性堆叠。
6. 完成后告诉用户在 NextClaw 左下角设置菜单打开“面板应用”，再选择对应应用。
