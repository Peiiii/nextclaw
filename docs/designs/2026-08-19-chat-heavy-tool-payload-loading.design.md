# 聊天历史大工具载荷分级加载设计

## 背景与证据

本设计承接[聊天工具调用高负载压测设计](./2026-08-19-chat-tool-call-stress.design.md)。真实压力会话 `stress-tool-call-heavy-local` 证明，现有消息行虚拟化只限制 DOM 挂载数量，无法限制进入虚拟化之前的历史读取、HTTP 传输、JSON 解析和消息适配成本。

当前可复现证据：

- 首屏只取最近 40 条消息，响应仍为 12,963,555 字节，首字节约 2.16 秒；
- 只取最后 1 条消息仍为 4,392,924 字节，首字节约 1.28 秒；
- 无缓存浏览器从进入路由到最后一条消息出现约 6.94 秒，期间记录到 7 个超过 50ms 的主线程长任务；
- 首屏最终只挂载约 9 个消息行，说明行虚拟化有效，但发生得太晚；
- 前端在“处理完成”和工具活动组都处于折叠态时，仍会对整页每个工具调用的 args/result 做完整序列化。
- 摘要合同实现后的真实接口复测中，响应已从 12,963,555 字节降到 455,980 字节，但首字节仍约 1.45 秒；调用链证明 `SessionManager.listSessionMessagePage` 在无 cursor 的分页读取后，又加载整份约 44 MB journal、重新预览 context window 并写回 projection。也就是说，分页接口虽然只返回轻量数据，内部仍执行了一次隐藏的全量读、全量计算和写入。
- 去掉隐藏全量计算后，接口首字节已降到冷次 125ms、热态 48–62ms，但隔离浏览器的最近消息可见仍为 4.9–5.6 秒。页面响应虽然只有约 456KB，40 条消息中仍包含约 1,450 个逐调用摘要 part，前端必须逐个适配成 tool-card view model；折叠态没有挂载卡片，却仍支付了线性对象构造成本。
- 聚合工具摘要后，历史响应进一步降到约 262KB、工具 part 从约 1,450 个降到 20 个，但浏览器仍出现 2.9–9.3 秒波动。网络时间线显示历史请求约 604ms 发出、约 4.43s 才收到，而相同接口单独请求只需约 59ms；同期 `skills`、`queued-inputs` 等接口都调用 `SessionManager.getSession`，分别加载完整 journal、预览 context window 并写 projection，串行阻塞同一服务事件循环。根因从单个分页方法扩大为 read-shaped session summary API 的 owner 错位。
- `getSession` 改为投影读取后，直接 session/queued-inputs 请求已降到约 4–6ms，但冷页面仍约 2.5–3.2 秒。并发时间线显示 `list sessions?limit=200` 先对全部约 705 条 summary 发起 metadata sidecar 读取，再在 manager 层截到 200 条；大量并发文件读取占满 I/O 队列，历史 projection 的少量读取被排队约 1.2–1.7 秒。这是全局列表读模型的 limit 下推和背压缺失。

因此这是跨 message projection、HTTP view、前端历史状态和折叠交互的 L3 合同缺口，不是单纯调小消息条数或增加列表虚拟化可以关闭的问题。

## 用户任务与成功标准

用户从会话列表或 URL 进入历史会话时，应先快速看到最近消息、工具调用数量和执行摘要；只有主动展开某条消息的处理过程时，才等待该条消息的大工具参数和结果，加载一次后可以连续查看其中所有工具调用。

成功标准：

- 普通小会话保持一次请求拿到完整历史，不引入额外交互；
- 大载荷会话的首屏响应受明确字节预算约束，不能由工具调用累计体积无限增长；
- 工具名称、数量、状态、耗时以及可安全提取的命令/路径/查询摘要在首屏可见；
- 展开一条延迟消息时按消息一次加载完整工具载荷，不按工具调用制造 N+1 请求；
- 同一消息加载成功后在当前会话生命周期内缓存，折叠、重开和查看不同工具卡不重复请求；
- 正在运行/流式消息、持久化 journal 和标准 NCP 消息语义不被摘要化或截断；
- 失败时保留原摘要并提供可重试状态，不能打开空白详情或静默丢失参数。

