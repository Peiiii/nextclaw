# Desktop Runtime Resilience and Graceful Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 NextClaw 桌面端从“本地运行时一掉线，用户只看到一个普通 network error”的脆弱模型，升级为“运行时尽量不中断、异常可自愈、必要重启需用户确认、对话连续性优先”的产品级可靠性模型。

**Architecture:** 这次不把问题定义成 `skills`、`config`、`remote` 或某个单独功能的补丁，而是把桌面壳、嵌入式本地服务、前端传输层、配置热生效、危险任务执行隔离、用户提示与恢复入口，统一视为一个运行时可靠性系统。整体方向分成两条主线：一条是“减少必须重启的场景”，另一条是“即使运行时异常退出，桌面也能识别、恢复、诚实提示，而不是把进程死亡伪装成普通请求失败”。

**Tech Stack:** Electron、TypeScript、Node.js、Hono、React、Zustand、NextClaw CLI runtime、`@nextclaw/core` 配置热重载、`@nextclaw/remote` 远程模块、Vitest。

---

## 长期目标对齐 / 可维护性推进

- 这项工作直接服务 `docs/VISION.md` 里的“统一入口、统一体验、足够可靠”目标。一个想成为 AI 时代个人操作层的产品，不能让用户在一次普通配置变更或一次本地任务执行后，直接失去主入口。
- 这次要解决的不是“把重启提示做漂亮一点”，而是把“运行时可用性”升级成明确的产品对象与架构对象。
- 长期方向必须同时推进三件事：
  - 默认热生效，而不是默认重启。
  - 异常退出时自动恢复或明确进入恢复态，而不是静默断联。
  - 必须中断时先征得用户同意，而不是让实现细节直接破坏对话。
- 这条路线也符合“删减优先、简化优先”的治理原则。最终目标不是再叠更多兜底代码，而是把现在分散在桌面、CLI、配置重载、更新、前端错误处理里的多套中断语义，收敛成一套可预测合同。

## 结论先行

### 我的判断

- 这不是一个 `skills` 专属问题。
- 这也不只是“偶尔网络波动”。
- 这暴露的是更深层的可靠性架构问题：当前系统没有把“本地运行时是否还活着、是否正在恢复、是否必须重启、用户当前会不会失去对话连续性”当成一等状态来治理。

### 对截图现象的直接判断

- 从代码看，`skills` 文件变化本身不会触发自动重启。
- 更可能的链路是：某次任务执行或某条本地运行时路径让后端服务不可达了，而前端把它呈现成了一个普通 `network error`。
- 也就是说，用户感受到的是“应用像崩了”，哪怕 Electron 壳本身还活着。

## 当前代码证据

### 1. 桌面端把本地运行时作为子进程拉起，但退出后没有 supervisor 恢复闭环

- `apps/desktop/src/runtime-service.ts`
  - `RuntimeServiceProcess.start()` 通过 `fork(..., ["serve", "--ui-port", ...])` 启动本地服务。
  - `child.once("exit", ...)` 只记录日志，并把 `child` / `port` 置空，没有自动拉起、状态上报、恢复策略、退避重试或 UI 通知。
- `apps/desktop/src/main.ts`
  - Electron 窗口直接 `loadURL(baseUrl)` 指向本地服务。
  - 启动失败时有错误弹窗，但“运行中途子进程退出”没有对应的桌面恢复编排。

### 2. 前端只把 websocket 连接建模成简单 connected/disconnected，没有把运行时可用性建模成产品态

- `packages/nextclaw-ui/src/stores/ui.store.ts`
  - 当前只有 `connected | disconnected | connecting` 三态。
- `packages/nextclaw-ui/src/hooks/use-realtime-query-bridge.ts`
  - websocket 断开时只把状态改成 `disconnected`。
  - 没有区分“瞬时断网”“本地服务已死”“正在恢复”“需要用户确认重启”。
- `packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx`
  - 目前只是状态徽标，没有恢复引导、不可用说明、重试策略、恢复进度。

