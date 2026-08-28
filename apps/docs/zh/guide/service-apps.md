# Service Apps

Service App 让 NextClaw 中的应用不只展示界面，还能执行需要本地运行时的操作。它可以保存应用数据、访问经过允许的网络服务、在后台持续运行，或把一项能力同时提供给 Panel App 和指定 Agent。

你仍然通过 NextClaw 使用和管理这些能力：应用负责声明自己能做什么，NextClaw 负责启动运行时、展示风险、处理授权，并管理应用数据。

## Service App 能做什么

具体能力取决于应用本身。当前 Service App 可以支持这些常见场景：

- **保存和修改应用数据**：例如待办、便签、表单记录和应用状态。
- **执行一次操作**：例如计算、格式转换、数据查询或写入。
- **访问允许的网络服务**：应用只能访问清单中声明的域名。
- **在后台保持运行**：例如计时、轮询或处理宿主定时事件。
- **复用其它 Service App 的能力**：应用可以调用自己明确声明依赖的 Provider。
- **供 Agent 调用**：你可以把某个 Action 单独授权给指定 Agent。

Service App 暴露的每项能力都叫作一个 **Action**。例如，一个笔记应用可以提供“列出笔记”“保存笔记”和“删除笔记”三个 Action，而不是一次获得不受限制的系统访问。

## 它和 Panel App 的关系

Panel App 负责用户看到和操作的界面，Service App 负责界面背后的运行逻辑。两者可以组合成一个完整应用：

```text
你操作 Panel App → Panel 请求一个 Action → NextClaw 检查授权 → Service App 执行并返回结果
```

Panel App 不是使用 Service App 的唯一方式。经过你单独授权后，Agent 也可以发现并调用同一个 Action，并使用同一份应用数据。

## 从哪里管理

打开 NextClaw 的 **Service Apps** 页面，可以看到已发现的 Service App、它提供的 Actions、当前运行状态和每项 Action 的风险类型。

常见状态包括：

| 状态 | 含义 |
| --- | --- |
| 未连接 | 运行时尚未启动或尚未发现 Actions |
| 连接中 | NextClaw 正在连接 Service App |
| 已连接 | 可以使用已发现的 Actions |
| 连接失败 | 启动或运行发生错误，可查看错误信息后重试 |
| 已停止 | 运行时已断开，可以重新连接 |

如果 Service App 来自已安装的 NextClaw App，可以从该页面进入应用管理；如果它来自 workspace 源码，则可以直接移除这个 Service App。

## 开始使用

1. 在 **Service Apps** 页面找到要使用的服务。
2. 选择“连接并发现动作”，等待状态变为已连接。
3. 在对应的 Panel App 中执行操作。首次调用 Action 时，检查来源、用途、输入和风险，然后选择允许或拒绝。
4. 如果还希望 Agent 使用某项能力，在对应 Action 旁只授权给需要它的 Agent。

NextClaw 会分别保存 Panel 和 Agent 的授权。允许一个 Panel 调用 Action，不代表所有 Agent 都自动获得该能力。

## 当前支持的运行方式

NextClaw 当前支持两类 Service App 协议：

- **MCP**：连接现有 MCP Service，并把它提供的工具映射为 Service Actions。
- **WASM Component**：使用 Portable Runtime 在共享原生运行器中执行 Rust/WASM Component。

对使用者而言，两者都会出现在 Service Apps 页面，并通过同一套 Action、状态和授权体验使用。

## 接下来

- [使用 Service Apps](/zh/guide/service-apps-usage)：连接服务、调用 Action，并把能力授权给 Agent。
- [Service App 权限与数据](/zh/guide/service-app-permissions-data)：了解风险标记、授权边界和卸载时的数据处理。
- [Portable Runtime](/zh/developers/portable-runtime)：了解 WASM Service App 的运行模型和当前技术边界。
