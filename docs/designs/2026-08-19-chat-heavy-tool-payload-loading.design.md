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
- 线上 `0.40.1` 的真实 68 MB 会话进一步证明，字节预算不能代表浏览器对象成本：最近 40 条消息的 projection 读取与 JSON 解析仅 25ms，但现有摘要仍返回约 1.88 MB、420 个工具调用 part，只有 2 条消息因超过字节阈值被延迟；同一 Chrome 热刷新直到最后消息可见约 18.3 秒。工具载荷分散在许多低于 256 KiB 的消息时，2 MiB 页面字节预算无法约束 tool-card view model 数量。第一次数量预算部署后还发现，一条已有 `endedAt` 的 `status="error"` 历史 assistant 消息含 27 个工具调用、约 273 KiB，却因候选只接受 `final` 而完整下发；错误终态同样是可稳定读取详情的已结算历史，不能与 `pending` / `streaming` 混为一类。补齐数量与错误终态预算后，线上 summary 发送量已降到约 77 KiB，但 40 条消息仍会在首次 hydrate 和 stream-open reconcile 中各适配一次，连续热刷新仍为 5.84–7.52 秒；此时瓶颈已经从载荷体积转为前端每轮 hydrate 的消息对象窗口。首屏收敛到 20 条后发送量约 26 KiB，warm 刷新仍为 4.09–5.70 秒，且每次 stream open 都会在约 3 秒内取得第二份相同 seed 并再次提交 manager；继续缩短窗口不能关闭重复状态提交这一生命周期问题。

因此这是跨 message projection、HTTP view、前端历史状态和折叠交互的 L3 合同缺口，不是单纯调小消息条数或增加列表虚拟化可以关闭的问题。

## 用户任务与成功标准

用户从会话列表或 URL 进入历史会话时，应先快速看到最近消息、工具调用数量和执行摘要；只有主动展开某条消息的处理过程时，才等待该条消息的大工具参数和结果，加载一次后可以连续查看其中所有工具调用。

成功标准：

- 不超过首屏窗口的普通小会话保持一次请求拿到完整历史；更长会话向上滚动时沿现有分页自动补齐，不新增按钮或丢失历史；
- 大载荷会话的首屏响应受明确字节预算约束，不能由工具调用累计体积无限增长；
- 大载荷会话的首屏工具 part 数量同样受明确预算约束，不能因大量小参数调用绕过字节预算；
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

### 1. 预算同时约束字节和工具调用数量，并且都有页面级与消息级上界

单次调用的 4 KiB 参数看似不大，但 50 或 500 次累计后仍会压垮首屏。服务端为已结算的 assistant message（`final` 或 `error`）同时计算工具 args/result 累计体积与工具 part 数量：单消息超过任一预算，或整页仍超过任一预算时，将候选消息按消息整体延迟，直到字节和调用数量都回到预算内。`pending` / `streaming` 仍保持完整实时表示。

字节预算保留单消息 256 KiB、整页 2 MiB；工具数量预算采用单消息 12 次、整页 80 次。它们是可由压力基准调整的性能预算，不是外部协议。选择 12/80 的依据是：线上真实页会把 420 个首屏工具 part 收敛到 19 个、估算响应约 533 KiB，同时普通的短工具过程仍一次完整返回；若只放宽到单消息 20 次、整页 100 次，该页仍会返回 100 个工具 part 和约 923 KiB，不能为 2 秒目标留出足够余量。

算法先延迟超过单消息字节或数量上界的消息，再分别按工具载荷字节和调用数量从大到小收敛页面预算。延迟集合是两种压力的并集；不能用一个混合分数掩盖任一硬上界，也不能按工具调用拆分同一消息。

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

### 11. 近期上下文目标采用 20 条，更早历史继续按滚动位置自动分页