### 3. 普通 HTTP / SSE 请求失败会直接冒成请求错误，没有和运行时生命周期打通

- `packages/nextclaw-ui/src/transport/local.transport.ts`
  - `request()` 失败时直接抛异常。
  - `openStream()` 的 `fetch()` 失败也直接抛异常。
  - 没有把“服务不可达”翻译成统一的 `runtime unavailable` / `recovering` / `restart required` 领域错误。
- `packages/nextclaw-ui/src/components/chat/ncp/NcpChatPage.tsx`
  - `lastSendError` 直接来自 `agent.hydrateError` 或 `agent.snapshot.error`。
  - 于是用户输入框附近只会看到一个普通错误，而不是“本地运行时已断开，正在恢复”。

### 4. `skills` 变更不会自动触发重启

- `packages/nextclaw-server/src/ui/ui-routes/marketplace/skill.controller.ts`
  - 安装/卸载 skill 后只发布 `config.updated`，路径是 `"skills"`。
- `packages/nextclaw-ui/src/hooks/use-realtime-query-bridge.ts`
  - `skills` 和 `plugins` 变更甚至不会触发主配置查询失效。
- `packages/nextclaw-core/src/agent/skills-loader.ts`
  - `SkillsLoader` 是按需扫盘和读文件，不存在“skill 改了就自动重启服务”的 watcher 逻辑。

### 5. 系统里确实还存在多条“重启/重拉起”语义，但它们彼此分散

- `packages/nextclaw-core/src/config/reload.ts`
  - 运行时热生效判定存在，但规则并不完整，且 `ui` 仍被记为 `none`。
- `packages/nextclaw/src/cli/config-reloader.ts`
  - 已有很多热重载能力，但命中 `restartRequired` 时只会回调上层处理。
- `packages/nextclaw/src/cli/runtime.ts`
  - 仍集中挂着 `requestRestart()`、background service restart、self relaunch 等语义。
- `packages/nextclaw/src/cli/restart-coordinator.ts`
  - 协调的是“要不要重启、怎么重启”，不是“如何避免主入口被中断”。
- `packages/nextclaw/src/cli/update/runner.ts`
  - `update.run` 明确属于中断性路径。

## 深层问题是什么

### 1. 运行时可用性没有被当成一等产品状态

- 现在的系统把“服务是否还活着”更多当作实现细节，而不是产品态。
- 结果是：
  - 桌面端不知道该不该恢复。
  - 前端不知道该告诉用户什么。
  - 请求层不知道该抛什么语义错误。
  - 配置/更新/远程模块也不知道哪些动作可以破坏主入口，哪些不可以。

### 2. Electron 壳和本地服务之间缺少真正的监督者角色

- 现在 Electron 更像“启动器”，不是“supervisor”。
- 一旦本地服务在运行中退出，桌面壳没有负责：
  - 识别退出原因。
  - 进入 recovering 状态。
  - 拉起替代服务。
  - 把新 base URL 或恢复结果同步给前端。

### 3. 请求失败和运行时死亡被混在一起了

- 对用户而言，“服务挂了”和“一次普通请求失败”完全不是一回事。
- 但当前 UI 层几乎把两者都压扁成 `network error` 或发送失败。
- 这会造成非常糟糕的产品感知：
  - 用户不知道是自己的 prompt 有问题，还是整个系统已经不在工作。
  - 用户不知道该等待、重试、恢复、还是必须重启。

### 4. 风险任务和 UI 控制平面共享命运过深

- 只要本地服务既负责 UI API、又负责 agent/tool 执行、又负责部分配置/更新切换，那么任何危险路径都有机会影响主入口。
- 这不是说一定已经有某个 skill 安装逻辑会杀进程，而是说当前架构允许“长任务/危险任务/异常任务”与 UI serving control plane 命运绑定过深。

### 5. 重启语义分散，导致系统行为不可预测

- 现在“热生效”“局部模块重建”“后台服务重启”“当前进程退出”“手动重启提示”分散在多个层里。
- 结果是用户无法预期：
  - 哪类变更会不中断生效。
  - 哪类变更会短暂断开。
  - 哪类变更必须明确确认。

