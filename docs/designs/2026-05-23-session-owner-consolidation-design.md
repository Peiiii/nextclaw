# Session Owner 收敛设计

## 背景

当前 NCP 会话已经从旧的 `SessionManager` 体系迁到了 session-centric live execution 与 journal persistence，但主链路里仍然保留了多条历史路径：

- 新 agent run 没有 `sessionId` 时，仍由 legacy `SessionManager.createSession()` 创建会话。
- `sessions_spawn` / `sessions_request` 仍通过 core `SessionRequestManager` 读写 legacy session。
- NCP 读写通过 `NcpAgentSessionStoreAdapter` 同时桥接 journal store 与 legacy store。
- `NcpSessionApiService` 作为额外 API service 层，重复承担 query、realtime projection 和 mutation 职责。
- `SessionActivityPreviewContribution` 与 `SessionContextWindowContribution` 会基于 NCP event 再写回 session metadata 或 event。

结果是：同一个“session”在运行时、持久化、legacy 兼容、API facade、projection contribution 里都有一部分 owner 语义。局部 bug 可以修，但结构上仍然容易出现双写、旧 metadata 覆盖新 projection、summary refresh 与 live metadata 不一致等问题。

这个设计的目标不是新增能力，而是把 session 领域收敛成更少、更清楚、更可删除的主链路。

## 愿景对齐

NextClaw 的长期目标是成为 AI 时代的个人操作层。会话系统是“自感知连续性”的核心基础设施：它保存用户意图、执行上下文、运行结果、工具调用和系统对当前状态的认识。

因此 session 架构必须满足：

- 统一入口：UI、工具、runtime、HTTP API 都进入同一条会话 mutation 链路。
- 连续性可靠：运行时状态与持久化状态不能互相覆盖。
- 可解释：开发者能清楚知道某个字段由谁生成、谁更新、何时持久化。
- 可演进：legacy 兼容不能长期混在热路径里。

## 设计原则

本方案遵循这些原则：

- `single-domain-owner`：同一 session 领域不保留多个事实 owner。
- `complete-owner`：NCP session owner 必须覆盖创建、patch、append event、delete、read 与变化通知这些 session 事实闭环。
- `single-event-path`：同一 NCP event 事实只走 `eventBus` 这一条标准事件面；SSE、WebSocket、contribution、内部等待者都是这条总线的过滤/投影，不再保留平行 session event publisher。
- `deletion-first`：优先删除 legacy adapter、fallback、重复写入口，而不是新增包装层。
- `cqs-pure-read`：query facade 不应暗中承担 mutation 职责。
- `no-compatibility-by-default`：兼容路径必须有明确边界和删除点，不能继续作为主链路的一部分。

## 当前 Owner 盘点

### `SessionManager`

位置：`packages/nextclaw-core/src/features/session/managers/session.manager.ts`

当前职责：

- 创建 legacy session id。
- 初始化 legacy session metadata。
- 保存 legacy event/message。

问题：

- 这是旧系统 owner，但新 NCP session 创建仍从这里开始。
- 它让新 session 在“出生时”就进入 legacy 存储，再由 NCP adapter 接管。
- 它迫使主链路保留 legacy bridge。

建议：

- 从 NCP 新会话创建主链路移除。
- 后续只作为旧数据迁移/读取兼容对象存在，最终删除。

### `NcpSessionManager`

位置：待新增，建议放在 `packages/nextclaw-kernel/src/managers/ncp-session.manager.ts`。

目标职责：

- 作为 NCP session 的统一事实门面。
- 创建 NCP session 并初始化 metadata。
- append NCP session event 并持久化。
- patch session metadata。
- delete session。
- read/list session、messages 与 summaries。
- 维护 session metadata 的唯一当前真相；runtime 需要 metadata 时只能从这里读或经由这里改。
- 在持久化事实发生变化后统一发布 `sessionUpdated`。
- 封装 journal store、显式 legacy import、summary index 等内部细节。

不负责：

- 执行 runtime。
- 维护 active run。
- 管理 abort controller。
- 处理 HTTP request body。
- 适配 UI view model。

建议：

- 它替代 legacy `SessionManager` 在 NCP 主链路中的位置。
- 外部业务层不得直接访问 `NcpAgentSessionJournalStore` 或 `NcpAgentSessionStoreAdapter`。
- 第一阶段作为统一门面接管热路径；`NcpAgentSessionStoreAdapter` 不作为默认内部依赖，除非实现时证明某个旧数据读取场景必须短期保留。

### `SessionRunManager`

位置：`packages/nextclaw-kernel/src/managers/session-run.manager.ts`

当前职责：

- 维护 live session。
- 创建 runtime。
- 管理 active run。
- append NCP event。
- patch live/stored metadata。
- publish event stream。

问题：

- 它现在直接依赖 session store，并承担了一部分持久化细节。
- 新 session 创建不在它这里，而在 `AgentRunRequestManager` / `SessionRequestManager` 里。
- 如果继续把创建、patch、delete 都塞给它，它会从 runtime owner 膨胀成新的 session god object。

建议：

- 退回 live/runtime owner。
- 负责 live session、runtime 创建、active run、abort、event stream publish。
- 运行过程中需要 append event 时，调用 `NcpSessionManager.appendSessionEvent()`。
- runtime 需要读取或设置 session metadata 时，转交 `NcpSessionManager`，不维护第二份 metadata 真相。
- 不负责创建 NCP session，不直接访问底层 store。

### `NcpAgentSessionJournalStore`

位置：`packages/nextclaw-kernel/src/stores/ncp-agent-session-journal.store.ts`

当前职责：

- 保存 append-only journal。
- 保存 metadata sidecar。
- 更新 summary index。
- replay session messages。

问题：

- 它是事实上的 NCP durable owner，但被 `NcpAgentSessionStoreAdapter` 包在 legacy 兼容层后面。
- summary index、metadata sidecar、journal replay 是正确的持久化子职责，但不应该被多个上层绕着写。

建议：

- 作为 `NcpSessionManager` 的内部持久化子对象。
- 外部热路径不直接使用它，也不通过 legacy adapter 暴露它。
- 不新增 `NcpSessionRepository` 第一阶段先不引入新名字，避免把复杂度换壳。

### `NcpAgentSessionStoreAdapter`

位置：`packages/nextclaw-kernel/src/services/ncp-agent-session-store-adapter.service.ts`

当前职责：

- 在 journal 与 legacy store 之间桥接。
- journal 不存在时从 legacy store import snapshot。
- list 时合并 journal summaries 与 legacy summaries。
- metadata update 根据 session 是否已在 journal 决定写 journal 或 legacy。

问题：

- 这是迁移兼容层，却在生产热路径中承担 store 合同。
- 它让“当前 session 到底在哪里”成为运行时判断。
- 它也是 summary refresh 与 legacy import 行为混在一起的来源。

建议：

