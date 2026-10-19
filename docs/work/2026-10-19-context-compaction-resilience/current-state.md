# 当前执行状态

## 2026-10-20 01:28 最新状态（以下早期记录仅为过程证据）

- 本任务仍未提交、推送或发布；主工作区 WIP 未触碰。Required CR-01–CR-10 保持开放，最终匹配版本验证、Review 与发布完成后按证据逐项关闭。
- 功能已接通：一次可选摘要与硬压力恢复、v2 来源证明/持久提交、实际工具恢复限制和受信渠道确认；SQLite 有界页/正文分片/运行窗口；显式维修；本地 UI/server/SDK 与 Cloudflare/Bibo 同一投影 owner。
- 历史/实时巨型消息、10 会话缓存、取消前/写入中/提交后、同长度源替换、随机 Unicode/事件、Node20/libsql 等专项通过。完整 Kernel 前轮 159 文件、789 测试通过；最新 v12 全量回归及匹配 tsc/lint 正在运行，不能以旧结果代替。
- Linux x64 Node22.23.2 Docker（2CPU/2GiB，M4 宿主运行 x64 仿真）每组 >=30：256MiB 页 p95 1.84ms/规划5.55ms/维修堆增10.38MiB；64MiB 单条0.65ms/0.13ms/4MiB；百万 delta 0.74ms/0.56ms/20.27MiB。维修分别17.46s/4.14s/85.78s。OS缓存热、SQLite连接新建；不是原生 x64 服务器实测。日志 /tmp/compaction-linux-benchmark-current.log。
- 实际 DO SQLite 五项通过，64MiB 维修全过程控制50样本 p95 10.35ms/max387ms。修复了 DO 事务中 timer yield 被 input gate 阻塞的真实30s死锁；adapter用microtask，Node仍timer。日志 /tmp/compaction-real-worker-current.log。
- 完整产品 HTTP，每组30：256MiB page/compact/part p95 6.01/5.77/4.50ms，compact20700B；64MiB 3.72/4.46/4.61ms，compact2699B；维修90次控制p95 7.02ms/max202ms。报告 /tmp/compaction-resilience-http-performance.json。
- Chrome155 生产UI，M4/16GiB，50ms RTT/10Mbps，壳缓存热、新document/JS、目标会话请求点击后才放行；30次/组点击到内容 p95：256MiB140.77ms、64MiB199.13ms；JS堆增长7.75/6.03MB。报告 /tmp/compaction-resilience-browser-performance.json。原文下一片操作和窄屏截图已生成，尚待最终视觉检查。
- 真实 DeepSeek 隔离任务完成两次自动压缩及整个平台关闭后冷恢复，保留文件随机标识与既定约束，未重建文件。报告 /tmp/compaction-real-model-report.json。该测试后发现滚动检查点复用ID，已改每次新UUID并以真实旧检查点冷加载回归证明；不重复付费模型调用来验证纯ID逻辑。
- 新增最终审查修正：摘要源输入被裁剪必须标为恢复态；immutable 字符串不 structuredClone，Linux规划 p95 从97ms降到5.55ms；readPage v12 covering index只读身份后逐条取descriptor，累计源读取预算2.5MiB并剥除CP模型上下文（完整记录仍保留）。连续40个大检查点反例新增待跑。
- 当前验证日志 /tmp/compaction-{kernel-final-v12,bibo-full-final,types-final-v12,targeted-lint-final}.log。后续：关闭匹配验证与Review→文档/changeset→冻结远程master单次product stable发布→适用Bibo部署/真实安装升级/主线回流→retrospective。

## 身份与入口

- 整体进行中；2026-10-19 21:57 Asia/Shanghai；flow=bugfix；task-id=dt-c619a4e2；retrospective=pending。
- [合同](acceptance-contract.md) compaction-resilience-20261019 r1；[设计](../../designs/2026-10-19-context-compaction-resilience.design.md) design-review: passed；[计划](../../plans/2026-10-19-context-compaction-resilience.plan.md)；[日志](../../logs/2026-10-19-context-compaction-resilience/README.md)。

