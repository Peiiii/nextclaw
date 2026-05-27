---
name: service-app-creator
description: Create or update NextClaw Service Apps under the workspace service-apps directory, especially MCP-compatible backend helpers for Panel Apps that need file access, external API calls, or privileged actions.
description_zh: 创建或修改 NextClaw workspace/service-apps 下的 Service App，尤其适用于给 Panel App 配套后端能力、文件读写、外部 API 调用或需要授权的动作。
---

# NextClaw Service App Creator

当用户要给 Panel App、小工具或轻量应用增加后端能力时使用这个 skill。第一版 Service App 是用户自定义后端扩展，不是 NextClaw 内部系统能力，也不默认投射给 Agent 使用。

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
    "readNote": { "risk": "read" },
    "writeNote": { "risk": "write" }
  }
}
```

## 实现规则

1. 第一版只创建 `protocol: "mcp"` 的 stdio 服务，不创建 HTTP server、不后台常驻监听端口。
2. `command` 和 `args` 的相对路径以 Service App 目录作为 cwd。
3. 每个 MCP tool 都会映射成 Service Action，action id 形如 `<service-app-id>.<tool-name>`。
4. `actions` 里为每个 tool 声明风险等级；可用值为 `read`、`write`、`external`、`dangerous`，不确定时用 `dangerous`。
5. 不把 NextClaw 内部 kernel/server API 当作默认能力暴露；需要访问用户文件、外部服务或本地命令时，在 Service App 自己的代码里清楚收敛边界。
6. 完成后告诉用户在右侧面板的“服务应用”页刷新查看状态。

## 配套 Panel App

如果 Panel App 需要调用 Service App，必须在 HTML `<head>` 声明 allowlist：

```html
<meta name="nextclaw-panel-actions" content="workspace-notes.readNote workspace-notes.writeNote">
```

Panel App 内通过宿主注入的 SDK 调用：

```js
const actions = await window.nextclaw.serviceActions.list();
const result = await window.nextclaw.serviceActions.invoke(
  "workspace-notes.readNote",
  { path: "notes/today.md" }
);
```

第一次调用需要用户授权。不要在 Panel App 中伪造 caller、保存 bridge token 或直接调用 Service Gateway；caller、allowlist 和 grant 都由宿主与 kernel 管理。

## 验收建议

- 检查 `service-app.json` 是合法 JSON，`id` 与目录名一致。
- 检查 MCP server 至少能列出 tools，并且 tool 名和 manifest `actions` 对齐。
- 如果配套 Panel App，同时检查 `<meta name="nextclaw-panel-actions">` 包含要调用的 action id。
- 用“服务应用”面板刷新，确认 app 状态不是 failed；再从 Panel App 触发一次调用，确认授权和结果都能走通。
