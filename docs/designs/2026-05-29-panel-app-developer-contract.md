# Panel App 开发者合同优化方案

## 背景

近期 AI 生成的 Panel App / Service App 暴露出一组高频失败：

- Panel App 把 Service action allowlist 写进 HTML meta，而目录式应用运行时只读取 `panel-app.json.actions`。
- Service action id 与 Agent capability 名称混淆：Service action 使用 `<service-app-id>.<tool-name>`，Agent capability 使用 `agent:send` / `agent:generateObject`。
- Panel App 调用 `window.nextclaw.serviceActions.list()` 后按数组使用，但宿主实际返回 `{ actions: [...] }`。
- Panel App 调用 `window.nextclaw.serviceActions.invoke()` 后期待业务对象，但 Service App MCP 返回常见是 `{ content: [{ type: "text", text: "..." }] }` envelope。
- AI 分析类需求被写成 Service App 自己调用外部模型，导致输出格式、授权、运行依赖和失败提示都不稳定。

这些问题不是单个应用写错，而是开发者合同不够单一、SDK 返回形态不够直觉、skill 没有把坑点压成唯一可执行路径。

## 目标

1. 让 AI 创建 NextClaw 小应用时只有一条主路径：目录式 Panel App，可选目录式 Service App。
2. 让 Panel App 内注入 SDK 的返回值符合前端开发直觉，减少 envelope / wrapper 误读。
3. 让 skill 明确区分 UI、后端 action、Agent 三类能力边界。
4. 让 Service App 保持 MCP 协议兼容，但 Panel bridge 对前端只暴露业务 payload。
5. 通过测试把 skill 文案和运行时合同绑住，避免后续再次漂移。

## 非目标

- 不修改用户 workspace 中已经生成的具体应用数据。
- 不新增第二套 Panel App manifest、meta manifest 或兼容字段。
- 不把 Service App 投射给 Agent 使用。
- 不把 Service App 设计成通用模型调用层。AI 结构化分析优先使用 `window.nextclaw.agent.generateObject()`。

## 唯一开发路径

### Panel App

Panel App 只推荐目录式：

```text
panels/<app-id>.panel/
  panel-app.json
  index.html
  app.js
  styles.css
  assets/icon.svg
```

`panel-app.json` 是唯一 manifest 事实源：

```json
{
  "title": "示例应用",
  "description": "一个 NextClaw 面板应用",
  "icon": "🧩",
  "entry": "index.html",
  "capabilities": ["agent:generateObject"],
  "actions": ["workspace-files.list"]
}
```

HTML `<head>` 不再承载 NextClaw manifest。Skill 中也不再引导单文件形态，除非未来显式重新设计。

### Service App

Service App 只推荐目录式：

```text
service-apps/<service-app-id>/
  service-app.json
  server.mjs
```

第一期 protocol 为 `mcp`。`service-app.json.actions` 是静态 action 事实源，宿主列表、授权和 Panel allowlist 都以它为准。

Service action id 使用点号：

```text
<service-app-id>.<tool-name>
```

例如 `workspace-files.list`。

### Agent Capability

Agent capability 使用冒号：

```text
agent:send
agent:generateObject
```

Panel App 只声明实际使用的 capability。需要稳定会话时传 `peerId`，不允许外部生成稳定 `sessionId`。

## Bridge SDK 合同

Panel App 中只使用宿主注入的 `window.nextclaw`：

```js
const actions = await window.nextclaw.serviceActions.list();
const payload = await window.nextclaw.serviceActions.invoke("workspace-files.list", {});
const object = await window.nextclaw.agent.generateObject({
  peerId: "mood-analysis",
  prompt: "分析当前心情记录",
  context: { entries },
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" }
    },
    required: ["summary"],
    additionalProperties: false
  }
});
```

返回合同：

- `serviceActions.list()` 返回 `ServiceAction[]` 数组，不返回 `{ actions }`。
- `serviceActions.invoke()` 返回业务 payload，不返回 `{ actionId, result }`，也不返回 MCP envelope。
- `agent.generateObject()` 返回结构化对象本身。
- `agent.send()` 返回发送 handle。

## Service Action 解包规则

Service App runtime 和 server 可以继续保持 MCP tool result 形态；Panel bridge 注入 SDK 对前端做统一解包：

1. 若 result 含 `structuredContent` 且非 `undefined`，返回 `structuredContent`。
2. 若 result 含单条 text content，且 text 是 JSON，返回解析后的 JSON。
3. 若 result 含单条 text content，但不是 JSON，返回 text 字符串。
4. 其他形态按原 result 返回，便于排查非标准返回。

这让 MCP 兼容和 Panel App 易用性各归其位：底层协议可以保留 envelope，前端开发只面对业务结果。

## AI 与 Service 的边界

- UI 内需要自然语言生成、分类、总结、分析、结构化 JSON：优先使用 `window.nextclaw.agent.generateObject()`。
- 只想触发 Agent 会话：使用 `window.nextclaw.agent.send()`。
- 需要读写本地文件、调用外部 API、执行本地命令或跨浏览器权限边界：使用 Service App action。
- Service App 不默认承担 AI 模型调用。除非用户明确要求接入某个外部模型服务，否则不要在 Service App 中自建 Ollama/OpenAI 调用。

## Skill 优化

本次需要同步更新三个内置 skill：

- `nextclaw-app-creator`：作为总入口，先判定 Panel-only / Service-only / Panel + Service，并强制读取对应专项 skill。
- `panel-app-creator`：沉淀唯一 Panel 开发合同、bridge API 返回值、窄侧栏布局和 manifest 唯一事实源。
- `service-app-creator`：沉淀 MCP Service App manifest、action id 规则、Service action result 如何被 Panel bridge 解包，以及 AI 需求不要默认放进 Service App。

同时新增 Panel bridge API reference，让 AI 在使用 SDK 前能读到简短、精确、可复制的 API 合同。

## 验收标准

1. 运行时注入脚本中 `serviceActions.list()` 解包为数组。
2. 运行时注入脚本中 `serviceActions.invoke()` 解包为业务 payload。
3. 内置 skill 明确只推荐目录式 Panel App，且 `panel-app.json` 是唯一 manifest。
4. 内置 skill 明确点号 action id 与冒号 capability 的区别。
5. 内置 skill 明确 AI 结构化分析走 `agent.generateObject()`。
6. 定向测试覆盖 bridge script 合同和 skill 文案合同。
7. 发布一个 minor NPM 版本，并用真实安装验证 `nextclaw@latest` 可用。
