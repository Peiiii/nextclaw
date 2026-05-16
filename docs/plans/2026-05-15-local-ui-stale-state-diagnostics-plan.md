# 本地页面打不开与 stale state 诊断优化方案

## 背景

2026-05-15 本地出现 `nextclaw status` 显示服务停止、页面打不开的现象。现场证据显示：

- `nextclaw status` 指向 `http://127.0.0.1:55667`。
- `55667` 端口无服务监听，旧 `service.json` 记录的 PID 97079 已不存在。
- 当前 Desktop 进程 PID 49454 仍在运行，并监听 `http://127.0.0.1:63189`。
- `http://127.0.0.1:63189/` 返回 HTML，`/api/health` 返回 `ok`。
- 旧 PID 97079 的退出原因在现有日志中不可见，只能看到它曾经启动成功。

因此，本问题的核心不是“所有本地服务都挂了”，而是：

`旧 managed service 退出 -> service.json 未清理 -> status 继续展示旧 URL -> 用户打开旧 URL 失败 -> 误判为页面整体挂掉`

`remote WebSocket is not defined` 会影响远程访问，但目前证据不足以说明它导致本地页面打不开；本方案不把它作为本轮核心问题处理。

## 目标

本方案要解决三个用户可感知问题：

1. 用户打开 `nextclaw status` 给出的 URL 时不应进入假入口。
2. 当旧服务退出后，系统应能说明“页面为什么打不开”，而不是只说 state stale。
3. 当无法判断旧服务为什么退出时，日志必须给出足够证据，让下一次可直接定位。

这服务于 NextClaw 的“统一入口、自感知、自治”愿景：系统不只要运行，还要知道自己当前入口是否真实可用、哪个入口才是当前真相源、为什么旧入口失效。

## 非目标

- 不在本轮修复 remote connector 的 `WebSocket is not defined`。
- 不在本轮重构 Desktop 启动器或远程访问架构。
- 不把所有后台进程都强行合并成单实例；本轮只建立清晰的诊断合同和状态真相源。
- 不通过简单删除 `service.json` 来“修本机现象”，除非作为用户显式恢复动作。
- 不新增专门的 lifecycle recorder / lifecycle store / `runtime-lifecycle.jsonl`。本轮只复用现有 logging runtime 和各模块 scoped logger。

## 问题拆解

### 问题一：status 过度信任旧 service state

当前 `nextclaw status` 主要以 `~/.nextclaw/run/service.json` 作为 managed service 真相源。只要该文件存在但 PID 死亡，就显示 stale state，并继续展示其中的旧 URL。

这会造成两个误导：

- 用户看到的 UI URL 是旧的、打不开的。
- 如果 Desktop 另有活跃 UI runtime，status 没有把它提升为“当前可打开入口”。

### 问题二：Desktop / local UI runtime 没有进入 status 主视图

现场存在一个活跃 Desktop runtime：

- PID 49454
- URL `http://127.0.0.1:63189`
- health ok

但 `nextclaw status` 的主输出仍围绕旧 managed service 展示，导致用户无法从 status 直接知道“当前其实有一个可用页面”。

### 问题三：旧服务退出原因缺失

旧 PID 97079 的日志只记录：

- 启动成功
- UI/API ready
- remote 曾连接成功

没有记录：

- 子进程退出事件
- exit code
- signal
- 是否由 launcher 主动停止
- 是否因系统睡眠、用户关闭、崩溃、端口冲突或外部 kill 退出

这使得根因只能定位到“旧实例退出且 state 未清”，但无法继续定位“旧实例为什么退出”。

## 设计原则

1. **真实入口优先**：用户看到的首要 URL 必须是当前可访问入口，而不是陈旧 state。
2. **诊断分层**：区分 `service state stale`、`local UI alive`、`remote failed`、`channel degraded`，避免不同问题混成“服务挂了”。
3. **证据优先**：每个异常结论都要能指向具体 PID、端口、状态文件、health probe 和最近退出记录。
4. **恢复动作显式**：自动清理或重启应作为明确的 `--fix` / UI 控制动作，不在普通 status 中偷偷改变状态。
5. **低噪声**：remote、渠道、插件错误只有影响当前页面可用性时，才进入页面不可用主诊断。
6. **复用现有日志系统**：用 `@nextclaw/core` 现有 logging runtime 与 scoped logger；日志点放在真正拥有生命周期事实的 owner 里，不为单个问题新增抽象层。

