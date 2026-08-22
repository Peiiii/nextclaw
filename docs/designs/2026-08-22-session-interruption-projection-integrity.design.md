# 会话中断恢复与消息投影完整性设计

## 1. 状态

- 日期：2026-08-22
- 状态：Design Ready
- 2026-08-23 范围修正：用户明确要求同一 `NEXTCLAW_HOME` 下的多个 runtime（包括同一会话）不能因 journal writer ownership 被阻止。本批次撤销目录级 writer lease 与启动 fail-fast；下文 8.1/8.2 的单写者方案不再是实现合同，保留 replay、projection 和历史视图修复。
- 风险：L3，涉及 NCP 会话事实写入、进程启动恢复、消息投影、上下文压缩时间线和首屏分页
- 事故会话：`ncp-mt4g15ql-djd2ohpr`
- 事实源：`$NEXTCLAW_HOME/sessions/.ncp-agent-journal/<session-id>.jsonl`
- 主要 owner：`NcpAgentSessionJournalStore`、`SessionEventIngestionService`、消息 projection persistence、context compaction recovery、session history API view
- 关联设计：
  - [会话消息分页与动态高度虚拟时间线设计](./2026-07-18-chat-message-virtual-timeline.design.md)
  - [聊天会话历史读取链路优化设计](./2026-08-13-chat-session-history-read-path-optimization.design.md)
  - [SSE 恢复与会话 Journal 内存治理设计](./2026-08-11-sse-recovery-and-journal-memory.design.md)
  - [会话消息投影写入失败恢复设计](./2026-08-22-session-message-projection-write-recovery.design.md)
  - [Codex 对齐的上下文压缩设计](./2026-08-08-codex-aligned-context-compaction.design.md)

本文是可直接交给实现 AI 的冻结设计。实现必须先添加稳定复现测试，再修改生产逻辑；不得根据表面 UI 现象直接删除启动恢复、上下文压缩或分页性能优化。

## 2. 执行摘要

本次事故不是用户打开同一会话页面导致写入，也不是 JSONL 中的历史被物理删除。真实链路是：

1. 第二个 NextClaw 后端与原后端共享同一个 `NEXTCLAW_HOME`。
2. 第二个后端启动时无条件扫描 unfinished run，把原后端仍在执行的 run 写成 `run.error`。
3. 原后端随后继续写入工具事件，两个进程对同一 journal 形成多写者，并实际产生重复 `seq`。
4. 增量消息投影在 `run.error` 后没有把原 assistant 终态消息作为 replay seed；看到同一 message ID 的晚到 streaming 事件时，把它 bootstrap 成一条新的空 streaming 消息。
5. projection 的 offset 索引随后指向这条只有少量 parts 的新快照，原先包含完整 parts 的 error 快照仍在 `messages.jsonl` 中，但正常分页已经读不到。
6. 首屏 24 KiB 紧凑预算又把包含完整压缩摘要的 service marker 当作普通消息计费，并让 service marker 占用最少 5 条消息名额，最终放大为“只剩两条压缩提示、其它消息消失”。

原始方案曾推荐四个相互独立但必须一起交付的保护组成；其中目录级单写者租约已被用户约束否决：

1. **已撤销：journal 目录进程级单写者租约**。它会把 runtime 级资源误判成会话级资源，导致新会话也无法发送。
2. **增量 replay 边界收紧**：projection tail replay 禁止仅凭未知 message ID 的 delta/tool 事件 bootstrap 新 assistant；只有 full replay 的 legacy 兼容路径允许该救援。权威终态不可被晚到 streaming 事件重新打开；被后续同 run/message 事件明确证伪的 synthetic interrupted terminal 则在历史 full rebuild 中跳过。
3. **旧 projection 惰性修复**：提升 projection version，使可能已被旧语义污染的 projection 在该 session 第一次访问时从 journal 重建；不得在进程启动时批量重建全部历史。
4. **压缩 marker 与 UI payload 收口**：compaction recovery 按 continuation 生命周期而非偶然事件顺序判断；session history API 不下发模型专用的完整 checkpoint summary，并保证首屏最少窗口按 user/assistant 对话锚点计算。

本次修正不新增每个 runtime、每个 run 或每个 session 的锁；避免把用户明确拒绝的限制换成另一种隐式阻断。

## 3. 用户语义与成功标准

用户的合理预期是：

- 只打开同一会话页面是读取行为，不能修改会话事实。
- 第二个后端即使被启动，只要没有获得同一数据目录的写权限，就不能替另一个活着的后端判定 run 已中断。
- 原实例真的死亡时，启动恢复仍要把 unfinished run 收敛为明确终态，不能为了修复误判而删除恢复能力。
- 即使发生错误恢复或晚到事件，已有消息正文和工具 parts 也不能从正常读取路径消失。
- JSONL 是事实源，projection 损坏必须能自动重建；用户不应手工编辑 journal。
- 已有分页和长会话性能优化继续生效，正常首屏不能退回全量 journal replay。

完成标准：

