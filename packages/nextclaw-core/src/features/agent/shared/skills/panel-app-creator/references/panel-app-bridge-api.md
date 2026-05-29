# Panel App Bridge API Reference

Panel App 只能通过宿主注入的 `window.nextclaw` 与 NextClaw 交互。不要直接请求 NextClaw gateway、不要伪造 caller、不要保存 bridge token。

## Manifest 声明

所有 NextClaw 能力都必须写在 `panel-app.json`：

```json
{
  "title": "示例应用",
  "entry": "index.html",
  "capabilities": ["agent:generateObject"],
  "actions": ["workspace-files.list"]
}
```

- `actions` 使用 Service action id：`<service-app-id>.<tool-name>`。
- `capabilities` 使用 Agent capability：`agent:send`、`agent:generateObject`。
- 不要在 HTML meta 中写 NextClaw manifest。

## Service Actions

### list

```js
const actions = await window.nextclaw.serviceActions.list();
```

返回值是数组：

```js
[
  {
    id: "workspace-files.list",
    appId: "workspace-files",
    name: "list",
    title: "List files",
    description: "List workspace files.",
    risk: "read"
  }
]
```

不要写 `const actions = response.actions`。

### invoke

```js
const payload = await window.nextclaw.serviceActions.invoke("workspace-files.list", {
  dir: "notes"
});
```

返回值是 action 的业务 payload：

```js
const files = payload.files ?? [];
```

不要写 `response.result`，也不要处理 MCP `content` envelope。宿主会把常见 MCP result 解包成业务 payload：

- `structuredContent` -> 直接返回。
- 单条 text content 且内容是 JSON -> 解析后返回对象。
- 单条 text content 且不是 JSON -> 返回字符串。

## Agent

### generateObject

用于 AI 分析、总结、分类、生成结构化 UI 状态。

```js
const result = await window.nextclaw.agent.generateObject({
  peerId: "mood-analysis",
  prompt: "分析这些心情记录，返回总结和建议。",
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

返回值就是结构化对象本身，不是字符串，也不是 `{ result }`。

稳定会话使用 `peerId`。不要自己生成、缓存或猜测稳定 `sessionId`。

### send

用于只触发 Agent 会话，不等待结构化结果。

```js
await window.nextclaw.agent.send({
  peerId: "daily-review",
  content: [{ type: "text", text: "请基于当前数据继续分析。" }]
});
```

## 边界判断

- AI 结构化分析：用 `agent.generateObject()`。
- 只触发会话：用 `agent.send()`。
- 本地文件、外部 API、本地命令、权限动作：用 Service App action。
- 不要默认在 Service App 中自建模型调用。除非用户明确要求外部模型服务，否则 AI 能力走 NextClaw Agent。