- 从热路径删除。
- 如果仍需要读取老会话，改为 `LegacySessionReader` 只读能力和显式 legacy import 边界。
- 不允许新 NCP session 通过 adapter fallback 到 legacy 写路径。

### `NcpAgentLegacySessionStore`

位置：`packages/nextclaw-kernel/src/stores/ncp-agent-legacy-session.store.ts`

当前职责：

- 把 legacy session 转成 NCP session record。
- 把 NCP record 保存回 legacy session。

问题：

- 这是历史兼容实现，不应继续参与新 NCP session 写路径。
- 它存在越久，主链路越难判断真实数据归属。

建议：

- 第一阶段删除写路径依赖。
- 第二阶段完成 read/import 边界收敛，并在同一阶段结束前通过迁移或兼容窗口删除。

### `AgentRunRequestManager`

位置：`packages/nextclaw-kernel/src/managers/agent-run-request.manager.ts`

当前职责：

- 接收 agent run ingress。
- materialize request。
- 没有 sessionId 时创建 session。
- 调用 `SessionRunManager` 执行 run。

问题：

- 它直接依赖 legacy `SessionManager`。
- 它负责创建 session，但 session 创建的字段不变量和持久化不属于它。

建议：

- 不再依赖 `SessionManager`。
- 无 sessionId 时调用 `NcpSessionManager.createSession(...)` 或等价 materialize 方法。
- 只保留 run orchestration，不拥有 session 存储。

### `SessionRequestManager`

位置：`packages/nextclaw-core/src/features/session-request/managers/session-request.manager.ts`

当前职责：

- `sessions_spawn` 创建目标 session。
- `sessions_request` 向目标 session 发任务。
- 追加 session request accepted/completed/failed legacy event。

问题：

- 它在 core 包里强依赖 legacy `SessionManager`。
- 它把跨会话请求事件写到 legacy event store，而 NCP event stream 才是当前会话事实流。

建议：

- 对 NCP 主链路重写为 kernel 侧 session request owner，使用 `NcpSessionManager` 创建/写入 NCP session event。
- core 里的 legacy manager 只服务旧链路或被删除。

### `NcpSessionApiService`

位置：`packages/nextclaw-kernel/src/services/ncp-session-api.service.ts`

当前职责：

- list/get messages/summaries。
- 监听 `sessionUpdated` 并发布 realtime summary。
- update metadata。
- delete session。

问题：

- query facade 和 mutation 混在一起。
- `updateSession()` 是绕开统一 NCP session owner 的直接写路径。
- context window query 还依赖 legacy `SessionManager`。
- 这一层与项目其他 HTTP controller 直接使用 kernel manager 的模式不一致。
- 一旦存在 `NcpSessionManager`，它就成为第二个 session manager 名字，只增加调用链和职责歧义。

建议：

- 直接删除 `NcpSessionApiService`，不要瘦身保留。
- HTTP session controller 直接调用 `kernel.ncpSessionManager`。
- realtime summary 刷新职责并入 `NcpSessionManager`，或作为其内部私有 projection 方法实现，不保留独立 API service。
- context window contribution 不再通过 `ncpSessionApi.getSession()` 反读 summary。

### Projection Contributions

位置：

- `packages/nextclaw-kernel/src/contributions/session-activity-preview/index.ts`
- `packages/nextclaw-kernel/src/contributions/session-context-window/index.ts`

当前职责：

- preview contribution 监听 NCP event 并 patch `last_activity_preview`。
- context window contribution 读取 summary context window，再写 `ContextWindowUpdated` event。

问题：

- preview 当前已从直接写 store 收敛到 manager 调用，方向正确；目标状态下它必须继续经由 `NcpSessionManager.patchSessionMetadata()`。
- context window 是“读 API summary -> 写 event”的循环链路，且当前通过 `appendSessionEvent()` 会把 `ContextWindowUpdated` 写入 journal。
- `contextWindow` 快照本身是由 messages、`last_context_compaction` checkpoint metadata 和当前模型窗口配置计算出来的视图；它不是独立 session fact。
- `last_context_compaction` checkpoint 是应该持久化的 metadata，`ContextWindowUpdated` 是把计算结果通知 UI/state manager 的 ephemeral event，不应写 journal。

建议：

- preview 暂时保留为明确 projection，但写入必须走 `NcpSessionManager.patchSessionMetadata()`，并承认它不是 session owner。
- context window contribution 保留为 live projection：运行中优先读取 `SessionRunManager` 的 live session record，再交给 `NcpSessionManager` 用同一套 summary/context-window 计算逻辑生成快照；没有 live session 时才读持久化 record。
- `ContextWindowUpdated` 或等价的 context-window projection notification 直接通过 `eventBus` 发布；不调用 `NcpSessionManager.appendSessionEvent()`，不写 journal。
- `/api/ncp/agent/stream` 必须订阅同一个 `eventBus` 并按 `sessionId` 过滤，作为 NCP SSE 投影；不要让 `SessionRunManager` 再维护私有 `EventPublisher` 或 per-session publisher。
- 对后端来说，context window 不是 session state，也不是 runtime state；它是由 session facts 计算出的 projection。前端可以把它缓存为 UI state。
- 后续如果确认 `SessionContextWindowContribution` 与 native runtime preflight 的 context window 发布重复，再单独删除重复 projector。

### NCP event 总线与 SSE 投影

锁定决策：保留“总线全透出”原则，删除内部 session event 专用通道。不要把这个决策误读成“前端只能消费 `/ws`”。前端可以消费全局 bus，也可以消费 NCP stream；关键是事件来源本质上都必须是同一个 `eventBus`。

```text
所有 NCP event producer
  -> eventBus.emit(eventKeys.ncpEvent)
      -> backend contributions 按需过滤
      -> /ws subscribeAll 全量透出
      -> /api/ncp/agent/stream 按 sessionId 过滤成 SSE
      -> session request 等内部等待者按 correlationId 过滤
```

- `eventBus` 是唯一事件事实面。任何 NCP event 只发布到这里一次。
- `SessionRunManager` 负责 live session、runtime、active run、stateManager dispatch 和持久化调用；不再拥有一条 session event publisher。
- `/api/ncp/agent/stream` 是 `eventBus` 的 per-session NCP SSE 投影，不是新的事件源。
- `/ws` 保持全量透出总线的设计，不做白名单收窄。
- context window projection 必须覆盖所有会改变可见上下文预算的 NCP event：`MessageSent` 立即刷新，文本/推理/tool call 流事件节流刷新，terminal event 立即刷新；刷新时不能只读持久化 journal，否则 tool run 中的 streaming message / tool result 会滞后。
- 只需要部分事件的消费者在订阅点过滤，不为它们新增第二条通道。

禁止事项：