1. 两个进程指向同一 journal 目录时，至多一个进程能进入可写 kernel 生命周期。
2. 活跃 owner 存在时，第二进程不会追加 `run.error`、compaction marker、summary 或任何 session event。
3. owner 异常退出后，新实例只追加一次 interrupted `run.error`，保留此前全部消息内容。
4. 对合法事件流，`完整 journal replay` 与 `稳定 projection + 任意合法边界后的 tail replay` 产出相同的消息状态和 parts。
5. 权威 terminal assistant 后的晚到 streaming/tool 事件不能把该 message ID 重新变成 streaming，也不能用更短快照覆盖 offset 指向。
6. 历史 journal 中若 `run.error(interrupted=true)` 后仍有同 run/message 的明确 continuation，v7 full rebuild 必须保留后续真实内容，不能让误恢复终态截断它。
7. 旧 projection 第一次访问可恢复，第二次访问回到 projection 随机分页，不重复全量重建。
8. compaction summary 不进入 UI history payload；首屏至少包含近期 user/assistant 对话锚点，service marker 不能单独满足最少消息数。
9. 性能门槛和真实隔离复现全部通过后，才能声明修复完成。

## 4. 事故证据

### 4.1 页面和 API 现象

事故发生时，同一会话的首屏消息 API 返回 `total=13`、当前页 5 条、`hasPreviousPage=true`。当前页主要包含：

- 前一条 assistant final；
- 当前 user；
- 同一 target assistant 的 streaming 快照，但只有 2 个 parts；
- “较早上下文已自动压缩”；
- “正在压缩较早上下文”。

使用 previous cursor 能读到更早的 8 条逻辑消息，证明历史分页仍存在。浏览器页面没有 console error；页面底部显示“停止”，说明 UI 只是忠实渲染了错误的 server projection/status。

### 4.2 时间线

以下时间使用 Asia/Shanghai：

| 时间 | 事实 |
| --- | --- |
| 22:54:02 | 原后端开始 run `agent-run-bfeee07c-...` |
| 23:03:40 | 第一次 mid-run compaction 写入 `compressing` marker |
| 23:04:36 | 第一次 compaction 完成，92 条 session messages 从约 616,115 tokens 压到约 43,012 tokens |
| 23:15:24 | 第二个 `dev-runner` 启动，未显式设置 `NEXTCLAW_HOME`，因此默认使用同一个 `~/.nextclaw` |
| 23:15:28 | 第二后端的启动恢复生成 interrupted `run.error` |
| 23:15:41—23:15:52 | 原后端仍继续写入同一 assistant 的 tool start/result 等事件 |
| 23:15:50—23:15:51 | journal 出现两个 `seq=17205`：一个是 `run.error`，另一个是 tool result |
| 23:15:52 | 原后端继续写入同 checkpoint 的下一条 compaction marker |

`scripts/dev/dev-runner.mjs` 当前在没有显式环境变量时把 `NEXTCLAW_HOME` 默认到 `~/.nextclaw`。第二个后端虽检测到 remote ownership 冲突，但该冲突只关闭 remote ownership，没有阻止 kernel 初始化和 session recovery。

### 4.3 事实没有被删除，但 projection 指针被替换

事故后 projection 的 append-only `messages.jsonl` 中，同一 assistant message ID 至少保留了以下快照：

| 顺序 | status | parts | 含义 |
| ---: | --- | ---: | --- |
| 早期 | `streaming` | 15 | run 仍在执行 |
| `run.error` 后 | `error` | 87 | 含此前完整文本和工具 parts |
| 晚到事件后 | `streaming` | 2 | 错误 bootstrap 出的新不完整快照 |

projection 的 `offsets.idx` 对每个逻辑 message ordinal 只保留一个最新位置。晚到事件同步后，该 ordinal 被改指向 2-part streaming 快照，因此 87-part error 快照虽仍有物理字节，普通 API 已不可达。这就是“消息仍在，但读不到”的直接原因。

后续原后端继续运行又生成了更多快照，不影响上述事故证据。真实会话仍在变化，不能把当前现场文件直接当成稳定测试夹具，也不能在修复测试中写入它。

## 5. 根因分层

### 5.1 触发根因：共享数据目录存在两个完整写者

`SessionEventIngestionService.start()` 会订阅 runtime event，并遍历 `listUnfinishedRuns()`。对每个 unfinished run，它立即 ingest 一条 interrupted `RunError`。当前没有“本实例是否拥有该 journal 的恢复权”前置条件。

所以用户没有操作第二个会话、甚至不打开页面，也不影响问题发生。写入来自第二个 backend startup，不来自 GET 页面。

### 5.2 生命周期根因：把“本进程没看到终态”误当成“原 runtime 已死亡”

unfinished journal 只能说明事实源里尚无 terminal event，不能单独证明原 producer 已死亡。只有获得该 journal 目录唯一写权限的新 runtime，才有资格把它解释为“上一 runtime 已中断”。

### 5.3 投影根因：增量 replay 把“不在 seed”误当成“从未存在”

`readJournalTailMessages()` 当前只 seed：

- `meta.activeMessageId`；
- `meta.pendingCompactionMessageIds`。

`run.error` 之后，assistant 已是 terminal，`activeMessageId` 变成 `null`。随后 tail 中出现同一 ID 的 `message.tool-call-*` streaming 事件时，`createReplayStreamingBootstrapEvent()` 发现 ID 不在 `knownMessageIds`，便合成空的 `MessageSent(streaming)`。

