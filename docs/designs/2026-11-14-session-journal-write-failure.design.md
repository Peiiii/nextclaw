# Issue #73：会话持久化失败边界

## 用户结果、来源与现状

来源与 active contract `JRN-20261114` 归[本批日志](../logs/2026-11-14-session-journal-write-failure/README.md)。用户要求先复现、修复、充分验证后发布新 stable，全平台沿本 chat 已明确的 Desktop 范围。

0.59.4 真实 journal + coordinator + SessionRun 复现：将目标 journal 临时替换为目录，真实文件访问失败后 actor 仍新增消息，而恢复文件并冷加载只有先前内容；50 次后续事件触发50次报错，锁存 stack 不展示原 cause/code。原机0.59.1与其原始JSON触发未取得，不能把合成磁盘故障等同原机根因。锁存是 ingestion 内 per-session Map，非持久状态；原文日志并不会因为锁存本身被删除，未写入内容则无法在重启后重建。

现有链：native/external runtime → SessionRun.applyEvents → actor；运行观察器广播 ncp event → ingestion 的异步 append → journal/派生 projection/catalog/preview。只有压缩终态在 actor 之前等待 persist。此为同一持久化能力的边界缺口，不需要第二套日志、后台重试器或新 runtime。

## 冻结主路径与不变量

1. **确认写入再提交 actor**：SessionRun 对所有 durable 事件调用已有 persistSessionEvent，ContextWindowUpdated 仍为非持久事件。沿用 ingestion WeakMap 去重和有界100ms/16KiB流式 delta 合并；这是有界的暂态流，不承诺硬件故障期间仍能保存新内容。非delta终态必须先排空之前delta，避免最终成功先于落盘。
2. **首个故障唯一归 ingestion**：首次非预期持久化异常转为内部 `SessionJournalWriteError`，保留原 cause。每会话保存同一个首次异常并只通知一次，不用后续锁存 wrapper 覆盖原因。显式取消/压缩 stale 属于 rejected commit，不进入磁盘故障；真实写入失败即使成功回滚也必须停止运行，因此 rollback 标明 journalWriteFailed，区分合法拒绝。
3. **停止与通知**：coordinator 使用已有 RunError 事件发布一次明确的存储失败通知（独立的临时 source，不能冒充已持久事件，也不回流写入）；原活动 runtime observer 订阅该 source，通知对应 SessionRun abort active controller、清空待运行输入、停止状态，并在 run finally 解除监听。SessionRun 的直接 persist 异常同样关闭该 actor，防止启动前/离线调用漏通知。其它会话不受影响。此通知明确当前运行无法保存，不制造成功 checkpoint 或虚假的历史。
4. **原运行错误路径不递归写坏盘**：运行观察器与启动失败处理识别存储异常，不再尝试把同一错误再持久化为新的事件。finally 仍结算/释放 claim/capacity、清理 runtime；队列已清空，不自动开启下个运行。observer 发布正常事件时使用既有 persisted source，避免完成消息的 UI 投影 clone 被再次写成第二个完成事件；所有既有运行 producer 已通过 SessionRun.applyEvents。
5. **诊断与恢复**：日志只输出首个原因链的 name/message/stack/code/errno/syscall/path，不输出整个用户事件/供应商配置。锁存在 dispose/restart 时清除；恢复后从已保存 journal 重建，已有 torn-tail 隔离保留路径继续有效。真实 chmod 复现确认 loader 把 EACCES 错当不存在返回 null；只在 ENOENT 返回缺失，权限/IO 异常保持原 code 显式失败，避免把存在的历史当作新会话。原始坏记录/原用户未落盘内容不伪称修复，不做无证据的历史删除或自动覆盖。

沿用现有 EventBus、ingestion、SessionRun、运行请求与 observer owner。只新增内部错误类型/格式化 utils，不新增服务、公共 NCP variant、持久 schema、配置开关、备用存储或自动重试。正确性优先于悄悄重试坏事件；实际故障解除后按明确提示重启恢复写入口。

## 黄金验收与矩阵

- 正常用户发送 → 原 native runtime 调用真实可用模型 → delta有界合并/终态落盘 → 完整回复 → 冷重启可读；UI投影不二次写入或覆盖完整来源。
- 当前会话写盘失败 → 原因一次记录、用户看到RunError、controller停止、待运行队列清空 → 后续事件/发送明确失败 → 不出现持续内存成功；另一会话能继续并冷加载。
- 恢复文件访问并冷启动 → 已有消息与会话目录仍在、未完成运行成为明确中断 → 正常新消息可保存。坏行/尾部已有来源保留，不能通过删除session冒充恢复。
- 大于20MiB历史、多轮压缩、高频文本/推理/Unicode/tool参数 → 成功结束后完整冷回放；注入 write/open/metadata/flush失败、正常取消、stale压缩冲突覆盖相邻边界。
- 匹配 tsc/lint、定向集成、真实模型及原公开安装升级流程；设计不改变界面布局，错误沿现有 RunError 展示，必要文档说明停跑与恢复操作。新 stable NPM/Runtime/Desktop 全平台由原父流程完成。

## 方案审查