- 不恢复 `SessionRunManager.publisher`、`LiveSession.publisher` 或任何 per-session 私有事件 publisher。
- 不新增内部 `sessionEventBus`、`sessionMutationChains`、`session event service` 之类的平行事件通道。
- 不把 `/api/ncp/agent/stream` 当作新的事实源；它只能订阅 `eventBus.on(eventKeys.ncpEvent)` 并按 `sessionId` 过滤。
- 不收窄 `/ws subscribeAll` 的总线全量透明透出能力。
- stream 生命周期管理只能用于关闭 active queue、响应 client abort、manager dispose 清理；它不是事件分发 owner。

验收：

- `SessionContextWindowContribution` 直接 `eventBus.emit(eventKeys.ncpEvent, ContextWindowUpdated)` 后，`/api/ncp/agent/stream?sessionId=...` 能收到该 SSE。
- `rg "publisher|EventPublisher" packages/nextclaw-kernel/src/managers/session-run.manager.ts packages/nextclaw-kernel/src/utils/session-run.utils.ts` 无命中。
- NCP event 仍经 `/ws` 全量透出，不收窄总线设计。

## 当前问题链路

## Legacy `SessionManager` 递归调用方审计

这次不能把“还有引用”当作保留理由。所有引用者按产品价值和迁移路径分成四类：迁到 `NcpSessionManager`、降级只读、删除旧写能力、暂缓但隔离。

### A. 必须迁到 `NcpSessionManager` 的 NCP 主链路

这些调用方仍有产品价值，但不应该继续依赖 legacy `SessionManager`。

#### `AgentRunRequestManager`

当前用途：

- 无 `sessionId` 的 send 请求里调用 `SessionManager.createSession()`。

判断：

- 这是新 NCP session 的出生路径，必须迁移。

处理：

- 删除 `AgentRunRequestManager.sessions` 依赖。
- 无 `sessionId` 时调用 `NcpSessionManager.createSession()`。
- `AgentRunRequestManager` 只保留 run request materialization 和 run orchestration。

#### `SessionSpawnTool` / `SessionRequestTool`

当前用途：

- `sessions_spawn` 创建新 session。
- `sessions_request` 找目标 session，并把 request 状态写入 legacy event。

判断：

- 工具能力有价值，但当前实现写错事实源。

处理：

- 重写成 NCP session tool：创建、查找、request 状态事件全部经由 `NcpSessionManager`。
- 不新增第二个 request manager；已有 `SessionRequestManager` 继续作为 request 编排 owner，只把它依赖的 session facts owner 换成 `NcpSessionManager`。
- 若包边界要求迁移运行时实现位置，只移动这个已有 manager，不复制一套新 manager。
- `session.request.accepted/completed/failed` 若仍需要历史可见，应成为 NCP event，而不是 legacy event。

#### `SessionsListTool` / `SessionsHistoryTool`

当前用途：

- 通过 `SessionManager.listSessions()` 和 `getIfExists()` 列旧会话和历史消息。

判断：

- 工具能力有价值，但应该列 NCP session；旧会话只是兼容读取源。

处理：

- 改为依赖 `NcpSessionManager`。
- 列表默认来自 journal summary。
- 若仍要显示旧会话，由 `NcpSessionManager` 内部合并 legacy read-only summaries；工具不直接碰 legacy `SessionManager`。

#### `NativeAgentRuntimeFactory` / `NextclawNcpContextBuilder`

当前用途：

- runtime context builder 通过 `SessionManager.getOrCreate()` 读取 metadata。
- 同步 thinking/channel route 等 metadata。

判断：

- 这是 NCP runtime 主链路，继续用 legacy `SessionManager` 会偷偷创建或修改旧 session。

处理：

- context builder 改为从 `NcpSessionManager` 读取 session metadata 与 messages。
- thinking/model/channel route 同步改为 `NcpSessionManager.patchSessionMetadata()`。
- 不允许 `getOrCreate()` 这种读路径顺手创建 legacy session。

#### `ContextCompactionPreflightService`

当前用途：

- 读取/写入 context compaction checkpoint。
- 在 legacy session messages 里 upsert timeline message。

判断：

- context compaction 是 NCP runtime 能力，必须迁到 NCP session fact stream。

处理：

- metadata checkpoint 通过 `NcpSessionManager.patchSessionMetadata()` 写入。
- timeline message 若仍需要持久化，应通过 NCP event 表达，而不是写 legacy session messages。
- `preview()` 只能读 NCP session，不得依赖 legacy `SessionManager`。

#### `NcpSessionApiService`

当前用途：

- 给 HTTP session controller 提供 list/get/messages/delete。
- 监听 `sessionUpdated` 后发布 `sessionSummaryUpsert/Delete`。
- 用 legacy `SessionManager` 支撑 context window preview。

判断：

- 这是额外 API service 层，不是必要 owner。
- query 应由 HTTP controller 直接调用 `NcpSessionManager`。
- realtime summary refresh 应由 `NcpSessionManager` 或其内部 projection 方法负责。
- context window preview 不应通过 API summary 反读。

处理：

- 删除 `NcpSessionApiService` 文件和 kernel 字段。
- `NcpSessionRoutesController.getSessionApi()` 删除，改为直接取 `kernel.ncpSessionManager`。
- `listSessions/getSession/listSessionMessages/deleteSession` HTTP 路由直接调用 `NcpSessionManager`。
- 删除 `updateSession()` 直接写 store 路径。
- `publishSessionChange()` 逻辑迁入 `NcpSessionManager` mutation 成功后的 summary publish，或实现为 `NcpSessionManager.publishSessionSummary(sessionId)` 私有/内部方法。
- `SessionContextWindowContribution` 改为直接调用 `NcpSessionManager.getSession()` 或被删除为 query projection。

### B. 应删除写能力，只保留旧数据只读兼容

#### `NcpAgentLegacySessionStore`

当前用途：

- 读 legacy session。
- 把 legacy session 转为 NCP record。
- 也能 `saveSession()`、`updateSessionMetadata()`、`deleteSession()`。

判断：

- 读旧会话有价值。
- 写旧会话不再有价值，并且会继续制造双事实源。

处理：

- 改名或重写为 `NcpLegacySessionReader`。
- 只保留：
  - `getSession(sessionId)`
  - `listSessionMessages(sessionId)`
  - `listSessionSummaries()`
- 删除或停止暴露：
  - `saveSession()`
  - `updateSessionMetadata()`
  - `deleteSession()`，除非明确决定支持“删除历史旧会话”这种管理动作。

#### `NcpAgentSessionStoreAdapter`

当前用途：

- 在 journal 与 legacy store 之间做读写桥接。
- journal 不存在时自动 import legacy snapshot。

判断：

- 它是过渡层，不应保留为热路径 store。

处理：

- 不作为 `NcpSessionManager` 的默认内部依赖；如果实现时证明旧数据读取必须短期保留，也只能作为只读 reader/import 的过渡实现。
- 拆成：
  - journal store：新事实唯一读写源。
  - legacy reader：旧数据只读源。
  - explicit import：显式迁移动作，不在普通读写路径里自动发生。