这里混淆了两个状态：

- message ID 真的是旧 journal/legacy 数据中缺失的未知消息；
- message ID 已经存在于稳定 projection，只是不属于 active/pending seed。

增量 replay 因此不再等价于完整 replay。

### 5.4 压缩恢复放大：恢复逻辑依赖事件先后顺序

`ContextCompactionJournalRecoveryService` 当前只在“先看到 pending marker、后看到 run terminal”时终态化 marker。如果 terminal 先出现、同 continuation 的 `compressing` marker 后出现，它不会利用 continuation lifecycle 判断，可能暂时投影为仍在压缩。

### 5.5 首屏放大：模型摘要进入 UI 消息预算

session history compact view 默认预算为 24 KiB、最少 5 条消息。完整 checkpoint summary 位于 service message metadata 中，UI parser 虽要求该字段存在，却没有展示其正文。该模型上下文数据仍参与序列化字节预算；同时 service marker 也计入最少 5 条消息。

因此两个 marker 加一个错误 streaming assistant 足以挤掉近期对话锚点，形成“消息全没了，只剩压缩提示”的视觉结果。

## 6. 必须保持的不变量

1. JSONL journal 是唯一会话事实源，append-only；projection 是可删除、可重建的派生读模型。
2. 页面 GET、SSE 订阅和 history pagination 本身是只读操作，不得触发 run recovery。
3. 同一 journal 目录下的 runtime 不因目录级 ownership 被阻止启动；共享写入异常不得升级成整个 kernel 不可用。
4. unfinished-run recovery 不能仅凭 journal 缺少 terminal event 就把其它活跃 runtime 的 run 判定为中断；真正中断的 run 仍要收敛为明确终态。
5. 权威 terminal 状态对 streaming delta 是吸收态：`final`、非恢复型 `error`、`cancelled/aborted` 不能被晚到 delta 重新打开。`run.error(interrupted=true)` 是启动恢复派生终态；只有 full replay 发现它在 append order 上被同 run/message continuation 明确证伪时才可忽略。
6. projection 更新同一 message ID 时只能保留或增加已确认内容，不能因不完整救援快照丢失已确认 parts。
7. 对合法事件流，full replay 与 incremental replay 必须同构。
8. compaction 的模型摘要继续保存在 journal/checkpoint，并继续供 model input 使用；UI payload 省略它不改变模型上下文。
9. 不删除启动检查、unfinished-run scan、context compaction、cursor pagination、tool payload defer 或 projection 随机读取。
10. 正常读写性能不依赖完整 journal 大小；只有 projection 缺失、版本过旧或损坏时允许一次惰性重建。

## 7. 方案比较

### 7.1 只给 unfinished run 增加短延迟

延迟几秒不能证明另一个 runtime 已死亡，也无法阻止两个进程继续追加其它事件或生成重复 seq。

结论：不采用。

### 7.2 每个 run 增加 heartbeat/lease

它可以表达 run producer liveness，但会新增周期写入、过期时间、休眠/唤醒、时钟漂移和每个 runtime adapter 的续租责任。当前根因首先是整个 journal 目录存在两个写者；按 run 建租约比问题边界更细、更复杂。

结论：本批不采用。只有未来明确需要多个写者并发服务同一 home 时再设计。

### 7.3 允许第二 backend 进入隐式只读模式

完整 backend 包含 automation、session metadata、projection、extension 和其它持久 owner。只屏蔽 session recovery 不能证明它整体只读；真正的只读 secondary kernel 需要独立 capability contract 和 UI 状态，不应在故障修复中临时拼装。

结论：本批不采用。冲突实例 fail-fast，并指向现有 owner 或隔离 `NEXTCLAW_HOME`。

### 7.4 每次 append 获取跨进程文件锁

它只能串行文件写入，不能阻止第二进程基于错误生命周期判断合法地写入 `run.error`。两个 producer 即使轮流写，也仍会生成矛盾事实。

结论：不充分。

### 7.5 replay/视图修复，不以启动锁牺牲可用性

原方案曾建议用 journal 目录生命周期单写者直接关闭多写者触发条件；用户验证后明确否决：共享目录中的另一个 runtime，尤其是新会话，不能因为已有 runtime 或同一会话而被整个阻断。因此本批不再新增 runtime、run 或 session 级 writer lease。

保留 replay、projection 和 API 视图层的完整性修复；若共享写入出现异常，必须沿局部写入失败、重建或降级路径处理，不能把持久化竞争升级成 kernel 启动失败或聊天不可用。

结论：采用 replay/视图修复；不采用目录级单写者限制。

## 8. 推荐设计

### 8.1 已撤销：journal writer lease

本节保留原始方案作为决策记录，不再是实现合同。`$NEXTCLAW_HOME/sessions/.ncp-agent-journal/.writer.lock`、legacy-owner guard、writer conflict fail-fast 和 stale lease 接管均已撤销；不得通过另一个 runtime 锁、session 锁或隐式只读模式替代它们。

原因是 journal 目录是共享持久化资源，不等于某个会话的独占资源。目录级 ownership 会让一个无关的新会话也无法发送消息，违反可用性优先约束。

