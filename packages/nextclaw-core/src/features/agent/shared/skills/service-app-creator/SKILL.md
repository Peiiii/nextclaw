---
name: service-app-creator
description: Create or update the Service App backend action part of a NextClaw lightweight app. Use after nextclaw-app-creator selects Service-only or Panel + Service, or when the user explicitly asks for workspace service-apps, MCP-compatible backend helpers, file access, external API calls, local commands, or privileged actions.
description_zh: 创建或修改 NextClaw 轻量应用中的 Service App 后端 action 部分。适用于 nextclaw-app-creator 判断为 Service-only 或 Panel + Service 后，或用户明确要求 workspace/service-apps、MCP 后端 helper、文件访问、外部 API、本地命令或需要授权的动作。
---

# NextClaw Service App Creator

当用户要给 Panel App、小工具或轻量应用增加后端 actions 时使用这个专项 skill。若用户表达的是“做一个完整 NextClaw 小应用”，先读取 `nextclaw-app-creator` 判断是否还需要 Panel App。第一版 Service App 是用户自定义后端扩展，不是 NextClaw 内部系统能力，也不默认投射给 Agent 使用。

Service App 只负责浏览器做不了或不该做的后端动作：本地文件、外部 API、本地命令、权限边界和可授权原子能力。AI 分析、总结、分类、结构化 JSON 输出默认走 Panel App 的 `window.nextclaw.agent.generateObject()`，不要为了 AI 分析新建 Service App 自己调用模型，除非用户明确要求接入某个外部模型服务。

## 输出位置

- Service App 必须写入 NextClaw workspace 的 `service-apps/<app-id>/` 目录。
- 默认 workspace 是 `~/.nextclaw/workspace`；如果当前任务能读取 NextClaw 配置，则以 `agents.defaults.workspace` 为准。
- `<app-id>` 使用 kebab-case，并且必须和 `service-app.json` 里的 `id` 完全一致。

## 文件形态

每个 Service App 至少包含：

```text
service-apps/
  workspace-notes/
    service-app.json
    server.mjs
```

`service-app.json` 第一版只使用轻量字段：

```json
{
  "id": "workspace-notes",
  "title": "Workspace Notes",
  "description": "Read and update notes in a controlled workspace folder.",
  "enabled": true,
  "protocol": "mcp",
  "command": "node",
  "args": ["server.mjs"],
  "actions": {
    "readNote": {
      "title": "Read note",
      "description": "Read one note from the app data folder.",
      "risk": "read"
    },
    "writeNote": {
      "title": "Write note",
      "description": "Create or update one note in the app data folder.",
      "risk": "write"
    }
  }
}
```

## 前置检查

当前 NextClaw 版本可能尚未支持 Service App 运行时（配置中无 `serviceApps` 字段、`nextclaw doctor` 无 service app 检查项）。在创建 Service App 前：

1. 检查 `nextclaw doctor` 输出中是否有 service app 相关检查。
2. 如果不确定，先创建一个最小 Service App 并通过 Panel App 验证 `window.nextclaw.serviceActions.invoke()` 是否可用。
3. 如果 Service App 不可用，**仍应创建 Service App 文件**（未来版本会支持），但必须同时告知用户：当前版本的 Panel App 应使用 `localStorage` 作为临时后端，并在 Service App 可用后切换。

## 实现规则

1. 第一版只创建 `protocol: "mcp"` 的 stdio 服务，不创建 HTTP server、不后台常驻监听端口。
2. `command` 和 `args` 的相对路径以 Service App 目录作为 cwd。
3. 每个 MCP tool 都必须在 `service-app.json.actions` 中静态声明；NextClaw 的列表、授权和 allowlist 都以 manifest 为事实源，不靠启动服务后临时发现。
4. action id 形如 `<service-app-id>.<tool-name>`；`<app-id>` 不包含点号，tool name 可以包含点号。
5. `actions` 里为每个 tool 声明风险等级；可用值为 `read`、`write`、`external`、`dangerous`，不确定时用 `dangerous`。
6. 推荐为每个 action 写 `title` 和 `description`；有稳定入参时可补 `inputSchema`，但运行时 schema 仍以 MCP `tools/list` 作为校验来源。
7. 不把 NextClaw 内部 kernel/server API 当作默认能力暴露；需要访问用户文件、外部服务或本地命令时，在 Service App 自己的代码里清楚收敛边界。
8. 完成后告诉用户在右侧面板的“服务应用”页刷新查看状态；需要运行时 schema 或 mismatch 时，点击单个服务应用的发现/刷新动作。

## 配套 Panel App

如果 Panel App 需要调用 Service App，必须在目录式 Panel App 的 `panel-app.json.actions` 声明 allowlist：

```json
{
  "actions": ["workspace-notes.readNote", "workspace-notes.writeNote"]
}
```

Panel App 内通过宿主注入的 SDK 调用：

```js
const actions = await window.nextclaw.serviceActions.list();
// invoke() 返回 Service App tool 的业务结果 payload，不需要读取 response.result
const note = await window.nextclaw.serviceActions.invoke(
  "workspace-notes.readNote",
  { path: "notes/today.md" }
);
renderNote(note.content ?? "");
```

如果 tool 返回 `{ files: [...] }`，Panel App 应直接读取：

```js
const payload = await window.nextclaw.serviceActions.invoke("workspace-files.list", {});
const files = payload.files ?? [];
```

Bridge SDK 返回合同：

- `serviceActions.list()` 返回 action 数组，不返回 `{ actions }`。
- `serviceActions.invoke()` 返回业务 payload，不返回 `{ actionId, result }`。
- 如果 MCP tool result 使用 `structuredContent`，Panel App 会收到 `structuredContent`。
- 如果 MCP tool result 使用单条 text content 且 text 是 JSON，Panel App 会收到解析后的对象。
- 如果 text 不是 JSON，Panel App 会收到字符串。

因此 Service App 的 MCP server 可以按 MCP 标准返回 tool result，但业务 JSON 应保持稳定 shape，避免同一个 action 有时返回数组、有时返回对象、有时返回纯文本。

第一次调用需要用户授权。不要在 Panel App 中伪造 caller、保存 bridge token 或直接调用 Service Gateway；caller、allowlist 和 grant 都由宿主与 kernel 管理。

## 验收建议

- 检查 `service-app.json` 是合法 JSON，`id` 与目录名一致。
- 检查 manifest `actions` 非空，并且每个 action 都有 `risk`。
- 检查 MCP server 至少能列出 tools，并且 tool 名和 manifest `actions` 对齐；manifest 声明但 runtime 缺失、runtime 多出未声明 tool 都需要向用户说明。
- 如果配套 Panel App，同时检查 `panel-app.json.actions` 包含要调用的 action id。
- 用“服务应用”面板刷新，确认 app 状态不是 failed；再从 Panel App 触发一次调用，确认授权和结果都能走通。
