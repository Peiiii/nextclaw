# Session Journal Persistence Design

## 背景

NextClaw 的 chat / agent runtime 需要同时满足两个要求：

1. agent 工具执行、流式输出、MCP 调用或长任务运行时，普通 API 不能被卡住。
2. 系统自主重启、崩溃恢复、服务重启或桌面后台恢复时，必须能恢复已经产生的半截 assistant message、半截 tool call、工具中间结果和 run 状态。

当前 session 持久化路径的风险在于：运行时事件进入 live session 后，会被投影成完整 session snapshot，再通过同步文件 IO 全量 rewrite 到磁盘，并同步更新列表 index。这个模型对短消息可接受，但对工具密集、流式密集、session 历史较长的场景不成立。

这个问题不是“工具慢”本身，而是实时事件、会话状态、持久化格式、列表读模型被绑在同一条同步主链路里。NextClaw 作为个人操作层，需要的是可恢复、可观察、可自治的运行时，而不是靠减少落盘次数牺牲连续性。

## Codex 参考

OpenAI Codex 的方向值得借鉴，但不能机械照搬：

- `Codex` 通过 submission queue + event stream 连接前台和后台 agent loop。
- `UnifiedExecProcessManager` 负责工具进程 / PTY 生命周期、输出缓冲、yield 和后台 watcher。
- rollout persistence 使用 JSONL 记录会话，但通过 bounded channel 把写入交给后台 async writer，避免在调用方线程做 blocking IO。
- session / thread 列表优先走轻量索引或 DB，rollout 文件是可 replay 的事实日志，不是列表接口每次解析的重路径。

对应到 NextClaw：我们不应该减少保存半截消息，而应该把保存方式从“同步全量 snapshot rewrite”改成“异步增量 journal append + 可 replay 投影 + 轻量索引”。

## 目标

- 已进入 live session 的关键运行时事件必须 durable，支持恢复半截消息。
- 普通 HTTP API、WebSocket/SSE 推送、配置接口和健康检查不得等待 agent 工具执行或 session 全量落盘。
- session 持久化从 snapshot-first 改为 journal-first：事件日志是事实源，snapshot/checkpoint/index 是读模型优化。
- 架构上清晰区分 live runtime、durable journal、projection、summary index、artifact/blob store。
- 支持文件存储默认实现，同时保留后续 SQLite、远程存储或云同步实现的可插拔边界。
- 不把复杂度推给 UI；UI 只消费 session API 和实时事件，不理解 journal 内部格式。

## 非目标

- 本设计不恢复已经中断的外部工具进程本身。重启后可以恢复“当时运行到哪里、最后一段输出是什么、工具调用处于什么状态”，但不能保证原子恢复同一个 OS process。
- 不在第一版做多进程并发写同一 session。多实例协调需要单独的 distributed runtime / lock owner。
- 不把所有 EventBus 事件都持久化。只持久化能够重建 session conversation 与 run 状态的 session journal event。
- 不把大工具结果直接塞进 journal 主文件。大 payload 必须进入 artifact/blob store，journal 只保存引用、摘要和校验信息。

## 设计原则

### 1. Journal 是事实源

半截消息恢复依赖 append-only journal，不依赖 run finished 时的一次完整 snapshot。只要事件已经对 live session 可见，就应该进入 durable 写入队列。

### 2. 实时状态和持久化解耦

`AgentLiveSessionRegistry` / state manager 负责当前进程内的实时真相；journal writer 负责 durable log。实时 UI 不等待落盘完成，除非某个操作明确要求 durable ack。

### 3. 持久化写入不能阻塞普通 API

writer 可以对当前 agent run 产生反压，但不能把 `/api/health`、`/api/config`、`/api/ncp/sessions` 等普通请求拖进同一个同步文件写链路。

### 4. 读模型分层

列表接口读 `SessionSummaryIndexStore`；详情接口对 active session 优先读 live state，对 inactive session 读 snapshot/checkpoint 或 replay journal；恢复流程由 projector 负责。