## 执行现场

- 唯一实施 checkout: `/Users/peiwang/Projects/nextbot-compaction-resilience`；分支 `codex/compaction-resilience`，基线 f9da4930b。
- 原设计 checkout 无未提交修改；主工作区已有用户 WIP 未触碰，保持 master，禁止 reset/stash/rebase。设计已在 origin/master。
- `pnpm dev:worktree` 完成 Node 22.23.2 / pnpm offline ignore-scripts bootstrap；依赖仅此 checkout 链接。尚需构建验证依赖闭包。
- 根因、上游 SHA、性能基线与探针见设计；临时探针 `/tmp/nextclaw-compaction-rootcause-20261019/`；上游源码 `/tmp/nextclaw-compaction-upstream-20261019/`。

## 当前进度与下一步（22:46 更新）

- 首批源码 WIP：一次可选摘要与 60s deadline/取消；自然 stop 文本可接受、截断/工具/空输出丢弃；真实 provider 错误保留；软阈值 80%、失败延后与内存节流、v2 recovery 字段及继承。源码尚未完成全部 v2 source manifest/提交线性化。
- 派生 SQLite 替换原 projection persistence；Node 22 内建 SQLite，Node 20 明确 incremental opener 使用 libsql 0.5.29，原 sql.js 小元数据 fallback 保留。依赖 bootstrap/构建完成；Node 20 驱动与发行闭包待验证。
- 正文按 part 顶层字段分片（part_fields/part_chunks/part_previews），源字符串保存 JSON-escaped fragments 避免跨块 surrogate 丢失。SessionMessagePartsStore 已支持完整写入、精确片段游标、流式 token staging、payload 追加/替换与有界 preview；EventProjectionStore 正在把既有 replayer 的有界骨架映射到原始字段，必须补语义对照/故障测试。
- scanBoundedSessionJournal 已实现 token 解析、256KiB 骨架、巨型单行字符串、取消/恢复水位；4 项测试通过，尚需空行/损坏边界、超大 part 数等硬例。
- 新 persistence.prepare / appendEvent 已写入但尚未接线到 projection/journal owner；准备流程可取消/可见/单并发、冷 run seed、托管存储仍未完成，不可发布。
- SessionRunManager 初步接 loadSessionRunSeed，丢失来源时持久化恢复 marker；须修正 prefix/retained/tail 来源与冷加载一致性，不能把当前草稿当完整设计。
- sessions_history 初步支持页 cursor / messageId+part 精确分片；server 新 GET part 端点。UI/SDK、托管适配与旧展开路径尚待接入。Runtime dispatch 已加恢复态仅本会话 history、8 次不同 cursor；尚需真实用户业务澄清解除路径，不能永久锁住后续任务。
- 当前证据：首次三组测试 42 passed；normalized fields 后 projection 11 passed；stream parser 4 passed；此前 kernel tsc 通过，最新新增 EventProjection/prepare 的 tsc 正在运行。日志 `/tmp/compaction-resilience-{tests,fields-tests,tsc,stream-tests,dependency-build}.log`。
- 新源码已逐批 preflight：session-message-chunks.utils.ts、session-journal-stream.utils.ts/test.ts、session-message-parts.store.ts、session-event-projection.store.ts、session-message-preparation.store.ts（未创建）、session-message-projection-resilience.store.test.ts（未创建）。
- CR-01–CR-10 仍全部未关闭；没有 commit/push/release。本任务所有 WIP 只在本 checkout，主区保持原样。
- 下一步：先接并验证 SQLite 流式 prepare + incremental event 对照，补 superseded interruption / pending compaction terminal / late tool owner、bounded descriptor 与 token 源完整性；再完成 readiness/UI、runtime/durable commit、托管与验证发布。不能留隐藏 full-history fallback。
- 当前无外部阻塞；实现复杂度高，3–5 小时仍为初估，应以新证据修订。默认单代理，禁止委派。

