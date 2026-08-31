# Portable Runtime：能力与安全边界

Portable Runtime 有两层合同：应用包和 Service 清单说明“应用请求什么”；WIT world 说明“Component 怎样调用宿主、怎样暴露操作”。只有声明并不等于已经获得访问权限：NextClaw 会把每个请求解析成已安装应用的能力快照。

## 应用清单：只请求真正需要的能力

```json
{
  "schemaVersion": 2,
  "id": "example.reading-log",
  "name": "Reading log",
  "version": "0.1.0",
  "runtime": { "profile": "wasi" },
  "distribution": { "mode": "universal" },
  "storage": { "scope": "global", "schemaVersion": 1 },
  "permissions": {
    "storage": { "namespace": "reading-log" },
    "allowedDomains": ["api.example.com"],
    "documentAccess": [
      { "id": "library", "mode": "read", "description": "Read selected documents." }
    ],
    "secrets": [
      { "id": "api-token", "title": "API token", "description": "Access the configured API.", "required": true }
    ]
  },
  "components": [
    { "kind": "service", "path": "service-components/reading-log" }
  ]
}
```

`documentAccess` 请求的是一个命名文件夹，不是在包里写死路径。`secrets` 只声明槽位信息。宿主保存的是非敏感引用，在启动 runner 前才解析出值；这两个字段都不能用来放凭据。

## 能力矩阵

| 请求或接口 | Guest 能拿到什么 | 边界与常见失败 |
| --- | --- | --- |
| `permissions.storage` | 应用私有数据、标准 WASI KV 和 SQLite 存储 | 按应用实例隔离，不能读取其他应用数据 |
| `permissions.documentAccess` | 预打开的 `/documents/<scope>` 目录 | 只会挂载已授权且路径规范化后的目录；写入要求 `read-write`；缺少授权会得到 `WASI_CAPABILITY_DENIED` |
| 打包资源 | 存在资源目录时的只读 `/app` | 不能写入应用包 |
| 私有运行目录 | `/data`、`/cache`、`/tmp` | 只属于当前已安装应用实例 |
| `permissions.allowedDomains` | 标准 WASI 出站 HTTP | 目标和重定向都会检查；私有网络目标会被拒绝 |
| `permissions.secrets` | 通过标准 WASI configuration 读取命名值 | 必需槽位未绑定时为 `SECRET_BINDING_MISSING`；无法解析时为 `SECRET_RESOLUTION_FAILED` |
| `requires.capabilities` 或 `resources` | 已声明 Provider 的绑定，或资源就绪状态 | 缺少或存在歧义的依赖会阻止启用 |
| `requires.modelSlots` / `agentSlots` | 已安装宿主内的模型或 Agent 绑定 | 槽位是非敏感授权；只有产品随附 WIT 声明 Guest host-call 时，Guest 才能调用它 |
| `provides.capabilities` | 给消费者使用的稳定 Provider 合同 | 绑定前会检查 Provider 标识、版本和 WIT 兼容性 |

当 Guest 的 WIT 工作区包含对应包时，runner 支持标准 WASI filesystem、HTTP、KV、SQLite、时钟和 configuration 接口。请只使用 `nextclaw app create` 复制出来的 WIT 包，或目标运行时随附的版本；不要从别的 NextClaw 版本复制 import 后假定 ABI 仍兼容。

## Service 清单与操作

```json
{
  "id": "reading-log",
  "title": "Reading log",
  "protocol": "wasi-component",
  "component": { "entry": "service.wasm" },
  "lifecycle": { "mode": "action" },
  "actions": {
    "entry_save": {
      "title": "Save reading entry",
      "risk": "write",
      "timeoutMs": 7000,
      "inputSchema": { "type": "object", "required": ["title"] }
    }
  }
}
```

清单中的操作名必须与 Component 的 `list-actions` 导出一致。Panel 使用的完整操作名是 `<service-id>.<action-name>`。请准确选择 `read`、`write`、`external` 或 `dangerous`：风险等级是用户和 Agent 授权的一部分。

公共 `nextclaw:portable-service` WIT 包会导出 `list-actions`、`invoke`、`start`、`handle-event` 和 `stop`。宿主 import 包含结构化日志、为兼容性保留的宿主 KV 与 HTTP 帮助方法、Provider 调用、运行时信息，以及 Job 进度和取消帮助方法。产品存在 `service-app-v2` world 时，新的持久化 Resident 使用它；旧的 `service-app` Component 仍通过兼容路径运行。

## 生命周期与组合

| 模式 | 适用场景 | 合同 |
| --- | --- | --- |
| `action` | 一次请求后返回结果 | 默认模式 |
| `resident` | 持续运行并接收持久事件的 Component | 单条有序投递通道；Guest 确认或请求重试；事件可能进入死信 |
| `provider` | 给其他已声明 Component 或应用使用的能力 | 先于消费者启动，后于消费者停止 |

能力依赖要在 `requires.capabilities` 中声明能力和兼容的 WIT 合同。同包 Provider 使用 sibling service id 作为 `provider`。外部 Provider 使用已安装依赖的绑定流程。Provider 不能递归调用另一个 Provider。

## 安全与兼容规则

- 把每个清单字段都当作请求，不要把它当成能力令牌。
- 文件夹、域名、密钥槽位、超时和输入 schema 都尽量收小。
- 不要把密码、Token、连接字符串、宿主路径或用户私有数据放进清单、操作结果、日志、Job chunk 或验证记录。
- 不要依赖任意环境变量、socket 或当前用户文件路径；它们不是 Portable Runtime 合同。
- WIT 包名、接口和版本都是兼容性信息。打包前应运行 `app check` 和 `app test`。

相关页面：[开发 Service App](/zh/developers/portable-service-apps) · [Job、事件与可观测性](/zh/developers/portable-runtime-observability)