### 5. Owner 内聚

持久化格式、写入顺序、恢复 replay、summary index 更新不能散落在 controller、router、UI hook 或普通 helper。每个变化原因对应一个明确 owner。

## 推荐架构

```text
Runtime event
  -> AgentSessionProjector.applyLive(event)
  -> SessionJournalWriter.enqueue(event)
  -> SSE/WebSocket/EventBus publish

SessionJournalWriter
  -> DurableSessionJournalStore.append(event)
  -> SessionSummaryIndexStore.upsert(delta)
  -> optional SessionSnapshotStore.compact()

Startup / restore
  -> SessionSummaryIndexStore.list()
  -> DurableSessionJournalStore.read(sessionId)
  -> AgentSessionProjector.replay(events)
  -> live session hydrate
```

## 核心 owner

### `AgentSessionProjector`

职责：

- 将 `NcpEndpointEvent` 投影为 `NcpAgentConversationSnapshot`。
- 支持 live apply 和 replay apply 两种入口，但共享同一套投影规则。
- 负责处理半截 text delta、tool args delta、tool result、run started / finished / error / abort。

不负责：

- 不写磁盘。
- 不管理 HTTP API。
- 不决定具体存储后端。

当前 `DefaultNcpAgentConversationStateManager` 已经承担了大量投影职责。后续实现时优先评估：是将它演进为 projector owner，还是提取一个可 replay 的 `AgentSessionProjector` 包住它。不能再新增一套平行 message reducer。

### `SessionJournalWriter`

职责：

- 接收已经规范化的 durable session events。
- 维护 per-session 写入顺序。
- 使用 bounded queue 与异步 flush。
- 对 writer backlog、写入失败、重试、fatal failure 提供可观测状态。
- 在必要时对 agent run 反压，而不是阻塞全局 server。

不负责：

- 不解析业务事件含义。
- 不生成 UI view model。
- 不直接被 controller 调用来拼响应。

### `DurableSessionJournalStore`

职责：

- 提供 append-only journal 存储接口。
- 第一版默认文件实现：每个 session 一个 `.journal.jsonl` 或按日期/分片组织。
- 保证单 session event 顺序、record 校验、损坏尾部恢复策略。

建议接口：

```ts
export type SessionJournalAppendBatch = {
  sessionId: string;
  events: SessionJournalEvent[];
};

export interface DurableSessionJournalStore {
  append(batch: SessionJournalAppendBatch): Promise<void>;
  read(sessionId: string, options?: { afterSeq?: number }): AsyncIterable<SessionJournalEvent>;
  delete(sessionId: string): Promise<void>;
}
```

### `SessionSummaryIndexStore`

职责：

- 保存 session 列表需要的轻量读模型。
- 字段包括 `sessionId`、`agentId`、`status`、`messageCount`、`lastMessageAt`、`updatedAt`、`label`、`projectRoot`、`runtime/sessionType`、最近 run 状态摘要。
- 列表接口只读它，不 replay 完整 journal。

不负责：

- 不作为 conversation 事实源。
- 不保存完整 messages。

### `SessionSnapshotStore`

职责：

- 低频保存可选 checkpoint，加速 inactive session 详情读取和重启恢复。
- snapshot 是优化，不是事实源。journal 永远可以 replay 出等价状态。

第一版可以先不实现独立 snapshot store，只保留接口缝；当 journal replay 成本真实变高后再加。

### `SessionArtifactStore`

职责：

- 存储大工具结果、图片、文件片段、大 JSON 或 stdout/stderr 大块内容。
- journal event 只保存 `artifactUri`、`mimeType`、`size`、`sha256`、`preview`。

这能避免一次 MCP 工具返回大 payload 时把 session 主日志和模型上下文一起打爆。

## Journal 事件模型

Journal event 应该表达语义增量，而不是保存 UI patch。

