# NextClaw 托管服务生命周期监督设计

## 背景

2026-05-22 至 2026-05-23 的本机事故暴露出一个确定性缺口：`nextclaw start/restart` 启动的托管服务在 ready 后被 `unref`，父进程不再观察子进程生命周期；如果子进程后续死亡，`service.json` 仍会长期保留旧 PID 和 ready 状态，导致 `status/doctor` 只能在读端发现 stale state，无法说明最后一次存活时间、退出原因或状态合同是否过期。

这不符合 NextClaw 作为个人操作层的自感知要求。NextClaw 必须能表达“我是否仍在运行、最后一次被谁确认、退出时发生了什么”，而不是把一个静态 PID 文件留给用户猜。

## 目标

- 把托管服务生命周期收敛到单一 owner，而不是由启动 helper、state store、diagnostics 分散维护。
- 将 `service.json` 从静态 PID 文件升级为带 lease 的运行状态合同。
- 服务进程正常退出或收到可处理信号时，写出可诊断的退出原因。
- 服务被 `SIGKILL`、系统回收或外部强杀时，即使没有退出日志，也能通过 lease 过期判断状态不可信。
- `status/doctor/start` 的行为基于同一个状态合同，不各自发明 stale 判断。

## 非目标

- 不在本次引入 OS 级常驻守护或跨平台 autostart KeepAlive 策略。
- 不实现无限自动重启，避免把异常退出隐藏成“看起来还好”。
- 不用当前事故的日志关键字、版本号或插件报错做特殊分支。
- 不改变用户显式 `stop` 的语义。

## Owner

新增 `ManagedServiceSupervisor` 作为托管服务生命周期 owner。

它负责：

- 启动托管子进程；
- 写入初始 state；
- 写入 ready state；
- 在当前服务进程内启动 lease heartbeat；
- 安装退出与信号观察；
- 判断 state 是否 stale；
- 清理或标记过期 state；
- 给 diagnostics 提供统一判断。

它不负责：

- gateway/runtime 业务启动；
- remote connector 业务状态；
- 插件注册；
- autostart 安装；
- 用户配置加载策略。

## 状态合同

`ManagedServiceState` 增加：

- `lease`：托管进程的存活租约。
  - `ownerPid`
  - `heartbeatAt`
  - `heartbeatIntervalMs`
  - `ttlMs`
- `lastExit`：进程可观察退出信息。
  - `pid`
  - `reason`
  - `signal`
  - `code`
  - `exitedAt`
  - `message`

判断规则：

- `pid` 不存在或进程不存在：stale。
- `pid` 存在但 `lease.heartbeatAt + ttlMs < now`：stale。
- `lease.heartbeatAt` 不可解析：stale。
- `status --fix` 可清理 stale state。
- 正常退出、SIGTERM/SIGINT/SIGHUP、uncaught exception 时，当前进程尽力写 `lastExit` 并停止 heartbeat；不为 `unhandledRejection` 增加会改变 Node 默认行为的监听器。
- `SIGKILL` 无法在进程内捕获，靠 lease 过期表达 state stale；不会伪造一个实际没有被进程观察到的 `lastExit`。

## 方案取舍

只在 `status` 清理 stale state 是读端补救，不能让系统知道服务何时最后存活。只加 signal handler 也不够，因为 `SIGKILL` 和系统级回收没有执行机会。OS KeepAlive 长期有价值，但跨平台语义和显式 stop 边界更重，不适合作为本次唯一答案。

因此采用 supervisor + lease：它不掩盖死亡，不做静默恢复，而是先让状态真实、可诊断、可验证。未来如果引入自动重启，应基于同一个 supervisor 策略扩展，而不是另起路径。

## 验收标准

- 启动托管服务时，`service.json` 写入 `lease`。
- 服务进程运行时，heartbeat 会更新 `lease.heartbeatAt`。
- 服务正常退出或可处理信号退出时，写入 `lastExit`。
- 构造一个 PID 仍存在但 lease 过期的 state，`status/doctor` 必须判定 stale。
- 构造一个 PID 不存在的 state，`status --fix` 必须清理。
- 定向测试覆盖：
  - supervisor 启动写入 lease；
  - lease 过期判断；
  - exit/signal 记录；
  - diagnostics 使用统一 stale 判断。

## 验证计划

- `pnpm --filter @nextclaw/service test -- shared/services/runtime`
- `pnpm --filter @nextclaw/service test -- cli/commands/diagnostics`
- `pnpm --filter @nextclaw/service tsc`
- `pnpm --filter @nextclaw/service lint`
- 贴近链路 smoke：在临时 `NEXTCLAW_HOME` 下启动服务，读取 `run/service.json`，确认 lease 存在且 heartbeat 更新；杀掉 PID 后确认 `status --json` 报告 stale。
