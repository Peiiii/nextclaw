---
name: panel-app-creator
description: Create or update the Panel App UI part of a NextClaw lightweight app. Use after nextclaw-app-creator selects Panel-only or Panel + Service, or when the user explicitly asks for a right-side Panel App UI, folder-based static panel, Service Actions UI, or Agent-powered Panel App.
description_zh: 创建或修改 NextClaw 轻量应用中的 Panel App UI 部分。适用于 nextclaw-app-creator 判断为 Panel-only 或 Panel + Service 后，或用户明确要求右侧面板 UI、目录式静态面板、Service Actions UI、Agent 驱动的 Panel App。
---

# NextClaw Panel App Creator

当用户需要实现右侧面板 UI 时使用这个专项 skill。若用户表达的是“做一个 NextClaw 小应用”而不是明确只做 UI，先读取 `nextclaw-app-creator` 判断是否还需要 Service App。

如果 Panel App 要调用 `window.nextclaw.serviceActions.*` 或 `window.nextclaw.agent.*`，必须先读取 `references/panel-app-bridge-api.md`，并按该 reference 的返回值合同写代码。

## 输出位置

- Panel App 必须写入 NextClaw workspace 的 `panels/` 目录。
- 默认 workspace 是 `~/.nextclaw/workspace`；如果当前任务能读取 NextClaw 配置，则以 `agents.defaults.workspace` 为准。
- 目录式应用的目录名必须使用 kebab-case，并以 `.panel` 结尾，例如 `todo-board.panel/`。

## 文件形态

- 新建或重写 Panel App 时只使用目录式 Panel App。
- 目录式 Panel App 必须包含 `panel-app.json` 和入口 HTML；不要求服务器部署，不创建 npm 项目，不运行构建工具。
- 需要后端能力时，可配套 `service-app-creator` 创建 Service App，但必须先执行 Service App 可用性检查（见下方"Service App 可用性"节）。
- 不需要后端权限的轻量数据可以优先使用 `localStorage`。如果用户目标明确需要文件、外部 API、本地命令或跨浏览器权限边界，就应该配套 Service App，不要把后端失败伪装成静默 localStorage 成功。
- `panel-app.json` 是标题、描述、图标、入口、Agent capabilities 和 Service actions 的唯一 manifest 事实源；不要把 NextClaw manifest 字段写到 HTML meta。

### 目录式静态应用

适合需要后续扩展、持续维护、资源拆分或更清晰代码组织的静态应用：

```text
panels/markdown-manager.panel/
  panel-app.json
  index.html
  app.js
  styles.css
  assets/icon.svg
```

`panel-app.json` 示例：

```json
{
  "title": "Markdown 管理器",
  "description": "浏览、编辑和整理本地 Markdown 文件",
  "icon": "assets/icon.svg",
  "entry": "index.html",
  "capabilities": ["agent:generateObject"],
  "actions": ["workspace-files.list", "workspace-files.read"]
}
```

目录式规则：

- `id` 可以省略，系统会使用目录名作为身份；如果显式填写 `id`，必须等于目录名去掉 `.panel` 后的值，例如 `markdown-manager.panel` 对应 `markdown-manager`。
- `entry` 必须是目录内的 HTML 文件，通常是 `index.html`。
- `icon` 可以是 emoji、data URL、http/https/绝对路径，也可以是目录内相对资源路径，例如 `assets/icon.svg`。
- 相对 CSS、JS、图片路径可以直接写 `styles.css`、`app.js`、`assets/icon.svg`；NextClaw 会通过资源接口托管它们。
- 不要在目录式 Panel App 里创建 `package.json`、`node_modules`、Vite 配置或后台 dev server，除非用户明确要求后续升级为更重的形态。

## 启动器元信息

每个 Panel App 默认都要在 `panel-app.json` 写清启动器元信息，让用户在 Panel Apps 列表中能快速识别它：

```json
{
  "title": "番茄便签",
  "description": "番茄钟、任务清单和专注记录",
  "icon": "🍅",
  "entry": "index.html"
}
```

图标规则：

- 最简单优先在 `panel-app.json.icon` 放一个语义明确的 emoji 或 1-2 个短字符。
- 如果用户要求正式图片图标，再使用目录内相对资源路径，例如 `assets/icon.svg`。
- 不要省略图标；没有用户指定时，按应用主题选择一个克制、可识别的 emoji。
- 可以在 `panel-app.json.icon` 中使用相对资源路径。