### 8.2 启动与退出顺序（修正后）

修正后的启动顺序：

```text
resolve NEXTCLAW_HOME / journal path
  -> initialize writable kernel managers
  -> subscribe runtime events
  -> scan unfinished runs
  -> append interrupted terminal events when needed
  -> publish readiness
```

关键约束：

- 不存在 writer lease 获取失败这一条启动阻断路径；同一 `NEXTCLAW_HOME` 下的多个 runtime 可以初始化并发送新会话消息。
- 任何 journal/projection 写入异常都必须局部处理，不能让无关会话或整个 backend 因持久化竞争而不可用。
- 不自动终止、重启或抢占其它活跃 runtime；也不新增 session 级硬锁。
- 保留 unfinished-run scan，但不能仅凭“journal 没有 terminal event”把其它活跃 runtime 的 run 判定为中断。

### 8.3 增量 projection replay

`replayNcpAgentSessionEvents` 需要显式区分两个入口：

- `full/legacy replay`：从 journal 起点重放；可保留未知 streaming ID bootstrap，兼容旧 journal 缺少初始 `MessageSent` 的历史救援语义。
- `projection tail replay`：从一个已提交 projection boundary 后重放；禁止未知 streaming ID bootstrap。

tail replay 的合法 message 来源只有两类：

1. boundary 时仍 active 的 assistant，由 `meta.activeMessageId` 对应 snapshot seed；
2. tail 内先出现明确 `MessageSent` 的新 message，随后 delta 自然更新它。

为保持既有 legacy journal 的可读性，再保留一个受限兼容窗口：若 tail 内先出现
`RunStarted`，但历史 producer 没有写入 `MessageSent`，则在该 run 尚未观察到
`RunFinished`/`RunError`/`MessageAbort` 前允许 conversation state manager 接收未知
streaming 事件；这个窗口不创建 projection bootstrap snapshot，且一旦观察到 terminal
就关闭。这样不会恢复事故中的 terminal-after-tool late event，也不会破坏旧 journal
中“RunStarted 后直接 text/tool stream”的既有语义。

除上述兼容窗口外，如果 tail streaming/tool event 引用的 ID 既不在 seed，也没有在 tail 内被明确声明，则它是晚到、乱序或损坏事件。它可以保留在 journal 供诊断，但不能凭空创建新 streaming message，也不能覆盖稳定 ordinal。

replay 还必须维护 authoritative terminal message ID 集合：

- seed 中 status 为 `final`/`error` 的 assistant 进入 terminal set；
- `RunFinished`、非恢复型 `RunError`、`MessageAbort` 使对应 message ID 进入 terminal set；
- 后续 text/reasoning/tool streaming 事件命中 terminal set 时不改变 conversation state；
- 明确、完整的新 `MessageSent` 只有使用新的 message ID 才能开始新生命周期；同 ID 不允许从 terminal 回到 streaming。

#### 历史 synthetic interruption 对账

事故 journal 已经包含一个错误的 `RunError(interrupted=true)`，而原 producer 后来继续写入同一 run/message 并最终产生更多完整内容。若 v7 full rebuild 无条件吸收该终态，会把现有可恢复内容再次截断。因此 full replay 在 dispatch 前需要做一次有界的事件对账：

1. 仅把 `interrupted === true` 的 `RunError` 识别为 synthetic recovery terminal；普通 provider/runtime error 不参与该 fallback。
2. 按 journal append order 查找其后的明确 continuation 证据，不按 `occurredAt` 排序；跨进程事件的发生时间和落盘时间在事故中已经交错。
3. continuation 证据必须能归属到同一 `messageId` 或 `runId`，包括 text/reasoning/tool start/args/execution、message completion/run completion；只有 `toolCallId` 的 result 必须先通过此前 tool start 建立 `toolCallId -> messageId` 归属，不能凭任意 result 猜测。
4. 找到证据时，full replay 跳过该 synthetic `RunError` 的状态投影，但不删除或改写 journal；随后事件继续从 terminal 前状态正常 replay。
5. 没有后续 continuation 证据时，该 interrupted error 仍是有效终态，保持现有真实崩溃恢复语义。
6. 该对账只用于 full rebuild/完整 recovery。新版本取得单写者 lease 后，合法 incremental tail 不应再产生“恢复终态后原 producer 继续写”的矛盾流。

实现优先在 journal replay normalization 中完成该判断，不把“interrupted 可重开”扩散到通用 conversation state manager。这样普通 terminal 仍严格吸收，兼容逻辑也只服务已存在的多写者污染数据。

不要在 projection persistence 里手写 parts merge。消息状态与 parts 仍由 `DefaultNcpAgentConversationStateManager` 唯一投影；persistence 只选择 replay mode 和 seed。

### 8.4 等价性合同

实现测试必须固定以下公式，而不是只测一个事故样例：

```text
fullReplay(allEvents)
===
incrementalReplay(
  projection = fullReplay(eventsBeforeBoundary),
  tail = eventsAfterBoundary
)
```

比较内容至少包含：

- message IDs 与顺序；
- role/status；
- parts 数量和每个 part 的稳定内容；
- tool call state/result；
- compaction marker status/placement；
- active message；
- cursor total/pageInfo。