在摘要字节与工具数量都已受控后，首屏消息对象仍会被初始 hydrate 与 stream-open reconcile 各处理一次。线上 2 核 VPS 与真实 Chrome 证明 40 条窗口不能满足可见时间目标，因此 UI 把近期上下文目标从 40 条收敛到 20 条；约等于最近 10 轮用户/assistant 对话，足以建立进入上下文。这里的 20 条是页面稳定后的近期上下文目标，不要求极重会话必须等 20 条全部下载完才首次显示。第 21 条及更早历史仍在用户向上滚动到现有 320px 边界时，由 history manager 使用 projection cursor 自动 prepend，数据、顺序和入口不变。

20 是 consumer 请求的最大上下文窗口，不再被解释为任何数据形态都必须返回 20 条。普通短消息应尽量一次返回 20 条；极重摘要页允许按显式 compact 首屏合同缩小实际窗口，具体规则见决策 13。full API、普通 summary API 和带 cursor 的前页请求仍严格遵守调用方 limit，不暗中截断。

### 12. Stream-gap reconcile 保留读取，但相同 snapshot 不重复 hydrate

`useHydratedNcpAgent` 首先 hydrate 历史 seed，随后在 live stream `onOpen` 后再次读取 seed，用来覆盖“第一次历史读取完成到 stream 建立之间”的事件缺口。第二次读取是正确性边界，不能为了速度直接删除或用短时缓存复用旧响应；否则其它客户端或并发 run 在 gap 中落盘而未被当前 stream 观察到时会丢消息。

reconcile owner 在合并 seed 与 stream 期间 live snapshot 后，先比较目标 messages 与 active-run 是否和 manager 当前 snapshot 完全相同。相同时直接完成 reconcile，不调用 `manager.hydrate`；不相同时仍走现有合并与 hydrate。比较必须覆盖完整消息内容和 active-run，而不能只看 ID/status，否则同 ID streaming part 增量或 gap 中的运行状态变化会被误判为相同。这样保留第二次网络正确性校验，但消除相同 20 条消息的第二次 adapter、store publish、虚拟列表测量和滚动复位。

### 13. 首屏 compact 以摘要字节预算动态决定消息数，不给所有会话固定砍条数

VPS 真实会话证明消息条数不是可靠成本：同一页 gzip 后 20 条为 26.3KB，10 条仍有 19.2KB，5 条才降到 4.4KB；浏览器单次 seed 在公网波动下耗时 2.1–6.8 秒，而 VPS 内部相同 20 条读取仅 25–94ms。继续从 20 猜到 10 既不能建立网络上界，也会无差别损害普通会话。

UI 只在无 cursor 的首次 summary 请求上显式发送 `initialPayload=compact`。Server 先按既有工具预算生成摘要，再从最新消息向前累计序列化字节：最多保留请求的 20 条，默认预算 24KiB，且无论是否超预算至少保留最新 5 条。普通短页在预算内仍返回 20 条；极重页自动返回 5 条或预算允许的更多条。被省略消息不删除，Server 把 `pageInfo.startCursor` 移到实际首条之前，`hasPreviousPage` 置真。

首批消息 hydrate 完成后，复用既有且不可删除的 stream-gap reconcile 读取作为后台补齐：同一 viewer 对每个 session 只让第一次 seed 请求携带 compact，随后 stream 建立时的 reconcile seed 恢复普通 20 条合同。这样极重页先快速显示最近 5 条，再由既有生命周期自动替换为完整的最近 20 条；普通页首批已经返回 20 条时，幂等 reconcile 不发布第二份 manager snapshot。这个选择没有新增第二套预取状态机、timer 或 cursor 竞态，首屏预算仍归 Server，seed 阶段选择归 history loader，stream 正确性仍归 NCP React。若 stream 首次连接失败，重连前的恢复 seed 同样使用普通 20 条合同；首批内容在此期间仍可阅读。第 21 条及更早历史才要求滚动触发。

compact 是显式 UI 表示合同，不能影响 full response、普通 summary consumer、详情请求或带 cursor 的前页。预算作用于完成工具摘要后的完整 message JSON，而不只计算 args/result；这样 reasoning、长文本和摘要 metadata 也进入首屏网络成本。最小 5 条是极端网络预算与最近交互可读性的底线，不是新的全局分页大小。