## 窄侧栏优先布局

Panel App 默认打开在 NextClaw 右侧栏里，初始宽度通常较窄；用户可以把右侧栏拉宽，但不能假设一开始就是桌面宽屏。

- 默认按 `320px-480px` 窄面板优先设计，再逐步增强到宽屏。
- 主流程、核心按钮、表单和列表在窄宽度下必须完整可用，不横向溢出。
- 使用单列布局作为基础；宽屏时再用 CSS media query 升级为双列、网格或并排详情。
- 工具栏和筛选项在窄屏下允许换行、折叠或变成分段按钮，不要做依赖大宽度的顶部横排。
- 卡片、表格、图表要适配窄容器：长文本换行，表格优先改成列表/详情卡，图表使用 `width: 100%` 和稳定高度。
- 不使用固定桌面宽度容器，例如 `width: 960px`；容器应使用 `max-width: 100%`、`min-width: 0`、`box-sizing: border-box`。
- 验收时至少想象两种宽度：窄侧栏和用户拉宽后的面板。窄侧栏可用性优先于宽屏装饰性。

## Service Actions

Panel App 调用 Service App 前，必须在 `panel-app.json` 的 `actions` 数组声明允许使用的 action：

```json
{
  "title": "Markdown 管理器",
  "entry": "index.html",
  "actions": ["workspace-files.list", "workspace-files.read"]
}
```

action id 必须来自对应 `service-app.json.actions`：`<service-app-id>.<tool-name>`。`service-app-id` 不包含点号，tool name 可以包含点号。
不要发明 `permissions.allowlist`、`serviceActions` 等额外字段；当前标准字段就是 `actions`。

运行时通过宿主注入的 SDK 调用：

```js
// Service App 调用必须在 try/catch 中，错误要给出明确用户反馈
try {
  if (window.nextclaw?.serviceActions?.invoke) {
    // invoke() 返回 action 的业务结果 payload，不需要读取 response.result
    const note = await window.nextclaw.serviceActions.invoke("workspace-notes.readNote", {
      path: "notes/today.md"
    });
    renderNote(note.content ?? "");
  } else {
    showError("当前环境不支持 Service Actions");
  }
} catch (e) {
  console.error("Service Action 调用失败:", e);
  showError("Service Action 调用失败，请检查授权和服务状态。");
}
```

`list()` 返回 action 数组，`invoke()` 已由宿主 SDK 解包，返回值就是 Service App tool 的业务 payload。不要写 `response.actions`、`response.result`、`response.files` 这种不确定访问：

```js
const actions = await window.nextclaw.serviceActions.list();
renderActions(actions);
```

如果 action 返回 `{ files: [...] }`，应写：

```js
const payload = await window.nextclaw.serviceActions.invoke("workspace-files.list", {});
const files = payload.files ?? [];
```

错误提示要区分原因：bridge 不存在才说 Service Actions 不可用；调用抛错才说 Service Action 调用失败；返回结构不符合预期要说返回格式未识别，不要统一误报为 Service App 不可用。

不要在 Panel App 里伪造 caller、保存 token 或直接请求 Service Gateway；首次调用授权由宿主处理。
不要为了发现 action 在 Panel App 启动时自行触发后端探测；Service Actions 列表由宿主读取静态 manifest，运行时 discovery 由服务应用面板中的显式操作完成。

## Service App 可用性

构建 Panel App 时必须区分“环境不支持”“未授权”“服务调用失败”“返回格式不符合预期”，不要把所有问题都报成 Service App 不可用：

1. **先检查，后调用**：在调用任何 service action 前，检查 `window.nextclaw?.serviceActions?.invoke` 是否存在。
2. **声明一致**：调用前确认 `panel-app.json.actions` 包含实际 action id。
3. **try/catch 包裹**：所有 service action 调用必须在 try/catch 中，catch 里展示明确错误。
4. **返回值校验**：`invoke()` 返回业务 payload；如果 payload 结构不符合 UI 预期，提示“返回格式未识别”，不要误报为连接失败。
5. **本地降级有边界**：只有用户目标允许纯浏览器状态时才用 `localStorage` 降级；读写文件、执行命令、外部 API 这类目标不能静默降级为假成功。
6. **运行时失败快速决策**：如果 Service App 已部署但返回错误，最多调试 2 次（检查 manifest、检查 server 日志），仍失败就明确告知用户当前阻塞点，不要反复空转。