- 能直接删时直接删，不为“以后再删”保留 adapter 热路径。

### C. 旧 channel / slash command 链路不能直接保留，应迁到 NCP command port

#### `CommandRegistry`

当前用途：

- `/status` 读 session metadata。
- `/reset` 清空 legacy messages。
- `/model` / `/thinking` 修改 legacy metadata。

判断：

- slash command 能力有价值。
- `SessionManager` 依赖没有价值。

处理：

- 引入更窄的 command port，而不是传完整 `SessionManager`：

```ts
type SessionCommandPort = {
  getSessionStatus(sessionId: string): Promise<...>;
  patchSessionMetadata(sessionId: string, patch: ...): Promise<...>;
  createNewSessionForRoute(route: ...): Promise<...>;
};
```

- NCP direct prompt、Discord command 等调用 `CommandRegistry` 时传 `NcpSessionManager` 实现的 command port。
- 删除 `/reset` 清历史语义；如果需要类似用户动作，改为 `/new`：新增会话并绑定当前 route，不改写旧 journal。

#### `dispatchPromptOverNcp`

当前用途：

- 为 direct prompt 执行 slash command 时传 `SessionManager` 给 `CommandRegistry`。

判断：

- direct prompt 是 NCP 入口，不能继续依赖 legacy session。

处理：

- 参数从 `sessionManager` 改为 `sessionCommands` 或 `ncpSessionManager`。
- slash command 执行不再创建/修改 legacy session。

#### built-in channel runtime: Telegram / Discord

当前用途：

- Telegram `/reset` 通过 `SessionManager` 查 route metadata 并 clear legacy sessions。
- Discord 创建 `CommandRegistry(config, sessionManager)`。

判断：

- channel 能力是否长期保留需要单独评估，但即使保留，也不能写 legacy session。

处理：

- 删除 channel 对完整 `SessionManager` 的依赖。
- channel 只拿到受限 command/session port。
- Telegram `/reset` 不再 clear legacy messages；如保留命令入口，应改为 `/new` 或兼容映射到 new：新增并绑定当前 route。
- 如果这些内置 channel 已经被 plugin/channel 新架构替代，优先整体删除旧 runtime，而不是为它继续适配。

### D. Gateway restart / route 恢复链路应迁到 NCP metadata query

#### `GatewayControllerImpl`

当前用途：

- 重启前从 legacy session metadata 解析 `last_delivery_context`、`last_to`、`last_account_id`。

判断：

- restart delivery context 有产品价值。
- 读取源应改成 NCP session metadata。

处理：

- 改为依赖 `NcpSessionManager.getSession()` 或专门的 `SessionRouteResolverPort`。
- 不直接使用 legacy `SessionManager.getIfExists()`。

#### `GatewayRestartWakeService`

当前用途：

- sentinel 缺失 sessionKey 时从 legacy `listSessions()` 找最近 routable session。
- 用 legacy session metadata 补 `last_channel` / `last_to`。

判断：

- wake 能力有价值，但应从 NCP summary/metadata 查 route。

处理：

- 改为从 `NcpSessionManager.listSessionSummaries()` 中找最近 routable session。
- route fallback 读取 NCP metadata。

#### `restart-sentinel.enqueuePendingSystemEvent`

当前用途：

- delivery 不可用时，把 pending system event 写入 legacy session metadata。

判断：

- 这是旧 fallback。是否仍需要取决于现在是否还有读取并消费 `pending_system_events` 的 NCP 路径。

处理：

- 先查消费方；如果没有消费方，删除这条 fallback。
- 如果还需要，改成 NCP metadata patch 或独立 restart queue，不写 legacy session。

### E. `ChannelManager` 的 `sessionManager` 注入应收敛

当前用途：

- `ChannelManager` 把完整 `SessionManager` 传给 extension channel 的 `createChannel()`。

判断：

- 这是旧扩展 API 泄漏完整 session owner 的入口。

处理：

- 对内置 channel：改成传受限 command/session port。
- 对外部 extension compat：如果必须短期保留，传 read-only legacy facade 或 `undefined`，不要继续提供可写 `SessionManager`。
- 在 extension API 层标记 `sessionManager` deprecated，并给出迁移到 NCP session/command port 的路径。

## Legacy 删除结论

短期不能只说“`SessionManager` 还有引用所以不能删”。正确结论是：

- `SessionManager` 不能继续作为 NCP 写 owner。
- 所有 NCP 主链路引用都应该迁走。
- 旧数据读取能力保留为 `LegacySessionReader`，只读、受限、可删除。
- 旧 channel/command/restart 引用不是保留理由，它们分别要迁到 NCP command port、NCP metadata query，或整体删除。
- 当上述迁移完成后，core `SessionManager` 可以从 NextClaw NCP runtime 中完全移除；若仍有 plugin compat 需要，可移到 compat 包或测试 fixture，而不是留在主 kernel 对象图里。

### 新 run 创建链路

当前：

```text
HTTP / UI / ingress
  -> AgentRunRequestManager
  -> SessionManager.createSession()
  -> SessionRunManager.getOrCreateLiveSession()
  -> NcpAgentSessionStoreAdapter
  -> JournalStore 或 LegacyStore
```

问题：

- 新 session 先进入 legacy owner，再进入 NCP owner。
- `NcpAgentSessionStoreAdapter` 被迫判断 session 是否在 journal，读不到就回 legacy。

目标：

```text
HTTP / UI / ingress
  -> AgentRunRequestManager
  -> NcpSessionManager.createSession()
  -> SessionRunManager.getOrCreateLiveSession()
  -> NcpSessionManager.appendSessionEvent()
```

### session spawn/request 链路

当前：

```text
sessions_spawn / sessions_request
  -> core SessionRequestManager
  -> SessionManager.createSession() / appendEvent()
  -> ingress agentRun.sessionMessageRequest
  -> AgentRunRequestManager
```

问题：

- 创建目标 session 与 request 状态事件都写 legacy。
- NCP event stream 只能事后通过 adapter/import 看到一部分状态。

目标：

```text
sessions_spawn / sessions_request
  -> kernel NCP session request owner
  -> NcpSessionManager.createSession()
  -> NcpSessionManager.appendSessionEvent(session.request.*)
  -> ingress agentRun.sessionMessageRequest
```

### metadata patch 链路

当前已经局部收敛：

```text
HTTP patch / preview contribution
  -> NcpSessionManager.patchSessionMetadata()
  -> NcpSessionManager 持有的 session metadata 当前真相
  -> internal store.updateSessionMetadata()
```

剩余问题：

- 现有 `NcpSessionApiService.updateSession()` 仍可直接写 store，因此整个 service 应删除，而不是只删除这个方法。
- store 仍是 adapter，不是 journal hot path。

目标：

```text
任何 metadata mutation
  -> NcpSessionManager.patchSessionMetadata()
  -> internal NcpAgentSessionJournalStore.updateSessionMetadata()
```