### 14. 会话详情的 compact seed 在 HTML 解析阶段抢跑，React 只消费同一只读结果

VPS 浏览器在静态资源压缩后连续 5 次热刷新仍为 3.04–5.21 秒，中位 3.62 秒；同一 compact API 在 VPS 内部只需约 0.11 秒、gzip 5.7KiB。Nginx 日志证明浏览器同时发起十余项全局启动请求时，关键 history GET 会在 HTTP/1.1 连接队列中等待 2–4 秒。继续缩消息或压 Server CPU 都无法消除这段排队。

生产 HTML 在解析到 `/chat/:sessionRouteId` 时立即解码既有 `sid_` 路由 token，并启动与 UI 首次请求完全相同的只读 compact GET；结果只保存在当前 document 的一次性内存槽，不写 storage、不跨 session、不发布 UI 状态。history seed loader 只在 session、limit 和 compact 合同完全匹配时消费一次，随后仍按决策 13 使用普通 reconcile seed。预取是同一 canonical API 的传输抢跑，不是第二个数据 owner。

预取成功时复用其标准 API envelope；预取缺失、合同不匹配、网络失败、非 2xx 或响应结构无效时，清空一次性槽并执行原有 SDK 请求。调用方已经 abort 时必须立即退出，不能借 fallback 复活旧 session 请求；标准请求的失败仍按原错误链路暴露，不能被预取吞掉。开发模式、draft route、非 chat route 和无法解析的 route 不预取。这个 fallback 只保护可选性能缓存，不掩盖发布、协议或认证缺陷，canonical API 始终是唯一事实源。

### 15. 主 module 在 head 提前发现，UI injection 保持同步执行顺序

单独部署决策 14 后，真实浏览器首次 5.67 秒、后续 5 次 4.08–6.33 秒，证明 history 请求抢跑没有解除 UI 启动阻塞。HTML 当前在 body 中先同步加载 `/api/ui-inject.js`，之后才声明 Vite module entry；公网往返期间浏览器无法发现约 416KiB gzip 的主模块，形成 document → injection → module graph 的硬串行。

把 `type="module"` 的 Vite entry 移到 head：module 下载会与后续 HTML 解析、history 预取和 UI injection 并行，但 module 的默认 defer 语义仍要等文档完成后执行；body 中既有同步 injection 仍在解析完成前执行，因此“用户注入先于应用模块求值”的兼容合同不变。不能简单给 injection 加 `async/defer`，也不能只等待 render，因为静态 import 的模块求值可能已经读取注入配置。这个改动只调整资源发现时机，不新增状态 owner 或 fallback。

### 16. Chat 作为主工作区静态进入首包，次要设置页继续按路由懒加载

决策 15 上线后的真实浏览器 5 次热刷新为 3.33–4.17 秒，中位 3.74 秒。HTML 已经提前发现主 module 和它的静态依赖，compact history 也在 React 之前完成；剩余启动链路仍要等主 module 求值后，React Router 才触发 `chat-page` 动态 import。Chat 是 NextClaw 的默认入口和绝大多数启动落点，这个额外 route chunk 往返属于主路径上的人为瀑布，不应和低频设置页采用相同懒加载策略。

将 `ChatPage` 改为普通静态 import，使 Vite 在 HTML 中直接生成它及共享依赖的 module preload，并让 Router 首次 render 不再经过 route Suspense。模型、外观、搜索、渠道、安全等低频页面仍保留 lazy boundary，避免把所有功能无差别塞进首包。这个取舍允许主入口首包小幅增加，换取消除一次公网往返和一段路由占位；构建后必须记录 entry gzip 增量并用真实 VPS 复测，若首包增量抵消了瀑布收益则回退，而不是仅凭结构推断保留。

### 17. VPS 静态 assets 由 Nginx 直接发送，HTML 与 API 继续归 NextClaw