## 功能状态图

| 场景 | 用户看到什么 | 动作 | 状态 owner | 失败/恢复 | 验证 |
| --- | --- | --- | --- | --- | --- |
| 普通历史消息 | 与现在一致的完整内容 | 正常展开 | 前端历史 manager 持有完整消息 | 无新增路径 | 现有回归测试 |
| 大工具载荷首屏 | 最终文本、处理摘要、工具数量和轻量元信息 | 展开处理过程 | Server history view 标记延迟消息；前端历史 manager 记录 detail cursor | 摘要仍可阅读 | 响应预算与浏览器首屏 |
| 首次展开延迟消息 | 明确 loading，内容不闪成空卡片 | 等待或折叠 | 前端历史 manager 去重请求 | 显示失败与重试 | 交互测试和真实页面 |
| 加载成功 | 完整工具组；先显示有界数量的卡片 | 查看卡片、继续显示更多 | 前端历史 manager 缓存整条完整消息；工具组组件只拥有展示窗口 | 折叠重开不再请求 | 请求计数与 DOM 数量 |
| 加载失败 | 原摘要、失败反馈和重试入口 | 重试 | 前端历史 manager | 重试成功后原位替换 | 失败注入测试 |
| 流式/运行中 | 现有实时工具调用体验 | 实时查看 | NCP agent/runtime | 沿现有恢复链路 | 现有流式测试 |
| 刷新/重进 | 重新从轻量首屏开始 | 再次按需展开 | 缓存只属于当前前端会话 | 不依赖过期内存 | 刷新冒烟 |

## 候选方案

### 方案 A：只减少首屏消息条数

优点是改动最小。缺点是最后单条消息就可达到 4.39 MB，无法建立规模上界；同时让用户看到的上下文更少。淘汰。

### 方案 B：只做前端懒序列化和虚拟化

可以减少 React 主线程工作，但 13 MB 响应仍要在服务端构造、传输并由浏览器解析；解决不了进入页面前半段的等待。它是必要优化，但不是完整方案。

### 方案 C：所有历史消息都摘要化，并按单个工具调用加载

首屏最小，但普通会话也产生额外请求；连续查看几十个工具调用会形成 N+1，交互和失败状态复杂。与用户高效浏览目标冲突。淘汰。

### 方案 D：按预算识别大载荷，按消息延迟完整载荷

普通页面仍返回完整消息；只有 finalized 历史消息的工具载荷超过单消息或整页预算时才返回轻量 view。用户首次打开处理过程时一次拉取整条完整消息并缓存。配合前端懒序列化和工具卡片分批展示，同时关闭网络、适配和 DOM 三段瓶颈。

采用方案 D。代价是新增 history detail 合同和 loading/retry 状态，但它把额外复杂度严格限制在真正的大载荷消息，并保留完整查看能力。

## 关键决策与理由

### 1. 预算是页面级和消息级，不是单字段阈值

单次调用的 4 KiB 参数看似不大，但 50 或 500 次累计后仍会压垮首屏。服务端先计算 finalized assistant message 的工具 args/result 累计体积：单消息超过预算，或整页工具载荷超过预算时，将最大的候选消息按消息整体延迟，直到页面回到预算内。

初始常量建议为单消息 256 KiB、整页 2 MiB。它们是可由压力基准调整的性能预算，不是外部协议；实现后必须用当前夹具校准。如果 2 MiB 仍不能满足首屏目标，优先收紧预算而不是改交互合同。

### 2. 延迟单位是整条消息，不是单个工具调用

一条 assistant 消息中的 reasoning、工具调用和最终文本属于同一处理过程。按消息加载能让一次点击只产生一次请求，随后所有工具卡都本地可用；也避免部分工具已加载、部分未加载的混合状态。

### 3. Canonical NCP 与持久化数据保持完整

Journal、message projection 和 NCP `NcpMessage` 继续保存完整 args/result。摘要只属于 UI history HTTP view，不能回写存储、进入后续模型上下文或替代运行时消息。这样压力数据和用户真实历史不会被截断。

### 4. Server history view 决定延迟，projection 只提供稳定游标