### 最新接线与证据

- ProjectionStore 已移除隐式 full-history load/rebuild/readJournalPage fallback，改为显式 `prepare` + 全局单维修 lane（SessionMessagePreparationStore，最多 128 等待、512 状态）。准备 commit 每约 50ms（仅完整 entry 边界），SQLite事务与watermark同提交；cancel回滚当前批，冷重试续上次水位。
- Journal append 已接入 EventProjectionStore，原始 JSONL 写入改为 <=16KiB 片段、去掉追加前 full structuredClone；压缩 compressed marker 追加执行 fsync。nextSeq 从索引meta读取；无索引先显式准备，新会话建空派生索引。appendEvent 防止维修已覆盖事件重复应用，必须匹配 previousOffset 才增量前进。
- 已接线 SessionManager.listSessionMessagePage 的 readiness，未准备返回 preparation 状态；server messages 携带状态、POST history/prepare、DELETE history/preparation、GET message parts；SDK有对应方法。UI seed loader等待准备并每500ms有取消信号地轮询，显示进度/停止/失败/重试。这些 UI/SDK最新代码尚未完整 build/tsc/真实渲染。
- EventProjectionStore 已修 late result 与 stale completed：settled_tools保存final工具归属，快照替换前把权威 result/execution字段留在SQLite staging，替换后恢复，不在JS读巨大正文。字段顺序固定已知字段rank，避免分片游标遗漏。结果恢复后重算bytes，避免巨型老result被误判小消息重新全装载。
- Part capture已不用Stringer（其潜在surrogate拆分UTF8替换风险），使用已验证Parser tokens的有界JSON片段编码；JSON.stringify字符串片段保存孤立surrogate。尚需新增错位Unicode/孤立surrogate随机硬例。
- 最新证据：assembled journal/projection/compaction recovery/new hardcases 36 passed；SQLite故障/repair/fragment cursor/全球单lane + source hardcases 10 passed；kernel build、server build、kernel tsc、server tsc、runtime-next tsc、SDK tsc曾通过对应时点。后续源码已变更，需匹配重跑，不可拿旧证据当最终通过。
- 修复 summary catalog cold bootstrap 意外用一页预览推导label：投影回填保留 metadata owner 原值；原baseline该测试通过，新实现现已恢复通过。老恢复测试已替换 renameMeta mock 为SQLite事务/损坏等真实新边界测试。
- 最新 protocol manager测试有2项旧假设：取消原signal identity（现在组合deadline signal，已改为断言AbortSignal）；1000-token fixture最低source prompt无法容纳，provider并未调用（已改2000验证真正provider错误）。正在跑 session 18653；最新kernel tsc session19859。日志 `/tmp/compaction-resilience-protocol-tests.log`。
- 恢复态新增受信业务确认路径草稿：core recovery.checkpointId为稳定root；Kernel compaction.utils `readContextRecoveryState(messages,fallback)` 由现有checkpoint+user元数据`nextclaw_context_recovery_ack`判断；SessionRun暴露getContextRecoveryState，runtime只调用此owner。允许恢复中本会话sessions_history + request_user_input_async，合计8个不同读取/澄清cursor。
- UserQuestionManager.ask为恢复态问题标记root checkpointId；projectUserQuestions携带recoveryCheckpointId；真实human answer的resolution message写ack，dismiss不写；UI问题显示业务条件确认提示。模型done不能解除。preflight继承时识别ack；readRunWindow补读latest ack message。必须补端到端安全测试、冷读/多次压缩、界面确认与纯渠道回答路径；尚不能宣称完整。

### 仍需闭合的核心设计缺口（不可漏项）

