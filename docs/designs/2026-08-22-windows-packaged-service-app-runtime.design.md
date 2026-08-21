# Windows 打包 Desktop 的 Service App 运行合同

## 问题与范围

Windows 最新 Desktop 中，内置 Panel App 调用 Service App 时可能只收到
`The Service App request failed. Please retry.`。该文案是 server route 对未知异常的
通用 500 兜底；它没有保留第一个失败边界，因此不能据此假定是 Panel、授权或 MCP
进程本身的问题。

现有验证在 Windows runner 用开发目录的 `electron` 执行 Service App smoke，另有已打包
Desktop 的启动 smoke；两者没有组合。故它没有证明实际 `NextClaw Desktop.exe` 作为
宿主时，`node` 保留别名解析、`ELECTRON_RUN_AS_NODE`、Service App 子进程和 HTTP action
route 能端到端工作。

本次范围是内置 Service App 的 Windows 打包宿主执行合同。不会改变第三方原生命令、
Panel 授权模型、Service App manifest 格式或用户数据。

## 合同与唯一 owner

链路为：

```text
Panel action request
  -> ServiceAppsRoutesController
  -> ServiceAppManager
  -> McpServiceAppRuntimeService
  -> resolveRuntimeCommandLaunch("node")
  -> packaged NextClaw Desktop.exe + ELECTRON_RUN_AS_NODE
  -> built-in service MCP process
```

- `McpServiceAppRuntimeService` 是启动命令、子进程环境和最后运行状态的唯一 owner。
- `ServiceAppManager` 负责把 runtime 失败归为 `SERVICE_APP_RUNTIME_FAILED`。
- controller 只序列化已归类错误；不能因不同 workspace/package 的类实例身份而把已归类
  的 Service App 错误重新降级为无信息的通用 500。
- 内置 `command: "node"` 始终解析为当前宿主 executable；在 Electron 里只通过
  `ELECTRON_RUN_AS_NODE=1` 使用其内置 Node。禁止回退探测或依赖系统 Node。

不变量：同一个 action 在打包宿主的真实调用必须成功；若 Service runtime 真失败，响应
必须保留稳定错误代码与可诊断信息，而不是 `SERVICE_APP_REQUEST_FAILED`。

## 方案比较与选择

1. 仅给通用 500 增加更多提示：实现最小，但仍不能定位或阻止打包宿主回归，拒绝。
2. 以浏览器自动化点击实际 Panel：覆盖最完整，但把 UI、网络时序与授权 UI 混入
   runtime 合同，成本高且失败边界不清晰，拒绝作为主门。
3. 以已打包 `NextClaw Desktop.exe` 的 Node mode 执行现有端到端 Service action smoke，
   并将 Service App 错误的识别改为稳定错误合同：看似复用宿主 executable，但其 kernel/
   server 仍从源码 workspace 导入，不能证明安装器 runtime bundle，拒绝。
4. 启动已打包 Desktop 后，从它实际 runtime 日志读取本地 URL，再通过同一 HTTP API 启用
   内置 App、创建 Panel bridge session、授权并调用收藏/日历 action：覆盖安装器 runtime、
   kernel、server、子进程和 route，且不混入浏览器自动化，选用。

## 实施与恢复边界

1. 扩展既有 `smoke-windows-desktop.ps1` 的 runtime API probe，在应用已就绪后直接启用
   内置个人空间、创建 Panel bridge session、授权并调用收藏和日历的写/读 action；不复制
   Desktop 启动脚本或新增第二条测试入口。
2. `desktop-validate` 与 desktop release 都复用该既有 packaged Desktop smoke，因此同一
   请求链路在普通 CI、安装器与 portable 发布门中成立。
3. 让已归类的 Service App error 按稳定 `code` 合同识别，而不是跨打包边界脆弱的
   `instanceof` 身份；未知异常仍保持通用 500，不暴露任意内部栈或用户数据。
4. 如果 packaged smoke 首次失败，修复必须落在第一个违约 owner（resolver、child env
   或 MCP runtime），并用同一 packaged invocation 复验；不在 Panel 增加 fallback。

失败恢复：调用失败只更新 runtime 的运行状态；用户重试走既有 warm/restart 生命周期。
不新增持久化的失败提示或后台第二启动器。

## 验证标准

- route regression：跨模块实例的已归类 Service App error 仍返回原 code/status；未知错误
  仍为安全通用 500。
- 本地打包 Desktop：启动实际 runtime 后运行收藏和日历写/读 probe。
- Windows GitHub Action：使用实际 `win-unpacked/NextClaw Desktop.exe` 与安装后的
  Desktop 运行同一 probe；不允许系统 Node PATH 成为前提。
- 现有普通 Desktop 启动和 portable smoke 继续通过。

## 非目标

- 不新增系统 Node 扫描、Node launcher、UI 重试按钮或新的 Service App 协议字段。
- 不将 Service App 的临时失败写入用户偏好或长期数据。