## 方案一：status 输出区分“旧入口”和“当前可用入口”

### 建议行为

当 `service.json` stale，但发现 `ui-runtime.json` 或 Desktop 运行时可用时：

- `Level` 不应简单显示 `stopped`。
- 主视图应增加 `Current UI` 或 `Available UI`。
- 旧 `UI` 应标注为 `stale`，避免用户继续打开。

示例：

```text
Process: stale-state (old PID 97079 exited)
Stale UI: http://127.0.0.1:55667 (unreachable)
Available UI: http://127.0.0.1:63189 (Desktop PID 49454, healthy)
API health: ok

Issues:
- Service state is stale: old PID 97079 is not running.
- A healthy Desktop UI is available at http://127.0.0.1:63189.

Recommendations:
- Open http://127.0.0.1:63189.
- Run nextclaw status --fix to remove stale managed service state.
```

### 实现要点

- `DiagnosticsCommands.collectRuntimeStatus` 读取 `localUiRuntimeStore`。
- 对 `service.json` 与 `ui-runtime.json` 分别做 PID 存活和 health probe。
- 输出时把 `managed service state` 与 `current available UI` 分开。
- `--json` 中新增结构化字段，方便 UI 或自动诊断使用：

```json
{
  "entrypoints": {
    "stale": [{ "kind": "managed-service", "pid": 97079, "uiUrl": "http://127.0.0.1:55667" }],
    "available": [{ "kind": "desktop-ui", "pid": 49454, "uiUrl": "http://127.0.0.1:63189", "health": "ok" }],
    "recommended": "http://127.0.0.1:63189"
  }
}
```

## 方案二：用现有 scoped logger 补齐服务退出证据

### 核心口径

本轮不新增日志抽象。现有 `AppLogger` 已支持稳定 `scope` 与结构化 `context`：

```ts
logger.warn("runtime.process.exited", {
  runtimeKind: "desktop-embedded-runtime",
  childPid,
  code,
  signal,
  expected,
  uiPort,
  uiUrl
});
```

因此补日志的方式是：

- 继续写入现有 `~/.nextclaw/logs/service.log`。
- 每个模块使用自己的 scoped logger。
- 事件名稳定，字段结构化。
- 不新增 `RuntimeLifecycleRecorder`、不新增 `service-exit-history.jsonl`、不新增独立生命周期存储。

### scope 约定

建议使用现有 logging runtime 的 scoped logger：

| 位置 | scope | 职责 |
| --- | --- | --- |
| CLI managed service 启动 | `service.startup` | 记录 detached 后台进程启动、初始 state 写入 |
| foreground serve / gateway runtime | `service.runtime` 或现有 gateway scope | 记录当前长期进程收到退出信号、ready、异常退出上下文 |
| Desktop runtime supervisor | `desktop.runtime` | 记录 Desktop 启动的 runtime 子进程启动、停止意图、退出结果 |
| diagnostics status | `diagnostics.status` | 记录 stale state 被发现，但普通 status 不做清理 |

### 事件名约定

先只约定少量稳定事件名，避免过度设计：

```text
runtime.process.started
runtime.process.ready
runtime.process.stop_requested
runtime.process.exited
service_state.written
service_state.stale_detected
```

这些事件名只是 `message`，不是新类型系统。第一版不需要建 enum，除非后续出现多处拼写漂移。

### 接入点一：CLI managed service 启动

文件：

```text
packages/nextclaw-service/src/shared/services/runtime/service-managed-startup.service.ts
```

现有位置：

```text
spawn(cliLaunch.command, childArgs, { detached: true, stdio: "ignore" })
writeInitialManagedServiceState(...)
```

建议补充：

```ts
logger.info("runtime.process.started", {
  runtimeKind: "managed-service",
  childPid: child.pid,
  uiUrl,
  apiUrl,
  uiHost: uiConfig.host,
  uiPort: uiConfig.port,
  entrypoint: `${cliLaunch.command} ${childArgs.join(" ")}`
});

logger.info("service_state.written", {
  runtimeKind: "managed-service",
  childPid: child.pid,
  statePath: managedServiceStateStore.path,
  uiUrl,
  apiUrl
});
```

注意：这里不强行监听 child exit。因为 managed service 是 detached，启动命令本身会退出，父进程不是长期监督者。错误做法是为了“看起来完整”加一个不可靠的 exit 监听。

### 接入点二：foreground serve / gateway runtime 当前进程

文件：

```text
packages/nextclaw-service/src/shared/services/runtime/runtime-command.service.ts
```

