# Runtime 模型与能力合同

Portable Runtime 的公共边界由两部分组成：WIT 定义 Component 与宿主如何通信，App 与 Service 清单定义这个 Component 可以使用哪些能力、以什么角色运行，以及向调用者暴露哪些 Actions。内部使用嵌入式 Spin Runtime Factors 连接宿主，不会改变 `.napp`、WIT 或 NDJSON 公共合同。

## WIT world

当前合同包是 `nextclaw:portable-service@0.1.0`，world 名为 `service-app`。

### Component 导出

| 导出 | 用途 |
| --- | --- |
| `list-actions()` | 返回运行时实际提供的 Action 名称、标题和说明 |
| `invoke(action, input-json)` | 调用一个 Action，并以 JSON 字符串返回成功结果或错误 |
| `start(config-json)` | 启动 Component 生命周期 |
| `handle-event(event-json)` | 处理宿主投递给 Resident 的事件 |
| `stop(reason-json)` | 停止当前实例 |

`service-app.json` 声明的 Actions 会与 `list-actions()` 结果比对。两边一致时状态为 `matched`；清单有而运行时没有时为 `missing`；运行时有而清单未声明时为 `undeclared`。

### 宿主导入

| 导入 | 用途 | 边界 |
| --- | --- | --- |
| `log(level, message)` | 写入分级运行日志 | level 为 debug、info、warn 或 error |
| `kv-get(key)` | 读取宿主管理的字符串值 | 所属 App 必须声明存储权限 |
| `kv-set(key, value)` | 写入宿主管理的字符串值 | 数据写入 App 的受管实例 |
| `http-get(url)` | 返回 HTTP 状态和文本 body | 只接受 HTTPS，且目标必须符合 App 的 `allowedDomains` |
| `component-call(provider-id, action, input-json)` | 调用 Provider Action | Consumer 必须在 `providers` 中声明该 id |
| `get-runtime-info()` | 返回 runner pid、已加载数量和 Component id | 用于运行诊断 |

WIT 当前没有公开文件系统、Secret、任意 socket、模型调用或 Agent 调用。

## Service 清单

每个 WASM Service 目录包含 `service-app.json` 和清单指向的 `.wasm` 文件：

```json
{
  "id": "notes-state",
  "title": "Notes state",
  "description": "Stores and retrieves notes.",
  "protocol": "wasi-component",
  "component": {
    "entry": "service.wasm"
  },
  "lifecycle": {
    "mode": "action"
  },
  "actions": {
    "notes_list": {
      "title": "List notes",
      "description": "Returns saved notes.",
      "risk": "read"
    },
    "note_save": {
      "title": "Save note",
      "description": "Creates or updates one note.",
      "risk": "write",
      "inputSchema": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "text": { "type": "string" }
        },
        "required": ["id", "text"],
        "additionalProperties": false
      },
      "timeoutMs": 7000
    }
  }
}
```

关键约束：

- `id` 使用 kebab-case，并与 Service 目录名一致；
- `protocol` 为 `wasi-component`；
- `component.entry` 是 Service 目录内的 `.wasm` 相对路径；
- `actions` 不能为空；每项 Action 都应声明 `risk`；
- `timeoutMs` 可设为 100–300000 毫秒；未指定时当前默认值为 7000 毫秒；
- Action 的完整 id 是 `<service-id>.<action-name>`。

## 生命周期声明

### Action

```json
{ "lifecycle": { "mode": "action" } }
```

这是默认角色。实例用于按需调用，不要求长期保留。

### Resident

```json
{
  "lifecycle": {
    "mode": "resident",
    "eventIntervalMs": 1000
  }
}
```

`eventIntervalMs` 必须是 250–60000 的整数。Kernel 会保留实例并按该间隔调用 `handle-event()`。

### Provider

```json
{ "lifecycle": { "mode": "provider" } }
```

Provider 保留独立实例。Consumer 必须显式声明依赖：

```json
{
  "providers": ["contact-provider"]
}
```

Provider id 使用 kebab-case Service id。当前不支持 Provider 再递归调用另一个 Provider。