1. **v2 source manifest / 陈旧候选与 durable publish**：目前只加recovery字段，无完整code-owned source proof。需在同一写入/状态串行边界验证来源、保留并发suffix与最新完整请求预算，取消/rewind不半装。拟在SessionRun.applyEvents提供持久回调（SessionManager.publish persistFirst）、每run串行state队列；ingestion防同对象再发布重复写，observer避免重复UI发布。需要 current-message callback 与至多一次source-changed重求。只在manager.finish前检查有race，不能据此关闭CR-02。
2. **取消写入与读写可见性**：raw journal stream append分块后，普通ready/repair不能读取尚未完成/尚未fsync的tail。JournalStore writeChains需正确清理active promise并让prepare/control读取识别活动写入（控制响应不得等大写入）；wait型读则等完成。若要支持cancel直到commit，signal需从persistFirst→ingestion→SessionPersistence传递，写入中cancel在同一owner安全truncate回本次previousOffset，fsync后仍保留完整新checkpoint。进程中断的无newline tail需原maintenance owner隔离保留片段、恢复最后完整边界，不能永久preparing，也不能默默安装半条。
3. **机械削减/实际overflow**：尚未实现先model-free源引用削减；main runtime现有stream retry是无界循环且未把attempt已执行工具纳入guard。需有界瞬态retry，副作用后不重放；actual context overflow只在持久缩减、完整请求变小后重放一次。固定context/tool/preamble/tail预算与max output reserve需统一证明。
4. **索引生命周期语义**：superseded synthetic RunError尚未单遍持久处理；拟SQL延后synthetic interruption到维修EOF，后续continuation按message/run索引解除，避免旧Tracker用Map积累全历史或双扫H。孤儿compaction终态已接既有RecoveryService并通过两项回归，但pending marker ID数组仍潜在无界。旧metadata header尚未映射到meta/MetadataStore，须保持旧数据元信息。空行offset边界处理未补。
5. **热路径剩余全量读**：UserQuestionManager.list在打开会话时仍listSessionMessages全H；需原投影维护问题/解决索引，返回pending及近期并支持按questionId精确查询，不可简单最近slice丢旧pending。Catalog缺失时loadSummaryWithoutReplay仍readline整行+扫描H，启动/列表需轻量元信息与显式准备，不得隐藏扫描。巡查其余getSessionRecord/listSessionMessages真实热消费者。
6. **run seed/cache**：readRunWindow目前最近256再补CP/ack，预算下可能遗漏CP（追加到末尾后预算break），未按CP retained区间精确补足。SessionRunManager基线marker会把未知归档安全降级，但可能反复安装或覆盖gap，必须完善来源证明。冷slot2/byte LRU64MiB/active admission以及活跃run checkpoint后缩减内存尚未实现；不允许全量clone后slice。
7. **托管**：CloudflareSessionStore仍getSession→slice、全replay缓存；未接本任务新的prepare/runseed/part/query方法，CR-07必须实现并验证，不能仅本地发布。
8. **UI精确展开/SDK与错误**：新part API已加，但原deferred tool expansion仍1message full detail，当前描述会变成重复preview而非完整正文。须接真正part cursor逐片显示/可继续；跨会话取消、界面真实loading/error/retry、i18n/types/test要闭合。新question root notice需匹配实际server type更新build后验证。
9. **验证与发布**：固定负载大文件/64MiB单条/百万delta/10会话切换/永久坏摘要/property-state-fault matrix/Node20 libsql实际产物/本地托管冷恢复，设计固定Linux2cpu2GiB和M4Chrome生产构建>=30次p95/I/O/内存/写放大还未执行。真实模型只必要链路。最终targeted lint/tsc、diff-only maintainability一次与Review、docs EN/ZH+changeset、冻结remote master产品stable发布及安装/runtime channel/docs smoke/主线回流、复盘/telemetry尚未执行。所有Required仍open，不得提前发布。

### 23:05 增量（前述缺口仍需逐项对账）