## 不可用根因矩阵

这一节专门回答“为什么会正常用着用着就不可用”。当前代码下，真正会把用户感知打成“不可用”的原因，大致可以归成下面六类。

### Root Cause A：系统自己触发了中断性 restart / exit，但没有把它产品化

**表现**

- 用户看起来像“突然断了”。
- 其实是系统自己请求了 restart，或者直接安排了当前进程退出。

**代码证据**

- `packages/nextclaw/src/cli/gateway/controller.ts`
  - `requestRestart()` 在没有上层接管时会直接 `process.exit(0)`。
  - `config.apply` / `config.patch` / `update.run` 当前仍会在写完后调用 `requestRestart()`。
- `packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-context.ts`
  - config reload 命中 `restartRequired` 时，仍会请求 restart。

**为什么会让用户误以为是崩溃**

- 因为桌面端没有把“这是一次受控重启”做成明确产品态。
- 对用户来说，结果就是对话突然断掉。

**优先级判断**

- 高优先级。
- 这是最确定、最容易验证、也最该先收掉的一类。

### Root Cause B：本地 runtime 子进程异常退出，桌面没有 supervisor 自愈

**表现**

- Electron 壳还在，但本地服务没了。
- 前端请求开始报错，聊天直接不可用。

**代码证据**

- `apps/desktop/src/runtime-service.ts`
  - 子进程 `exit` 后只记录日志，不恢复。
- `apps/desktop/src/main.ts`
  - 没有运行中退出后的恢复编排。

**可能触发源**

- 未捕获异常
- 原生依赖或 Node 进程崩溃
- 外部 SIGTERM / SIGKILL
- 资源耗尽导致进程退出

**为什么现在无法知道是哪一种**

- 因为当前没有把 exit code、signal、最后 stderr、恢复次数做成统一可查询状态。

**优先级判断**

- 最高优先级之一。
- 这是“主入口直接死掉”的核心类目。

### Root Cause C：服务进程没死，但 chat/NCP 子系统不可用

**表现**

- `/api/health` 可能还活着。
- 页面能打开，但聊天发送失败，或表现异常。

**代码证据**

- `packages/nextclaw/src/cli/commands/service-support/session/service-deferred-ncp-agent.ts`
  - 当 active agent 不存在时，直接抛 `ncp agent unavailable during startup`。
- `packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-startup.ts`
  - `createUiNcpAgent()` 失败时只打印错误，不会让整个壳进入明确故障态。

**为什么这也会被用户感知成“不可用”**

- 因为对用户来说，核心功能就是对话。
- 即使 UI 服务器活着，只要 chat plane 死了，产品也等于不可用。

**优先级判断**

- 高优先级。
- 这类问题不一定是“进程死了”，但一样破坏主价值。

### Root Cause D：服务还活着，但事件循环被阻塞或严重卡顿

**表现**

- 请求超时、SSE 卡住、前端以为后端挂了。
- 过一会儿可能又恢复。

**代码证据与风险点**

- 仓库里仍存在一些同步阻塞路径，比如 `spawnSync`、同步文件操作等。
- 例如 `packages/nextclaw-core/src/config/secrets.ts` 的 exec provider 使用 `spawnSync`。
- 这不一定就是当前主因，但它代表服务线程仍可能被重活或外部命令卡住。

**为什么这类问题难查**

- 进程可能没退出。
- 但用户体感和“挂了”很像。

**优先级判断**

- 中高优先级。
- 要靠超时、事件循环延迟监控和危险路径隔离来消灭。

### Root Cause E：外部环境把进程打掉或替换掉

**表现**

- 用户只看到应用断开。
- 实际可能是系统层、更新层、端口占用、外部 stop/kill、另一个实例替换等。

**代码证据**

- 项目里存在 managed service stop/start、self relaunch、桌面 relaunch、update.run 等路径。
- 端口占用和现有健康服务复用也会影响实际绑定目标。

**优先级判断**