合法边界要覆盖：message start 后、多个 delta 中间、tool args 中间、tool result 前后、run terminal 前后、compaction marker 前后。普通非法晚到事件场景单独断言“journal 保留、projection 忽略，不重新打开权威终态”。

被 foreign recovery 污染的历史流不属于合法增量流，不要求任意 prefix/tail boundary 都可在不知道未来的前提下撤销 synthetic terminal；它由 v7 的一次 full rebuild 对账。对应测试必须证明 full rebuild 产出后续完整 final，而不是停在错误 recovery 的 error 快照。

### 8.5 projection v7 与既有数据自愈

旧 v6 projection 可能已经把 ordinal 指向终态后的不完整 streaming 快照，单看当前 meta/data 长度仍是结构有效，无法用普通完整性校验识别。

因此把 `NCP_AGENT_SESSION_MESSAGE_PROJECTION_VERSION` 从 6 提升到 7。v7 的语义差异是“incremental tail 不 bootstrap 未知 streaming message、权威 terminal 不可重开、full rebuild 会跳过被后续 continuation 证伪的 synthetic interrupted terminal”。

迁移规则：

- journal 不迁移、不改写；
- 不在 startup 扫描或批量重建所有 session；
- session 第一次读取或 mutation 发现 v6 时，从 journal 惰性重建该 session 的 v7 projection；
- 重建成功后正常随机分页；同一 session 后续读取不得再次全量 replay；
- 重建失败时沿既有 projection recovery/degraded 设计保证完整读取，不返回半页；
- 重建过程记录一次原因 `projection_version_mismatch` 和耗时/字节，不记录消息正文。

事故会话的恢复只能通过 journal -> v7 projection 重建完成。禁止从 `messages.jsonl` 中挑某个历史快照手工覆盖 offset，因为后续事实可能已经继续增长。

### 8.6 compaction recovery 改为 continuation-aware

mid-run compaction checkpoint 已包含：

- `continuationMessageId`；
- `continuationMessageCoveredPartCount`；
- checkpoint ID/status/timestamps。

recovery 应按 continuation message lifecycle 关联，而不只依赖 pending set 的事件先后：

1. 看到 `compressing` marker 时，读取其 `continuationMessageId`。
2. 如果 replay 已知该 continuation 为权威 error/aborted/finished，或为未被后续事件证伪的 interrupted error，且 marker 尚无明确 `compressed` 更新，把 marker 投影为 `failed` 或 `cancelled`。
3. terminal 先出现或 marker 先出现都得到相同结果。
4. unrelated message/run terminal 不能终态化其它 continuation 的 marker。
5. 后续 journal 中若存在同 marker ID 的明确 `compressed` update，它是更具体的事实并获胜；恢复生成的 failed/cancelled 只是缺少明确完成事件时的派生状态。
6. 缺少 `continuationMessageId` 的 legacy/pre-run marker保留现有 pending-set fallback，不删除兼容路径。

recovery 状态只存在于 replay 过程，不向 journal 追加合成事件，避免页面读取变成写操作。

### 8.7 UI history payload 去除模型摘要

模型输入与 UI timeline 使用同一 checkpoint message，但它们需要的字段不同。server 在构造 session history API view 时，应从 context compaction checkpoint metadata 中移除：

- `summary`；
- 只服务模型生成诊断、且 UI 没有展示合同的大体积字段。

保留 UI 所需字段：

- checkpoint ID/status；
- phase；
- continuation message ID 和 covered part count；
- covered counts；
- original/projected token counts；
- created/updated timestamps。

kernel/journal/model input 中的 checkpoint 不变。UI 的 `ContextCompactionTimelineView` 不再把 `summary` 作为解析 marker 的必需字段；当前 UI 没有展示该正文，因此这是 transport view 收窄，不是功能删除。

compact initial payload 的“最少 5 条”改为至少 5 条近期 **conversation anchors**：

- `role=user`；
- `role=assistant`。

service timeline markers 仍按时间顺序包含在所选对话窗口中，但不能单独满足 minimum。字节预算仍适用，超大 assistant tool payload 继续走现有 deferred detail cursor；不得把 streaming message 永久排除 defer，若 streaming payload 超预算，需要沿已有 tool payload summary contract 做有界视图，而不是把整页挤空。

### 8.8 可观察性

只添加低频结构化事件，不记录消息正文：

- unfinished recovery count；
- projection version rebuild started/completed/failed（session ID、journal bytes、duration）；
- late streaming event ignored（session ID、message ID、event type，按 run/周期限流）；
- compact UI payload before/after bytes 可作为测试指标，不要求生产逐请求日志。

不要为此新建通用 observation 子系统或每条 delta 日志。

## 9. 端到端状态流

```mermaid
sequenceDiagram
    participant A as "原 Backend A"
    participant J as "JSONL journal"
    participant P as "Message projection"
    participant B as "第二 Backend B"

    A->>J: run.started / streaming events
    A->>P: 增量同步
    B->>J: 初始化并发送新会话消息
    A->>J: 后续 tool/final events
    A->>P: 合法 tail replay

    Note over A: 若 A 异常退出
    B->>J: 对真正 unfinished run 追加一次 run.error
    B->>P: v7 replay / 惰性重建
```