```ts
export type SessionJournalEvent = {
  version: 1;
  sessionId: string;
  seq: number;
  eventId: string;
  occurredAt: string;
  kind:
    | "message.sent"
    | "assistant.text.delta"
    | "assistant.text.end"
    | "assistant.reasoning.delta"
    | "tool.call.started"
    | "tool.call.args.delta"
    | "tool.call.ended"
    | "tool.result.delta"
    | "tool.result.completed"
    | "run.started"
    | "run.finished"
    | "run.error"
    | "run.aborted"
    | "session.metadata.updated";
  runId?: string;
  messageId?: string;
  toolCallId?: string;
  payload: Record<string, unknown>;
};
```

规则：

- `seq` 由 journal owner 按 session 分配，不能由 UI 或 runtime 外层临时生成。
- `eventId` 用于幂等和损坏恢复。
- `payload` 必须是协议事实，不放展示态字段。
- 大 payload 必须先 asset 化，再写引用。

## 写入模型

### 普通事件

1. runtime 产生 NCP event。
2. projector 更新 live snapshot。
3. backend 发布实时事件。
4. `SessionJournalWriter.enqueue()` 接收 durable event。
5. writer 后台 append journal，并更新 summary index。

### 需要 durable ack 的事件

用户消息、session 创建、metadata patch 等操作可以要求 durable ack：

```text
create session
  -> append message.sent / session.metadata.updated
  -> wait writer ack
  -> return materialized session id
```

这样能保证“用户刚发出的消息”不会因为立刻崩溃丢失。后续 text delta / tool delta 可由后台 writer 持续推进。

### Backpressure

writer queue 必须有上限。达到上限时：

- 当前 agent run 暂停继续消费模型/tool stream，等待 writer 追上。
- 普通 API 不等待这个 queue。
- UI 可以显示 runtime persistence degraded / catching up 状态。

禁止：

- 无界内存队列。
- 丢弃已对 UI 可见的 durable event。
- 在 HTTP 全局中间件或 controller 中同步等待 writer 清空。

## 读取模型

### 列表

`GET /api/ncp/sessions`：

- 只读 `SessionSummaryIndexStore`。
- 支持 limit / cursor。
- 不读取完整 journal。
- 不构建完整 `NcpMessage[]`。

### Active session 详情

`GET /api/ncp/sessions/:id/messages`：

- 如果 session live，优先读 `AgentLiveSessionRegistry` snapshot。
- 如有 writer lag，可在响应 metadata 里暴露 `durableSeq` / `liveSeq`，用于诊断。

### Inactive session 详情

- 优先读 snapshot。
- snapshot 不存在或落后时，replay journal。
- replay 后可异步补 snapshot。

### 重启恢复

启动时不需要立即 replay 所有 session：

1. 加载 summary index。
2. 对上次 `status=running` 或 `run.started` 未闭合的 session 做优先 replay。
3. 这些 session 恢复成 `interrupted` 或 `recovering` 状态，保留半截 assistant/tool message。
4. 用户打开某个历史 session 时再 lazy replay。

## 与现有代码的落点

### 目录组织与命名落点

本方案后续实现必须遵守当前仓库目录治理规则：

- `root 保边界，角色文件回角色目录`。
- 文件先按角色建模，再按领域命名；领域词放在 basename，角色放在后缀。
- 不新增 `journal/`、`persistence/`、`runtime-state/` 这类白名单外兜底目录，除非先完成目录结构 protocol 变更。
- 不新增只做转发的 `index.ts`；只有 package / feature 公共边界才保留 barrel。
- `.service.ts` 内部必须是 class owner；纯类型、纯映射、纯解析、事件转换、record normalizer 进入 `types/` 或 `utils/`。
- `stores/` 承担本地持久状态、路径布局和存储驱动状态切换；`services/` 承担生命周期、异步写入、恢复编排；`utils/` 承担无状态转换。

#### `@nextclaw/ncp-toolkit` 落点

`packages/ncp-packages/nextclaw-ncp-toolkit` 当前 contract 标记为 `app-l1`，但实际已有 `src/agent/agent-backend/` 作为 NCP agent backend 的历史 scope root。后续改造应优先在这个既有 scope root 内收敛，不新增平行业务根。