### summary refresh 链路

当前：

```text
append/update/delete
  -> onSessionUpdated/sessionUpdated
  -> NcpSessionManager.publishSessionSummary()
  -> NcpSessionManager.getSession()
  -> sessionSummaryUpsert
```

问题：

- 这个机制本身可以保留，它是 realtime projection refresh。
- 但不应该为了这个机制保留 `NcpSessionApiService`。
- 当底层还有 legacy/journal adapter 与直接写路径时，它会把不同来源的 summary 轮流推给 UI。

目标：

- 保留 `sessionUpdated -> summaryUpsert` 作为单纯 projection refresh。
- 确保 refresh 只从唯一 durable source 读取。
- refresh 逻辑属于 `NcpSessionManager` 内部，不单独暴露 API service。
- 不让 refresh 本身承担修复、迁移、fallback 或 metadata merge 职责。

## 目标架构

### 统一 session 门面：`NcpSessionManager`

职责：

- 创建 NCP session。
- append NCP event。
- patch metadata。
- delete session。
- list/get session、messages、summaries。
- 封装 journal store、metadata sidecar、summary index 与显式 legacy import。
- 持久化变化成功后发布 `sessionUpdated`。
- 发布或刷新 `sessionSummaryUpsert/Delete`，作为 session 事实变化后的内部 projection。

不负责：

- 创建/恢复 live session。
- 管理 active run。
- 调用 runtime。
- 发布 run stream。
- 直接处理 HTTP body。
- 处理 UI 展示字段适配。
- 承担全文搜索索引实现。

### Runtime owner：`SessionRunManager`

职责：

- 创建/恢复 live session。
- 创建 runtime。
- 管理 active run。
- 处理 abort。
- 调用 runtime。
- 将 runtime 产生的 NCP event 交给 `NcpSessionManager.appendSessionEvent()` 持久化。
- 发布 NCP event 与 per-session stream。

不负责：

- 创建 NCP session。
- patch/delete session metadata。
- 直接访问底层 session store。
- 判断 legacy fallback。

### 持久化子对象：`NcpAgentSessionJournalStore`

职责：

- append journal event。
- update metadata sidecar。
- replay messages。
- update summary index。
- list/get/delete NCP session。

不负责：

- 判断 fallback 到 legacy store。
- 创建 legacy session。
- 直接服务 HTTP controller。

## 分阶段方案

### 阶段 1：把 `NcpSessionApiService` 迁移成 `NcpSessionManager` 统一门面，并切断新 run 的 legacy 创建路径

改动：

- 将现有错位的 `NcpSessionApiService` 职责改名并迁移为 `NcpSessionManager`，第一阶段直接以 journal store 作为新 session 读写源。
- `NcpSessionManager` 提供 `createSession()`、`appendSessionEvent()`、`patchSessionMetadata()`、`getSession()` 等统一入口。
- `NcpSessionManager` 接管 `sessionSummaryUpsert/Delete` 发布。
- `AgentRunRequestManager` 无 sessionId 时不再调用 `SessionManager.createSession()`。
- `AgentRunRequestManager` constructor 删除 `sessions` 依赖。
- 新 session 创建通过 `NcpSessionManager.createSession()` 完成。
- `SessionRunManager` append event 时调用 `NcpSessionManager.appendSessionEvent()`，不直接访问 store。
- HTTP session controller 直接依赖 `kernel.ncpSessionManager`，不再通过 `ncpSessionApi`。
- 旧会话继续发送消息时，先显式 import 到 journal，随后归 `NcpSessionManager` 管；普通 get/list 不自动 import。

删除：

- `AgentRunRequestManager` 对 `SessionManager` 的依赖。
- `AgentRunRequestManager.materializeSendEnvelope()` 里的 legacy session 创建逻辑。
- 对新 run 创建后手动 `onSessionUpdated` 的职责，改由 `NcpSessionManager` 持久化后统一触发。
- `NcpSessionApiService` class、kernel 字段、start/dispose 调用和 controller `getSessionApi()`。
- 新写入路径对 `NcpAgentSessionStoreAdapter` 的依赖。
- 无生产引用后的 `NcpAgentSessionStoreAdapter` 旧兼容桥。

验收：

- 新建 NCP session 后，legacy session store 不新增 session 文件。
- UI list/get/messages 正常。
- agent run、abort、stream 正常。
- preview metadata 不回退。

### 阶段 2：收敛剩余 legacy `SessionManager` 主链路依赖

本方案总共只有两个阶段。阶段 1 已建立 `NcpSessionManager` 统一门面并切断新 run 的 legacy 创建路径；阶段 2 不再拆出更多阶段，而是把剩余会让 NCP 主链路继续依赖 legacy `SessionManager` 的路径一次性收敛掉。

阶段 2 不新增第二个 request manager，也不引入 `port` / adapter / proxy 这类过度抽象。已有 `SessionRequestManager` 仍是 request 编排 owner；本阶段只把它依赖的 session facts owner 从 legacy `SessionManager` 换成 `NcpSessionManager`。

如果包边界导致 core 里的 `SessionRequestManager` 不能直接 import kernel 的 `NcpSessionManager`，处理方式是迁移这个已有 manager 的运行时实现位置，而不是复制出一个新 manager。core 可保留纯类型和纯工具函数；NCP 主链路只保留一个 `SessionRequestManager` 实例。

阶段 2 的真实边界不是只改 `SessionSpawnTool` / `SessionRequestTool` 两个文件。只要同属 `ToolContribution` 注册的 AI session 工具域，并且当前通过 `kernel.sessions` 或 `kernel.sessionRequests` 触达 legacy `SessionManager`，都必须在这一阶段一起收敛，否则模型一边用 NCP 创建新会话，另一边又用 legacy list/history 看不到或看错事实源。

本阶段必须覆盖：

- `SessionRequestManager`：request 编排 owner 保留，但 session create / lookup / request event 写入全部改走 `NcpSessionManager`。
- `SessionSpawnTool`：不再持有 `SessionManager`；有 request 走同一个 `SessionRequestManager`，无 request 直接走 `NcpSessionManager.createSession()` 或由 `SessionRequestManager` 暴露同语义创建方法。
- `SessionRequestTool`：继续只调用同一个 `SessionRequestManager.requestSession()`，不新增第二套 request 编排。
- `SessionsListTool` / `SessionsHistoryTool`：同属 AI-facing session 工具域，不能继续从 legacy `SessionManager.listSessions()` / `getIfExists()` 读；要改为读取 `NcpSessionManager` 的 list/history 能力。旧会话如需展示，只能由 `NcpSessionManager` 内部的只读 legacy reader 合并，tool 不直接碰 legacy manager。
- `ToolContribution`：不再向 session 工具注入 `kernel.sessions`；session 工具统一从 `kernel.ncpSessionManager` / 同一个 `SessionRequestManager` 获得能力。
- `LearningLoopContribution`：它依赖 spawn-and-request 创建 review session，也属于 request 链路消费者，必须同步迁移；同时它当前通过 `sessionStore.save(session)` 写 review metadata，必须改为 `NcpSessionManager.patchSessionMetadata()`。
- `NextclawKernel.sessionRequests`：构造时不再传 `sessions: this.sessions`，也不把 legacy `SessionManager` 作为 request manager 的事实源。
- `SessionSearchTool` 本身不直接依赖 `SessionManager`，但它依赖 search index；阶段 2 验收必须确认 `NcpSessionManager.createSession()`、request 状态事件追加和 metadata patch 后仍触发 `sessionSearch.handleSessionUpdated`，否则 AI search 会成为新的暗断点。
- request 状态事件 contract：`session.request.accepted/completed/failed` 必须作为 NCP journal 中的 session 历史事实写入，不能退回 UI-only tool result 或 legacy event store。阶段 2 可先使用 journal event string contract；若后续要提升为 `@nextclaw/ncp` 公共事件枚举，需要单独按 types 文件命名治理迁移。