design-document: required；plan: not-required（单批修复原链路，状态沿活跃日志）。

## 发布兼容与时序补充（scope revision 2）

## 用户纠偏后返工（2026-11-15，scope revision 3）

旧结论失效：用户指出“有日志为什么定位不到、为什么复现不出来；停机方案可能让产品更不可用”，要求补日志并恢复真实可用性。当前先冻结有直接证据的两处修复，不把它们等同于原反馈机器的首次触发已经查明。

修前基线：实际FileLogSink写入/查询会丢掉Error.cause、code/errno/syscall/path/dest；真实journal已提交后，catalog upsert故障仍进入永久failedWrites，actor拒绝后续输入；真实metadata chmod读失败发生于已提交RunStarted之后的activity preview，同样误锁session。历史本机日志中13,422条deleted_at错误与临时文件rename ENOENT可证明“持久化链报错”并不等于源journal写入失败，不能直接替代原机证据。

本批主链路：canonical append成功→actor可应用；后续消息投影、目录索引、会话预览单独报降级诊断，由既有读端prepare/下一事件重建或更新，不永久锁会话。真正canonical/业务metadata失败仍明确阻止未保存的续跑；其自动恢复、队列保留与原事故直接触发作为未闭合项，不因本批通过而宣布整体完成。

日志唯一owner：core内部log-error.utils只投影白名单错误字段与有界cause/AggregateError子链，由ScopedAppLogger和FileLogSink共同消费；不复制配置、请求或消息内容。coordinator以现有console mirror传入Error对象与event/sessionId/correlationId/eventType/operation/commit状态，按日志query读取验证，不再提前把异常压成stack字符串。canonical文件append移入独立store函数，明确serialize/write/sync/rollback/close阶段与offset/seq，rollback异常保留原始cause。

黄金验收：①真实落盘日志经过查询仍能定位底层rename EPERM与目标，不含任意配置字段；②真实源journal已提交、derived catalog短暂失败→不中断→恢复后下一消息/冷开完整；③真实metadata只读权限失败于preview→journal/actor继续→恢复权限后正常读；④真实canonical写/JSON失败仍不冒充成功，首因与回滚结局可见。

11:45补充直接证据：真实日志目录chmod不可写时，LoggingRuntime.writeRecord的sink异常向业务调用方传播。归入同一日志能力面缺口；冻结修复为既有LoggingRuntime捕获write失败，按一次故障期向原始stderr保留日志IO首因及原业务Error白名单，禁止console递归；后续记录继续尝试原sink并在恢复后正常写入，不永久禁用日志。验证真实权限失败不再使业务logger调用抛错、连续失败只一次告警、恢复权限后实际文件重新写入。补充design-review: passed，不修改日志读取/query失败的CLI可见错误语义。

design-review: passed（仅本批）。反例审查：不能把业务metadata写失败吞成成功，不能把source读取/append/rollback失败归为索引降级，不能让rollback/close异常覆盖首次异常；不能仅检查console spy代替落盘/查询；所有新增日志不记录消息正文或任意错误附带对象。原机首次异常及持久故障后的恢复仍是开放Required，不发布“已完整解决”的结论。plan: not-required（本批单批闭合，整体状态沿原日志恢复）。

### 同进程恢复与输入保留（scope revision 4，2026-11-15）

本节替代上文“故障清队列、强制重启”的旧语义；其余已验证的先保存后应用仍保留。design-document: required；plan: not-required（顺序闭合本节，状态复用原日志）。

用户链路：正常聊天期间短暂磁盘故障→当前运行停止并明确未保存→已确认接收、尚未执行的输入仍在原队列→用户恢复磁盘访问并在原聊天继续发送→系统等待旧运行及runtime清理结束、核对已保存历史、解除本会话故障→原队列按顺序运行，新输入随后正常回复→冷重启能读到保存的回复。存储仍坏时，本次继续发送明确失败，原排队输入仍保留；其它会话始终可用。不会自动重演已开始执行的运行或工具。

选择原链路上的显式重试，而非后台定时反复启动（会反复执行工具），也不要求整程序重启（额外损害可用性）。SessionRun拥有活动执行的结束屏障及恢复互斥；beginNextRun创建执行lease，request manager在runtime真正开始及observer最终结算时通知原actor。终态事件不等于runtime已退出；故障后不得在清理完成之前恢复。仅已被请求入口确认接收、且尚未进入runtime的启动失败请求可回到队首；未确认接收的失败请求不暗中执行。未消费的steering回原队列；已消费的输入不重放。

SessionPendingInputs继续唯一拥有待执行输入及确认状态；不新增持久队列/备用数据库/schema。保留指当前进程生命周期，不能冒充断电后未执行输入也可恢复。SessionRun恢复等待执行settlement及eventChain，复用SessionManager的recoverSessionRun；后者沿原coordinator/ingestion排空已在途写入，在故障锁仍生效时调用原store prepareSessionHistory(retry,wait)、读取metadata摘要与bounded run seed。成功后才清除ingestion故障并hydrate同一个actor；恢复失败保留原故障及全部未执行输入，记录带真实cause的恢复诊断。并发新发送共享一次恢复，不替换actor身份。