- 中优先级。
- 这类问题不能完全靠业务代码避免，但必须被监控并解释清楚。

### Root Cause F：前端把不同故障压扁成一个 generic network error

**表现**

- 用户只能看到 `network error`。
- 团队也拿不到故障分类。

**代码证据**

- `packages/nextclaw-ui/src/transport/local.transport.ts`
  - fetch 失败直接抛异常。
- `packages/nextclaw-ui/src/components/chat/ncp/NcpChatPage.tsx`
  - 直接把 transport error 映射成 sendError。

**为什么这本身也是根因的一部分**

- 因为当系统无法正确分类故障时，就没法精确治理。
- “不知道到底是哪一类不可用”本身就是架构缺陷。

**优先级判断**

- 最高优先级之一。
- 不先把故障分类建起来，后面只能继续猜。

## 我对概率和优先级的判断

如果把“很多用户正常用着用着就不可用”这件事按现实概率排序，我的判断是：

1. 第一梯队
- Root Cause B：本地 runtime 子进程异常退出，但桌面没有 supervisor
- Root Cause F：前端把运行时死亡/失联压成 generic network error
- Root Cause A：系统内部仍存在多条会中断主入口的 restart/exit 路径

2. 第二梯队
- Root Cause C：chat/NCP 平面失效，但外层 UI 还活着
- Root Cause D：事件循环阻塞、重任务或同步路径导致服务假死

3. 第三梯队
- Root Cause E：外部环境 kill、端口/实例切换、更新替换等外部因素

这里最关键的判断是：

- 我们现在还不能精确说“某一位用户那次一定是哪一个原因”，不是因为问题玄学，而是因为系统没有留下足够的故障归因数据。
- 但从代码看，可疑面其实已经不算无限大，主要就集中在上面几类。

## 逐项消灭不可用的正确顺序

如果目标是“把不可用尽量消灭掉”，正确顺序不是东补一块西补一块，而是下面这个顺序：

### Step 1：先消灭“未知”

- 记录每次不可用前后的：
  - runtime child exit code/signal
  - 最后 stderr/stdout
  - 当前是否触发了 restart path
  - 当前 runtime status
  - 前端感知到的是 fetch fail / websocket close / SSE break / agent unavailable

**原因**

- 不先做到这一步，团队永远只能猜。

### Step 2：先封住所有系统自己制造的中断

- 关闭默认自动 restart/exit。
- 普通变更改成热生效或 `pending restart`。

**原因**

- 自己制造的不可用是最不应该接受的。

### Step 3：给桌面补 supervisor，把 runtime 死亡变成可恢复事件

- 这是把“主入口死掉”降级成“短暂恢复中”的关键。

### Step 4：把 chat plane 和 control plane 的失效区分开

- 不能再让“对话不可用”和“整个服务不可达”混成一件事。

### Step 5：对高风险执行路径做隔离和限流

- 这是消灭“正常用着用着突然假死/崩掉”的长期核心。

## 为什么别的成熟产品通常不会这样

它们通常不是“从来不失败”，而是把失败吸收在产品边界内，而不是直接暴露成一次莫名其妙的断联。

### 常见做法 1：把 shell、control plane、worker plane 分开

- 桌面壳不把子进程当“一次性启动完就算了”的实现细节，而是长期监督它。
- 危险任务、插件执行、工具执行、长连接处理，尽量与 UI serving 主通路隔离。

### 常见做法 2：先做 in-process / module-level live apply

- 普通配置优先热生效。
- 次一级改动优先做模块级 restart。
- 只有宿主级或二进制级变更才进入 restart 流程。

### 常见做法 3：运行时断开会进入明确的 recovering / degraded 状态

- 用户会看到“正在恢复连接”“本地服务正在重启”“某项能力暂不可用”，而不是一个泛化的 network error。
- 页面通常还能保留草稿、保留会话上下文、保留恢复入口。

### 常见做法 4：重启是显式产品动作，不是实现副作用

- 真要重启，会先告诉用户：
  - 为什么要重启。
  - 会影响什么。
  - 是否会中断当前对话。
  - 用户要不要现在执行。