- v2 source形状已加入core：<=16 ordinal ranges、SHA256 revisionDigest、journalWatermark、sourceCount<=256、omittedRangeCount、semanticRevision；reader对v2强制校验这些字段。core generic service结果保持provisional v1，kernel实际durable manager注入SessionManager.captureSource后提升v2。baseline恢复marker也须captureSource，否则拒绝安装。
- Local captureSource使用covering indexes仅取id/ordinal/revision，不读正文；proof截断额外source/ranges则强制recovery。meta.semanticRevision在非压缩timeline消息改变时递增，proof在**原JournalStore enqueueWrite内、追加前**检查epoch和digest；任何并发语义追加/修改都保守拒绝陈旧候选（不只是旧行改变）。runtime preflight对CONTEXT_COMPACTION_STALE最多重新求解一次。
- SessionRun.applyEvents已加本run state串行队列；compressed marker通过SessionManager.persistSessionEvent→Coordinator.persist（不emit）→ingestion→journal先持久，再dispatch状态，observer随后正常emit一次。ingestion WeakMap复用同事件inflight Promise避免二次入账；失败移除，STALE/安全cancel的journalCommitRejected不毒化failedWrites。
- AbortSignal从runtime preflight apply options→SessionRun persist callback→ingestion→SessionPersistence传入。journal append开始前检查，分片写完但未fsync前若cancel，truncate回本次previousOffset并fsync，标safe rejection；fsync后不再因取消撤销。JournalStore统一enqueueWrite且正确清理active promise；getSession等写完成，prepare控制请求遇active写返回queued而不扫描未提交tail。仍需真实fault/状态机证明。崩溃partial tail quarantine/recovery未实现。
- model budgeter已拒绝隐式丢历史/截用户/截固定上下文/截工具结果，抛MODEL_INPUT_OVERFLOW；reserve>=spec.maxTokens。preflight增加overflow强制路径（70%目标、不软延后）、maxOutputTokens；native adapter传入。runtime builder遇guard overflow只重做一次preflight；真实provider context overflow在model-round recovery通过callback执行持久压缩，仅实际compressed事件已安装且完整request序列化长度下降时重放一次。尚需专门测试，并补estimate safety余量/真实token计量。
- 主model stream瞬态retry限制最多3次；本轮尝试过工具后不自动重放，防止重试不确定副作用。此处必须补测试，不能仅类型通过。最新runtime+kernel tsc在部分变更时通过，source后新字段需要core build后再匹配验证。
- UserQuestionManager.list已改专用索引读取；part schema加session_questions(id,ask/resolution id,status索引)，snapshot投影记录问题/回答，读取pending最早32+近期resolved32，按questionId支持精确lookup。新增reader在SessionPersistence/Manager贯通；Cloudflare未实现仍降到bounded64兼容，不能当托管完成。UserQuestion源码测试与storage tests合计15 passed，新的owner+ingestion tests20 passed。
- 源码中的新partial_projection处理已写入但**未启用完整actor裁剪**：mergePartialSessionMessage在fullreplayer保留原parts并合并生命周期/映射物理round offsets；EventProjectionStore遇partial assistant snapshot不删part_fields，只更新头部；writeDescriptor剥离内部projection元数据、保留末64 round offsets；readRunWindow对巨型assistant设置partial标记并映射offsets。最新kernel tsc曾报metadata类型与sourceEvent窄union，已修，待重跑。设计新增该语义与降级边界说明；必须对照原文+delta+结束帧、跨epoch冷重启/完整导出证明后才能启用/发布。用户显式编辑须剥离此内部标记。
- **下一具体动作**：完成SessionRun bounded actor/checkpoint后reload窗口与LRU/冷slot/active admission，避免活跃state继续增长；补partial snapshot精确重放测试。然后托管适配、巨型旧header/partial tail/source supersession等剩余边界。
- 托管新证据：BiboUserContainer是wrangler new_sqlite_classes，真实DO storage.sql可用。Cloudflare官方确认SQLite DO `storage.transaction(async()=>...)`可包含SQL，不能SQL直接BEGIN；可复用Kernel同一事件/part/SQL语义，宿主仅SQL adapter+事务。官方源 https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/ 及 https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/partials/durable-objects/api-storage-other-methods.mdx 。尚未写实现；不要再发散KV并行语义。
- 正在/最近sessions：74148 core build；49357 四组current tests；64789 kernel tsc（后有修正需重跑）；22376 runtime tests。日志对应/tmp/compaction-resilience-{core-build,current-tests,tsc,runtime-tests}.log。此任务未commit/push/release，master WIP未碰，CR-01–CR-10仍open。