建议：

```text
src/agent/agent-backend/
├── agent-backend.ts
├── agent-backend-types.ts
├── agent-session-projector.service.ts
├── session-journal-writer.service.ts
├── in-memory-session-journal.store.ts
├── in-memory-session-summary-index.store.ts
├── session-journal.types.ts
├── session-summary-index.types.ts
└── session-journal-event.utils.ts
```

说明：

- `AgentSessionProjector` 如果是 class owner，使用 `agent-session-projector.service.ts`；如果最终只是对现有 state manager 的纯转换函数，则不得命名为 service，应放入 `*.utils.ts`。
- `SessionJournalWriter` 是异步写入生命周期 owner，应为 class service。
- in-memory 实现属于 store 角色，但当前 `agent-backend/` 没有 `stores/` 子目录。为避免一次重构扩大 blast radius，第一步可沿用现有平铺风格并使用 `.store.ts` 后缀；若触发目录治理，再统一把 `agent-backend/` 升级为角色目录结构。
- 类型文件使用 `.types.ts`，事件映射和 payload 归一化使用 `.utils.ts`。
- 不新增 `src/agent/journal/` 或 `src/agent/persistence/`。

#### `@nextclaw/kernel` 落点

`packages/nextclaw-kernel` 是带白名单的 `app-l1`，允许 `services/`、`stores/`、`types/`、`utils/`、`features/` 等根目录。

建议：

```text
src/services/
├── ncp-session-persistence-runtime.service.ts
├── ncp-session-recovery.service.ts
└── ncp-session-api.service.ts

src/stores/
├── file-session-journal.store.ts
├── file-session-summary-index.store.ts
└── file-session-snapshot.store.ts

src/utils/
└── ncp-session-journal-path.utils.ts

src/types/
└── ncp-session-persistence.types.ts
```

说明：

- 文件系统 journal / summary / snapshot owner 属于 `stores/`，不应放入 `features/native-runtime/`。
- 装配 owner 放在 `services/`，由 kernel constructor / lifecycle 方法持有。
- 路径解析、文件名安全、journal line 编码解码若无状态，放 `utils/`。
- 不把 `SessionManager`、`EventBus`、`ConfigManager` 拆成小参数到处传；由组合 service 持有必要 owner。

#### `@nextclaw/core` 落点

`packages/nextclaw-core` 是 `app-l2`，session 基础能力已在 `src/features/session/` 下。若 journal index 要与 legacy session store 共存或迁移，应放到该 feature root 内。

建议：

```text
src/features/session/stores/
├── session.store.ts
├── session-list-index.store.ts
└── legacy-session-export.store.ts

src/features/session/utils/
└── session-legacy-journal-migration.utils.ts
```

说明：

- core 只承接 legacy session 基础 store / migration 能力，不承接 NCP runtime journal 主流程。
- NCP 专属的 event kind、run 状态恢复、tool call 恢复不应进入 core session feature，避免 core 被 agent runtime 语义污染。

#### `@nextclaw/server` 落点

`packages/nextclaw-server` 是 `app-l2`，sessions feature 已有 `controllers/`、`services/`、`types/`、`utils/`。

建议：

```text
src/features/sessions/controllers/sessions.controller.ts
src/features/sessions/services/session-skills-view.service.ts
src/features/sessions/types/chat-session-type.types.ts
src/features/sessions/utils/session-list-metadata.utils.ts
```

说明：

- server 只消费 `NcpSessionApi`，不新增 journal store。
- 如果需要展示 persistence/recovery 状态，只扩展 session API view type 和 controller response。
- 不在 server feature 内实现 replay、writer 或文件 IO。

#### 跨包导入边界

- `@nextclaw/server`、`@nextclaw-ui` 等消费者只能通过 package 公共入口导入 toolkit / kernel / core 能力。
- 禁止从另一个 workspace deep import `src/agent/agent-backend/*`、`src/services/*` 等内部路径。
- 可复用 package 不使用泛化 `@/` alias；`nextclaw-kernel` 继续使用 `@kernel/*`，`nextclaw-core` 继续使用 `@core/*`，`nextclaw-server` 继续使用 `@nextclaw-server/*`。

