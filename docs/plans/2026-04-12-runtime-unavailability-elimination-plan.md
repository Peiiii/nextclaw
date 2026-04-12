# Runtime Unavailability Elimination Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 系统性消灭 NextClaw 的“正常用着用着就不可用”问题，把“不可用”从一个用户体感现象拆成可归因、可监控、可拦截、可恢复、可持续压低发生率的工程问题。

**Architecture:** 这份方案不再讨论“配置热生效”或“用户确认重启”的交互细节，而是单独聚焦“为什么会不可用，以及怎么把它消灭掉”。核心思路是把不可用拆成四层治理对象：`运行时死亡`、`聊天平面失效`、`事件循环卡死/超时`、`系统主动中断但没有显式建模`。同时把现有日志体系升级成“故障归因系统”，让每一次不可用都能落到明确类别，而不是继续停留在用户侧一个模糊的 `network error`。

**Tech Stack:** Electron、TypeScript、Node.js、Hono、React、Zustand、NextClaw CLI runtime、`@nextclaw/core` logging runtime、桌面 launcher logging、Vitest。

---

## 长期目标对齐 / 可维护性推进

- NextClaw 想成为 AI 时代的个人操作层，前提不是“功能很多”，而是“主入口足够可靠”。用户只要形成“这个东西会突然不可用”的心理预期，统一入口地位就立不住。
- 这次工作的核心目标不是“让崩溃之后更会安慰用户”，而是把不可用的真实来源一类一类消灭掉。
- 这也是一条强可维护性路线，因为它要求把现在分散在桌面、服务、聊天子系统、重启逻辑、日志链路里的隐式行为收敛成清晰边界。

## 这份文档解决什么，不解决什么

### 解决什么

- 识别“正常用着用着就不可用”的真实根因类别
- 定义如何让每一种不可用都可观测、可归因
- 制定逐阶段消灭不可用的改造顺序
- 明确如何复用并补强现有日志系统

### 不解决什么

- 不展开讨论所有配置项如何热生效
- 不单独讨论更新产品化交互
- 不把问题误缩成 `skills`、`plugins` 或某一个单点功能

## 现状结论

### 结论 1：我们现在还不能精确回答“某一次具体事故为什么不可用”

原因不是无从下手，而是系统当前没有足够的故障归因结构。

- 桌面端 runtime 子进程退出后，目前只记录日志并把句柄清空，没有统一的退出分类和恢复状态。
- 前端 transport 层把服务不可达、超时、连接断开、聊天子系统未就绪等多种故障压扁成普通请求错误。
- 服务端和桌面端的日志都存在，但还没有形成一套“围绕一次不可用事件把证据串起来”的关联机制。

### 结论 2：尽管还不能锁定每一单事故，但根因范围已经可以收敛

从代码看，不可用的主要来源不是无限多，而是集中在下面几类：

1. 运行时进程真的退出了
2. 运行时没退出，但聊天/NCP 平面不可用
3. 运行时没退出，但事件循环被阻塞或严重超时
4. 系统自己触发了中断性 restart/exit
5. 前端把不同故障压成一个 generic `network error`

## 不可用根因分类

### Type A：Runtime Process Death

**定义**

- 本地服务进程退出、被杀、崩溃，或以某种方式不再提供 UI/API。

**当前代码证据**

- `apps/desktop/src/runtime-service.ts`
  - 通过 `fork()` 启动本地服务
  - 子进程 `exit` 后只记录日志、清空引用，没有 supervisor 恢复闭环
- `apps/desktop/src/main.ts`
  - Electron 窗口直接依赖本地服务 URL

**用户体感**

- 桌面壳可能还在，但聊天突然断了
- 页面刷新后也不一定好
- 看起来像“应用崩了”

**为什么危险**

- 这是对统一入口最直接的破坏

### Type B：Chat Plane Failure

**定义**

- UI/API 还在，但聊天核心能力不可用，例如 NCP agent 没准备好、内部 session plane 失败等。

**当前代码证据**

- `packages/nextclaw/src/cli/commands/service-support/session/service-deferred-ncp-agent.ts`
  - 未 ready 时会抛 `ncp agent unavailable during startup`
- `packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-startup.ts`
  - `createUiNcpAgent()` 失败时只打印错误，不把系统切成明确故障态

**用户体感**

- 页面能打开，但发不出去消息
- 用户会认为“产品核心功能坏了”

### Type C：Soft Hang / Event Loop Stall

**定义**

- 进程还活着，但被同步路径、重 IO、外部命令、长任务等卡住，导致请求超时或流中断。

**当前代码风险证据**

- `packages/nextclaw-core/src/config/secrets.ts`
  - `exec` provider 使用 `spawnSync`
- 仓库中仍存在部分同步命令与同步文件路径

**用户体感**

- 像挂了，但可能过一会儿恢复
- 比真正 crash 更难排查

### Type D：Self-Inflicted Interruptions

**定义**

- 系统自己出于配置变更、更新、restart path 等原因，把当前服务中断掉。

**当前代码证据**