登录态恢复后的真实浏览器热刷新为 0.57–1.38 秒、中位 1.13 秒；强制绕过浏览器缓存的冷进入为 19.96 秒，其中 420KiB gzip 主 entry 从公网下载本身占 19.44 秒。此时 compact history 已在 2 秒附近完成，不能再通过减少消息或延迟 UI 修复。当前 `/assets/` 仍经 Nginx 反代到 Node，响应使用 chunked 传输；静态资源没有业务鉴权和运行时注入需要，多一层应用代理只增加传输与故障面。

VPS Nginx 为 `/assets/` 建立只读 alias，直接指向已安装 NextClaw 的 `ui-dist/assets`，保留内容哈希资源的一年 immutable 缓存与 gzip；HTML、`/api`、`/ws`、manifest、logo 和其它运行时路径继续走 NextClaw，避免绕过动态注入、认证或未来语义。发布或热修仍原子替换同一 `ui-dist` owner，Nginx 配置不复制构建产物。变更必须先备份完整 server 配置、通过 `nginx -t`，再 reload；回归要证明入口 asset 为正确 MIME、gzip 与 immutable，未知 asset 返回 404，页面认证和消息读取不变。若真实冷测没有收益则恢复原代理路径，不因“静态直出通常更快”而保留无证据配置。

### 18. 拒绝仅按 feature/package 边界强制拆主包

Nginx 静态直出把强制冷进入从 19.96 秒降到 6.33 秒，但 420KiB gzip 的主 entry 仍在一条 HTTP/1.1 连接上耗时 5.92 秒。曾在隔离构建中评估按现有 UI Chat feature 与 NCP/agent-chat package 边界拆成两个稳定 chunk，以利用并行连接并提高跨版本缓存命中。

结果不接受：原 entry 为约 420KiB gzip；强拆后 `chat-workspace` 为 376KiB、`chat-runtime` 为 270KiB，首屏压缩总量增加约 226KiB，最大单 chunk 只减少约 44KiB。目录边界在运行时存在大量交叉引用，强制分块破坏压缩局部性，却没有形成足够均衡的并行块。该实验未进入主工作区、未部署；后续若治理首包，必须先沿真实 import owner 解耦低频能力或引入 HTTP/2/CDN，不能用 manualChunks 掩盖耦合。

### 19. 预压缩静态资产属于 `nextclaw` 发布包合同，不属于单机部署补丁

VPS 验收通过时，`/assets/` 目录包含 318 个原文件和 318 个手工生成的 `.gz` sidecar，Nginx 使用 `gzip_static on` 直接发送它们；但 `npm install -g nextclaw` 会整体替换安装包内的 `ui-dist`，现有发布构建只复制原文件，不会重建 sidecar。于是源码优化已经进入版本，最快的静态传输路径却仍会在升级后丢失。这不是 Nginx 单点配置错误，而是安装、升级和外部静态 consumer 共同依赖的发布能力面缺失。

主合同由 `nextclaw` distribution owner 承担：`copy-ui-dist` 在把 `@nextclaw/ui/dist` 复制到发布包后，为不少于 1 KiB 的可压缩文本资产生成确定性 gzip sidecar；候选限定为 HTML、JavaScript、CSS、JSON、SVG、XML、文本和 source map，不重复压缩图片、字体、归档等已经压缩的二进制资源。当前 UI 约有 115 个候选，原始总量约 7.16 MiB，sidecar 约增加 2.08 MiB 安装体积，换取约 5.08 MiB 的每次冷传输节省。`ui-dist` 原文件仍是 canonical asset，`.gz` 只是同内容的发布表示，不形成第二份业务事实。

发布前验证必须逐个确认所有候选 sidecar 存在且 gunzip 后与原文件字节完全一致；registry 发布后的 tarball 验证重复同一合同。缺失或陈旧时 fail-fast，不能因为 NextClaw 内置 Hono server 仍能动态 gzip 就放过坏包。NPM runtime update 和 Desktop 都消费同一个 `nextclaw` 包，因此不各自生成第三套压缩资产。