### `@nextclaw/ncp-toolkit`

建议承担通用 backend 层抽象：

- `AgentSessionProjector`
- `SessionJournalWriter`
- `DurableSessionJournalStore` interface
- `SessionSummaryIndexStore` interface
- `SessionSnapshotStore` interface
- in-memory test implementations

`DefaultNcpAgentBackend` 负责 run 编排、事件发布和调用 writer，但不关心文件路径。

### `@nextclaw/kernel`

建议承担 NextClaw 默认持久化装配：

- 文件版 `DurableSessionJournalStore`
- 文件版或 SQLite 版 `SessionSummaryIndexStore`
- `SessionArtifactStore` 与现有 asset store 的集成
- legacy session store migration / read adapter

`NcpAgentSessionStoreAdapter` 不应该长期继续作为“每个事件全量 snapshot rewrite”的核心路径。它可以在迁移期作为 legacy adapter，但必须有删除点。

### `@nextclaw/server`

server controller 只消费 `NcpSessionApi`，不理解 journal。

### `@nextclaw/ui`

UI 只消费：

- session list summary
- session messages
- realtime events
- persistence/recovery 状态提示

UI 不做 journal replay，也不拼 durable 状态。

## 可插拔边界

存储可插拔只发生在持久化 owner 层：

```ts
export type SessionPersistenceRuntime = {
  journalStore: DurableSessionJournalStore;
  summaryIndexStore: SessionSummaryIndexStore;
  snapshotStore?: SessionSnapshotStore;
  artifactStore: SessionArtifactStore;
};
```

不把 `SessionManager`、`EventBus`、`ConfigManager`、`runtimeRegistry` 等上层对象作为碎片参数到处传。组合 owner 在 constructor 建立对象图，`start/reload/dispose` 负责副作用和恢复。

## 迁移策略

### Phase 1：并行写入

- 保留现有 session store 读写 contract。
- 新增 journal writer，对 NCP runtime session 同步写 journal。
- 测试 journal replay 是否能恢复 live snapshot。
- 列表仍可读旧 index。

### Phase 2：列表切 summary index

- session list 改读 `SessionSummaryIndexStore`。
- 旧 `.jsonl` session 首次访问或后台任务懒回填 summary。
- 验证大量 session 下列表接口不扫描完整 transcript。

### Phase 3：详情读 journal/snapshot

- inactive session 详情从 journal replay 或 snapshot 读取。
- active session 继续读 live registry。
- legacy snapshot rewrite 降级为迁移兼容路径。

### Phase 4：移除 legacy 全量 rewrite 主路径

- 删除 `NcpAgentSessionStoreAdapter` 中运行时事件全量 clear/append/save 的主路径。
- 只保留明确 migration / export / compatibility 入口。

## 失败与恢复语义

### Writer 写入失败

- writer 保留内存 pending batch 并重试。
- 多次失败后标记 persistence degraded。
- agent run 可以被反压或中止，但普通 API 继续可用。
- UI 显示“运行仍在继续，但持久化滞后/失败”。

### Journal 尾部损坏

- 按行 JSONL 解析。
- 最后一行损坏时截断到最后一个完整 event。
- 如果中间行损坏，标记 session corrupted，停止 replay 并暴露诊断。

### Summary index 损坏

- index 可由 journal 重建。
- 启动时发现 index 不可信，先降级列表，后台重建。

## 验收标准

- 工具执行期间 `/api/health` 和 `/api/config` 不等待工具结束。
- 工具执行期间 session list 不读取完整 transcript。
- 模型输出 text delta 到一半后 kill service，重启后能看到半截 assistant message。
- tool call args 到一半后 kill service，重启后能看到 partial tool call。
- tool result 大 payload 不进入 journal 主文件，只留下 artifact 引用。
- journal replay 与 live projector 对同一事件序列产生等价 snapshot。
- writer backlog 只反压对应 agent run，不拖死全局 server。