- `packages/nextclaw/src/cli/gateway/controller.ts`
  - `config.apply` / `config.patch` / `update.run` 仍会请求 restart
- `packages/nextclaw/src/cli/gateway/controller.ts`
  - 在缺少上层接管时，restart path 甚至可能直接 `process.exit(0)`
- `packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-context.ts`
  - reload 命中 `restartRequired` 也会 request restart

**用户体感**

- 表面像崩溃，实质是系统主动中断

### Type E：Error Flattening

**定义**

- 多种本质不同的故障，在前端都被压成一个普通 `network error`。

**当前代码证据**

- `packages/nextclaw-ui/src/transport/local.transport.ts`
  - request / stream 失败直接抛异常
- `packages/nextclaw-ui/src/components/chat/ncp/NcpChatPage.tsx`
  - sendError 直接取 transport / hydrate 错误

**为什么这本身也是根因**

- 因为不能正确分类故障，就无法正确治理故障

## 现有日志基础设施

这一部分是这次方案的关键前提。不是从零开始，我们已经有不错的基础，但还没有把它们变成“不可用归因系统”。

### 已有能力 1：服务日志和 crash 日志

- `packages/nextclaw-core/src/logging/logging-runtime.ts`
  - 已支持 `service log` 和 `crash log`
  - 已支持安装 console mirror
  - 已支持 `uncaughtExceptionMonitor`
- `packages/nextclaw/src/cli/commands/logs.ts`
  - 已支持 `nextclaw logs path`
  - 已支持 `nextclaw logs tail`
  - 已支持 `nextclaw logs tail --crash`

### 已有能力 2：桌面 launcher 日志

- `apps/desktop/src/utils/desktop-logging.utils.ts`
  - 已写桌面 `main.log`
  - 已捕获桌面主进程 `uncaughtException` / `unhandledRejection`

### 已有能力 3：managed service 启动日志

- `packages/nextclaw/src/cli/commands/service.ts`
  - 已记录 startup failure diagnostics
  - 已记录 readiness probe failure

### 当前缺口

现有日志“有了”，但还不够“可归因”：

1. 缺少一次不可用事件的统一 incident id
2. 缺少桌面 child exit code / signal / last stderr 摘要
3. 缺少 frontend 感知故障类型的埋点
4. 缺少 runtime status 变化日志
5. 缺少“这是 self-restart 还是真实 crash”的明确标记

## 根本性目标

我们不是要“把错误提示做漂亮”，而是要做到下面五条：

1. 每一次不可用都能被准确归类
2. 系统自己制造的不可用必须先被消灭
3. 运行时死亡不能直接等价于产品死亡
4. 聊天平面失效和服务死亡必须分开治理
5. 高风险路径必须被隔离，不允许随便拖垮主入口

## 治理顺序

这是最重要的部分。顺序错了，工程会陷入打补丁。

### Phase 1：先消灭“未知”

**目标**

- 把不可用事件从“用户一句话描述”变成“机器可归因事件”。

**要做什么**

- 定义 `runtime incident` 模型
- 给桌面 runtime child exit 建立结构化日志
- 给前端 transport 失败建立故障分类
- 给服务端 runtime status 建立统一状态与事件

**产出**

- 每次不可用都能落到：
  - `runtime-exit`
  - `chat-plane-unavailable`
  - `request-timeout`
  - `stream-broken`
  - `restart-required`
  - `self-restart`

### Phase 2：先消灭系统自己制造的不可用

**目标**

- 把当前残留的自动 restart / exit 路径逐步收掉。

**要做什么**

- 禁止普通配置/能力变更默认破坏当前主入口
- 把 restart 改成 `pending-restart`
- 只有真正宿主级变化才允许进入用户确认重启

**理由**

- 自己制造的不可用是最不该接受的

### Phase 3：把 runtime death 变成 recoverable event

**目标**

- 即使 runtime 子进程死了，桌面端也能恢复，而不是放任产品失联。

**要做什么**

- 引入 desktop supervisor
- exit 后自动退避重启
- 恢复失败时进入明确 degraded / unavailable 态

### Phase 4：把聊天平面从“隐式依赖”升级成明确子系统

**目标**

- 不让“聊天坏了”继续伪装成“网络坏了”。

**要做什么**

- 明确 chat plane readiness / failure state
- 在前端展示 `chat unavailable`，而不是 generic sendError
- 给服务侧增加 chat plane 健康与启动失败事件

### Phase 5：消灭卡死型不可用

**目标**

- 把“进程活着但服务像死了一样”的问题压下去。

**要做什么**

- 找出同步阻塞路径
- 对高风险命令执行和大任务做隔离
- 增加 event loop lag 监控
- 对长 SSE / fetch / worker 路径加 timeout 和 abort 合同

## 详细实施方案

### Workstream 1：Runtime Incident Model

**目标**

- 为所有不可用事件定义统一模型。

**建议字段**

- `incidentId`
- `category`
- `startedAt`
- `detectedBy`
- `runtimePid`
- `childExitCode`
- `childExitSignal`
- `lastHealthError`
- `lastTransportError`
- `chatPlaneReady`
- `wasSelfRestart`
- `recoveryAttempt`