#### 工作包 A：AI session 工具域与 request 链路

改动：

- `SessionRequestManager` 不再接收 legacy `SessionManager`；改为直接依赖 `NcpSessionManager`。
- `SessionRequestManager.spawnSessionAndRequest()` 里的 session 创建改走 `NcpSessionManager.createSession()`。
- `SessionRequestManager.requestSession()` 的 target lookup 改走 `NcpSessionManager.getSessionRecord()` / `getSession()`。
- `SessionRequestManager.appendRequestEvent()` 不再写 legacy event store；改为把 `session.request.accepted/completed/failed` 写成 NCP event，并通过 `NcpSessionManager.appendSessionEvent()` 追加到 source 与 target session。
- `SessionSpawnTool` 不再直接依赖 core `SessionManager`。
- `SessionSpawnTool` 无 `request` 的普通 spawn 也必须走 `SessionRequestManager` 或 `NcpSessionManager.createSession()`，不能保留 `SessionManager.createSession()` 分支。
- `sessions_spawn` 创建 session 走 NCP session owner。
- request accepted/completed/failed 状态写 NCP event，不写 legacy event。
- `SessionRequestTool` 继续调用同一个 `SessionRequestManager.requestSession()`，不自行实现 request 编排。
- `ToolContribution` 不再把 `kernel.sessions` 或 legacy `kernel.sessionRequests` 注入 `SessionSpawnTool` / `SessionRequestTool`。
- `LearningLoopContribution` 仍需要 spawn-and-request 能力时，同步切到同一个 `SessionRequestManager`，不能继续走 legacy request 链路。
- `LearningLoopContribution` 读取 session messages / metadata 时走 `NcpSessionManager.getSessionRecord()`；写 `learning_loop_*` metadata 时走 `NcpSessionManager.patchSessionMetadata()`。
- `SessionsListTool` / `SessionsHistoryTool` 从 core legacy tool 迁出或改造为 NCP session 工具，读取 journal session summary / messages。
- request 状态事件以 `session.request.accepted/completed/failed` 写入 NCP journal；这些事件是 session 历史事实，不是 UI-only tool result。公共 NCP enum 是否补齐属于后续协议化治理项，不阻塞阶段 2 收敛。

删除：

- NCP 工具链路对 core `SessionManager` 创建/写入能力的依赖。
- request 状态事件写 legacy session 的逻辑。
- `SessionSpawnTool` 中 `this.sessionManager.createSession()` 分支。
- `SessionRequestManager` 中 `this.options.sessions.appendEvent()` / `save()` / `getOrCreate()` 写 legacy event 的逻辑。
- `SessionsListTool` / `SessionsHistoryTool` 在 NCP tool registration 中对 legacy `SessionManager` 的直接依赖。
- `LearningLoopContribution` 中 `sessionStore.save(session)` 这类绕过 `NcpSessionManager` 的 metadata 写入。
- 若 `SessionRequestManager` 运行时实现迁移到 kernel，删除 core 对该 manager class 的运行时导出，只保留必要的纯类型/纯工具导出。

验收：

- `sessions_spawn` 创建的 session 只进入 journal。
- `sessions_request` 仍能向目标 session 发送任务并等待 final reply。
- source 与 target session 都能看到 request 状态。
- 无 request 的 `sessions_spawn`、带 `request.notify="none"` 的后台 request、带 `request.notify="final_reply"` 的同步等待 request 都通过。
- `LearningLoopContribution` 触发的 review session 仍能创建并收到 final reply。
- `sessions_list` 能看到 NCP journal session；`sessions_history` 能读取 NCP journal messages。
- `session_search` 能搜到本阶段新建或更新的 NCP session。
- `rg "SessionManager" packages/nextclaw-kernel/src/tools packages/nextclaw-kernel/src/contributions/tool-contribution packages/nextclaw-kernel/src/contributions/learning-loop` 不再显示 NCP 工具主链路依赖。
- `rg "appendEvent\\(|save\\(" packages/nextclaw-core/src/features/session-request packages/nextclaw-kernel/src` 不再显示 request 状态写 legacy session 的生产调用。
- journal 中能看到 request accepted/completed/failed 事件；legacy session store 不新增对应 request 状态事件。

#### 工作包 B：runtime context builder 与 context compaction

这一组处理运行时主链路里更深的一层职责越界。`ContextBuilder` 不应该管理 session，它的合理职责只是“为本次模型调用组装上下文”。context compaction 则不是一个零散 helper，而是一个完整 feature：它应该有自己的 manager 内聚“预算评估、checkpoint 生命周期、摘要生成、timeline message、context window projection”这整件事。当前问题是 `NativeAgentRuntimeFactory` 把 `kernel.sessions` 传给 `NextclawNcpContextBuilder` 和 `ContextCompactionPreflightService`，导致只读 builder 和 compaction feature 都拿到了 legacy `SessionManager`。

当前代码实情：

- `NextclawNcpContextBuilder` 调用 `SessionManager.getOrCreate(input.sessionId)` 获取一个可变 legacy `Session` 对象。
- `resolveEffectiveModel()`、`syncSessionThinkingPreference()`、`resolveSessionChannelContext()` 会原地修改 `session.metadata`，把 model / thinking / last_channel / last_to 写进这个对象。它没有显式 `save()`，但已经把 context builder 变成了会改 session 对象的组件。
- `ContextCompactionPreflightService.begin()` / `finish()` 更严重：直接 `getOrCreate()` legacy session，写 checkpoint metadata，upsert timeline message，然后 `save()`。

判断：