## 测试策略

- 单元测试：projector replay、delta 合并、run interrupted 状态、tool result artifact 引用。
- store contract 测试：append 顺序、seq 幂等、尾部损坏恢复、delete、read after seq。
- writer 测试：bounded queue、flush ack、失败重试、per-session 顺序。
- API 测试：session list 只读 summary index；active details 读 live snapshot；inactive details replay journal。
- 恢复测试：启动时恢复未闭合 run，并把状态标记为 interrupted。
- 性能测试：构造大量 delta 和大工具结果，验证普通 API 延迟不随 journal 文件大小线性退化。

## 不推荐方案

### 只在 run finished 落盘

会丢失半截消息，不满足自主重启和长期自治目标。

### 单纯 debounce snapshot save

debounce 只能降低写入频率，不能解决全量 rewrite、主线程同步 IO、半截 durable 保证和大 payload 污染问题。

### 把工具丢到 worker 就结束

worker 可以隔离 CPU/进程执行，但如果工具事件仍回到主线程做同步全量 session save，普通 API 还是会卡。

### UI 自己保存半截消息

这会把持久化事实分裂到前端，破坏统一入口和多渠道一致性。渠道、CLI、桌面、Web 都必须走同一后端 session journal。

## 结论

NextClaw 应该采用 session journal-first 架构：

- live session 负责当前交互真相；
- journal 负责 durable 半截状态；
- projector 负责从事件恢复 conversation；
- summary index 负责列表读模型；
- snapshot 只作为恢复加速；
- artifact store 负责大 payload；
- writer 负责异步、顺序、反压和可观测。

这不是为当前慢接口打补丁，而是把 agent 运行时从“同步全量保存聊天记录”的模型升级成“可恢复、可 replay、可扩展的运行时日志系统”。这个方向同时服务性能、自治重启、故障诊断和未来多 runtime / 多渠道扩展。

## 2026-05-14 第一版落地记录

本方案第一版已按“先切断阻塞主因，再保留可扩展 owner”的方式落地：

- `@nextclaw/ncp-toolkit` 的 `AgentSessionStore` 增加 append-only 事件持久化扩展点；`DefaultNcpAgentBackend` 在 store 支持该扩展点时，不再对每个 runtime event 执行全量 `saveSession`。
- append-only 扩展点的主路径只接收 `AgentSessionEventRecord`，不再接收完整 `messages` snapshot；完整 snapshot 构造只保留给 legacy `saveSession` / `replaceSession` 兼容路径。
- `@nextclaw/kernel` 新增 `NcpAgentSessionJournalStore`，用异步 JSONL append 保存 NCP endpoint events，并维护 session summary index。
- `NcpAgentSessionStoreAdapter` 变成 legacy session store 与 NCP journal 的桥接 owner：NCP journal 存在时优先读 journal，legacy store 只作为历史兼容路径。
- `NcpSessionApiService` 优先从 NCP store 读取消息和详情，避免刷新页面时回到 legacy full transcript 路径。
- 定向测试覆盖：
  - append-only store 下 backend 不再执行 per-event `saveSession`；
  - append-only store 下 backend 不再向 append contract 传递完整 `messages`；
  - journal 重载后可以 replay 半截 streaming assistant message；
  - UI session API 在 legacy shell session 同时存在时优先读取 NCP journal。

第一版暂未包含的增强项：

- 大 tool result payload artifact 化；
- writer queue 的显式 backlog 指标与重试状态；
- journal 尾部损坏自动截断；
- 未闭合 run 启动恢复时显式标记 `interrupted`。
- `@nextclaw/ncp-toolkit` 仍处在用户明确授权的 module-structure 豁免状态；后续应将 toolkit / library 类 package 迁入正式 `lib` 类型目录协议，再移除豁免。

这些增强不影响本次核心问题的修复：工具执行期间高频事件不再触发同步全量 session rewrite，同时半截消息已经进入可 replay 的 journal。