独立 Provider App 还可以声明自己提供的稳定能力合同。`provides` 只允许出现在 `lifecycle.mode: "provider"` 的 Service 上：

```json
{
  "lifecycle": { "mode": "provider" },
  "provides": {
    "capabilities": [
      {
        "id": "contacts.normalize",
        "version": "1",
        "resourceTypes": ["contacts"]
      }
    ]
  }
}
```

当前绑定的执行身份仍是 Provider 的 Service id。替换实现必须暴露同一个稳定 Service id；能力别名到任意实现的动态路由尚未开放。

## 外部依赖声明

默认 Service 不应依赖安装包之外的服务。确有需要时，Service 可以显式声明外部 capability 或 resource；这些声明只描述依赖，不携带凭据、连接字符串或安装命令：

```json
{
  "requires": {
    "capabilities": [
      {
        "id": "redis",
        "title": "Redis capability",
        "description": "Requires a trusted Redis capability provider."
      }
    ],
    "resources": [
      {
        "binding": "primary-database",
        "type": "redis",
        "title": "Primary Redis",
        "description": "A Redis resource must be configured before enablement."
      }
    ]
  }
}
```

带有必需外部依赖的 App 会在 App 列表和详情中显示 `needs-capability` 或 `needs-configuration`，在满足要求前不能启用。NextClaw 会从已安装、已启用且正在运行的 Provider 中匹配 capability 版本和 resource type；候选唯一时可以自动绑定，多候选时必须明确选择：

```bash
nextclaw app dependencies inspect <app-id> --json
nextclaw app dependencies setup <app-id> --json
nextclaw app dependencies bind <app-id> \
  --component <service-id> \
  --kind capability \
  --requirement contacts.normalize@1 \
  --provider <provider-service-id> \
  --json
nextclaw app dependencies verify <app-id> --json
```

绑定记录保存在 Consumer 实例的受管配置目录，只包含 Component、requirement 和 Provider Service id，文件权限为 `0600`；不会写入密码、token、连接字符串或安装命令。修改绑定前必须先停用 Consumer，防止运行中的 allowlist 与磁盘配置不一致。Provider 被已启用的 Consumer 使用时也不能停用或卸载。

Agent 使用与 CLI、HTTP API 相同的 Kernel owner 执行 inspect、setup、bind、verify 和 unbind；变更操作要求调用方明确声明已经获得用户授权。NextClaw 不会凭空安装未知外部服务，也不会替用户完成登录、付费或第三方授权。Provider 如需 Redis 等重型外部资源，应通过自己的 Service Actions 和既有 Secret owner 完成可代理设置，并把不可代理步骤交给用户。应用作者仍应优先提供无需外部服务的自包含路径。

## 所属 App 清单

Portable Service 必须属于 schema v2 NextClaw App，并在 `components` 中声明：

```json
{
  "schemaVersion": 2,
  "id": "example.notes",
  "name": "Notes",
  "version": "0.1.0",
  "engines": { "nextclaw": ">=0.43.0" },
  "runtime": { "profile": "wasi" },
  "distribution": { "mode": "universal" },
  "storage": { "scope": "global", "schemaVersion": 1 },
  "permissions": {
    "storage": { "namespace": "notes" },
    "allowedDomains": ["api.example.com"]
  },
  "components": [
    { "kind": "service", "path": "services/notes-state" }
  ]
}
```

runner 只会根据当前合同使用 `permissions.storage` 和 `permissions.allowedDomains`。不要据此推断 Component 已拥有其它 App 权限对应的宿主 API。

## 调用与错误

`invoke` 的输入和成功结果都是 JSON 字符串。Service Action 层会用清单中的 `inputSchema` 验证结构，并把 Component 错误转为调用失败。

如果调用超过 `timeoutMs`，Kernel 会终止共享 runner、令未完成调用失败，并恢复需要持续存在的 Provider 与 Resident。因为写操作是否已经发生可能无法从超时本身判断，Kernel 不会自动重放失败调用。

继续阅读：[开发 WASM Service App](/zh/developers/portable-service-apps)。