## 10. 故障矩阵

| 场景 | runtime 启动 | startup recovery | projection/UI 结果 |
| --- | --- | --- | --- |
| 单实例正常启动 | 正常初始化 | 正常扫描 | 行为不变 |
| 第二实例同 home，owner 存活 | 允许初始化 | 不得误判其它活跃 run | 新会话可发送，原会话不被全局阻断 |
| 第二实例只打开原实例 URL | 不启动新 kernel | 不运行 | 纯读 |
| owner 正常退出 | 正常退出 | 下一实例正常扫描 | unfinished 依事实处理 |
| 两实例同时首次启动 | 都不因 writer lease fail-fast | 由各自运行时事实决定 | 不新增全局不可用限制 |
| 权威 terminal 后晚到 delta | owner 内事件仍可进 journal | 不相关 | projection 忽略，不重开 message |
| 旧 synthetic interrupted terminal 后有同 run continuation | v7 前历史污染 | 不追加新事件 | full rebuild 跳过误恢复终态并保留后续内容 |
| v6 projection 已污染 | 不相关 | 不相关 | 首次访问从 journal 重建 v7 |
| terminal 后出现 pending compaction marker | 不相关 | 不追加合成恢复事件 | continuation-aware 派生 failed/cancelled |
| marker 后有明确 compressed update | 不相关 | 不相关 | compressed 明确事实获胜 |
| UI 首屏含巨大 summary | 不相关 | 不相关 | summary 不传输，对话锚点保留 |

## 11. 实现边界与建议批次

### 批次 A：先写失败测试

在任何生产逻辑修改前，先提交到工作树但不 commit 以下 deterministic tests：

1. 同一 message ID 在权威 `run.error` 后收到晚到 tool events，当前 projection 会从 error/full parts 退化到 streaming/short parts。
2. `run.error(interrupted=true)` 后同 run/message 继续执行并最终完成时，旧 full/projection 语义不能稳定表达“误恢复被证伪”。
3. prefix projection + tail replay 与 full replay 在合法 terminal 边界不等价。
4. 两个进程/两个 store owner 指向同一临时 journal 目录时，第二 owner 仍能打开目录并验证新会话链路不被启动 gate 阻断。
5. terminal-before-compressing marker 不能正确终态化。
6. 两个大 summary marker 会占据 compact initial payload 的 minimum。

测试必须在 `mkdtemp` 隔离目录运行，不使用真实 `~/.nextclaw`。

### 批次 B：启动可用性与 recovery 边界

不新增 writer lease 或启动级 ownership check。预期只验证：多个 runtime 可以初始化；unfinished recovery 不会把其它活跃 runtime 的 run 误写成 interrupted；单次 journal/projection 写入异常不会阻断无关会话。

### 批次 C：projection replay 与 v7

预期触达：

- `packages/nextclaw-kernel/src/utils/ncp-agent-session-journal.utils.ts`；
- `packages/nextclaw-kernel/src/utils/ncp-agent-session-message-projection.utils.ts`；
- `packages/nextclaw-kernel/src/stores/ncp-agent-session-message-projection-persistence.store.ts`；
- `packages/nextclaw-kernel/src/stores/ncp-agent-session-message-projection.store.ts`；
- 对应 projection/journal/recovery tests。

保持 conversation state manager 为唯一事件合并 owner。禁止新增第二套 message reducer。

### 批次 D：compaction 与 transport view

预期触达：

- `packages/nextclaw-kernel/src/features/context-compaction/services/context-compaction-journal-recovery.service.ts` 及 tests；
- `packages/nextclaw-server/src/features/sessions/utils/session-message-history-payload.utils.ts` 及 tests；
- `packages/nextclaw-ui/src/features/chat/features/session/utils/ncp-session-context-metadata.utils.ts` 及 timeline tests。

不改变模型 input builder 的 checkpoint summary 读取。

## 12. 稳定复现规范

### 12.1 projection 最小复现

构造单 session：

1. append user message；
2. append assistant `MessageSent(streaming)`；
3. append至少一个 text part 和三个 tool invocation，使完整内容易于断言；
4. 第一组 append 权威 `RunError(interrupted=false/omitted)`；
5. 强制 projection 同步到该 byte boundary，并断言 assistant 为 `error`、parts 完整；
6. 在 boundary 后 append同 message ID 的 `MessageToolCallStart/ArgsDelta/ExecutionStarted/Result`；
7. 从 projection latest page 读取。

修复前必须稳定观察到至少一个失败断言：status 被重开或 parts 退化。修复后应保持 error 和 terminal 前完整 parts；晚到事件保留在 journal，但不成为新 streaming projection。

第二组使用事故型事件流：`RunError(interrupted=true)` 后追加同 message ID 的明确 continuation，再追加同 run 的完成事件。修复后的 v7 full rebuild 必须跳过 synthetic interrupted terminal，产出包含后续 parts 的完整 final；同时无 continuation 的 interrupted error 仍保持 error。

再把 boundary 参数化到每个关键 event 之后，与一次 full replay 的结构化结果比较。

### 12.2 双进程真实复现

使用子进程和临时 `NEXTCLAW_HOME`，不得复用开发者 home：