- 这是职责错误，不是目标架构。
- context builder 应该只消费 immutable session snapshot / run metadata，并返回本次 LLM 输入；如果运行中发现需要更新 model / thinking / route metadata，应返回 metadata patch 或调用上层提供的明确 mutation API，而不是拿 `SessionManager`。
- context compaction 应升级为 `ContextCompactionManager` 或等价 manager，而不是继续作为薄 service 散落在 runtime factory 里。
- `ContextCompactionManager` 可以完整负责 compaction 功能闭环：读取本次 run snapshot、评估预算、生成 pending checkpoint、调用 provider 生成摘要、生成最终 checkpoint、生成 timeline message、生成 context-window projection。
- 但 `ContextCompactionManager` 不是 session owner。它需要改变 session 时，必须通过 `SessionRunManager` 的 live mutation 入口或 `NcpSessionManager` 的持久化 mutation 入口完成，不直接持有 legacy `SessionManager`，也不直接写 journal store。
- live run 期间优先经由 `SessionRunManager` 应用 checkpoint metadata，因为它负责 live metadata 与持久化同步；非 live / query projection 场景才直接读 `NcpSessionManager`。

改动：

- `NativeAgentRuntimeFactoryOptions.sessions` 改为 `ncpSessionManager`。
- `NextclawNcpContextBuilder` 从调用方传入的 immutable session snapshot 或 `NcpSessionManager.getSessionRecord()` 读取 metadata 与 messages，不再 `getOrCreate()` legacy session。
- `resolveEffectiveModel`、channel route、workspace、thinking preference 等需要读写 session metadata 的逻辑，通过 `NcpSessionManager` 的 record/metadata contract 表达。
- `syncSessionThinkingPreference` 不能再原地修改 legacy session；改为返回 metadata patch，或由 `NextclawNcpContextBuilder` 调 `NcpSessionManager.patchSessionMetadata()`。
- 将 `ContextCompactionPreflightService` 收敛为 `ContextCompactionManager` 的内部协作者或直接改名为 manager；不要让 `NativeAgentRuntimeFactory` 编排 compaction 的多步细节。
- `ContextCompactionManager` 不再依赖 `SessionManager`；live run 场景由它调用 `SessionRunManager.patchSessionMetadata()` 或接收 `SessionRunManager` 提供的明确 mutation callback 来应用 checkpoint metadata。
- context compaction timeline message 若仍是会话历史事实，由 `ContextCompactionManager` 生成 NCP message/event，再通过 `SessionRunManager.appendSessionEvent()` 进入 state manager 与 journal；不能再 upsert 到 legacy `session.messages` 后 `save()`。
- `ContextWindowUpdated` 仍是 projection event，可由 `ContextCompactionManager` 发布或返回给调用方发布，但 projection event 不写 journal。

删除：

- `NextclawNcpContextBuilderOptions.sessionManager`。
- `NativeAgentRuntimeFactoryOptions.sessions`。
- `ContextCompactionPreflightService` 里的 `sessionManager.getOrCreate()` / `getIfExists()` / `save()`。
- `NativeAgentRuntimeFactory` 里对 compaction begin/finish/setSessionMetadata/publishPreflightResult 的散装编排；它应只调用 `ContextCompactionManager.runPreflightForLiveRun()` 这类意图级方法。
- 任何为了读 metadata 而顺手创建 legacy session 的路径。

验收：

- 普通 agent run 的 prompt context、tool registry context、workspace、channel/chatId、model/thinking 偏好仍正确。
- context compaction 触发时 checkpoint metadata 先更新 live session metadata，再同步写入 journal session metadata。
- context compaction timeline message reload 后仍可从 NCP journal messages 还原。
- `ContextCompactionManager` 是 compaction 的唯一业务编排 owner；`NativeAgentRuntimeFactory` 不再知道 begin/finish/checkpoint/timeline 的内部步骤。
- `rg "SessionManager|getOrCreate\\(|\\.save\\(" packages/nextclaw-kernel/src/features/native-runtime packages/nextclaw-kernel/src/features/context-compaction` 不再显示 runtime context / compaction 的 legacy session 读写。

#### 工作包 C：service、gateway、command 与 channel 的旧 `SessionManager` 使用

这一组处理不直接属于 agent run / session tool 的旧使用者，避免删除写能力时突然断裂。原则是：NCP 主链路不再拿完整 legacy `SessionManager`；确实还没迁的外部兼容路径必须被标成 legacy/compat，只读或有明确删除点。

必须复核并分类：

- `dispatchPromptOverNcp` / CLI agent runner：当前为了 slash command 传入 `SessionManager`。若 slash command 仍需 session 能力，优先让命令执行依赖 `NcpSessionManager` 的意图级方法；不要新增空心 port，也不要传完整 legacy manager。
- `CommandRegistry`：只保留真正还需要的 session 命令能力；能迁到 `NcpSessionManager` 就迁，不能迁的命令标为 legacy compat。
- `ChannelManager` / extension channel context：不要再把完整可写 `SessionManager` 暴露给 extension；如果外部兼容短期必须保留，降级为明确 legacy compat surface，并写删除条件。
- gateway / restart wake / restart sentinel：当前仍通过 legacy metadata 查 route 或写 pending system events；迁移到 `NcpSessionManager.getSessionRecord()` / `patchSessionMetadata()`，或明确划入非 NCP legacy channel 兼容。
- `nextclaw-ncp-dispatch.utils.ts`：direct prompt NCP dispatch 不应继续要求 legacy `SessionManager` 作为上下文依赖。

验收：

- CLI direct prompt、slash command、gateway restart wake、restart sentinel 的现有行为按最小冒烟通过。
- NCP direct prompt 不再把 legacy `SessionManager` 作为必需依赖。
- extension/channel 若仍暴露 legacy session 能力，文档中有明确 compat 标记和删除点。

#### 工作包 D：删除 adapter 与 legacy 写能力

前置条件：工作包 A 的 AI session 工具域、工作包 B 的 runtime context/compaction、工作包 C 的 service/gateway/command/channel 分类都已完成。否则不能删 adapter，因为还会有生产路径依赖 legacy `SessionManager` 写入或隐式创建。

改动：

- `NextclawKernel` 只把 `NcpSessionManager` 暴露给 `AgentRunRequestManager`、`SessionRunManager` 与 HTTP controller。
- `NcpSessionManager` 内部直接使用 `NcpAgentSessionJournalStore`。
- 若仍需旧 session 可见，提供 `LegacySessionReader` 只读能力，不参与新写入。
- `SessionRunManager` 不再接收 store，也不再判断 optional 方法。
- 旧会话发送消息的 import 必须是显式动作，普通 get/list 不触发 import。

删除：

- `NcpAgentSessionStoreAdapter` 作为主 store 的角色。
- `NcpAgentSessionStoreAdapter` 文件本身；如仍需旧数据读取，保留的是新的只读 reader，而不是 adapter。
- `SessionRunManager.persistLiveSessionEvent()` 里的 `saveSession(buildSessionRecord(...))` fallback。
- `AgentSessionStore` 里服务旧合同的 optional 分支。

验收：

- 新 session、旧 journal session 全部通过 journal store 读取。
- 旧 legacy session 的兼容策略明确：要么通过一次性 migration，要么通过只读 import 入口。
- 主链路没有 `journal ?? legacy` 的运行时分叉。