NextClaw 内置 HTTP server 继续使用现有动态 `compress()` 和 immutable cache，不要求 `.gz` 才能启动，也不在每次请求中扫描多级目录。外部 Nginx/Caddy 是否直出静态文件仍由部署者显式选择，NextClaw 不修改未知用户的系统配置。对于已经采用 `gzip_static on` 的部署，发布包 sidecar 会在升级后自动继续生效；当前 VPS 同时允许 Nginx 在 sidecar 暂缺时回退动态 gzip，保护非原子安装窗口或自定义构建，但该 fallback 不能替代发布包 guard。响应的 `Content-Encoding` 与静态来源 header 是可观察信号，删除条件是部署者不再由外部 server 直出 `/assets/`。

不采用两条备选：只在当前 VPS 的升级脚本里重新运行 `gzip` 会继续制造单机隐式状态，不能覆盖 runtime update、Desktop 或其它 self-hosted 安装；把预压缩放进 `postinstall` 会依赖安装目录写权限和生命周期脚本未被禁用，且 registry 验证看不到最终资产。也不把 Nginx alias 自动写入用户系统，因为安装路径、TLS、权限和代理拓扑不是 NextClaw 可以安全猜测的产品状态。

## 数据与事件主链路

1. 会话发生标准变更时，`publishSessionChange` 读取 canonical record、计算 context window、写入 message projection 并发布 session summary。
2. Projection 按游标纯读 canonical message page 及已物化的 context window。
3. Server history view 评估工具载荷预算；小消息原样返回，大消息改为 O(1) 聚合摘要、附 detail cursor，并保留真实调用数量与有界工具名称。
4. 前端 history manager hydrate 轻量页，消息 adapter 只处理有界摘要，外层 virtualizer 挂载首屏行。
5. stream 建立时复用既有 gap reconcile 普通 seed，将极重会话从轻量首批自动补齐到 20 条；相同普通页由幂等比较跳过重复状态发布。
6. 用户展开延迟消息，消息组件发送 messageId 意图给 history manager。
7. history manager 使用 detail cursor 请求一条完整 canonical message；并发点击复用同一 promise。
8. 成功后完整消息 overlay 原位替换摘要；消息过程打开，工具活动组按批次挂载卡片。
9. 工具卡真正展开时才格式化该调用的 raw input/output。

## 不变量

- `messageId`、工具调用顺序、状态和最终文本在轻量 view 与完整消息之间一致；详情响应不一致时拒绝覆盖并报错。
- 一个 session/message 同时最多一个详情请求；成功缓存不重复加载，失败不写入 ready cache。
- 预算算法只处理 `final` / `error` 的已结算历史工具载荷；`pending` / `streaming` 的实时状态仍走现有主链路，错误状态、错误文本和生命周期字段在摘要 view 中保持不变。
- 轻量 view 不能用于 edit/continue 的 canonical 输入；需要完整历史的业务动作必须使用 runtime/server owner。
- 工具批次只改变 DOM 展示数量，不改变数据、排序或工具活动统计。
- 切换 session 后旧请求即使完成也不能覆盖新会话。
- 无 cursor 和有 cursor 的历史分页都不得调用 `getSession`、context preview 或 projection update；projection 中缺失的 context window 按 `null` 返回。
- `getSession` 只能读取 summary index、metadata store 和 projection context；不得读取 journal record、调用 context preview 或写 projection。
- summary index 缺项的兼容恢复只能读取 projection meta、metadata sidecar 和 journal stat；不能退回 replay journal，也不能在读请求内偷偷修写 index。
- 无 peer 过滤的 session list 必须在 metadata hydration 前应用 limit；sidecar hydration 的同时在途读取不得超过固定上界。
- 延迟消息无论包含 50、500 还是更多工具调用，首屏最多保留一个工具 part；metadata 中的真实计数必须等于 canonical message 的工具 part 数量。
- summary 页中未延迟消息的工具 part 总数不得超过页面工具数量预算；任一已结算 assistant 消息超过单消息工具数量预算时必须整体延迟，即使它的 args/result 字节很小。
- UI 首次 history 请求默认最多 20 条；显式 compact 响应可按 24KiB 预算缩到最少 5 条，但必须返回指向实际首条之前的稳定 cursor。首次 compact seed 成功后，同一 viewer 对该 session 的所有恢复/reconcile seed 必须回到普通 20 条合同，自动补足到 20 条或会话实际总量，不能要求用户滚动才能恢复近期上下文；后续向上滚动必须保持稳定 ID、顺序和当前滚动位置，不能跳过或重复任何消息。
- Stream-open reconcile 读取到与当前 manager 完全相同的 messages/active-run 时不得发布新 snapshot；任一消息内容、顺序、streaming part 或 active-run 变化时必须继续 hydrate，不能用幂等优化吞掉 gap 恢复。
- HTML 抢跑只允许消费一次且必须匹配 session、limit 与 compact 合同；成功后不能再发重复 compact GET。失败 fallback 必须走原 SDK 主链路，session abort 后不得 fallback。
- 生产 HTML 必须在 head 声明 module entry，同时保留 body 同步 UI injection；构建产物中 entry 只能出现一次，且 injection 在 DOM 顺序上仍位于 body 结束前。
- `nextclaw` 发布包中每个符合扩展名与最小体积条件的 UI 原文件必须存在同路径 `.gz` sidecar，gunzip 后字节完全一致；发布构建重复执行必须得到相同 sidecar，旧 sidecar 不能从源目录或上次构建泄漏。

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