Server 是 UI HTTP 表示的 owner，负责预算和轻量工具摘要；kernel projection 仍负责稳定分页顺序，并为被延迟消息提供 session-scoped opaque detail cursor。前端不能复制预算算法，kernel 也不承担 UI 展示策略。

列表响应为被延迟的 messageId 返回 detail cursor。详情请求使用该 cursor 精确读取一条 canonical message；旧 UI 未请求摘要模式时仍收到完整页，旧 Server 忽略新 query 时新 UI 也能继续使用完整页。

### 5. 前端历史 manager 拥有详情状态与缓存

`useNcpSessionMessageHistory`（或其收敛后的 manager）拥有 `summary/loading/ready/error`、请求去重、session 切换清理和完整消息 overlay。消息组件只报告“用户想展开”，不自行 fetch、不保存第二份远端真相。

加载成功后按 messageId 原位覆盖展示消息；流式 agent 的内部历史和服务端 canonical history 不被轻量 view 反向污染。

### 6. 折叠态禁止完整序列化，展开态限制一次挂载量

Chat adapter 只从已知顶层标量字段构造 command/path/query 等摘要；不能为了生成一行折叠摘要先 `JSON.stringify` 整个 args/result。完整 raw value 保留到工具卡实际展开时再格式化。

一个工具活动组包含数百个调用时，首次打开只展示固定批次（建议 40 个），提供“继续显示”动作逐批增加；详情数据已经按消息缓存，因此这不是再次请求网络。采用分批展示而不是嵌套虚拟滚动，是因为当前外层消息列表已有可变高度虚拟化，嵌套虚拟器会引入双滚动、测量联动和焦点定位复杂度。

### 7. Loading 和失败必须属于原折叠入口

整个 header 仍是按钮。延迟消息首次展开时，入口原位进入 loading；成功后自动打开，失败后保留摘要并显示可重试反馈。不能先打开 500 个占位卡，也不能用无反馈的后台请求让用户猜测是否生效。键盘、`aria-expanded` 和 focus-visible 合同保持现有语义。

### 8. 历史分页必须纯读，context window 在会话变化时物化

Message projection 已经持久化 `contextWindow`，分页读取应直接返回该投影值，不能为了“顺便刷新”它而读取整份 canonical journal。`getSession` 也属于摘要读取：基础摘要和 metadata 从 summary index/metadata store 读取，context window 从 message projection 读取，不能 replay journal、调用 preview 或产生写入。这样 `skills`、queued input existence check 等旁路不会因为会话巨大而阻塞历史主请求。若多进程或旧数据导致 journal/projection 存在但 summary index 缺项，兼容路径只用 projection meta 的 `total`、metadata sidecar 和 journal 文件时间构造最小摘要；不读 message data、不修写 index，后续标准会话变更仍由正常 owner 收敛索引。

context window 的计算 owner 仍是 `AgentContextWindowManager`，唯一持久化刷新时机归 `SessionManager.publishSessionChange` 所代表的会话变更链路：消息完成、终止、run 结束、元数据变更、导入或回退后读取 canonical record、计算并写入 projection，再发布 summary。`getSessionRecord` 保留为明确需要 canonical messages 的重操作入口，调用者不能把它当成存在性或摘要查询。

这次不把 context window 改成前端进入页面时另发请求，也不允许任何摘要读取在投影缺值时同步回退到全量计算。前者只是把阻塞转移到另一条首屏请求，后者会让性能取决于缓存是否命中而不可预测。若旧 projection 或重建 projection 暂时没有该字段，分页和 `getSession` 都明确返回 `null`；下一次标准会话变更会修复投影。

这个边界选择有三个理由：

- 热路径的成本只与请求页大小相关，不再与历史 journal 总体积相关；
- summary index、metadata store 和 context projection 分别提供已物化的读模型，`getSession` 不需要重建另一份摘要；
- 计算、持久化和通知都留在同一个会话变更 owner，避免任一读接口暗中修改状态；
- 缺失时显示不了 context 指标，影响小于让整个会话延迟数秒，而且恢复条件明确，不需要兼容重试分支。

### 9. 延迟消息的工具摘要必须聚合且有界，不能保留逐调用 part

