# Native-process Service App

仅当 `service-app-creator` 已确认应用必须使用宿主进程，或用户明确只要本机 MCP helper 时读取。本 reference 拥有 MCP stdio、`command/args`、依赖和宿主权限细节。

## 安全边界

native-process Service 继承当前用户可访问的宿主环境。Action grant 约束调用，不是 OS 进程沙箱。公开发布时必须如实声明 `runtime.profile: native-process` 和真实权限，并接受高权限人工审核；不能伪装成 WASI 来降低审核等级。

适合它的真实需求包括：

- 直接复用 Node、Python、系统命令或现有平台 SDK；
- 需要驱动、socket、外部守护进程或 Portable Runtime 尚未提供的宿主能力；
- 用户明确选择无需 Rust、仅供本机使用的快速 Service helper。

KV、SQLite、受授权文件、允许域名、密钥槽位、Provider 或 AI 槽位已经能覆盖的自包含应用，回到 Portable 分支。

## 输出形态

完整 schema v2 包：

```text
my-app/
├── manifest.json                  # runtime.profile: native-process
├── marketplace.json
├── panels/<panel-id>.panel/       # 可选
└── service-components/<service-id>/
    ├── service-app.json
    └── server.mjs
```

明确只做 loose 本机 Service 时：

```text
~/.nextclaw/workspace/service-apps/<service-id>/
├── service-app.json
└── server.mjs
```

能读取 NextClaw 配置时，以 `agents.defaults.workspace` 代替默认 workspace。目录名与 manifest `id` 完全一致，并使用 kebab-case。

## Manifest

```json
{
  "id": "workspace-notes",
  "title": "Workspace Notes",
  "description": "Read and update notes in a controlled folder.",
  "enabled": true,
  "protocol": "mcp",
  "command": "node",
  "args": ["server.mjs"],
  "actions": {
    "read_note": {
      "title": "Read note",
      "description": "Read one note.",
      "risk": "read"
    },
    "write_note": {
      "title": "Write note",
      "description": "Create or update one note.",
      "risk": "write"
    }
  }
}
```

第一版只创建 MCP-compatible stdio server，不创建 HTTP 常驻端口。每个 MCP tool 都要在 manifest 静态声明；运行时 `tools/list` 不能缺少已声明 tool，也不能暴露未声明 tool。

## Node 与依赖

默认优先零依赖 `server.mjs`，使用 Node 内置模块和最小 MCP JSON-RPC 分发。只有真实需要第三方包时才在 Service 目录创建自己的 `package.json` 并安装依赖；不要把依赖加到 NextClaw 仓库根或假设宿主注入 `@nextclaw/mcp`。

`command: "node"` / `"node.exe"` 是 NextClaw 宿主 Node 的保留别名：NPM/CLI 使用当前 Node，Desktop 使用 Electron 内置 Node。不要探测或回退到用户 PATH 的另一套 Node。Rust、Go、Python、git 等显式 command 仍按各自程序启动。

如果使用官方 MCP SDK，可以在 Service 目录声明自己的依赖：

```json
{
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.27.1"
  }
}
```

安装完成后验证依赖能由 Service 目录解析。不要要求最终用户手工猜测依赖；可发布包必须包含或安装合同内所需资源。

## MCP 结果与 Panel bridge

Service 可以返回标准 MCP result；业务 shape 必须稳定：

- `structuredContent` 会直接成为 Panel 收到的业务 payload；
- 单条 JSON text content 会被解析成对象；
- 单条非 JSON text content 会成为字符串。

Panel 继续使用：

```js
const payload = await window.nextclaw.serviceActions.invoke(
  "workspace-notes.read_note",
  { path: "notes/today.md" }
);
```

不要读取 `response.result`，不要伪造 caller、保存 bridge token 或直接请求 Service Gateway。

## 验证

对完整包从包根运行，对 loose Service 直接传 Service 目录：

```bash
nextclaw app check <target> --json
nextclaw app dev <target> --json
nextclaw app call <target> <action-name> --input '{}' --json
```

检查：

- manifest action 非空，risk 合法；
- MCP server 能完成 initialize 与 `tools/list`；
- manifest 与 runtime tools 完全对齐；
- 至少一个无危险副作用的关键 action 返回预期业务 payload；
- 配套 Panel 的 `panel-app.json.actions` 包含完整 action id。

`dev/call` 使用隔离 runtime。若还要复测 live 产品中的 native-process Service，先运行 `nextclaw app restart <service-id> --json`，再刷新或重新打开 Panel；不要重启整个 NextClaw 宿主。

## 完成条件

- 已证明需求确实不能或不应由 Portable Runtime 承接，或用户明确选择本机无 Rust helper；
- 权限、外部依赖和宿主进程风险已披露；
- `check/dev/call` 通过；
- 没有把 native-process 描述成沙箱，也没有把它伪装成 WASI。