### 常见做法 5：崩溃会被归因、记录、可追踪

- 会保留 crash reason、最近日志、恢复次数、退避状态。
- 不会只剩一个“请求失败”，让团队和用户都猜。

## 目标产品合同

这次治理完成后，桌面端与本地运行时必须遵守下面的统一合同。

### 合同 1：普通变更默认不中断主入口

- `skills`、大部分 `config`、`plugins`、`mcp`、agent 默认项、channels/provider 这类普通变更，默认优先热生效或模块级切换。
- 禁止因为这类变更直接破坏用户当前对话入口。

### 合同 2：运行时异常退出不是普通网络错误

- 只要桌面检测到本地运行时不可达，就必须进入明确的 `runtime-unavailable` 或 `recovering` 状态。
- 前端要停止把这类情况伪装成普通发送失败。

### 合同 3：桌面必须负责监督和恢复本地运行时

- 运行中途子进程退出后，桌面默认尝试受控恢复。
- 恢复失败才升级为“需要用户操作”。

### 合同 4：必须重启时先征得用户同意

- 只有宿主级变更、二进制更新、端口切换等真正无法热切换的项，才进入 `pending restart`。
- `pending restart` 是产品状态，不是错误，也不是立刻执行。

### 合同 5：用户的对话连续性优先于实现便利

- 草稿要保留。
- 当前会话列表要尽量保留。
- 如果运行时短暂恢复，前端应该引导“重试发送/继续当前对话”，而不是让用户怀疑整个应用已经崩掉。

## 系统性方案

### Workstream A：先把“运行时状态”从隐式实现细节升级成统一合同

**目标**

- 给桌面、服务、前端共享一套运行时状态机。

**建议状态**

- `healthy`
- `degraded`
- `unavailable`
- `recovering`
- `pending-restart`
- `restarting-by-user`

**建议新增输出面**

- 桌面进程内 supervisor state
- 服务 API：`GET /api/runtime/status`
- realtime 事件：
  - `runtime.status.changed`
  - `runtime.recovering`
  - `runtime.recovered`
  - `runtime.restart-required`
  - `runtime.restart-cleared`

**原因**

- 只有先把状态做成公共合同，后面的自动恢复、前端提示、用户确认重启才会一致。

### Workstream B：把 Electron 从启动器升级成 supervisor

**目标**

- 本地服务中途退出时，桌面壳自动感知并进入恢复闭环。

**关键改造**

- 扩展 `apps/desktop/src/runtime-service.ts`
  - 不再只监听 `exit` 记录日志。
  - 增加退出原因分类、最近 stderr 缓冲、恢复次数、指数退避、健康探测。
- 扩展 `apps/desktop/src/main.ts`
  - 订阅 supervisor 状态。
  - 当服务不可达时，不直接让用户卡死在旧页面。
  - 支持恢复成功后的页面重连。

**产品行为**

- 第 1 次异常退出：自动恢复，不惊扰用户，只给轻提示。
- 连续恢复失败：明确显示“本地运行时恢复失败”，给出“查看日志 / 重新启动服务 / 联系支持”。
- 只有确实需要全应用 relaunch 时，才弹确认。

### Workstream C：前端把“服务不可达”建模成运行时问题，而不是普通请求失败

**目标**

- `fetch` / `SSE` / `WebSocket` 的失败能统一翻译成领域态。

**关键改造**

- `packages/nextclaw-ui/src/transport/local.transport.ts`
  - 为本地服务不可达、超时、连接拒绝、被 supervisor 标记为恢复中，定义统一错误类型。
- `packages/nextclaw-ui/src/stores/ui.store.ts`
  - 从单一 `connectionStatus` 升级为 `runtimeStatus + connectionStatus` 双层状态。
- `packages/nextclaw-ui/src/hooks/use-realtime-query-bridge.ts`
  - 连接断开后不只改徽标，还要驱动全局运行时状态与数据恢复策略。