## Agent API

Panel App 可以通过宿主注入的 `window.nextclaw.agent` 调用 NextClaw Agent。需要 Agent 能力时，必须先在 `panel-app.json.capabilities` 声明 capability：

```json
{
  "capabilities": ["agent:send", "agent:generateObject"]
}
```

只声明实际会用到的能力：

- 只触发会话 run：声明 `agent:send`。
- 需要结构化对象返回：声明 `agent:generateObject`。
- capability 名称必须精确使用冒号形式。不要写 `agent.send`、`agent.generateObject` 或泛化的 `agent`。

### generateObject

`generateObject` 适合 AI 分析、总结、分类、生成结构化 UI 状态：把当前 UI 状态交给持续 Agent 会话，并拿回可以直接写入应用状态的 JSON object。不要为了 AI 分析新建 Service App 自己调用模型，除非用户明确要求接入某个外部模型服务。

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
- 不要自己生成、缓存或猜测稳定 `sessionId`；需要固定会话时只传 `peerId`，由 NextClaw 内部创建或复用 session。
- `schema` 必须描述期望返回对象；不要要求 Agent 在自然语言里输出 JSON。
- 返回值就是结构化对象本身，不是字符串，也不是 `{ result: ... }` envelope。
- 第一次调用受保护 Agent capability 时，宿主会负责弹授权，不要自己实现授权 UI。

#### Capability 声明格式

`generateObject` 和 `send` 各自需要独立声明。声明必须使用**完整格式**（`agent:generateObject`、`agent:send`），不能用笼统的 `agent`：

```json
{
  "capabilities": ["agent:generateObject", "agent:send"]
}
```

错误示例：

```json
{
  "capabilities": ["agent"]
}
```

### send

`send` 适合只触发一次 Agent 会话 run，不等待最终回复：

```js
const handle = await window.nextclaw.agent.send({
  peerId: "daily-analysis",
  content: [{ type: "text", text: "请根据当前数据生成一份后续分析。" }]
});
```

后续继续使用同一个 `peerId` 即可投送到同一会话：

```js
await window.nextclaw.agent.send({
  peerId: "daily-analysis",
  content: [{ type: "text", text: "继续上一轮，补充风险点。" }]
});
```

如果你已经明确拿到了已有会话的 `sessionId`，也可以把它作为历史 continuation 使用：

```js
await window.nextclaw.agent.send({
  sessionId: handle.sessionId,
  content: [{ type: "text", text: "继续上一轮，补充风险点。" }]
});
```

不要同时传 `peerId` 和 `sessionId`。这两个字段分别代表“由系统按稳定 peer 创建/复用会话”和“继续一个已知会话”，混用会被拒绝。

不要在 `panel-app.json.capabilities` 未声明对应 capability 时调用 `window.nextclaw.agent.*`。调用失败时展示明确错误，不要静默当作成功，也不要退回到直接请求某个本地 Agent HTTP 接口。

## 实现建议

0. **信任 write_file 结果**：`write_file` 返回成功即表示文件已写入。不要用 `exec ls -la`、`head` 或 `read_file` 去"验证"刚写入的文件——这会浪费工具调用，并可能因批量执行的时间戳不一致导致分析循环。需要验证时，只在全部写入完成后的验收阶段做一次。
0b. **manifest 只写 `panel-app.json`**：标题、描述、图标、Service actions、Agent capabilities 都写入 `panel-app.json`。不要在 HTML `<head>` 中添加 NextClaw manifest meta，也不要发明 `permissions.allowlist`、`serviceActions` 等字段。
1. 明确用户要解决的实际工作流，不把临时工具做成复杂产品。
2. 生成完整可打开的 HTML：`<!doctype html>`、`<meta charset="utf-8">`、响应式布局、可访问的按钮和输入。
3. 每次新建或重写 Panel App 时，都要先补齐 `panel-app.json` 的 `title`、`description`、`icon` 和 `entry`。
4. 本地状态优先用 `localStorage`；需要导入导出时，用文本框、复制、下载 JSON 等浏览器原生能力。
5. 视觉保持克制、清晰、信息密度适中，避免营销页式 hero 和装饰性堆叠。
6. 完成后告诉用户在 NextClaw 左下角设置菜单打开“面板应用”，再选择对应应用。