1. 进程 A 启动可写 kernel，写入 unfinished run，并通过 IPC 通知已进入运行态。
2. 进程 B 使用同一 home 启动，并尝试发送一个新会话消息。
3. 修复前基线记录 B 被目录级 writer conflict 阻断，以及共享 home 下可能产生的错误 recovery。
4. 修复后 B 必须完成启动并可发送新会话消息；不能以 writer conflict 作为启动失败原因。
5. 强制终止 A，不执行 graceful release，再启动 B，验证真正中断的 run 仍可收敛。
6. 扫描每个 run，断言 late event 不会让无关 session 的 projection 退化；journal/projection 单次写入异常只影响局部操作。

如果完整 backend harness 太重，先用两个 journal-store 实例固定“可同时打开 + 局部 recovery 边界”，再补一条真实 kernel startup integration。仅有 mock 进程状态单元测试不足以声称复现完成。

### 12.3 API/UI 复现

构造包含以下尾部的 session：

- 近期 user + assistant；
- 两个 checkpoint summary 各大于 24 KiB；
- 一个多工具 assistant；
- 更早一页消息。

断言：

- initial compact payload 不包含 summary 正文；
- payload 仍包含最近 user/assistant anchors 和其间 marker；
- previous cursor 可读完全部历史，无重复、无遗漏；
- UI timeline marker 正常显示 status/count/token，不因缺少 summary 被过滤；
- 页面不会只剩压缩 marker。

## 13. 性能预算与验证

### 13.1 设计层面的成本

| 路径 | 新成本 | 结论 |
| --- | --- | --- |
| kernel startup | 不新增 journal ownership 检查 | 不因共享目录竞争阻断启动 |
| journal append | 无新增跨进程 lock/heartbeat | 热路径不变 |
| warm latest page | v7 projection 随机读取 | 不允许 full journal replay |
| tail replay | 仍只读 projection boundary 后 tail；未知 late event直接忽略 | 不增加历史扫描 |
| UI payload | 少序列化/传输完整 summary | 应降低字节与 parse 成本 |
| 旧 session 首次访问 | 一次 journal -> v7 rebuild | 可见的一次性成本，之后恢复快路径 |

### 13.2 必须执行的基准

在改动前后使用同一机器、同一 fixture、release-like Node 参数测试：

1. 事故规模 fixture：约 8.1 MiB journal、17k+ events、包含 compaction 和工具事件。
2. 大型 fixture：沿现有长会话/259 MiB projection 场景验证，不要求把真实私有会话复制进仓库。
3. 每项至少 5 次冷运行、20 次 warm 运行，记录 median/p95，而不是只报一次。

门槛：

- warm latest page p95 不得比基线回退超过 5%，并通过 fs spy/trace 证明未读取完整 journal；
- warm cursor page p95 不得比基线回退超过 5%；
- append p95 不得比基线回退超过 5%；
- compact history API payload 在大 summary fixture 中应明显小于改动前，summary 字节为 0；
- v7 cold rebuild 单独报告 wall time、peak RSS、journal bytes；第二次访问不得再次 rebuild；
- startup 不得遍历、重建全部 session projections。

如果相对 5% 落在测量噪声内，附原始数据并以多轮 median/p95 和 I/O trace判断；不能用一句“应该没影响”代替证据。

## 14. 验证命令与证据层级

实现 AI 应根据实际文件名调整，但至少运行：

```sh
pnpm --filter @nextclaw/app-runtime test -- src/services/file-lock.service.test.ts
pnpm --filter @nextclaw/kernel test -- \
  src/services/session-event-ingestion.service.test.ts \
  src/stores/ncp-agent-session-message-projection.store.test.ts \
  src/stores/ncp-agent-session-message-projection-recovery.store.test.ts \
  src/stores/ncp-agent-session-compaction-recovery.store.test.ts
pnpm --filter @nextclaw/server test -- \
  src/features/sessions/utils/session-message-history-payload.utils.test.ts
pnpm --filter @nextclaw/ui test -- <实际受影响的 compaction timeline tests>

pnpm --filter @nextclaw/app-runtime tsc
pnpm --filter @nextclaw/kernel tsc
pnpm --filter @nextclaw/server tsc
pnpm --filter @nextclaw/ui tsc
```

此外必须完成：

1. 双进程临时 home integration；
2. full/incremental replay boundary matrix；
3. v6 -> v7 惰性重建；
4. API payload 字节测试；
5. 上述性能基准；
6. targeted lint；
7. `git diff --check`；
8. 源码验证完成后的 diff-only maintainability review。

测试通过只证明对应范围。没有实际运行双进程 harness，不能声称多实例事故已复现或修复；没有基准，不能声称性能无回退。

## 15. 兼容、迁移与发布

- journal schema：不升级。
- HTTP cursor：不改变。
- projection schema：v6 -> v7，按 session 惰性重建。
- compaction checkpoint：journal 中保持完整；只收窄 UI transport view。
- legacy journal：full replay 保留未知 streaming bootstrap 救援；incremental tail 不使用该 fallback。
- startup recovery：保留，但不以 writer authority 作为前置条件；必须避免仅凭 unfinished journal 误判活跃 runtime。
- read-only secondary backend：非目标；同一 home 的 runtime 不因目录 ownership 被强制变成不可用。
- 用户配置：不新增。
- 用户文档：本批为内部故障修复，不新增“同一数据目录只能由一个本地 runtime 写入”的产品限制说明。
- changeset：这是用户可见的数据可靠性修复，交付时需要按受影响 package 判断 changeset；本文不执行提交或发布。