- `packages/nextclaw-ui/src/components/chat/ncp/NcpChatPage.tsx`
  - 发送失败时，优先展示“本地运行时不可用/正在恢复/需要重启确认”。
- `packages/nextclaw-ui/src/components/chat/containers/chat-input-bar.container.tsx`
  - 输入区需要承载运行时级错误与恢复 CTA，而不只是普通 sendError。

**产品行为**

- `recovering`：禁用发送，保留草稿，显示恢复中。
- `unavailable`：显示明确错误与恢复按钮。
- `pending-restart`：显示原因、影响范围、稍后重启与立即重启按钮。

### Workstream D：把危险执行路径和主 UI 服务解耦

**目标**

- 即使某次 agent/tool/exec 路径出问题，也尽量不把整个本地 UI 服务拖死。

**推荐方向**

- UI-serving control plane 继续保持轻量。
- 高风险执行路径逐步收敛到更独立的 worker / child boundary。
- 至少第一期先做到：
  - 对长任务设置更清晰的超时与错误边界。
  - 对本地命令执行、插件运行、潜在大内存任务做隔离包装。
  - 未捕获异常不要直接让整个服务进程失效。

**说明**

- 这是系统性稳定性的关键，不做这一步，前面做再多提示也只是“优雅地展示崩溃”。

### Workstream E：把“热生效优先、必要时待重启、用户确认后重启”落成统一变更协调器

这一部分与已有文档 [`2026-04-12-runtime-live-apply-and-consented-restart-plan.md`](./2026-04-12-runtime-live-apply-and-consented-restart-plan.md) 直接衔接。

**目标**

- 收敛所有配置/运行时变更入口。

**关键方向**

- 扩展 `packages/nextclaw-core/src/config/reload.ts`
  - 修正 reload plan 分类。
- 扩展 `packages/nextclaw/src/cli/config-reloader.ts`
  - 把 `restartRequired` 改成上报 `pending restart`，而不是直接打断。
- 引入统一 `RuntimeChangeCoordinator`
  - 让 `config`、`remote`、`gateway tool`、UI 配置页、CLI 配置命令共享语义。

### Workstream F：把崩溃诊断和恢复链路产品化

**目标**

- 再出现问题时，团队和用户都不用靠猜。

**关键能力**

- 记录最近一次：
  - 子进程退出 code/signal
  - 健康检查失败原因
  - 恢复次数
  - 最后 50 行 runtime stderr/stdout
- 在桌面端提供：
  - 打开日志
  - 复制诊断摘要
  - 重新启动本地服务

## 实施顺序

### Phase 0：先把状态合同和诊断面打底

**为什么先做这个**

- 没有统一状态，后面所有恢复和 UI 提示都只能继续打补丁。

**Files**

- Modify: `packages/nextclaw-server/src/ui/types.ts`
- Modify: `packages/nextclaw-ui/src/stores/ui.store.ts`
- Modify: `packages/nextclaw-ui/src/hooks/use-realtime-query-bridge.ts`
- Create: `packages/nextclaw-server/src/ui/ui-routes/runtime.controller.ts`
- Modify: `packages/nextclaw-server/src/ui/router.ts`
- Test: `packages/nextclaw-server/src/ui/router.*.test.ts`

**交付标准**

- 系统有统一 runtime status。
- 前端能拿到 runtime status，不再只看 websocket 是否连上。

### Phase 1：桌面 supervisor 化

**Files**

- Modify: `apps/desktop/src/runtime-service.ts`
- Modify: `apps/desktop/src/main.ts`
- Create: `apps/desktop/src/runtime-supervisor-state.ts`
- Test: `apps/desktop/src/runtime-service.test.ts`

**交付标准**

- 子进程退出后能自动尝试恢复。
- 连续失败会进入明确恢复失败态。

### Phase 2：前端恢复态与用户提示

**Files**

- Modify: `packages/nextclaw-ui/src/transport/local.transport.ts`
- Modify: `packages/nextclaw-ui/src/components/chat/ncp/NcpChatPage.tsx`
- Modify: `packages/nextclaw-ui/src/components/chat/containers/chat-input-bar.container.tsx`
- Modify: `packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx`
- Create: `packages/nextclaw-ui/src/components/runtime/runtime-status-banner.tsx`
- Test: `packages/nextclaw-ui/src/components/chat/**/*.test.tsx`