**Files**

- Create: `apps/desktop/src/runtime/runtime-incident.ts`
- Create: `packages/nextclaw/src/cli/runtime-state/runtime-incident-store.ts`
- Modify: `packages/nextclaw-server/src/ui/types.ts`

### Workstream 2：补齐日志与证据链

**目标**

- 复用现有日志系统，但让日志能直接服务“不可用归因”。

**实施方向**

- 服务日志继续使用 `@nextclaw/core` logging runtime
- 桌面日志继续使用 `main.log`
- 新增 incident 级关联字段
- 把 frontend transport 错误也结构化写到服务/桌面事件流

**建议新增日志事件**

- `runtime.child.exited`
- `runtime.recovery.started`
- `runtime.recovery.failed`
- `runtime.recovery.succeeded`
- `runtime.status.changed`
- `chat.plane.unavailable`
- `frontend.transport.failed`
- `restart.path.requested`
- `restart.path.executed`

### Workstream 3：Desktop Supervisor

**目标**

- 把桌面从 launcher 提升成 supervisor。

**Files**

- Modify: `apps/desktop/src/runtime-service.ts`
- Modify: `apps/desktop/src/main.ts`
- Create: `apps/desktop/src/runtime/runtime-supervisor.ts`

**关键行为**

- 记录 child exit 结构化事件
- 自动恢复
- 指数退避
- 恢复上限
- 明确上报当前 runtime state

### Workstream 4：Transport Error Taxonomy

**目标**

- 让前端知道“这是哪一类不可用”。

**Files**

- Modify: `packages/nextclaw-ui/src/transport/local.transport.ts`
- Modify: `packages/nextclaw-ui/src/api/raw-client.ts`
- Modify: `packages/nextclaw-ui/src/stores/ui.store.ts`
- Modify: `packages/nextclaw-ui/src/components/chat/ncp/NcpChatPage.tsx`

**分类建议**

- `runtime_unreachable`
- `runtime_recovering`
- `chat_plane_unavailable`
- `request_timeout`
- `stream_interrupted`
- `restart_required`

### Workstream 5：Chat Plane Health

**目标**

- 明确聊天系统有没有 ready，而不是把它藏在 deferred agent 内部。

**Files**

- Modify: `packages/nextclaw/src/cli/commands/service-support/session/service-deferred-ncp-agent.ts`
- Modify: `packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-startup.ts`
- Modify: `packages/nextclaw-server/src/ui/types.ts`

**关键行为**

- createUiNcpAgent 失败不只是 `console.error`
- 要显式上报 chat plane unavailable
- 前端看到后切成明确故障态

### Workstream 6：Self-Inflicted Restart Elimination

**目标**

- 把系统自己制造的中断收缩到最小。

**Files**

- Modify: `packages/nextclaw/src/cli/gateway/controller.ts`
- Modify: `packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-context.ts`
- Modify: `packages/nextclaw-core/src/config/reload.ts`
- Modify: `packages/nextclaw/src/cli/config-reloader.ts`

**关键行为**

- 普通变更默认不直接 interrupt
- restart 改成登记型状态
- 只有必要时才请求用户确认

### Workstream 7：Soft Hang Elimination

**目标**

- 找出和压低“进程还在但用户已经无法用”的情况。

**Files**

- Modify: `packages/nextclaw-core/src/config/secrets.ts`
- Modify: 其它同步阻塞路径
- Create: `packages/nextclaw/src/cli/runtime-state/event-loop-lag-monitor.ts`

**关键行为**

- 监控 event loop lag
- 标记长时间阻塞
- 尽量把高风险同步路径迁出主 control plane

## 验收标准

### 工程验收

- 每一次不可用都至少能被归类到一个明确 category
- 现有日志体系可以串出一次 incident 的完整链路
- 至少能区分：
  - 真实 crash
  - 自己触发的 restart
  - chat plane unavailable
  - request timeout / stream interruption

### 产品验收

- 用户不再只看到模糊 `network error`
- runtime 死亡后，默认进入恢复态而不是长期失联
- 聊天子系统坏了时，用户能看到明确状态
- 普通使用路径的“突然不可用”发生率显著下降

## 推荐先做的第一批

如果现在要立刻开始，我建议第一批只做最值的三件事：

1. 建 runtime incident model 和结构化日志
2. 建 desktop supervisor
3. 建 transport error taxonomy

原因很简单：

- 这三件事一起做，能先把“不可用原因不知道”这个最大障碍打掉
- 同时还能立刻降低最痛的“runtime 死了就完全失联”
- 做完这一步，再去继续收自动 restart 和 soft hang，节奏才对

## 和其它方案文档的关系

- 这份文档是独立文档，专门回答“怎么避免崩掉、怎么消灭不可用”。
- 它与运行时热生效/待重启方案互补，但不是同一件事。
- 如果后续继续实施，应该先按这份文档解决“不可用与归因”，再按热生效方案继续收缩中断面。