一旦整条消息被判定为延迟，首屏 view 不再为每个工具调用保留一个轻量 part。Server 统计真实 `toolCallCount` 和有界的 distinct `toolNames`，写入仅属于 UI history view 的摘要 metadata；消息 parts 中只保留一个去除 args/result 的代表性工具 part，用来维持现有“处理过程可展开”的结构边界，其余工具 part 延迟到详情请求。

过程折叠入口显示真实调用数量和最多三个工具名称，例如“已处理 · 500 次工具调用 · exec_command、read_file…”。因此用户在不加载详情时仍知道规模和类型，但前端对每条延迟消息只适配 O(1) 个工具对象。不能把 500 个调用改成 500 个空对象，也不能伪造较小的调用数量。

采用代表性 part 而不是新增一种 NCP canonical part，是因为这只是 Server UI view 的临时表示；canonical journal、detail 响应和模型输入保持原合同。摘要 metadata 使用明确的 history-view 命名空间，前端只读、不回传、不持久化。detail 成功后可继续保留该摘要 label，但工具卡和排序必须来自完整消息。

### 10. 会话列表先限量再补 metadata，并限制 sidecar 读取并发

Summary index 已按最近活动排序，未按 peer 过滤的列表请求可以安全地先应用 `limit`，再只为这批 summary 读取 metadata sidecar。不能读取全部 705 条后才截成 200 条。metadata 补全使用小而固定的 I/O 并发（实测采用 2），主动为历史、配置和其它首屏请求保留文件队列容量；采用 8 时仍观察到一次约 506ms 的历史响应，不能把“比原来快”误判为预算达标。

peer 过滤可能依赖 metadata 中的 peer 信息，不能在过滤前盲目截断；该路径保留全量候选，但同样受并发上界约束。这里不通过减少 UI 的 200 条产品上限来换性能，也不改变排序或列表内容合同，只把 limit 推到已有有序 read model 的正确位置。

## 数据与事件主链路

1. 会话发生标准变更时，`publishSessionChange` 读取 canonical record、计算 context window、写入 message projection 并发布 session summary。
2. Projection 按游标纯读 canonical message page 及已物化的 context window。
3. Server history view 评估工具载荷预算；小消息原样返回，大消息改为 O(1) 聚合摘要、附 detail cursor，并保留真实调用数量与有界工具名称。
4. 前端 history manager hydrate 轻量页，消息 adapter 只处理有界摘要，外层 virtualizer 挂载首屏行。
5. 用户展开延迟消息，消息组件发送 messageId 意图给 history manager。
6. history manager 使用 detail cursor 请求一条完整 canonical message；并发点击复用同一 promise。
7. 成功后完整消息 overlay 原位替换摘要；消息过程打开，工具活动组按批次挂载卡片。
8. 工具卡真正展开时才格式化该调用的 raw input/output。

## 不变量

- `messageId`、工具调用顺序、状态和最终文本在轻量 view 与完整消息之间一致；详情响应不一致时拒绝覆盖并报错。
- 一个 session/message 同时最多一个详情请求；成功缓存不重复加载，失败不写入 ready cache。
- 预算算法只处理 finalized 历史工具载荷；pending/streaming/cancelled 的实时状态仍走现有主链路。
- 轻量 view 不能用于 edit/continue 的 canonical 输入；需要完整历史的业务动作必须使用 runtime/server owner。
- 工具批次只改变 DOM 展示数量，不改变数据、排序或工具活动统计。
- 切换 session 后旧请求即使完成也不能覆盖新会话。
- 无 cursor 和有 cursor 的历史分页都不得调用 `getSession`、context preview 或 projection update；projection 中缺失的 context window 按 `null` 返回。
- `getSession` 只能读取 summary index、metadata store 和 projection context；不得读取 journal record、调用 context preview 或写 projection。
- summary index 缺项的兼容恢复只能读取 projection meta、metadata sidecar 和 journal stat；不能退回 replay journal，也不能在读请求内偷偷修写 index。
- 无 peer 过滤的 session list 必须在 metadata hydration 前应用 limit；sidecar hydration 的同时在途读取不得超过固定上界。
- 延迟消息无论包含 50、500 还是更多工具调用，首屏最多保留一个工具 part；metadata 中的真实计数必须等于 canonical message 的工具 part 数量。

## 兼容、迁移与恢复