**交付标准**

- 用户能看到 `recovering` / `unavailable` / `pending-restart` 的明确文案与动作。
- 草稿保留。

### Phase 3：热生效与待重启协调器

**Files**

- Modify: `packages/nextclaw-core/src/config/reload.ts`
- Modify: `packages/nextclaw/src/cli/config-reloader.ts`
- Modify: `packages/nextclaw/src/cli/runtime.ts`
- Create: `packages/nextclaw/src/cli/runtime-change/runtime-change-coordinator.ts`
- Create: `packages/nextclaw/src/cli/runtime-change/pending-restart-state.store.ts`
- Test: `packages/nextclaw-core/src/config/reload.test.ts`
- Test: `packages/nextclaw/src/cli/runtime-change/*.test.ts`

**交付标准**

- 普通变更优先热生效。
- 必须重启的变更只登记 `pending restart`。

### Phase 4：危险执行路径隔离

**Files**

- Modify: `packages/nextclaw/src/cli/runtime.ts`
- Modify: `packages/nextclaw-server/src/ui/server.ts`
- Modify: 相关 agent/tool 执行 owner
- Test: 以执行链路为中心的新冒烟与故障注入测试

**交付标准**

- 一条危险执行路径失败，不应轻易杀死主 UI 服务。

### Phase 5：用户确认重启产品化

**Files**

- Modify: `packages/nextclaw-ui/src/components/...`
- Modify: `packages/nextclaw-server/src/ui/types.ts`
- Modify: `packages/nextclaw/src/cli/restart-coordinator.ts`
- Test: UI + CLI restart consent 流程

**交付标准**

- 真正的应用重启只发生在用户确认之后。

## 详细任务拆分

### Task 1: 定义统一 runtime status 合同

**Files:**
- Modify: `packages/nextclaw-server/src/ui/types.ts`
- Modify: `packages/nextclaw-ui/src/api/types.ts`
- Create: `packages/nextclaw-server/src/ui/ui-routes/runtime.controller.ts`
- Modify: `packages/nextclaw-server/src/ui/router.ts`

**Step 1: 增加 runtime status 类型**

- 明确字段：
  - `state`
  - `reason`
  - `lastExitCode`
  - `lastExitSignal`
  - `recoveryAttempt`
  - `restartRequired`

**Step 2: 增加 runtime status API**

- 新增 `GET /api/runtime/status`。

**Step 3: 扩展 realtime 事件**

- 增加 runtime 相关事件，不再只靠 websocket open/close 推断。

**Step 4: 写测试固定合同**

- 覆盖 `healthy`、`recovering`、`unavailable`、`pending-restart`。

### Task 2: 给桌面端补 supervisor 与恢复退避

**Files:**
- Modify: `apps/desktop/src/runtime-service.ts`
- Modify: `apps/desktop/src/main.ts`
- Create: `apps/desktop/src/runtime-supervisor-state.ts`

**Step 1: 为运行时进程增加状态回调**

- 报告启动中、健康、退出、恢复中、恢复失败。

**Step 2: 记录最近退出证据**

- 保留最近 stdout/stderr 摘要与 exit code/signal。

**Step 3: 实现受控自动恢复**

- 指数退避。
- 恢复次数上限。

**Step 4: 恢复成功后重新建立前端连接**

- 尽量不让用户手动重开应用。

### Task 3: 前端把 runtime unavailable 从 sendError 中剥离出来

**Files:**
- Modify: `packages/nextclaw-ui/src/transport/local.transport.ts`
- Modify: `packages/nextclaw-ui/src/stores/ui.store.ts`
- Modify: `packages/nextclaw-ui/src/components/chat/ncp/NcpChatPage.tsx`
- Modify: `packages/nextclaw-ui/src/components/chat/containers/chat-input-bar.container.tsx`

