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
- 修复保持在 service / kernel / extension-sdk 三个 owner 边界内，不给 QQ channel 做特殊分支。

## 非目标

- 不在第一版引入跨平台启动扫孤儿进程，避免进程枚举、指纹识别和误杀策略把修复面扩大。
- 不实现自动重启扩展进程；扩展是否重启仍归当前 runtime lifecycle owner。
- 不吞掉 QQ SDK 的真实 gateway 错误；QQ SDK 错误可观察性可以作为后续增强。
- 不改变用户显式 `nextclaw stop`、后台 service lease、diagnostics stale 判断的既有语义。

## Owner 与边界

- `ManagedServiceSupervisor`：负责当前 service 进程的信号退出记录、heartbeat 停止，以及在退出前调用注册的 runtime shutdown hook。
- `ServiceGatewayManager`：拥有 gateway cleanup，负责停止 file watcher、kernel extensions 和 remote runtime。
- `ExtensionLifecycleService`：拥有扩展子进程启动合同，负责向子进程注入 `NEXTCLAW_EXTENSION_PARENT_PID`。
- `NextClawExtension` SDK：拥有扩展进程内的父进程死亡观察；父 PID 不存在或不可用时，不启用 watchdog。

## 方案取舍

完整强韧方案可以包含 runtime lease、扩展进程注册表、启动扫孤儿、父子双向 heartbeat、统一 supervisor 和 diagnostics 报告。但这会明显扩大实现面，且第一版最急迫的问题是“父 runtime 已经不存在，扩展还继续运行”。

最简有效方案采用两条互补链路：

1. 父进程优雅退出：service signal handler 不再直接 `process.exit`，而是先调用 gateway cleanup，确保内存中的扩展子进程被 `kernel.extensions.stop()` 停掉。
2. 子进程自救退出：kernel 启动扩展时下发父 PID，extension SDK 以固定间隔检查父 PID 是否仍存活；父 PID 消失时关闭本地订阅并 `process.exit(0)`。

这两条链路分别覆盖正常可处理信号和父进程异常消失。它们不依赖 QQ、Feishu、Weixin 等具体 channel 实现，也不要求每个扩展自己重写生命周期守卫。

## 验收标准

- kernel 启动扩展子进程时，子进程 env 必须包含 `NEXTCLAW_EXTENSION_PARENT_PID=<service pid>`。
- extension SDK 在 `NEXTCLAW_EXTENSION_PARENT_PID` 指向不存在的 PID 时，会关闭自身并退出。
- service 捕获 `SIGTERM` / `SIGINT` / `SIGHUP` 后，必须等待注册的 shutdown hook 执行，再调用进程退出。
- `ServiceGatewayManager` 的 shutdown hook 必须走同一个 gateway cleanup，至少覆盖 `kernel.extensions.stop()`。
- 功能验证必须覆盖单元测试和贴近真实运行的 SDK watchdog 冒烟。

## 后续增强

- 如果后续还出现历史孤儿扩展积累，再引入启动期 sweeper，但必须基于扩展 manifest root、命令指纹、父 PID 环境和工作目录组合判断，不能只按进程名误杀。
- QQ channel 可以补充 gateway 启动错误显式日志，把 `qq-official-bot` 内部 websocket / gateway 错误桥接到外层诊断，但不作为本次生命周期根因修复的一部分。