- 单元：字节与工具数量的单消息/页面预算边界、累计小调用、`final` / `error` 终态与 `pending` / `streaming` 反例、按各自压力最大的消息优先延迟、摘要字段、cursor/messageId 一致性、失败不缓存。
- NCP React：相同 stream reconcile 保持现有 visibleMessages/snapshot 引用；同 ID 新 part、状态变化、新消息和 active-run 变化仍提交，现有“live completion 不被旧 seed 覆盖”测试继续通过。
- 单元：延迟消息的聚合计数、distinct 工具名称上界和单个代表性工具 part；500 调用不能生成 500 个前端 tool-card view model。
- 类型：触达 package 的 TypeScript 编译全部通过。
- 组件：小消息无详情请求；大消息首次展开一次请求，成功后自动打开，重开不请求；失败可重试；工具组默认最多挂载 40 张卡。
- API：现有 full response、普通 summary 和 cursor page 合同不变；compact initial summary 在预算内尽量保留最多消息、至少保留 5 条，并把 pagination cursor 调整到实际首条；detail 精确返回目标完整消息。
- 体验：compact 首批为 5 条时先完成首批 hydrate，stream-gap reconcile 随后以普通 seed 自动恢复最近 20 条；首批已经为 20 条或会话不足 20 条时 reconcile 不得重复发布相同 snapshot。stream 首次连接失败不能遮住首批内容，恢复 seed 仍必须自动回到 20 条合同。
- 抢跑：匹配的 HTML 预取成功时 history loader 不重复请求 compact API；不匹配 session、错误 envelope、reject 和 abort 分别证明标准 fallback 或立即退出。VPS 日志中 compact GET 应在其它全局 API fan-out 之前开始，热刷新消息行首次可见目标稳定在 2 秒附近。
- 资源发现：生产构建的 hashed module entry 位于 head，`/api/ui-inject.js` 仍为 body 同步脚本且不重复；浏览器验证注入能力、登录态与会话页均正常。
- 发布资产：隔离构建验证候选筛选、最小体积、确定性 gzip 和损坏检测；`nextclaw` prepack 与已发布 tarball 验证必须覆盖全部候选，不只检查“至少存在一个 `.gz`”。
- 升级恢复：在当前 VPS 用缺失 sidecar 的隔离静态样本证明动态 gzip fallback 生效，再用正式 sidecar 证明 `gzip_static` 优先；实际升级后新 hash entry 仍返回 gzip、immutable 和 Nginx 静态来源标记。
- Kernel：最新页和前序页都只访问 message projection；测试锁定不读取完整 session、不预览 context window、不写 projection。
- Kernel：`getSession` 的测试锁定 summary read model，`publishSessionChange` 的测试锁定 canonical 计算与 projection 更新；旁路摘要请求并发时不触发重复 preview。
- 性能：当前 44 MB 压力会话的 summary 接口首字节应由约 1.45 秒降到 200ms 内；若冷态 projection 首次重建不满足此目标，单独记录为一次性重建路径，不能混入稳定热路径结论。
- 并发首屏：在 200 条 session list、skills、queued-inputs 等正常请求同时发起时，历史 summary 请求不能因 metadata I/O 饥饿超过 300ms。
- 浏览器：同一 URL 冷进入时最近消息出现目标先定为 2 秒内，且首屏阶段无超过 200ms 的长任务；展开最后一条时有即时 loading，加载后可查看完整 500 个调用并逐批显示。
- 线上复现：68 MB 会话最近消息首次可见从约 18.3 秒降到 2 秒目标附近，随后无需用户操作自动补齐最近 20 条；summary view 不超过 80 个未延迟工具 part，并分别记录首批响应字节数、服务器投影读取时间、浏览器首次可见时间和后台补齐完成时间；向上滚动后能连续补回第 21–40 条。
- 回归：普通会话、历史向前分页、刷新、session 切换、流式消息和旧服务端兼容路径保持可用。