现有长期进程入口：

```text
RuntimeCommandService.startGateway(...)
```

建议在 `ensureRuntimeLoggingInstalled()` 后，用现有 logger 记录当前进程自身生命周期：

```ts
const logger = NextclawCore.getAppLogger("service.runtime");

logger.info("runtime.process.started", {
  runtimeKind: "serve-process",
  pid: process.pid,
  source: "RuntimeCommandService.startGateway"
});
```

`@nextclaw/core` 已有 `getAppLogger(scope)`，不需要为了这个场景新增日志获取抽象。

退出日志可以用一个局部函数安装：

```ts
private installProcessExitLogging = (): void => {
  process.once("exit", (code) => {
    logger.warn("runtime.process.exited", {
      runtimeKind: "serve-process",
      pid: process.pid,
      code
    });
  });
};
```

这只是 `RuntimeCommandService` 内部的小方法，不是新 owner。第一版不监听 `SIGTERM` / `SIGINT`，避免为了日志改变 Node 默认 signal 行为；显式停止意图由发起停止的 owner 记录。

### 接入点三：Desktop runtime 子进程 supervisor

文件：

```text
apps/desktop/src/runtime-service.ts
```

现有 owner 已经是 `RuntimeServiceProcess`，它最知道：

- 子进程 PID
- 当前端口
- 是否处于 `stopping`
- 最近 runtime 输出
- 是否由启动失败 suppression 触发
- 是否要自动 recovery

因此只在现有方法里补结构化日志：

