# Service App 权限与数据

NextClaw 把 Service App 的“应用能力”“调用授权”和“受管数据”分开处理。启用一个应用，不等于把它的所有 Actions 自动交给所有 Panel 和 Agent。

## 三层边界

| 边界 | 决定什么 | 在哪里声明或确认 |
| --- | --- | --- |
| App 权限 | 应用可以向宿主请求哪些基础能力 | App 清单，例如存储和允许访问的域名 |
| Panel 授权 | 某个 Panel 是否可以调用声明过的 Action | 首次调用时由用户确认 |
| Agent 授权 | 某个 Agent 是否能发现并调用某个 Action | Service Apps 页面逐项授予 |

这三层不会互相替代。App 声明允许存储，只代表运行时可以提供存储能力；Panel 或 Agent 仍然只能调用自己获准使用的 Action。

## Action 风险类型

Service App 开发者需要为每项 Action 声明风险类型，NextClaw 会在列表和授权确认中展示它。

| 类型 | 用来表达 |
| --- | --- |
| `read` | 主要读取或查询数据 |
| `write` | 会创建、修改或删除数据 |
| `external` | 会与外部服务交互 |
| `dangerous` | 可能产生更高影响，需要格外检查 |

风险类型是开发者对 Action 的分类，不会代替你对具体用途、输入和来源的判断。

## 网络访问

WASM Service App 不能直接使用宿主网络。所属 App 必须在清单中声明 `allowedDomains`，Component 再通过宿主提供的 HTTPS GET 能力发起请求。非 HTTPS 地址或未列入允许范围的目标会被拒绝。

当前 Portable Runtime 只向 Component 公开受控的 HTTPS GET；它没有把宿主的原生网络能力整体交给应用。

## 受管数据

如果所属 App 声明了存储权限，WASM Component 可以使用宿主提供的 KV 能力。数据保存在 NextClaw 管理的 App 实例中，与可替换的应用代码分开。

因此：

- 关闭 Panel 不会删除数据；
- 更新应用代码时继续使用原有受管实例；
- 停用应用会停止运行能力，但不会自动清空数据；
- 卸载或移除应用时，默认可以选择保留数据；
- 只有明确选择“删除应用和数据”或之后单独删除保留实例时，受管数据才会永久删除。

当前 App 清单支持全局存储作用域，同一个 App 的 Panel 和已授权 Agent 可以通过 Service Actions 使用同一份数据。

## 卸载与保留数据

移除应用时，NextClaw 提供两个明确选择：

- **保留数据**：移除应用代码，保留受管实例，之后重新安装可以继续使用。
- **删除应用和数据**：在破坏性确认后，同时删除应用和受管实例。

确认前，NextClaw 会显示受管路径，以及数据、配置、状态、缓存、临时文件和日志的占用。应用被移除后，保留实例仍会出现在应用管理中，供你稍后处理。

应用获准访问、但位于受管实例之外的文件或目录，不属于这套清理流程，不会随 App 数据一起删除。

## 通过 CLI 查看和删除

可以通过运行中的 NextClaw 主机列出 App 数据：

```bash
nextclaw app data list --json
```

要永久删除已经处于 `retained` 状态的实例：

```bash
nextclaw app data delete <data-id> --confirm <app-id> --json
```

从最新清单复制不透明的 `data-id`，并让 `--confirm` 与 App id 完全一致。活动中的实例不能通过这个命令删除；不要手工删除受管存储目录。

## 当前安全边界

Portable Runtime 使用宿主中介能力限制 Component 可以请求的资源，但当前还不是用于运行不受信任代码的生产级安全沙箱。CPU、内存和并发隔离仍在完善；Secret、文件与 Blob 等能力也尚未进入公开 Component 合同。

继续阅读：[使用 Service Apps](/zh/guide/service-apps-usage) · [Runtime 模型与能力合同](/zh/developers/portable-runtime-contracts)