## 16. 当前工作区实施警告

设计时主工作区存在大量其它任务的 modified/untracked 文件，相关 projection persistence 文件本身也有未提交拆分工作。实现者必须：

1. 先运行 `git status --short` 和相关文件 `git diff`，区分用户 WIP 与本修复。
2. 不覆盖、revert 或格式化无关改动。
3. 当前曾存在 `tsx watch --package-watch` 进程，并且它默认指向真实 `~/.nextclaw`；修改被 watch 的 package source 可能自动拉起第二 backend，再次触发事故。
4. 在实质源码编辑前重新检查 watcher。若仍存在，要么在用户同意后停止，要么在隔离 worktree/副本和临时 `NEXTCLAW_HOME` 中实现验证；不得悄悄重启或停止现有 NextClaw 实例。
5. 不把真实事故 session 当测试目录，不删除其 projection，不写入其 journal。v7 自愈应通过产品路径或用户明确授权的修复动作发生。

## 17. 非目标

- 不建设多写者 journal、分布式 consensus 或数据库事务系统。
- 不给每个 run 增加 heartbeat。
- 不把第二完整 backend 临时伪装成只读 backend。
- 不移除 unfinished-run startup recovery。
- 不移除 context compaction 或压缩检查。
- 不退回每次打开全量 journal replay。
- 不修改模型压缩摘要内容或质量策略。
- 不修复 legacy chat 链路。
- 不顺带重构所有 session persistence owner。

## 18. 最终验收清单

- [ ] 失败测试在旧实现上稳定复现 terminal -> late event -> truncated projection。
- [ ] 双进程隔离 harness 在旧实现上复现 foreign recovery/multiwriter。
- [ ] 多 runtime 不因 journal writer ownership 在启动阶段 fail-fast。
- [ ] 活跃 runtime 的 unfinished run 不被其它 runtime 仅凭 journal 状态误判为 interrupted。
- [ ] startup recovery 在不牺牲新会话可用性的前提下仍可收敛真正中断的 run。
- [ ] full replay 与合法边界 incremental replay 等价。
- [ ] 权威 terminal assistant 不会被晚到 streaming/tool 事件重开。
- [ ] 被后续同 run/message continuation 证伪的 synthetic interrupted terminal 在 v7 full rebuild 中被忽略，后续完整内容保留。
- [ ] v6 projection 首次访问重建 v7，第二次走快路径。
- [ ] compaction recovery 对 terminal/marker 顺序不敏感，明确 compressed update 获胜。
- [ ] UI payload 不含 checkpoint summary，近期 user/assistant anchors 不被 marker 挤掉。
- [ ] latest/cursor 分页读完后无重复、无遗漏。
- [ ] app-runtime、kernel、server、UI 定向测试和匹配 `tsc` 通过。
- [ ] 双进程真实链路、API/UI 链路和性能基准均有记录。
- [ ] diff-only maintainability review 无阻断 finding。
- [ ] 未修改真实事故 journal，未破坏工作区其它 WIP，未未经授权重启服务。

## 19. 本次实施与验证记录（2026-08-23）

本方案已在主工作区完成范围修正，关键落点如下：

- 删除 journal 目录持久 writer lease、legacy-owner guard 和 kernel 启动 fail-fast；同一 `NEXTCLAW_HOME` 的第二 runtime（包括新会话）不再因 journal ownership 被阻断。
- 保留原有 unfinished-run startup recovery、replay、projection 和历史视图修复；不新增 runtime、run 或 session 级硬锁。
- full replay 增加 synthetic interruption 的历史证伪、终态消息保护和 late streaming/tool event 边界；incremental tail 仍只扫描 projection tail，并保留 `RunStarted` 后 legacy streaming 兼容窗口。
- projection 版本升至 v7，compaction marker 仅在 API/UI view 层剥离 summary 大字段，journal 原文不改写。
- 为降低维护风险，将 replay 编排、replay event 转换和 recovery 回归用例按职责拆开；没有新增 append 热路径锁。

已取得的证据：

- kernel 全量回归：87 个测试文件、414 个测试通过；故障相关 journal/recovery 定向回归 28/28 通过。
- app-runtime、server、service、UI 的匹配 `tsc` 通过；对应定向测试分别为 3、12、3、17 个通过。
- 临时目录双 store 可同时打开同一 journal 目录；真实 `~/.nextclaw` 未被用于测试写入。
- targeted ESLint 无 error，diff-only maintainability 无阻断 finding，`git diff --check` 通过。

尚未声称完成的证据：本次没有在真实事故实例上热重启或执行 8.1 MiB / 17k+ 生产规模的 5 次冷、20 次 warm 性能基准；这是出于不触碰现有实例和真实 session 数据的安全边界。后续若要闭合性能门槛，应在复制到隔离 `NEXTCLAW_HOME` 的 fixture 上执行第 13.2 节基准。