### 2026-10-20 00:03 更新

- 用户追问“需要三到五小时吗？有这么重吗？”：已解释直接修报错不需这么久，原估算包含存储/容量/跨宿主/验证/完整发布；承诺停止扩大范围、20–30分钟给检查点。00点检查点已汇报：148项存储/压缩/owner回归146过、2旧断言已修待复跑；新增runtime recovery18过；仍预计至少约2小时，不为赶时间提前发布。用户未缩减任务或取消。
- Local SQLite schema现在v11。SessionRun在巨型事件（编码>64KiB）和8MiB累计增长/>256条/>1024parts时转换为有界原文引用视图，原始observer事件不变；超过窗口立即恢复态guard，partial completion保留source正文。checkpoint后actor缩减为code projection、保留active stub。修复partial merge不应把compaction_part_start/archived_body污染原文元数据；round offsets映射补齐。需专项actor/冷热/连续CP hardcase和性能证明。
- SessionRunManager冷加载2、等待128，idle byte LRU64MiB，busy不淘汰；AgentRunAdmissionService最多8运行+16等待，abort/release幂等，planned restart拒绝等待并排空ingress防死锁；3项capacity tests新写待跑。AgentRunRequestManager释放capacity与execution claim在onSettled/catch，观察run改WeakSet避免LRU被强引用；需真实队列/重启/缓存验证。
- Catalog缺失：>256KiB journal只读64KiB可能legacy header生成轻量摘要，不扫描H；小日志仍旧scan。标题/预览/摘要热owner已改bounded入口。幂等热读新messages_ingress表达式索引+streaming SHA256 sorted-key digest，不getSessionRecord全H；SessionPersistence/Manager/Journal/Cloudflare贯通，单条无旧digest且>64KiB安全拒绝比较以防重放。原始hash metadata由ingress覆盖写。对应tests已换新host方法。
- 准备新增torn suffix维护：64KiB倒读找最后newline，先分块保存`.jsonl.torn-size-mtime`并fsync，再校验源未变、truncate/sync；explicit preparation调用，append仍拒绝未准备残片。追加serializer/取消/写入异常均在未commit时truncate回previousOffset且sync，安全reject不毒化failedWrites。空行/CRLF byte boundary reader修复并新测；critical protocol identities在body预算耗尽后仍保留，metadata单独预算、key计入预算；未知journal version/type显式拒绝不跳过。meta.legacyMetadata草稿已接入prepare/loader/summary，尚需极端字段顺序/大header验证。
- Synthetic interruption修复：SQL session_interruptions + interruption_fields/chunks保留bounded descriptor及state/execution字段，后续continuation按既有helper恢复原状态并解除中断；无H JS Map/双扫。meta.pendingCompaction IDs cap64仅兼容用，正确终态从SQL messages_pending_compaction索引按target/legacy选择、64行批处理并可取消，保留多continuation语义。专项12项过；新一轮148只剩2个旧preamble/metadata形状断言，已修。
- CloudflareSessionStore已重写SQL raw journal+head KV，同一DO事务原文/增量投影；CloudflareSessionSqlStore只SQL namespace/事务/源chunks适配，实际复用Kernel SessionMessageSqlProjectionStore（原persistence类加host注入）、分片、页、run seed、question、source proof。旧KV显式maintenance逐消息/逐event分片迁移并持久resume游标。BiboConversation开始/完成改getBoundedSession，prepareCheckpoint不再rewriteH。删除API必须在调用方transaction内deleteSqlSource+KV/UI变更，prepareDelete纯取keys。首轮shared storage4tests过，但Harness10失败；定位其中legacy空source bytes未置0、测试SQL fake多语句只执行第一条导致staging UNIQUE，均已修待复跑。**真实Miniflare DO SQL仍须验证**，已离线加devDependency miniflare4.20260219.0。
- Worker根和Node根导出实用的SQL投影host类/准备owner/chunks；local-only fs/sqlite driver/maintenance改dynamic import。**必须真实Worker bundle/Miniflare证明无Node fs/native driver误加载**。Kernel build曾通过当前前一时点；Harness build、chat-ui build已通过；Bibo tsc worker部分过，client曾因agent-chat-ui未build，现补build后待跑；UI tsc曾过新source前一时点。
- UI新SessionMessageSourceManager+component由现有ChatMessageList custom part连接任意descriptor原文：按part/cursor只保留当前<=24KiB片段，手动下一片、选择part，取消和revision错误，EN/ZH文案。没有积累64MiB正文。**待真实渲染、组件/typechecks/源读取测试；part显示当前/下一序号细节需修**。旧deferred tool loader仍只返回descriptor，source viewer可精确展开，需闭合旧展开展示合同。
- 全内核第一次775tests=731pass/44fail：11个缺本地wasmtime runner的环境失败（尚未build），其余包含旧多批摘要/截断摘要接受/元数据source字段/JSONLmeta文件断言与真实synthetic continuation bug。已修真实bug并将旧断言更新为新合同（不要吞掉行为）；新fixture canonicalSessionMessages只剥离derived cursor并JSON规范化，不忽略业务metadata/parts。最近148tests=146pass/2旧断言，刚修2项待复跑。builder预算两项旧裁AGENTS fixture改为完整fixed rules可容纳的真实参数，hardoverflow仍有明确code与专测；soft trigger预期28k改22.4k。完整suite尚待重跑。
- runtime-model-round-recovery.manager.test新增5项：永久transport仅3次、tool attempted后不重放、实际overflow仅durable compressed标记+更小request重试一次、同大小/未安装不重试；与原runtime19?本轮日志实际18tests passed(`/tmp/compaction-resilience-overflow-tests.log`)。还缺实际tool dispatch恢复限制8次/跨session/新授权的专测及纯渠道业务确认解除。
- 新待创建已preflight：session-history-performance.store.test.ts、cloudflare-session-worker.store.test.ts。尚未写性能fixture或跑30次。Linux参考环境尝试只读SSH：alias TLS在认证前断开；按已读SSH恢复skill改BindInterface=en0+ProxyCommand=none可到password，但认证后连接关闭，未执行任何远程命令或修改。Docker daemon未运行，不能冒充Linux证据。Node20.20.2已安装`~/.nvm/versions/node/v20.20.2/bin/node`，libsql实际矩阵待跑；Linux可用现有ncp-smoke workflow_dispatch增加可选perf job，经验证后分支push跑2CPU/2GiB容器基准，不要未经验证合主干或发布。
- **当前紧接着的风险**：JournalStore仍有sessions Map full-record cache，getSession/importSnapshot缓存并cloneH；需要移除缓存（热消费者已迁移）；importSnapshot仍full clone/map/JSON.stringify+非原子writeFile，rewind和source install竞态要闭合。拟原owner流式临时journal+fsync/rename，source proof增加journal generation（local inode/birthtime、host head uuid）并在同一write队列validate，防rename后旧index同size误认为source未变。不能只看semanticRevision/长度。新canonical metadata没有原始遗失，但源字段未知必须显式恢复/拒绝。
- Required仍CR-01–CR-10全open，未commit/push/release。接下来：收尾既定正确性缺口→真实DO/CPU/内存&加载性能/真实UI/必要模型→matching tsc/lint/review→docs changeset/full stable release/reconcile/retrospective。不要扩大无关平台能力，也不要删Required以赶时间。

