# 上下文压缩韧性：确定性视图与可选摘要

## 状态与用户目标

2026-10-19 调研与设计，尚未实现、尚未改变已发布行为。第一轮参考 Codex、pi 源码形成韧性方案；第二轮按用户指出的几百 MB 会话加载风险补齐性能合同，原先的正确性审查不足以证明性能。范围仍为方案，不执行产品实现或发布。

用户要求的高把握来自架构：模型输出异常不能破坏历史、伪造任务状态、造成无界重试或把会话堵死。测试负责证伪这些合同，不能靠案例数量替代合同成立的理由。

本方案是 Native runtime 压缩失败恢复的能力面补充。实现发布后，下文新合同取代 [原设计](2026-08-08-codex-aligned-context-compaction.design.md) 2026-10-09 章节的“所有源身份必须依次经过滚动模型摘要”和 [截断恢复设计](2026-08-22-context-compaction-truncation-recovery.design.md) 的必要 Markdown 前缀安装门；journal、稳定前缀、近期完整工具轮次、统一 projection 与原子安装继续沿用。旧设计在此之前仍描述已发布实现。

## 证据与结论边界

NextClaw 基线为远程 master `260c43f29a9ddc49623192aac7f696eb3c278262`。本轮已确认的失败机制：

- `ContextCompactionSummaryGenerationService.generate()` 要求多批的每批结果均为 `provider-summary`；任一批进入近期原文 fallback，整体抛出客户完整报错。
- `runAttempt()` 把下一次**总输入**上限设为上次的 70%，固定提示、累计摘要与身份开销不能同步下降；因此“最多三次”实际可能只发出一次请求。
- `buildContextCompactionEmergencySummary()` 从本批最后两条源记录取原文，无法证明承接此前累计历史；外层拒绝该结果有合理的数据保护动机。
- 通用 batch 错误丢失本批 `lastFailure` 等原因；下一次相同请求又从首批开始。
- 第二轮发现加载链仍存在全量 materialization：`SessionRunManager.createSessionRun()` 无 limit 取全部消息；loader 通过 `readAllSnapshot()` 读取全部有效投影，缺失时两遍 journal 扫描；`readMessageOrdinals()` 在内存缓存为空时逐条读全投影；`readMessages()` 按单条完整长度分配 Buffer 后 JSON.parse。UI/controller 的延迟载荷处理在这些读取之后发生，不能限制底层内存和 I/O。
- 故障注入在首/中/末批及 128k 级输入预算均复现该机制。既有相关 39 项与调查探针 5 项通过，不能据此推断客户两次分别是截断、空输出还是格式异常。客户现场数据不可得，不作为方案成立的前提。

探针仅为本机证据：`/tmp/nextclaw-compaction-rootcause-20261019/probe.test.js`，不属于长期回归资产；实施时应把不变量纳入原 owner 的正式测试。

## 上游源码对照

2026-10-19 实际读取并固定源码，不从产品名推断永不失败：

| 对象 | 源码结论 | 对本方案的启发与限制 |
| --- | --- | --- |
| Codex `4635d489254ba6d80eb6d2ef501929b0c617b6ec` local | 克隆历史执行压缩；实际上下文溢出时移除最旧项再请求；历史 owner 同时处理配对；构造摘要加有限用户原文的 replacement history | 对真实容量问题改变输入，用户原文和协议边界独立保护；仍有重试耗尽等失败出口 |
| 同版 Codex remote v2 | 等待完成事件且检查唯一 compaction item；安装 prepared prefix 前校验历史版本和认证 owner，保留实时 suffix；必要时有限 foreground fallback | 候选和安装分离、过期候选不能覆盖新历史；服务端如何生成加密状态不在开源客户端中 |
| 同版 Codex token-budget 路径 | 特定功能路径可跳过模型/服务端摘要、开启新上下文窗口 | 证明“换窗口”与“生成摘要”可分离；不能把该特定路径称为所有 Codex 用户的默认行为 |
| pi `d2e7d8b7c1d31d3661f769d5caef7ba8d50c3e03` coding-agent | 规范 session projection 决定摘要和保留边界；旧摘要与新增历史合并；工具结果序列化有界；文件读写身份从代码抽取后附加 | 机械事实由代码保存，近期原文与摘要分开；没有采用 NextClaw 的多批全成功及完成标记门 |
| 同版 pi 失败与提交 | 瞬态调用走共享重试；`length` 摘要与工具调用被拒绝；成功后追加 compaction entry，再重建视图；overflow compact-and-retry 有一次上限 | pi 也会失败，不能用“开源成熟产品都解决了”作为证明；可复用错误分类、提交顺序和循环边界 |