#### 工作包 E：清理剩余 API service 依赖与写入口

改动：

- 删除所有 `NcpSessionApiService` 测试或改写为 `NcpSessionManager` 测试。
- HTTP patch 调用 `NcpSessionManager.patchSessionMetadata()`。
- delete 下沉到 `NcpSessionManager.deleteSession()`。
- router/test kernel mock 从 `ncpSessionApi` 改成 `ncpSessionManager`。

删除：

- query facade 直接 `updateSessionMetadata()` 的能力。
- controller/API 层对底层 store 的隐式写语义。
- 所有 `kernel.ncpSessionApi` 引用。

验收：

- `rg "ncpSessionApi|NcpSessionApiService" packages/nextclaw-kernel packages/nextclaw-server packages/nextclaw-service` 无生产引用。
- `rg "updateSession\\(" packages/nextclaw-kernel packages/nextclaw-server` 不再出现绕过 `NcpSessionManager` 的生产调用。
- metadata mutation 全部通过同一方法。

#### 工作包 F：处理 projection contribution

改动：

- preview projection 继续走 `NcpSessionManager.patchSessionMetadata()`，但确认其只是 projection，不是 owner。
- context window contribution 改为直接读 `NcpSessionManager` 计算 context window。
- `ContextWindowUpdated` 或等价 projection notification 直接通过 `eventBus` 发布给前端消费，不经过 `SessionRunManager`，不经过 `NcpSessionManager.appendSessionEvent()`。
- context compaction 的 checkpoint metadata 仍通过 `NcpSessionManager.patchSessionMetadata()` 持久化；不要把 checkpoint 与 context window 快照混为一类。

删除：

- context window 的 API summary 反读写回循环。
- `ContextWindowUpdated` derived event 的 journal 持久化。

验收：

- context window 展示仍正常。
- journal 中不再新增 `context-window.updated` event。
- `SessionRunManager` 不持有、不缓存、不发布 context window projection。
- reload 后 context window 通过 messages + checkpoint metadata 重新计算，而不是 replay 持久化的 context window event。

## 不建议的方案

### 不建议新增一个空心 `NcpSessionRepository`

短期不建议新增一个只包装 `NcpAgentSessionJournalStore` 的 repository。原因：

- 现在问题不是缺一个名字，而是主链路仍有 legacy owner。
- 新增 wrapper 可能让调用链更长，但不删除旧路径。
- 当前更好的第一刀是建立 `NcpSessionManager` 统一门面，删除 `AgentRunRequestManager -> SessionManager` 和 store 直连。

如果后续 `NcpAgentSessionJournalStore` 名字已经不能表达职责，可以在删除旧路径后再做 rename，而不是现在新建平行抽象。

### 不建议保留 adapter 作为永久兼容层

`NcpAgentSessionStoreAdapter` 只能是迁移期对象。长期保留会导致：

- 每次读写都要判断 session 属于 journal 还是 legacy。
- bug 排查时无法直接判断真实数据来源。
- summary refresh 可能再次把旧投影视图推回 UI。

### 不建议让 controller 持有 metadata 业务规则

HTTP controller 可以解析 request body，但 session metadata 的业务规则最终应靠 session owner 或 kernel 内部方法维护。否则 UI read marker、preferred model、project root、label 等字段会继续散在 server/controller/UI adapter 之间。

## 已拍板决策

1. 旧 legacy session 是否还要求在 UI 列表里长期可见？

结论：短期可读，长期迁移或删除兼容。新写入绝不进入 legacy。

2. `sessions_spawn` 创建但不立即 request 的空 session，是否也必须进入 NCP journal？

结论：是。它是 NCP session，不应再创建 legacy session。

3. `reset` 是否继续存在？

结论：不继续做 reset。旧 `/reset` 语义改为 new：新增会话并绑定到新会话。不要清空 journal，不追加 `SessionCleared`，不改写历史。

4. 旧会话继续发送时怎么处理？

结论：显式 import 到 journal，然后该 session 归 `NcpSessionManager` 管。普通 get/list 只读，不自动 import。

5. `session.request.*` 状态是否需要成为 NCP event？

结论：是。它描述跨会话编排事实，属于 session 历史的一部分。

6. context window 是否必须持久化成 event？

结论：不持久化，也不作为 backend runtime state。`ContextWindowUpdated` 是 projection notification，直接通过 `eventBus` 发布给前端；真正需要持久化的是 context compaction checkpoint metadata 和必要的 timeline message fact。

7. `ContextWindowUpdated` 事件名是否要改？

结论：不改事件名。复用现有 `ContextWindowUpdated` payload 语义，但改变传输/持久化路径：eventBus projection only，不进 journal。

8. `NcpSessionManager` 是否会变成新 god object？

结论：它只做 session 事实门面，不管 runtime、HTTP parsing、UI adaptation、全文搜索实现。legacy import 是显式边界，不是普通读写 fallback。

## 第一刀推荐

第一刀只做一件事：

```text
NCP session 的 create / append event / patch metadata 先统一经由 NcpSessionManager。
```

具体范围：

- 将 `NcpSessionApiService` 改名并迁移为 `NcpSessionManager`，不让两者并存。
- `AgentRunRequestManager` 删除 `sessions` dependency。
- `AgentRunRequestManager` 无 sessionId 时调用 `NcpSessionManager.createSession()`。
- `SessionRunManager` append event 时调用 `NcpSessionManager.appendSessionEvent()`。
- HTTP patch / preview projection 改为调用 `NcpSessionManager.patchSessionMetadata()`。
- 删除新写入路径对 legacy adapter 的依赖；旧数据读取若必须保留，走只读 reader。

为什么先做这刀：

- 它直接切断最核心的双 owner 出生路径。
- 它同时删除 API service 层和 adapter 热路径，不再把“后续删除”当成默认拖延。
- 旧数据读取通过只读 reader/import 显式承接，不影响新事实源收敛。

## 验证标准

每个阶段都必须至少验证：

- TypeScript 编译通过。
- 新建 session 不写 legacy store。
- list/get/messages 读取一致。
- agent run stream 正常。
- metadata preview 不回退。
- session summary realtime refresh 只从唯一 source 读。
- 非功能重构的生产代码净增应尽量 `<= 0`，若阶段性无法做到，需要明确说明删除点和下一步净减路径。

## 最终目标

最终 session 体系应收敛为：

```text
UI / HTTP / tool / ingress
  -> NcpSessionManager 作为唯一 session 事实门面
  -> NcpAgentSessionJournalStore 作为内部持久化子对象
  -> SessionRunManager 只负责 live/runtime
```

legacy `SessionManager`、`NcpAgentSessionStoreAdapter`、`NcpAgentLegacySessionStore` 不再参与 NCP 主链路。旧数据兼容若仍需要，必须有明确的迁移窗口、显式入口和删除点。