### 2026-10-20 00:37 增量（覆盖前述已过期实现状态）

- JournalStore full-record Map 已移除；snapshot import 改为流式临时文件、fsync、rename，保留上一代 hardlink，失败恢复原 journal/metadata/catalog。新增真实 projection-commit 故障测试通过。仍需审查 crash 边界与 rewind 内存，不能宣称所有导出/编辑均有界。
- source proof 增加 journalGeneration；local dev/inode/birthtime，Cloudflare head UUID。parser 校验 range 和 count；原写队列检查 generation、semanticRevision、digest、水位。新增同长度 atomic rename 反例通过。
- SQL 投影已从本地 native adapter 抽出 SessionMessageSqlProjectionStore（同一个 schema/replay/cursor owner），Worker 导入不带 libsql/fs 驱动。真实 Worker 暴露原 core barrel 引入 child_process：已将 context-compaction、session-request-result 的内部导入指向叶子；runtime tool timing 使用跨宿主 global performance。Miniflare 使用真正 DO SQLite，非 fake SQL。
- 百万 delta 首次维修 175.77s/额外堆210.49MB 失败后，复用既有 coalescer 在有界16KiB批次处理连续小delta；复测15.17s/堆19.77MB/loopMax20.38ms，30次page p95 1.31ms。256MiB fixture page p95 2.30ms，repair4.74s/堆8.85MB。64MiB单条page p95 1.43ms/返回2506B，repair1.65s/堆8.62MB；copy/delete SQL分批后loopMax由679ms降244ms。全部仅本机Darwin arm64 Node22.23.2/SQLite新连接、OS cache warm；不是HTTP/UI/Linux证明。日志 /tmp/compaction-resilience-{million-performance,giant-performance-latest}.log。
- 实际 DO repair64MiB 发现事务中 await timer 会被 input gate 阻塞直至30秒重置；已增加 SQL driver transactionYield，DO用microtask保持原子性，Node继续timer yield。实际DO完整source重组、账号/会话隔离、事务失败rollback、reopen、64MiB维修最终可读首轮通过约3.65s；旧控制测量仅维修前段，现重跑覆盖维修全过程>=30样本，不提前认定SLO。
- CloudflareSessionStore 的 writes/preparation owner 按storage对象WeakMap共享，避免每次route实例化重复维修和并发写队列。Bibo /history 和run preparation移除getSession全读，按40条页与cursor；BiboClient historyPage与网页前页/最新/准备刷新已接，页替换不累积H。原文通过同鉴权 /history/source HTML片段页读取，SDK sources定位消息。正常<=24KiB消息页恢复完整parts（避免preview损害问题options）；大消息仍descriptor。尚待HTTP/UI完整验证、错误与retry/cancel行为补齐；Bibo完成回复仍需检查response大小/翻页cursor。
- 恢复态实际dispatch专测揭示回读8次后澄清也被阻止，已修为只计history预算；7项dispatch/executor测试通过。渠道仅trusted human trigger、当前pending恢复问题以及明确“确认续做：具体条件”回复写ack，ask中追加代码拥有的说明；普通聊天不解除。渠道路径专测尚缺。
- source fault +随机完整消息生命周期/Unicode对比 +journal +question/request共44tests通过。第一次随机样本缺消息完成事件，完整replayer丢弃旧streaming而SQL保留，已改为有效完整生命周期，未宣称Unicode丢失。Node20.20.2/libsql实际29tests通过。此前24files145tests通过，完整Kernel最新重跑中；环境wasmtime runner仍须恢复或明确证据范围。
- 当前后台：Kernel full /tmp/compaction-kernel-full-current.log；DO+store /tmp/compaction-real-worker-current.log；Bibo Harness/app /tmp/compaction-bibo-harness-current.log。旧 combined Bibo 测试因旧死锁仍可能残留自有进程32029/33173，必要时仅终止本任务进程，不碰其它workerd。
- 仍未commit/push/release。Required全部open：尚缺Linux2CPU/2GiB、真实API/生产UI>=30性能、活跃新巨型事件与10session cache、cancel/stale/rewind组装状态矩阵、一次必要真实模型长任务+冷恢复、匹配tsc/lint/review、用户文档/changeset及完整稳定产品发布/回流。下一检查点00:45，完整预计至少仍约2h，不赶时间放宽验收。