- 新摘要模式通过显式 query opt-in；未 opt-in 的客户端合同不变。
- 不迁移 journal，不修改已有压力会话；projection cursor 继续保持 opaque。
- 新 UI 对没有 detail metadata 的响应视为完整消息，兼容旧 Server。
- 新 Server 对普通 list messages 请求仍返回完整消息，兼容旧 UI 和 SDK consumer。
- detail 请求失败可重试；刷新会丢失内存详情缓存并重新走轻量首屏，这是预期生命周期。
- 若某扩展工具依赖复杂 args 才能生成折叠摘要，只显示通用工具名称和数量，不在前端重新复制完整 payload 解析规则。

## 实现边界

本次最小完整范围包括：

- UI history API 的预算化摘要和单消息详情合同；
- cursor 到精确 canonical message 的读取；
- 前端 history detail 状态、去重和 session 生命周期；
- Chat adapter 的 raw payload 延迟格式化；
- 大工具活动组的有界批次展示及 loading/error/retry 文案；
- 压力夹具的接口体积、首屏、展开、缓存和 DOM 上界验证。

非目标：改变 journal/NCP 消息格式、压缩或删除用户历史、为普通文本/附件建立通用大对象 CDN、引入嵌套滚动虚拟器、优化模型上下文构建。

## 验证标准

- 单元：预算边界、累计小调用、最大消息优先延迟、摘要字段、cursor/messageId 一致性、失败不缓存。
- 单元：延迟消息的聚合计数、distinct 工具名称上界和单个代表性工具 part；500 调用不能生成 500 个前端 tool-card view model。
- 类型：触达 package 的 TypeScript 编译全部通过。
- 组件：小消息无详情请求；大消息首次展开一次请求，成功后自动打开，重开不请求；失败可重试；工具组默认最多挂载 40 张卡。
- API：现有 full response 合同不变；summary response 在当前 40 条夹具上不超过 2 MiB；detail 精确返回目标完整消息。
- Kernel：最新页和前序页都只访问 message projection；测试锁定不读取完整 session、不预览 context window、不写 projection。
- Kernel：`getSession` 的测试锁定 summary read model，`publishSessionChange` 的测试锁定 canonical 计算与 projection 更新；旁路摘要请求并发时不触发重复 preview。
- 性能：当前 44 MB 压力会话的 summary 接口首字节应由约 1.45 秒降到 200ms 内；若冷态 projection 首次重建不满足此目标，单独记录为一次性重建路径，不能混入稳定热路径结论。
- 并发首屏：在 200 条 session list、skills、queued-inputs 等正常请求同时发起时，历史 summary 请求不能因 metadata I/O 饥饿超过 300ms。
- 浏览器：同一 URL 冷进入时最近消息出现目标先定为 2 秒内，且首屏阶段无超过 200ms 的长任务；展开最后一条时有即时 loading，加载后可查看完整 500 个调用并逐批显示。
- 回归：普通会话、历史向前分页、刷新、session 切换、流式消息和旧服务端兼容路径保持可用。

如果实现测量证明 2 MiB 预算仍无法达到 2 秒目标，返回 Design 调整预算或 summary 表示；不能靠隐藏 loading、减少历史条数或放宽验收掩盖失败。

## 实现后验证记录

- 同一 44 MB 压力会话的 40 条 summary 响应为 261,853 字节，20 条延迟消息首屏合计只保留 20 个工具 part；最后一条仍显示真实的 500 次调用及 `exec_command`、`write_file`、`read_file` 名称。
- 隔离冷页面连续 4 次最近消息可见时间为 1.13–1.73 秒；首屏挂载 9 个消息行。并发历史请求为 219–281ms，没有再被 session list metadata I/O 饿死。
- 首次展开最后一条时观察到 loading label，完整 4.39 MB detail 约 433ms 后自动打开；过程折叠再打开不产生第二次请求。
- 500 调用工具组首次只显示 40 项，入口显示“继续显示 40 项（剩余 460 项）”。
- 定向回归覆盖 kernel projection/summary owner、server 预算与 controller、UI history 状态和 agent chat 交互；受影响 package TypeScript、ESLint、skill progressive-loading 和 diff-only maintainability 检查通过。