```ts
private handleChildExit = async (child: ChildProcess, info: RuntimeProcessExitInfo): Promise<void> => {
  this.options.logger.warn("runtime.process.exited", {
    runtimeKind: "desktop-embedded-runtime",
    childPid: child.pid,
    code: info.code,
    signal: info.signal,
    expected: this.stopping,
    suppressRestart,
    uiPort: this.port,
    uiUrl: this.port ? `http://127.0.0.1:${this.port}` : null
  });
  ...
};
```

在 `stop()` 或 `terminateChild()` 前补：

```ts
this.options.logger.info("runtime.process.stop_requested", {
  runtimeKind: "desktop-embedded-runtime",
  childPid: child.pid,
  reason: "desktop-runtime-stop",
  uiPort: this.port
});
```

不新增 Desktop 专属日志模块；复用 `RuntimeServiceOptions.logger`。

### 关键要求

- 日志点只加在已有生命周期 owner 里，不新增 wrapper。
- 能记录 `expected` 时必须记录，避免把主动停止误判成异常退出。
- 能记录 `childPid`、`uiPort`、`uiUrl` 时必须记录，方便和 stale state 对上。
- `SIGKILL` 或系统强杀可能无法在被杀进程内写日志；这类情况由后续 status 根据“有 started 无 exited”推断并明确说明证据缺口。
- 第一版只写 `service.log`；如果后续 `status --verbose` 需要高效机器查询，再讨论是否引入极薄的 exit history 文件。

## 方案三：status --fix 只做安全清理，不掩盖根因

### 建议行为

`nextclaw status --fix` 可以清理 stale `service.json`，但应在清理前记录一条 fix action：

```text
Fix actions:
- Archived stale service state for PID 97079 before clearing it.
```

建议将旧 state 归档到：

```text
~/.nextclaw/run/archive/service-<timestamp>-pid-97079.json
```

这样既能恢复用户状态，又不丢排障证据。

## 方案四：页面不可用诊断命令

新增或增强现有诊断入口，使用户能直接问“为什么页面打不开”：

```bash
nextclaw doctor ui
```

输出按链路切分：

1. status 指向的 URL 是否可访问
2. 配置端口是否可访问
3. managed service state 是否 stale
4. local UI runtime 是否活着
5. Desktop 进程是否活着
6. 最近一次服务退出记录是什么
7. 推荐打开哪个 URL 或执行哪个恢复动作

这比泛化的 `doctor` 更贴近用户问题。

## 分阶段计划

### Phase 1：诊断输出修正

- `status` 读取并展示 local UI runtime。
- stale URL 明确标注不可用。
- 有可用 Desktop UI 时推荐真实 URL。
- `--json` 增加 entrypoints 结构。

验收：

- 构造 `service.json` stale + `ui-runtime.json` healthy 场景。
- `nextclaw status` 不再只给旧 URL。
- 用户能从输出里直接打开当前可用页面。

### Phase 2：退出原因留痕

- Desktop runtime supervisor 在现有 `handleChildExit` / `stop` / `terminateChild` 流程中补结构化日志。
- CLI managed service 启动器在现有 spawn / state write 位置补结构化日志。
- foreground serve 进程在现有长期入口记录自身启动、ready、信号和退出事件。
- 不新增 lifecycle recorder、独立 store 或 jsonl。

验收：

- 主动关闭 Desktop 后能看到 `reason: desktop-before-quit` 或等价原因。
- kill runtime 后能看到 signal。
- 崩溃时能看到 exit code / signal / crash log 路径；若被 `SIGKILL`，status 能明确说明没有退出日志是系统限制。

### Phase 3：安全 fix 与 UI doctor

- `status --fix` 清理前归档 stale state。
- 增加 `doctor ui` 或等价 UI 页面诊断接口。
- Desktop UI 的系统状态页展示“当前入口、旧入口、最近退出原因”。

验收：

- stale state 清理后仍可追溯原始 state。
- UI 页面能解释“为什么旧链接打不开”。

## 风险与取舍

- 如果 status 同时发现多个活跃 UI，必须明确推荐规则：优先 Desktop 当前进程，其次 healthy managed service，其次 configured port。
- 不能因为发现可用 Desktop UI 就静默删除 stale service state，否则排障证据会消失。
- 不应把 remote 或 channel 错误提升为“页面打不开”的主因，除非 health 或页面加载链路直接依赖它。
- 退出原因可能无法 100% 判断，但必须记录观察者、时间、PID、signal/code，避免完全无证据。
- 不提前抽象 lifecycle logger。只有当事件名、字段 shape 在 3 个以上模块反复漂移，且测试已经证明重复成本真实存在时，再考虑提取极小 helper。

## 待讨论问题

1. `nextclaw status` 的主语应该是 managed service，还是“当前 NextClaw 本地入口”？
2. Desktop 运行时是否应该写入 `service.json`，还是保持 `ui-runtime.json` 独立并由 status 聚合？
3. `status --fix` 是否默认归档 stale state，还是只在 `--verbose` / `--debug` 下归档？
4. 是否需要在 Desktop 窗口里提供“复制当前本地 URL”和“一键诊断页面打不开”入口？
5. `doctor ui` 是新增命令，还是并入现有 `doctor` 的一个 section？

## 推荐决策

建议先做 Phase 1 和 Phase 2。

理由：

- Phase 1 直接解决用户被假 URL 误导的问题，收益最大。
- Phase 2 解决根因不可追踪的问题，避免下次仍停在“旧实例退出但不知道为什么”。
- Phase 3 属于产品化增强，可以在前两阶段稳定后再做。

## 2026-05-16 落地状态

本轮已先落地 Phase 2 的退出证据链，暂未实现 Phase 1 / Phase 3 的 status 输出与 doctor 命令。

已改动：

- `packages/nextclaw-service/src/shared/services/runtime/runtime-command.service.ts`
  - 复用 `NextclawCore.getAppLogger("service.runtime")`。
  - 记录 foreground `serve-process` 的 `runtime.process.started`、`runtime.process.ready`、`runtime.process.exited`。
  - 只监听 `process.once("exit")`，不新增 signal handler。
- `packages/nextclaw-service/src/shared/services/runtime/service-managed-startup.service.ts`
  - 在 managed service spawn 与 state write 后记录 `runtime.process.started`、`service_state.written`。
  - 在 `nextclaw stop` 发起 SIGTERM / SIGKILL 前记录 `runtime.process.stop_requested`。
  - state 清理后记录 `service_state.cleared`，ready 后记录 `runtime.process.ready`。
- `apps/desktop/src/runtime-service.ts`
  - 在 Desktop embedded runtime 子进程启动、ready、停止请求、退出时记录稳定事件名。
  - 退出日志带 `childPid`、`code`、`signal`、`expected`、`suppressRestart`、`uiPort`、`uiUrl` 与最近输出摘要。
- `packages/nextclaw-service/src/shared/services/runtime/utils/managed-service-routing.utils.ts`
  - 把原本混在 managed startup service 里的路由与 ready snapshot 纯解析逻辑移出，避免继续膨胀已超预算文件。

本轮刻意没有做：

- 没有新增 lifecycle recorder / lifecycle store / jsonl 文件。
- 没有改 `status --fix` 行为。
- 没有处理 remote `WebSocket is not defined`，因为它不是本地页面打不开的主因。