**Step 1: 定义本地运行时领域错误**

- 区分：
  - 请求业务失败
  - 服务超时
  - 服务不可达
  - 正在恢复
  - 待重启

**Step 2: UI store 接 runtime status**

- 不再只依赖 websocket 连接状态。

**Step 3: 聊天输入区接管运行时错误展示**

- 保留草稿。
- 提供重试/等待/重启入口。

**Step 4: 写回归测试**

- 覆盖服务中途断开、恢复后继续发送、待重启提示。

### Task 4: 把热生效与待重启合并成统一 owner

**Files:**
- Modify: `packages/nextclaw-core/src/config/reload.ts`
- Modify: `packages/nextclaw/src/cli/config-reloader.ts`
- Modify: `packages/nextclaw/src/cli/runtime.ts`
- Create: `packages/nextclaw/src/cli/runtime-change/runtime-change-coordinator.ts`

**Step 1: 修正 reload plan 的分类精度**

- 把 `remote`、`ui`、宿主级配置明确区分。

**Step 2: 引入 `RuntimeChangeCoordinator`**

- 统一决定：
  - `live-applied`
  - `module-restarted`
  - `pending-restart`

**Step 3: 清理散落的直接 restart 请求**

- 禁止各入口再自行中断主进程。

**Step 4: 写测试固定行为**

- 保证变更结果可预测。

### Task 5: 危险任务执行隔离与故障注入测试

**Files:**
- Modify: `packages/nextclaw/src/cli/runtime.ts`
- Modify: 相关执行 owner
- Create: `tests` 下的故障注入用例

**Step 1: 识别高风险执行路径**

- 本地命令执行
- 插件执行
- 长任务 / 大输出 / 异常任务

**Step 2: 给执行边界加隔离与超时**

- 尽量让失败只影响 worker boundary。

**Step 3: 做故障注入测试**

- 模拟子进程退出。
- 模拟 fetch/SSE 中途断开。
- 模拟运行时恢复失败。

**Step 4: 把恢复行为做成验收标准**

- 不是只看“不报错”，而是看用户是否还能继续对话。

## 验收标准

### 产品验收

- 修改 skill 文件、安装 skill、普通配置变更后，主入口默认不断。
- 如果本地运行时异常退出，用户看到的是“正在恢复/恢复失败”，不是模糊的 network error。
- 如果恢复成功，用户无需重开应用就能继续对话。
- 如果某项变更必须重启，用户会看到明确原因和确认按钮。

### 工程验收

- 存在统一 runtime status 合同。
- 桌面 supervisor 有测试覆盖。
- 前端对 `runtime unavailable` 有稳定展示与恢复逻辑。
- reload / pending restart / consented restart 语义统一。
- 至少有一组故障注入冒烟验证“运行时退出后 UI 仍可恢复”。

## 风险与取舍

### 风险 1：如果只做前端提示，不做 supervisor 和执行隔离

- 那只是“把崩溃描述得更礼貌”，不是解决问题。

### 风险 2：如果只做 supervisor，不做统一状态合同

- 会出现桌面在恢复、前端却还把错误当普通 sendError 的撕裂体验。

### 风险 3：如果只做热生效，不做运行时可用性治理

- 仍然会有别的路径把主入口打断。

### 推荐取舍

- 第一优先级不是“把所有配置都热生效”，而是“先确保主入口不会因为一次异常而无声崩掉”。
- 所以实施顺序应该是：
  1. runtime status 合同
  2. desktop supervisor
  3. frontend recovering UX
  4. live apply / pending restart 收敛
  5. 高风险执行隔离

## 对这次问题的最终定性

- `skills` 更像触发现场里的一个表面动作，不是最核心根因。
- 真正的问题是：当前产品还没有把“本地运行时死亡或不可达”吸收成一个可恢复、可理解、可诊断的产品态。
- 这件事之所以严重，是因为它直接破坏 NextClaw 作为“统一入口”的可信度。
- 所以这次不应该再做局部补丁，而应该按这份文档推进一轮面向产品可靠性的系统治理。