如果实现测量证明 2 MiB 预算仍无法达到 2 秒目标，返回 Design 调整预算或 summary 表示；不能靠隐藏 loading、减少历史条数或放宽验收掩盖失败。

## 实现后验证记录

- 同一 44 MB 压力会话的 40 条 summary 响应为 261,853 字节，20 条延迟消息首屏合计只保留 20 个工具 part；最后一条仍显示真实的 500 次调用及 `exec_command`、`write_file`、`read_file` 名称。
- 隔离冷页面连续 4 次最近消息可见时间为 1.13–1.73 秒；首屏挂载 9 个消息行。并发历史请求为 219–281ms，没有再被 session list metadata I/O 饿死。
- 首次展开最后一条时观察到 loading label，完整 4.39 MB detail 约 433ms 后自动打开；过程折叠再打开不产生第二次请求。
- 500 调用工具组首次只显示 40 项，入口显示“继续显示 40 项（剩余 460 项）”。
- 定向回归覆盖 kernel projection/summary owner、server 预算与 controller、UI history 状态和 agent chat 交互；受影响 package TypeScript、ESLint、skill progressive-loading 和 diff-only maintainability 检查通过。
- VPS 真实 68 MB 会话最终 compact 首批返回 6 条：JSON 15,741 字节、gzip 5,739 字节，Server 读取约 109ms；普通 20 条后台补齐为 JSON 85,097 字节、gzip 25,969 字节，前页 cursor 与首批无缺口。
- 浏览器确认每次刷新只有一项 compact GET，随后既有 stream-gap reconcile 自动读取普通 20 条；首批消息无需等补齐即可阅读，未删除数据、未改变向上滚动入口。
- gzip、HTML module 提前发现、Chat 主路径静态进入和 Nginx `/assets/` 直出全部生效后，已登录热刷新 5 次为 0.565–1.384 秒，中位 1.130 秒；初始约 18.3 秒的大会话进入问题在日常缓存路径上已消除。
- 完全绕过浏览器缓存时，Nginx 直出把单次冷测从 19.96 秒降到 6.33 秒；后续 3 次公网波动样本为 10.14–13.86 秒，中位 12.57 秒，主 entry 下载占 9.61–13.27 秒。该剩余瓶颈是 IP HTTP/1.1 公网静态传输，不是会话读取；不能宣称冷启动已达到 5 秒内。
- 按 feature/package 强制拆 chunk 的隔离实验使首屏 gzip 总量从约 420KiB 增至约 646KiB，已撤销且未部署。history hook 则按真实职责拆为 252 行交互状态 owner 与 134 行 seed/prefetch owner，定向 17 项测试、UI TypeScript、ESLint 与 diff check 通过。