主要源码入口：

- [Codex local](https://github.com/openai/codex/blob/4635d489254ba6d80eb6d2ef501929b0c617b6ec/codex-rs/core/src/compact.rs)、[history 配对删除](https://github.com/openai/codex/blob/4635d489254ba6d80eb6d2ef501929b0c617b6ec/codex-rs/core/src/context_manager/history.rs)。
- [Codex remote 安装](https://github.com/openai/codex/blob/4635d489254ba6d80eb6d2ef501929b0c617b6ec/codex-rs/core/src/compact_remote_v2_installation.rs)、[安装原语](https://github.com/openai/codex/blob/4635d489254ba6d80eb6d2ef501929b0c617b6ec/codex-rs/core/src/session/mod.rs)、[输出校验](https://github.com/openai/codex/blob/4635d489254ba6d80eb6d2ef501929b0c617b6ec/codex-rs/core/src/compact_remote_v2.rs)。
- [Codex token-budget 路径](https://github.com/openai/codex/blob/4635d489254ba6d80eb6d2ef501929b0c617b6ec/codex-rs/core/src/compact_token_budget.rs)、[OpenAI 官方压缩说明](https://developers.openai.com/api/docs/guides/compaction)。官方说明明确远程压缩项是不透明状态；不能承诺复刻其内部质量。
- [pi 压缩](https://github.com/earendil-works/pi/blob/d2e7d8b7c1d31d3661f769d5caef7ba8d50c3e03/packages/coding-agent/src/core/compaction/compaction.ts)、[序列化与文件身份](https://github.com/earendil-works/pi/blob/d2e7d8b7c1d31d3661f769d5caef7ba8d50c3e03/packages/coding-agent/src/core/compaction/utils.ts)、[session projection/append](https://github.com/earendil-works/pi/blob/d2e7d8b7c1d31d3661f769d5caef7ba8d50c3e03/packages/coding-agent/src/core/session-manager.ts)、[自动恢复](https://github.com/earendil-works/pi/blob/d2e7d8b7c1d31d3661f769d5caef7ba8d50c3e03/packages/coding-agent/src/core/agent-session.ts)。

## 推荐方案与替代方案

选择“原 journal + 确定性 checkpoint 视图 + 可选模型摘要 + 有界原文恢复”。先保证可以构造安全的下一窗口，再让模型摘要改善信息密度。模型不拥有覆盖边界、工具执行状态、权限、预算证明或持久提交。

| 方案 | 优点 | 不能关闭的风险 / 代价 | 决定 |
| --- | --- | --- | --- |
| 修 70% 重试，保留多批全成功，持久化草稿 | 当前 diff 较小，晚批失败可少算一些 | 任一模型内容失败仍能使全链阻断；草稿又引入失效、恢复和存储状态 | 不采用为根治架构 |
| 纯滑动窗口、直接丢弃老模型上下文 | 无摘要依赖，路径简单 | 无任务恢复合同会导致遗忘和重复动作；无法满足连续性 | 不独立采用 |
| 确定性视图、可选摘要、可回读归档 | 把历史保存/边界/预算从模型成功中解耦，失败仍可响应与核实 | 极端降级时需读原文，无法安全恢复的副作用需用户澄清 | 采用 |

不新增摘要服务集群、独立长期记忆库、后台压缩调度或持久批次草稿。优先删除全历史串行摘要的强依赖，并复用原 session/journal/budget owner。

## 用户链路与可保证结果

1. 用户在原会话继续长任务。Native runtime 检测压力并展示现有压缩状态；原始消息不改写。
2. 代码先准备可安装的确定性视图：规则、最新请求的有界原文/引用、近期完整交互、明确的历史范围和恢复入口。容量允许时请求一次模型摘要，合格结果加入候选。
3. 摘要成功且没有新增未恢复范围时继续原请求；摘要不合格、为空、含工具调用、截断、超预算或摘要专用请求失败时，候选仍能以 `recovery-required` 安装。只要有未进入摘要源的有效历史或继承的未解决范围，同样保留恢复态，不能因本次摘要成功解除。界面明确“已保留历史，正在恢复任务上下文”，不能显示完整语义已恢复。
4. 恢复阶段可以查历史、核实结果、回答和提出续做计划；恢复所需信息确实可得时自动读取。无法证明旧约束或副作用状态已恢复时，保持只读并向用户说明具体缺口，只澄清业务状态，不要求客户提供内部日志。
5. 刷新或重启继续读取已提交 checkpoint 的同一边界与恢复状态；取消立即停止新调用且不安装未提交候选。

“始终能安全响应/恢复”不等于“任何未知历史下都能无人工完成写操作”。有限窗口不能无损容纳任意长的全部语义；模型理解也不能由 Markdown 标记证明。此限制必须显式表达，不能把未知当成已完成或无约束。

## 单一路径与确定性合同

### 1. 原始历史与模型视图分离

- journal 是唯一原始事实源；compaction 仅追加 checkpoint 和生命周期事件。新能力不回写、删改原消息。
- checkpoint v2 表达 code-owned 的源范围、保留范围、归档范围、可选摘要及其来源、恢复状态和最终预算证明；`summary` 可以为空，由代码生成稳定 envelope。
- 源坐标使用 session/message ID、part 区间及有效历史 revision；时间戳仅展示，不承担唯一边界。已有 retained part starts/ends 保持冻结。
- 对本次有效历史的每个区间，必须明确是 retained raw、summary source 或 archived-only；raw 投影区间不能重复。摘要可引用 raw 来源，但不能把仅归档冒称已摘要，也不能把“给过模型”冒称语义无损。
- `archived-only` 且未经当前任务恢复的范围强制 `recovery-required`。已恢复证据与用户对新续做范围的明确确认要有来源坐标；不能因后来不再显示该区间就从未知状态中删除它，不能把读取过当作理解正确。
- 归档范围引用原 journal，不在 checkpoint 枚举所有消息 ID；合并连续区间，保留确定性有界 manifest，避免长历史仅身份列表就撑爆预算。
- manifest 以整个旧 prefix 默认为归档，最多 16 个保留/摘要来源区间覆盖默认值；区间数与其模型可见字节都受预算约束，超限的可选区间回归默认归档并保留未知标记。不能用任意碎片列表伪称常数大小；边界引用采用有界 cursor，长外部 ID 不直接膨胀模型输入。工具证据详情按需读取，不复制完整历史工具 ID 清单。
- 先前摘要失效、超大或来源不可验证时转为归档引用，恢复状态只会更保守。以后模型输出正常不能自动抹掉尚未恢复的未知区间。

### 2. 先求解视图，再请求摘要

预算先扣固定规则、实际工具定义、当前请求、近期完整工具边界、continuation、输出 reserve、安全余量及恢复工具响应空间，再给摘要分配可选槽位。旧摘要也占槽位，不是零成本保护项。

最小视图不依赖模型：固定 envelope + 有界任务锚点 + 近期完整边界/引用 + 归档 manifest + 恢复策略。超大用户消息、单个工具结果按可回读的 part/文本范围引用；图片等引用原资产，不能伪造文本已覆盖全部视觉信息。模型不支持必要模态时返回具体能力错误。

固定规则或最小恢复工具协议本身超出模型能力时，明确 `fixed-context-too-large`，指出具体占用项；不能继续压缩历史或重试模型来掩盖配置不可行。

当前 `estimateInputTokens()` 为字符估算，不能当成供应商精确 token 证明。触发、候选、实际 provider surface 和 UI 继续共享预算 owner；结果区分精确 tokenizer 与保守估计。使用已知模型 tokenizer/协议开销，未知方言保留余量并记录估算身份；不能声明对任意未知 provider 有数学硬上界。真实 context overflow 才允许进一步缩小可变输入；若最小视图仍被拒绝，终止为具体容量/协议错误。

### 3. 摘要是可丢弃的内容，不是 checkpoint 协议

- 默认一次摘要调用，provider 瞬态重试由原 provider owner 负责并有独立次数/时间上限；不再按批数放大语义调用次数。
- 摘要阶段总时限默认 60 秒，包含该请求的传输重试；和用户取消使用不同的类型化原因。超时仅放弃可选摘要、进入已求解基线，用户取消终止整个动作；迟到响应不能改变候选或越过安装 revision 校验。主请求仍遵守原 run 的取消/超时合同，不新增并行后台任务。
- 模型只读有界源：可安装的前次摘要与预算允许的新历史；未进入摘要源的区间显式归档。不能强求每条源身份经串行调用后才换窗口。
- 仅完整响应、非空可见文本、无工具调用、预算合格的摘要进入内容槽。内部可继续提示四节格式，但标题、完成注释或 JSON 拼写不再控制历史安装资格。
- 截断、空输出、错误格式、超限、thinking-only、异常 finish reason 均丢弃该内容槽，使用已求解基线并标记恢复；不补写模型遗漏的事实。
- 摘要不能改变覆盖范围、工具状态、权限或恢复标记；原用户/工具内容按数据引用，不能通过摘要提高指令权限。
- 摘要 provider 与主请求 provider 同时不可用时，返回真实 provider 故障；本方案不保证外部模型离线时仍能生成答案，也不把失败伪装成成功。

### 4. 原文回读必须真实可用

现有 `sessions_history` 只取尾部且每条最多约 4000 字符，缺少指定历史位置及片段分页；`session_search` 主要提供会话关键词命中。仅在 checkpoint 放 journal 指针不足以闭环。

在原 `sessions_history` owner 上增加会话内范围读取和不透明 cursor，复用 `SessionManager` / `SessionPersistence` 的分页能力；单条超大消息还须增加完整 part/文本分片读 contract，不能把 UI preview 当完整证据，也不能先加载全会话再截成一页。复用同一授权后的精确 session ID，cursor 绑定 session、revision、message 和范围，不能跨会话或越权读取。

返回稳定 message/part 坐标、工具身份、已观察到的结果、截断标记、下一 cursor 和剩余范围；每页服从当前恢复窗口的字节/token 上限。不能绕过 tool registration、平台授权或存储 owner 直接读宿主文件。Native 的本地/托管宿主都必须实现同一 contract；缺少注册或读权限时明确 `history-unavailable` 并阻止自动副作用恢复。

### 5. 恢复与副作用边界

- 压缩只处理事实，不执行或重放工具。工具 call ID 与结果记录从原事件确定性读取；“有调用/返回”不等于业务成功，不从命令名或模型总结推断完成。
- `recovery-required` 由 runtime 在实际 dispatch 前执行封闭工具白名单：本会话原文读取与已核验的只读核实操作。未知扩展、通用 exec、发送、写入默认不在白名单，不能仅靠 prompt 禁止动作。
- 单次原 run 最多 8 次自动历史读取、每页服从输入预算；读取新证据必须推进 cursor。同一 cursor/证据重复不算进展。用尽后仍缺关键状态，返回具体恢复结果和澄清项，不自循环。用户随后主动要求继续可开启新的恢复预算。
- 退出恢复态不能由模型写 `done` 或读取页数触发。代码须确认需核实的操作状态有原执行 owner 的证据、必要锚点可读且未知条件已被明确解决；不能证明旧约束完整性时不自动放开写动作。必要时用户对已展示的续做范围明确确认，保留确认来源。
- 无任意工具的通用 exactly-once 承诺。幂等 key 与外部副作用确认仍归原执行 owner；压缩负责不自动重放、不丢失已知证据、未知时不放行。不能按命令字符串去重或因模型换 call ID 就推断动作不同。

### 6. 候选、提交与恢复只保留一个 owner

preflight 生成候选；journal ingestion 的同一会话串行写入口在校验并追加 marker 时负责提交。安装时在同一写边界验证源 prefix/revision，重新组装实时 suffix 并求完整预算。rewind/edit 或源内容变化使候选失效，不能用过期结果覆盖；纯追加 suffix 原样保留且只投影一次。

拒绝过期候选后本 run 只允许一次基于新快照的重新求解，不形成追赶循环。取消检查必须在持久化线性化点之前；已原子提交后到达的取消保留已提交事实并取消后续 run，不能靠删除 marker 回滚历史。

只有持久化成功才发布 compressed。journal 追加成功而 metadata/UI 投影失败时，从已提交事件幂等重建投影；追加未成功时保留旧 checkpoint。metadata 不成为第二安装真相。

原请求若实际 overflow，仅允许在新 checkpoint 已持久提交且输入确实缩小后自动续跑一次。相同 source fingerprint 下不得反复触发相同压缩/原请求回放。

失败诊断归原 checkpoint/run 事件，保留 request ID、源 revision、预算估算身份与数值、可见 finish reason、实际调用数、超时/取消原因、恢复模式及存储阶段；不在最终错误中覆盖原 cause，也不默认记录完整客户原文或凭据。观测用于定位外部故障，不作为上述安全合同成立的前提。

## Owner 与传播范围

| Owner | 本次职责变化 |
| --- | --- |
| core `ContextCompactionService` 与 checkpoint contract | 确定性范围/保留计划、v1/v2 读取和有界基线，输出预算约束；无 provider I/O |
| kernel preflight / summary generation | 先求基线，再可选摘要，错误分类、质量诊断；删除全批成功门和按总输入 70% 缩减的语义重试 |
| 原 journal ingestion / projection / SessionManager | revision 校验与追加的单一提交点，冻结区间、冷恢复、精确原文分页 |
| 原 runtime 与工具执行入口 | recovery 状态、只读 allowlist、读取进展与自动续跑预算；不复制压缩算法 |
| 原 history tool / portable provider | 游标与分片回读；本地、托管注册与权限一致 |
| provider / budget owner | finish reason、usage、上下文能力、瞬态错误的规范语义，完整输入预算 |
| server / UI / SDK 消费者 | 传播 v2 与恢复状态，显示真实状态；不重新推导 covered 边界或在前端容错安装 |

不建立新的 recovery manager、task ledger 或 archive 数据库。新增字段服务现有 checkpoint 的真实消费者；不能只在生成端扩 union 而遗漏 parser、持久化、冷读、context snapshot、transport、SDK 类型与 UI。

## 性能合同：归档规模不能决定打开会话的工作量

### 已确认的历史问题与本轮测量

[既有大载荷治理](2026-08-19-chat-heavy-tool-payload-loading.design.md) 已证明响应摘要化、前端虚拟化不能弥补隐藏全量读取；[journal 增长设计](2026-09-29-session-journal-growth-reliability.design.md) 记录过用户 488.6 MB、约百万行的会话。delta 合并减少文件外壳，未保证所有读取都与历史长度无关；不能把旧治理的局部收益当成本方案已满足性能。

本轮对仓库原 `NcpAgentSessionMessageProjectionPersistenceStore` 做真实文件读取探针。所执行文件与本方案基线对应源码相同；fixture 为 4096 条、每条约 64 KiB 文本，消息投影约 256.7 MiB，另有单条 64 MiB 样本。环境 Node 22.23.2、macOS arm64 Apple M4/16 GiB。文件刚生成，OS 页缓存热；cold 指内存 ID 映射为空，不代表物理磁盘冷缓存。

| 操作 | FileHandle.read 逻辑读取量 | read 调用 | 单次本机耗时 |
| --- | --- | --- | --- |
| 最近 40 条、无 tail | 2.51 MiB | 41 | 2.5 ms |
| 最近 40 条、一个 tail、cold ID map | 259.24 MiB | 8233 | 394.5 ms |
| 同一 tail、warm ID map | 2.51 MiB | 41 | 1.9 ms |
| readAll，供全量运行态装载 | 256.73 MiB | 4097 | 240.5 ms |
| 仅取一条、该条 64 MiB | 64.00 MiB | 2 | 48.4 ms |

这证明读取放大机制，未测 HTTP/浏览器、完整 Runtime hydration、冷 OS 缓存、低配 VPS 或托管存储。逻辑读取字节不是物理磁盘流量；单次毫秒数不是 p95/SLO。测试进程还包含 Vitest 和前序 fixture，不能把观察到的总 RSS 直接归因为一次请求的内存增量。探针 `/tmp/nextclaw-compaction-rootcause-20261019/perf.test.js`，两项定向检查通过；合成数据已删除，未读取或修改客户会话。

### 热路径与归档分开

定义 H=全部归档字节，W=受字节上限约束的运行窗口，P=受上限约束的页面/片段，D=尚未投影的受限尾部，N=索引条目数：

- 普通首屏、展开一页、精确回读的读取与解析量为 O(P+D)，加索引定位 O(log N)；不允许 O(H) 扫描。已索引的旧历史从 50 MiB 增长到 500 MiB/2 GiB，不能使普通页读取量随之线性增长。
- Runtime 冷装载与每轮 projection/compaction 计划只处理 O(W+D)，不先载入 H 再做 `slice`、`filter`、`structuredClone`、估 token 或求 hash。全历史数组从这些热路径的输入合同中退出。
- 派生视图写入只更新受影响消息/part、执行归属索引与有界窗口；单个 delta 不重写累计派生消息或重算整个历史。原 JSONL 继续沿既有 ingestion delta 合并合同保留事实；上游累计 MessageSent 快照的原始写入放大尚不能据此宣称消除，必须单独计量序列化时间/写入量及并发读延迟，不能擅自删除这类事件。
- 全历史重放、校验、索引重建与用户显式全量导出可以是 O(H)，但必须是可见、可取消、有进度和资源预算的独立维护路径，不能隐式串在普通分页/打开请求里。

### 必须改变的读取与运行入口

1. **存储层即区分轻量描述与正文。** 写入/投影时生成有界、确定性的消息描述、part/正文范围、字节数、工具数量和定位索引；页面只取描述和预算内正文。大参数、结果、推理、base64 与附件正文按范围或资产引用回读，不在服务端先解析整条再截短。已有图片/asset owner 继续复用，不额外复制一份归档。
2. **ID 定位不能靠读完全部正文建 Map。** 在原 projection owner 维护持久的 message ID/ordinal、tool-call owner 与正文位置索引，增量更新并与投影同代发布；本地复用已有索引存储能力，托管宿主使用其原持久化的按键/范围查询。缓存仅是加速，不是满足性能的前提；禁止一次命中不了就扫描全历史，禁止每次读页为校验有效性 hash 整个文件。
3. **运行态只装载可执行窗口。** 原 SessionManager 提供按已安装 checkpoint、必要边界和新 tail 构造的 bounded run seed；SessionRun/runtime/preflight/model builder 消费同一受限视图和来源引用。完整 transcript 仍由 journal/projection 拥有，不能把截短数组写回原消息集合。活跃 assistant 的新增 parts、工具归属与待确认结果使用索引补齐，不能靠保留全历史碰巧找到。读取路径禁止回退无 limit 的 `listSessionMessages()`/`getSession()`。
4. **尾部与巨大事件也必须有界。** 持久元信息记录最后有效事件边界与投影 watermark；正常读最多处理受限 D，超限进入追赶状态。不能为找最后 seq 对一个巨型 JSON 行逐 64 KiB 拼接反复 parse；不能用 readline 就宣称峰值内存有界。老大行在维护路径中以增量解析/分片建立索引，不在用户请求中 JSON.parse 整条。
5. **索引恢复不劫持前台。** 现有 listPage 的 `loadSession -> rebuild` 和 degraded `readJournalPage -> full load` 从正常路径退出。索引缺失/损坏时立即返回明确的 preparing/catching-up 状态及可验证的小型目录信息；有上次有效视图时可以读取它并显示尚未追赶，不把它当最新。原 projection owner 负责一次流式、可断点重建；同会话去重，不能每次刷新重启扫描。
6. **浏览器只消费轻量页。** 保留已有 compact 首屏、折叠摘要和虚拟化；part、工具参数/结果仅在明确展开时分片取回和格式化。流式活跃消息同样受窗口/对象预算约束，不能以 streaming 为由恢复无限制累计复制。前端缓存按字节设限，切换会话取消请求；旧历史仍可继续分页，不能把“快”实现为永久不可查看。

运行和历史消费者的依赖面应只暴露“有界窗口/范围读取”意图，避免继续注入包含全量加载方法的整个 SessionManager 后靠调用约定维持性能。读入口只报告需要维修；原宿主/会话就绪入口通过显式 prepare/maintenance mutation 驱动同一 projection owner，不把隐式写入和全量修复重新塞回 `listPage`。

这些是同一用户能力的 Required 变化。不能只修首屏传输或只改摘要器，留下 Runtime seed/托管分页继续全量加载。原 SessionPersistence 的分页接口不足以自动满足合同：当前托管 `CloudflareSessionStore.listSessionMessagePage()` 也先 getSession 再 slice，必须一并改为实际范围读取。

### 资源预算与等待目标

以下为实施前冻结的初始验收预算，尚未达到或实测；实现若无法满足须回设计说明取舍，不能把目标改写成已实现事实：

| 路径 | 资源/结果上限 |
| --- | --- |
| 打开普通已索引会话 | 不调用 LLM、不扫描归档、不同步写/重建索引；保留既有 compact 首包约 24 KiB 预算，普通页最多 256 KiB UTF-8 JSON，超大单条只返回有界描述与 cursor |
| 正常页/精确历史片段 | 总逻辑读取（含 index/tail）最多 4 MiB/请求，单次正文片段最多 64 KiB；消息条数限制之外再设字节上限，超限必须有 next cursor |
| Runtime seed / 本地压缩计划 | 活跃数据 W 最多 8 MiB（同时服从更小模型预算），最多 256 个消息与 1024 个 part；巨型/高对象数量载荷仅给有界描述及引用。额外 JS 堆增量目标最多 32 MiB/会话装载，禁止复制 H；大工具产出自身的执行内存另行归工具 owner，不混入此加载保证 |
| 索引追赶/重建 | 全实例最多 1 个维修任务，流式解析工作内存最多 64 MiB，分片让出事件循环；前台不等待整次扫描。进入 preparing 的控制响应目标 500 ms 内，不能承诺无索引的任意旧格式立即完成首次初始化 |
| 并发与缓存 | 同实例最多 2 个冷窗口装载；不活动会话视图缓存按字节 LRU，默认总量 64 MiB。活跃 run 不可直接驱逐，超出运行容量由原调度入口排队；同一会话打开/恢复 single-flight |

参考服务端验收机先冻结为 Linux x64、2 vCPU、2 GiB RAM、SSD、Node 22.23.2，并记录实际磁盘/网络条件：健康索引下普通 messages API p95 目标 300 ms 内（不含公网 RTT）；参考客户端为 M4/16 GiB、固定 Chrome 版本和生产构建、50 ms RTT/10 Mbps 下行，app shell 已加载且静态资产 warm、会话数据 cold，点击会话至近期消息可见 p95 目标 1 秒内。全新浏览器冷资产场景另报完整结果，不混用这一门槛；恢复/维修并发时同一控制接口 p95 不超过 500 ms。每个条件至少 30 次，报告 p50/p95/最大值、逻辑读取、堆/RSS增量、event-loop delay 与响应体；分别报告进程冷启动和 warm，OS cache 状态单独记录。以上是待实现门槛，M4 上的单次读盘结果不能证明其通过。

摘要模型等待与会话加载单独计量：打开会话不触发摘要；本地基础视图求解在已装载 W 上 p95 目标 50 ms 内。原摘要总时限 60 秒是异常上限，意味着压缩任务仍可能等待，不能用首屏变快宣称任务无延迟。后续须用代表模型报告摘要 p95、首 token 与降级比例；若正常摘要频繁触及上限或频繁迫使用户澄清，方案不满足整体可用性，须调整源/输出预算与等待策略后再交付。

### 首次升级与损坏不能靠缓存掩盖

已有健康索引从中增量生成新描述/运行视图；无法证明完整性的旧索引不冒用。首次遇到无索引的数百 MB 旧文件，精确恢复通常必须至少读一次 H，这是信息条件导致的下界，不能承诺零等待。通过可见 preparing、流式重建、检查点和后台限速承担该一次性成本，后续访问从持久索引恢复；不要求用户手工删文件或反复提供日志。

必须同时覆盖“大物理 journal、小有效视图”“大有效正文”“单条巨型记录”“百万短 delta”“索引缺失/损坏”“长未投影 tail”“10 会话切换/并发”。永久返回一个很快的 loading 或恢复状态不算验收：维修要测到可继续分页和续跑的最终状态，读取总代价至多一次必要全扫描加增量，取消后可从 watermark 恢复。托管宿主按同一字节合同记录实际存储读取与内存，不能仅用本地结果替代。

## 故障预演与设计防线

| 故障类 | 结构性处理 | 允许的最终结果 |
| --- | --- | --- |
| 任意空/乱码/截断/格式异常摘要 | 内容槽可丢弃，基线不依赖生成 | recovery-required，仍可响应/回读 |
| 上千短记录、身份很长、超大单条/工具结果 | 区间 manifest、字节有界来源片段与分页，不串行强制全摘要 | 有界视图或明确必需输入不适配 |
| 固定 prompt/工具 schema 过大、模型缩窗、估算误差 | 固定/可变预算分离，完整请求校验，真实 overflow 有界收缩 | 继续或具体容量错误，无相同输入死循环 |
| 429/5xx/流断开、鉴权/配置错误 | provider 有界瞬态重试，终态不语义重试 | 真正可用时继续，否则具体 provider 错误 |
| 用户取消/进程被杀/marker 写入中断 | 单一持久提交点、恢复 orphan marker | 旧或完整新 checkpoint，绝不半装 |
| 生成中追加/编辑/rewind/切模型 | prefix/revision 校验与当前 suffix 预算 | 采纳有效候选或有界重新求解 |
| 多次压缩、冷重载、旧摘要损坏 | 有界 manifest、未知状态保守继承、统一 projection | 不复制工具尾部，不冒称未知已恢复 |
| 工具已执行但未确认、归档含用户旧限制 | execution 原证据、历史回读、恢复态写动作闸 | 先核实；无法证实时澄清，不自动重做 |
| 存储不可读/写、回读工具缺失/无权限 | 不安装不可恢复候选，不提升访问权限 | 旧 checkpoint 与明确 storage/history 错误 |

## 为什么无日志也能有较高把握

设计证明的边界分开：

1. **保存性**：压缩只追加视图索引，历史不删除；候选无写权限，因此模型任意输出都不能破坏原历史。
2. **结构完整性**：覆盖/归档/保留和工具边界来自代码；安装验证同一源 revision，不能由摘要伪造。归档可读性是提交条件。
3. **局部推进性**：在存储正常、模型至少容纳最小恢复请求且主 provider 可用的前提下，摘要失败不阻止构造/提交恢复窗口。总摘要调用次数与历史批数无关。
4. **终止性**：一次摘要、一次候选重求、一次 overflow replay、八次有进展的恢复读取分别有预算；provider 的独立重试也有次数和时间上限，不存在无界递归或相同状态循环。
5. **副作用隔离**：恢复态的工具 dispatch 由代码限制，模型编造完整摘要/成功标记不能越过；未核实业务条件不自动解锁。
6. **语义限制**：源覆盖、标记完整、回读完成均不能证明模型理解正确。任意历史的无损语义压缩、任意外部动作 exactly-once、供应商永不宕机不在可证明集合；必须通过可回读证据与保守停止管理，不能用成功率数字掩盖。

因此验收的核心反例是“让摘要器永远失败”。在此前提下，系统仍须守住保存、结构、预算、有限调用与只读恢复；不能仅用一个好模型的成功演示证明韧性。

## 实现验收与交付门

本轮交付设计文件与源码证据，非新运行版本。`design-document: required`。后续实现跨 checkpoint/runtime/history/tool contract，`plan: required`；实施前须形成执行计划并完成方案 Review，不以本轮研究报告替代运行验收。

黄金验收：

- 原 UI/渠道发起长任务 → 多次自动压缩 → 成功路径保持原任务、约束、完成证据和下一步；压缩不新增工具副作用，冷重载投影相同。
- 同一路径令摘要器永久空输出/拒绝服务 → 安装明确恢复窗口 → 自动读回真实原文 → 只读回答/核实；不能恢复的条件只问具体业务澄清，不再出现 opaque batch failure，也不默默重做动作。
- 压缩生成中取消、刷新、重启、追加、rewind → 只观察旧 checkpoint 或完整有效的新 checkpoint；后续消息与 parts 恰好投影一次。

正式验证针对不变量：property-based 随机历史/part 边界及预算、状态模型的提交/取消/并发转换、摘要永久失败及每个 I/O 边界故障注入、v1/v2 读写和旧数据、跨本地/托管 history 回读权限与大消息分片、实际 provider 多轮长任务。TypeScript、原 diff-only maintainability、匹配文档与真实入口验证按触达范围执行；测试通过不代表未测试模型和任务无语义遗忘。

上线须同批覆盖 core/kernel/runtime/server/UI/history portable provider 和真实托管存储适配；新增 v2 由新版本读取 v1/v2、只写 v2，不物理迁移旧 journal。不为旧 checkpoint 伪造来源覆盖证明；首次遇旧数据重新建立可验证来源，必要时进入恢复。旧二进制不支持 v2 的降级运行不宣称兼容，应明确拒绝或使用已验证的完整 journal 恢复入口。

原设计只加本补充方案链接，当前运行事实不改写。本轮不增加 changeset、NPM/Desktop/runtime release，也不声称客户故障已上线解决。

## 本轮方案审查结论

`design-review: passed`，范围仅限本文架构与后续验收合同，不表示新实现已通过运行验证。审查过的反例及已落实的设计修正：

- 好摘要不能掩盖未进入源的历史：archived-only 强制继承恢复状态，结构覆盖与语义完整分开。
- 巨量碎片不能令 manifest 变为新超限源：默认归档加有界覆盖区间，不枚举全量身份。
- 用户指出性能缺口后，原正确性审查结论在性能维度失效。本轮补查存储、Runtime seed、UI 与托管入口，用原 store 的 256 MiB/64 MiB 合成探针确认隐藏全量读取，新增复杂度、字节/内存/等待预算和索引损坏的可见维修合同；以上为架构审查，所有新性能目标仍待实现证明。
- “原文仍在磁盘”不能冒充可恢复：精确范围、单消息分片、两类宿主注册与授权为实施 Required 条件。
- 模型自称恢复不能解锁动作：dispatch 白名单和未知业务条件的确认边界属于 runtime 合同。
- 迟到生成、取消和追加不能越过提交边界：source/revision 校验、单一串行追加与线性化点明确。
- 任意 tokenizer/模型永久离线不能被设计假装解决：条件化预算保证、外部故障和语义限制已披露。

后续不必等待客户日志才开工，但实施时若上述任一 Required 条件缺失，不能仅以删除当前错误文案交付。研究证据与方法纠偏已回写本专题及原设计入口，不新增全局提示词或治理规则。
