# NextClaw 扩展进程生命周期合同设计

## 背景

本次 `pnpm dev start --package-watch` 暴露的问题表面是 QQ channel 启动超时：`qq-official-bot` 在 gateway websocket 频率限制或内部启动错误时不会把错误可靠 reject，外层只能在 90 秒后报 `QQ bot start timed out`。

更深一层的确定性问题是：历史 `nextclaw-channel-extension-*` 子进程在父级 service 退出后继续存活，变成 `PPID=1` 的孤儿扩展进程。QQ 扩展孤儿进程会继续执行 reconnect，从而持续打 QQ gateway，最终触发频率限制；即使修 QQ 的 timeout，也不能解决扩展进程失去父 owner 后仍可长期运行的问题。

这不符合 NextClaw 作为个人操作层的自感知与真实调度要求。扩展进程必须归属于当前 service runtime；一旦父 runtime 停止或消失，扩展进程应尽快退出，而不是继续代表已经不存在的宿主访问外部平台。

## 目标

- 新版本不再制造长期孤儿扩展进程。
- service 收到 `SIGTERM` / `SIGINT` / `SIGHUP` 时先走 gateway cleanup，再退出进程。
- kernel 启动扩展进程时把父 service PID 写入扩展运行时环境。
- extension SDK 统一实现父进程死亡 watchdog，所有扩展共享同一生命周期兜底。
- kernel 启动扩展前清理历史遗留的孤儿 channel extension 进程，避免旧版本残留继续污染新实例。
- QQ channel 在创建 websocket 前预检 gateway session quota，并把 ready 前返回的 close/error 显式暴露出来，避免真实 `INVALID_SESSION` 被包装成 90 秒 timeout。

## 非目标

- 不在 Windows 上做进程枚举式孤儿清理；启动扫孤儿先覆盖 macOS/Linux，并以 `PPID=1`、`node dist/main.js`、channel extension cwd 组合判定。
- 不实现自动重启扩展进程；扩展是否重启仍归当前 runtime lifecycle owner。
- 不改变用户显式 `nextclaw stop`、后台 service lease、diagnostics stale 判断的既有语义。

## Owner 与边界

- `ManagedServiceSupervisor`：负责当前 service 进程的信号退出记录、heartbeat 停止，以及在退出前调用注册的 runtime shutdown hook。
- `ServiceGatewayManager`：拥有 gateway cleanup，负责停止 file watcher、kernel extensions 和 remote runtime。
- `ExtensionLifecycleService`：拥有扩展子进程启动合同，负责向子进程注入 `NEXTCLAW_EXTENSION_PARENT_PID`，并在启动前清理明确属于 NextClaw channel extension 的历史孤儿进程。
- `NextClawExtension` SDK：拥有扩展进程内的父进程死亡观察；父 PID 不存在或不可用时，不启用 watchdog。
- `QQChannel`：拥有 QQ SDK 启动诊断，先预检 gateway `session_start_limit`，再把 `receiver.close`、`receiver.error`、`session.error` 和 `session DISCONNECT` 转成启动失败原因。

## 方案取舍

完整强韧方案可以包含 runtime lease、扩展进程注册表、父子双向 heartbeat、统一 supervisor 和 diagnostics 报告。但这会明显扩大实现面，且第一阶段最急迫的问题是“父 runtime 已经不存在，扩展还继续运行”。

修正后的最简有效方案采用三条互补链路：

1. 父进程优雅退出：service signal handler 不再直接 `process.exit`，而是先调用 gateway cleanup，确保内存中的扩展子进程被 `kernel.extensions.stop()` 停掉。
2. 子进程自救退出：kernel 启动扩展时下发父 PID，extension SDK 以固定间隔检查父 PID 是否仍存活；父 PID 消失时关闭本地订阅并 `process.exit(0)`。
3. 历史孤儿扫除：kernel spawn 前扫 `PPID=1`、命令为 `node dist/main.js`、cwd 明确属于 NextClaw channel extension 的进程，并发送 `SIGTERM`。

前三条链路分别覆盖正常可处理信号、父进程异常消失和旧版本历史残留。它们不依赖 QQ、Feishu、Weixin 等具体 channel 实现，也不要求每个扩展自己重写生命周期守卫。

QQ channel 的启动失败诊断是另一条局部增强：它不解决 lifecycle 所有权，但能在 `session_start_limit.remaining=0` 时停止创建 websocket session，并按 `reset_after` 等待下一次重试；同时把 QQ gateway 返回的 `INVALID_SESSION` / `4903 create session error` 直接暴露给外层日志，避免被误判为纯 timeout 或网络慢。

## 验收标准

- kernel 启动扩展子进程时，子进程 env 必须包含 `NEXTCLAW_EXTENSION_PARENT_PID=<service pid>`。
- extension SDK 在 `NEXTCLAW_EXTENSION_PARENT_PID` 指向不存在的 PID 时，会关闭自身并退出。
- service 捕获 `SIGTERM` / `SIGINT` / `SIGHUP` 后，必须等待注册的 shutdown hook 执行，再调用进程退出。
- `ServiceGatewayManager` 的 shutdown hook 必须走同一个 gateway cleanup，至少覆盖 `kernel.extensions.stop()`。
- kernel 启动扩展前，必须能清理 cwd 明确属于 NextClaw channel extension 的历史孤儿进程。
- QQ gateway quota 为 0 时，日志必须显示 reset 时间，按 reset 时间调度下一次重试，并且不能继续创建 websocket bot。
- QQ gateway 在 ready 前 close/error 时，日志必须显示 close code/reason，而不是只显示 90 秒 timeout。
- 功能验证必须覆盖单元测试和贴近真实运行的 SDK watchdog 冒烟。

## 后续增强

- 后续可以把 orphan cleanup 的观测结果接入 diagnostics，展示清理数量、cwd 和是否仍有残留。
- 后续可以把 QQ `4903 create session error` 的平台含义映射成更友好的配置/权限建议，但底层日志仍应保留原始 close code/reason。