本地store既有prepare负责隔离保存torn suffix并校验/重建projection，完整坏JSON不得跳过。retry准备成功后失效旧nextSeq缓存，防止rollback失败后沿用旧序号。该链路不创建第二个journal writer，也不在load/get中暗加恢复变更。主路径由既有owner承担，无通用recovery manager、timer、重试策略注册表。

12:39恢复反例补充：只读验证可以在磁盘仍满时成功，随后已接收队列立即再次失败。故SessionManager在锁仍生效时还须经原store append提交一个无正文RunMetadata（kind=session_storage_recovery），作为真实恢复写边界；提交成功并读seed后才解锁。不是回放失败事件，也不创建第二writer。该补充关闭“只读可用误认写入恢复”的finding，design-review: passed。

冷catalog扫描同类缺口：lightweight失败可用原来源回退；来源也不可读则保留原文件、记录底层cause并隔离该会话，不能阻止其它会话启动。metadata已提交后catalog失败不得倒报canonical失败。日志投影总节点64、深度8、Aggregate分支8，防止有界深度仍指数膨胀；日志初始化及写盘故障都只能走有界stderr诊断，不可抛回业务。

JRN-12验收矩阵：真实文件写入失败/恢复；启动前失败与已运行后失败；已确认queued与未确认新请求；未消费steering；存储持续失败与第二次恢复；恢复时旧runtime尚未退出；两个新发送并发恢复；既有取消/正常队列；成功回复冷读与源文件不删除。JRN-09原机首次触发仍为Required，不能用本节注入测试代替。

实现审查补充：同actor恢复与冷创建共享prepareRunMessages，使用同一份bounded context完整性检查及原来源checkpoint安装；不能在恢复时跳过大历史的缺失保留项或archive确认边界。队列确认的成员关系由SessionPendingInputs就地判断，不为查询id克隆全部排队正文。相关设计复审通过，复验原context continuity与新原地恢复场景。

12:58日志初始化复现补充：FileLogSink默认路径虽然不再创建logs，但getDataPath仍会提前mkdir data home，父目录不可访问时在LoggingRuntime捕获之前抛错。原路径owner分离纯resolveDataPath与确保目录存在的getDataPath；FileLogSink constructor只解析路径，mkdir由原ensureReady/writeRecord边界捕获。真实chmod父目录、home尚未创建的失败用例修前红，修后须能初始化并在权限恢复后写回原日志位置。未改变数据home的配置语义，补充方案Review通过。

mode=design复审：旧actor直接重置会漏掉旧runtime并发；重启actor会丢输入和监听身份；后台自动重演会重复工具；读seed前清锁会容许新事件竞跑。以上反例由同actor结束屏障、原owner互斥恢复和确认/执行边界共同关闭。没有新增外部协议变体、依赖或存储迁移；设计范围及验收完整，design-review: passed（本节，原机根因仍待直接证据）。

0.44旧壳在Node20.18.1加载candidate时，history preparation明确失败于缺失 `@libsql/win32-x64-msvc`；candidate新壳已成功读出原消息。上一任务同路径同位置失败。冻结增量：沿原native resource owner复制目标平台libSQL binding，原bundle资产合同验证实际`.node`文件；不新增数据库fallback或整目录依赖复制。Windows smoke只对显式queued/preparing有界等待，失败立即保留原因。由Node20真实隔离bundle读写冷开与Windows focused原升级链证明。

父流程在NPM artifact先就绪后启动Runtime promotion，原selector仅接受整条prepare成功，精确源仍运行即失败，prepare随后真实成功。冻结增量：同selector优先已成功，否则只选精确源active run，Actions owner等其成功再promotion；其它source/失败cell不接受，不增加Agent轮询。0.59.5 NPM已不可变，新增兼容修复以0.59.6 patch交付。补充设计Review passed：两项分别归既有packaging/runtime orchestration owner，缺binding和准备失败均fail closed。

mode=design：从原 issue 反查“只加日志”仍会允许内存会话，故 gate 必须在 actor 之前；只在后台发错误则挂起 provider 仍可能继续，所以要联动真实 AbortController；只改 gate 则 observer/startup catch 会再次写故障盘，需同一故障分支收敛；只按事件 WeakMap 去重不够，完成消息 UI clone 需 persisted source。取消/stale 不得锁死、timer失败不得等下一条token才通知；上述均进入矩阵。未引入并行持久 owner，无未关闭设计 finding，design-review: passed。

维护性复审：首次 diff 检查发现 AgentRunRequest 594→602 超过600、SessionRun628→646继续增长。故将故障监听收回本就拥有活动 runtime 生命周期的 observer，随该 run 开始订阅、finally 解除，不让请求管理器增加全局监听；启动前写失败仍由 actor 的直接 gate 处理。原有 SessionPendingInputs 已是独立队列状态 owner，把原类及其请求类型原样移到同目录独立 manager，原 SessionRun 类型出口继续 re-export，保持调用合同，避免队列状态和运行/持久化继续混放。不是新增转发层，也不按行数压缩逻辑。补充方案Review passed，原队列/取消/steering与native故障集成复验。
