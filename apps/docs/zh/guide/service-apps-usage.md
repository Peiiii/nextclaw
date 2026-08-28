# 使用 Service Apps

这篇文档说明如何连接 Service App、在 Panel 中调用它的 Action，以及怎样只把需要的能力交给指定 Agent。

## 连接并发现 Actions

打开 **Service Apps**，找到目标服务，然后选择“连接并发现动作”。NextClaw 会启动对应运行时并读取它实际提供的 Actions。

连接后，每项 Action 会显示：

- 名称、标题和用途说明；
- 开发者声明的风险类型；
- 清单声明与运行时发现结果是否一致；
- 已获得该 Action 的 Agent。

如果状态显示 `missing`，说明清单声明了 Action，但运行时没有提供；如果显示 `undeclared`，说明运行时提供了清单中没有声明的 Action。这两种情况都应该由应用开发者修正。

## 在 Panel App 中使用

Panel App 必须在自己的清单中列出需要调用的 Actions。首次实际调用时，NextClaw 会显示授权确认，其中包括：

- 发起调用的 Panel；
- 要调用的 Action；
- Action 的用途和风险；
- 本次传入的数据。

选择“允许”后，该 Panel 可以继续调用已批准的 Action；选择“拒绝”则中止本次调用。授权只属于当前 Panel，不会自动扩展到其它 Panel 或 Agent。

## 让 Agent 调用

在 Service Apps 页面展开目标服务，在某个 Action 旁选择授权入口，然后选择一个 Agent。授权完成后，该 Agent 会把 Action 作为工具发现。

你可以直接用自然语言要求 Agent 使用它。例如，应用提供“列出任务”和“保存任务”两个 Action 时，可以说：

> 先读取我的任务列表，再新增一条“整理本周计划”的待办；完成后告诉我新增记录的标题。

Agent 只能发现你明确授予它的 Actions。只授予读取 Action 时，它不能调用写入 Action；撤销授权后，这项工具会从该 Agent 的可用能力中移除。

## 断开和重新连接

需要停止运行时时，可以从 Service App 的更多操作中选择断开。再次选择连接时，NextClaw 会重新启动运行时并发现 Actions。

如果 Service App 进入失败状态：

1. 查看页面显示的最后一条错误信息。
2. 检查应用所需的配置、文件或外部服务是否可用。
3. 重新连接并确认 Actions 能否正常发现。

WASM Service App 的共享运行器异常退出或调用超时时，NextClaw 会结束故障运行器；需要持续存在的 Provider 和 Resident 会按 Provider 优先的顺序恢复。导致失败的调用本身不会被静默重放。

## 管理或移除

- **随 NextClaw App 安装的 Service App**：选择“在应用中管理”，统一启用、停用或卸载所属 App。
- **workspace 源码 Service App**：可以直接从 Service Apps 页面移除。

移除时可以保留受管数据，也可以在明确确认后同时删除应用和数据。详细规则见 [Service App 权限与数据](/zh/guide/service-app-permissions-data)。

## 常见问题

### Agent 看不到某个 Action

确认服务处于已连接状态，并检查该 Action 是否已单独授权给当前 Agent。Panel 授权和 Agent 授权互不替代。

### Panel 第一次调用没有成功

确认授权对话框中列出的 Action 是当前 Panel 清单声明的 Action。拒绝授权、运行时未连接或 Action 未正确发现都会让调用失败。

### 关闭 Panel 后数据会消失吗

不会。关闭 Panel 只关闭界面。是否保存数据由 Service App 的实现和所属 App 的存储权限决定。

### 关闭 Panel 后后台工作会停止吗

普通 Action 本来就只在调用时运行。声明为 Resident 的 Service App 可以在 Panel 关闭后继续接收宿主定时事件，直到所属 App 被停用或运行时被断开。
