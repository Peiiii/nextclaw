# Issue #73：会话持久化失败边界

## 0.59.10 交付期 preparation 恢复增量

Mac x64预构建pnpm deploy重新解析开发依赖，17:10Z报ERR_PNPM_NO_MATCHING_VERSION @typescript-eslint/types@8.73.0（当时metadata最新8.72.2），同source Mac ARM未获runner而cancel。17:20Z同一精确registry版本HTTP200且name/version相符；源码锁文件仍8.56.0，不能把临时metadata不同步误当产品回归或立即升级pnpm/改依赖锁。L4交付修复，复用原Release Recovery控制器：订阅npm-release-prepare终态，对此类错误只有精确缺失版本现已可用才自动failed-only恢复；永久404/不同版本/普通build失败不重试。既有runner容量分类适用于prepare，保留成功NPM产物及其它平台artifact，最多3次恢复，不另起publisher。

已发生的失败事件在控制器部署前，故增加run_id受控恢复入口：获取原run后仍执行同仓master/已知workflow/原event/current attempt/失败状态/上限的同一校验，不允许任意workflow或active run重跑。当前一次bootstrap需计人工介入，不能称首轮零干预。相较盲重试、固定版本特判和改冻结产品源，这条路径保持原身份，能证实错误条件已改变。设计及实现Review passed：10项实际handler执行回归覆盖scoped package、registry404/错版本/普通错误/未知workflow拒绝及手动同门校验，actionlint与diff维护性通过；部署后用原43912639495验证真实恢复。产品source8e7849ace2与已发布0.59.10不改写，原session修复证据不失效。

## 2026-11-17 旧会话压缩分段边界返工（scope revision 8）

用户反馈新版新窗口可工作，但旧会话持续Cause Invalid compacted message part boundary，run中止/HTTP500。00:23开始，L4 bugfix，reproduce，单批plan not-required，design-document required。源码修前clean HEAD0f79cfd66；主区WIP保持，首写仅本任务既有resilience测试。客户AI关于“文件结构坏”的说明是待核实解释，无原始堆栈/版本/源文件，已经异步请求最小脱敏堆栈，Issue无新评论。

实证：真实journal→SQLite准备→readRunWindow→model projection，24part/大文本使8MiB工作预算退为16part预览，assistant通过、user同文边界错误；源checkpoint保留0..24，但user预览未标partial，严格校验以16part视作完整源。初始legacy assistant夹具通过，不能算复现；最初忘prepare的null失败属fixture错误。红基线/tmp/issue73-compact-boundary-before.log。另沿SessionManager.appendSessionEvent→publishSessionChange→summaryProjection→contextWindow.preview追踪到提交后的摘要投影异常仍会回到ingestion.recordFailure，产生持久化锁，需单独红基线确认。

方案：SQL运行窗口对所有role准确标partial及原始坐标，slicer输出实际交集起点/同步source indices，不能把请求的start赋给不含该part的预览；完整源和非法数值仍严格校验，不改源journal、checkpoint或预算。SessionManager只隔离已经成功append之后的摘要发布异常，结构化诊断含阶段与journalCommitted；真实append异常继续拒绝、队列/恢复合同保持。既有失败锁由升级冷启动或原恢复owner重读，禁止删会话/猜边界。错误诊断补安全结构值（role/start/end/base/parts/sourcePartCount），不含正文。

方案Review passed：与直接clamp坏checkpoint相比，修真实producer/consumer坐标并保留非法源拒绝；与全部吞错误相比，仅收窄原提交边界。验收JRN-21=有效源多role部分视图同文故障转绿，重复投影坐标稳定、原始源字节不变；JRN-22=真实摘要投影异常不误锁、后续发消息/冷读通过而真实写失败仍拒绝；JRN-23=旧会话真实模型读取结果/续聊及全平台新版本。客户原会话是否正是该输入仍待堆栈/结构证据，不能因此关闭原JRN-09或称恢复从未落盘内容。

设计增量Review：进一步语义断言发现descriptor的共享2K预算会使大text后的小part整项变成“已归档”字符串，不能仅修partial后让非法part进入模型。原descriptor owner将相同2K内容预算按最多16part分配，text/reasoning及其它part保持type，metadata独立预算，不增加工作窗口8MiB/part数上限；索引v12/v13从原journal自动重建v14，测试注入坏parts及offset验证源字节不变。旧缓存不能只修新producer。摘要错误隔离落在原SessionSummaryProjectionService.publishChange（纯派生流程owner），不在651行SessionManager再加包装；保留原Error并按会话一次诊断，健康发布后清除抑制，后续事件重试派生计算，真实append异常在此之前照常抛出。该owner不掌握源提交事实，诊断不虚填journalCommitted，而明确summary-projection阶段，避免再混称journal失败。

## 2026-11-16 发布瞬态故障自动恢复

用户要求全自动完成，不能靠Agent逐阶段手动恢复。实际证据：release43875370755两项macOS job从未分配runner，平台annotation明确capacity constraints；docs43875336211仅生产验证连接超时。原workflow只有人工rerun入口，没有终态事件恢复owner。L4 bugfix，design-document required，plan not-required（单批）。

方案：由独立release-recovery workflow接收原release/Docs Deploy completed事件，独立低权限恢复job只读取同仓库master的workflow_dispatch/push失败run。只对有明确runner未获取annotation的失败/cancelled job，或Docs verify日志明确ConnectTimeoutError的失败，调用原run的rerun-failed-jobs；summary连带失败忽略但其它业务失败拒绝恢复。保持原run/source/成功checkpoint，不发新版本、不dispatch第二publisher、不改平台矩阵。最多三次自动恢复（run_attempt<4）；到限明确失败，不宣称无限可自愈。事件恢复run不进入发布jobs，不读取artifact/执行上游源码，避免权限放大与自回复循环。恢复workflow按原run互斥，避免恢复run挤占生产队列。GitHub真实部署拒绝workflow监听自身，故不能把handler放进release.yml；独立控制器不承接任何发包步骤。

方案Review：逐步检查原run失败→终态事件→原因分类→有界rerun→原成功outputs复用→Runtime/Desktop继续；确定性失败/PR/fork/取消操作/陈旧run/到限均不重跑。相较单纯重试所有错误，明确分类避免隐藏产品错误；相较另起publisher，保留身份和已成功步骤。design-review passed。验收：真实平台失败annotations回放、确定性错误拒绝、次数/来源/陈旧事件门、API只调用rerunFailedJobs；部署到默认分支后用原失败事件重投验证真实自动恢复，不以手动rerun冒充。

## 2026-11-16 20:39 结果可读性与轮次坐标返工（scope revision 6）

原始新输入：客户AI报告“每次返回内容都变成已归档；文件写出、命令完成却读不到回显；抓Issue、SHA256和读11-14反馈均卡住”；随后用户补充不能发消息，报Invalid assistant model round part offsets。不把“工具已执行/报告文件存在”当作完成业务验收。复现选择reproduce，L3 bugfix。

当前源码已复现：原native固定模型测试在下一轮增加工具结果尾部随机标识可见断言即失败，原返回值约43KB，低于既有60K模型可见结果预算；事件的result/contentItems重复后超过64KiB，SessionRun提前套用UI descriptor的2K字符共享预算，把近期输出换成归档标记。对应修前日志/tmp/issue73-observation-before.log。另补真实actor大早期body+多轮工具场景，核对裁剪后轮次坐标及最新SHA结果，判据是模型实际收到有效结果，而非调用计数。

选定主链路：保留现有8MiB actor工作窗口、256消息/1024片段边界及持久化先行保护。近期消息在总预算内保留原协议与模型可见结果；64KiB不再作为把正常工具结果转换成UI预览的阈值。超过工作窗口时优先保留最新消息，旧消息/真正超大单消息才转有来源的有界视图；超大消息的近期各part独立预览预算，不能前一个body耗尽预算后抹掉后面的SHA等小结果。数量裁剪仍留下有来源的归档边界，避免静默丢历史。context预算继续由原preflight/compaction owner控制，不加第二套上下文或权限owner。

轮次协议：裁剪偏移后仅保留大于0、在可见parts范围内的边界；存储descriptor中的model_round_part_offsets是协议元数据，不参加通用文字preview。由原message converter兼容旧记录中唯一的空首轮0，不改变片段和工具顺序；其它非法坐标仍拒绝并给结构诊断，不猜测、不改源journal。完整压缩后的空活动占位同时清空offsets。历史列表预览仍有界，不能因该修复全量载入归档或取消8MiB预算；旧派生缓存通过原版本机制重建。

最强替代方案“只调大2K预览/继续把descriptor喂模型”保留了混用展示与工作数据的错误owner；“取消所有内存/上下文限制”会重现大历史成本与内存问题，均拒绝。正常数据和超大数据沿同一既有actor/源history链路处理，无新配置开关、无新发布器。

黄金验收：①工具读入带不可预知尾标记的约40K反馈文件→模型输入必须含完整结果→后续SHA命令结果被模型正确引用→实际报告包含读取到的nonce与真实SHA；②连续多轮、超过16parts和发生真实窗口裁剪后仍能发新消息，显式轮次边界合法，近期输出不变“已归档”；③冷开同一持久会话后重做新请求仍能读取真实内容；④64MB单消息/结构压力保持有界且可访问来源；存储失败中止/恢复原回归不变。

JRN-16=模型确实读取并引用工具值（Required）；JRN-17=裁剪/旧partial坐标下正常发消息（Required）；JRN-18=本次全平台发布（Required）。JRN-09原首因继续unverified；本轮不把新可复现退化混同原事故。plan:not-required（同批连续修复，原设计与日志维持状态），design-document:required（本节）。

mode=design Review：沿真实事件持久化→actor预算→模型projection→converter取证；反例包含多次大结果、小SHA跟在大参数后、超大单part、多轮尾裁剪、冷seed、旧partial首0及原存储失败。实现只改原工作窗口/descriptor协议元数据/既有projection兼容，不改变catalog、权限、队列或源journal。已验证低于模型预算的结果被过早替代，保留预算而撤去UI预览的模型职责可恢复合同；无未关闭方案finding，design-review:passed。

今天改动专项审计：原64KiB提前预览及>=0轮次过滤均来自6e7a43a6ad；0.59.7已包含这些行为，不是客户误用。今天7dfa9fa56恢复工具分派但保留该两处，并新增了kernel preview的payloadDeferred:true。前端toUiParts按该flag过滤片段，故该新增标记会进一步隐藏有实际结果的工具卡。修复删除kernel无条件deferred标记；UI原adapter兼容旧flag：只有确实没有args/result/contentItems时才过滤占位，保留旧版“带flag但有内容”的有效结果。其它deferred摘要机制不改，不把真正缺失的payload显示成伪结果。局部纯数据适配，依原组件交互，补适配到展示的回归。该影响面补充设计/Review passed；原21:10检查点不变。

旧数据兼容补充Review：冷projection会去除临时partial标记，因此仅在kernel按该标记剔除首0不足以恢复已保存会话。将唯一边界兼容放在原ncp-agent-runtime message converter：仅允许一个明确的空首轮0，跳过它不改变任何片段或工具顺序，原metadata不改；负数、重复、越界、非整数等其它异常仍拒绝。删除kernel重复兼容逻辑，不增加重建/猜测轮次或重写用户journal。以无partial标记的真实cold场景验证该公共协议消费边界；这是兼容空轮次，不是放开任意损坏输入。design-review:passed（该增量）。

轮次同owner审计还复现第二个确定缺陷：完整压缩覆盖活动回复全部parts后，为继续stream保留的parts=[]占位仍携带旧正offset，converter同文报错，见/tmp/issue73-empty-round-before.log。清空该占位的offsets是与空parts同一状态变更，不额外容忍越界坐标。回归跨两轮完整压缩，每轮后实际追加回复并转换模型输入；设计及实现边界补充Review passed。8MiB预算、序号来源和旧原文不变。

诊断增量：其它非法坐标仍报错，同时提供parts数、offset数、首个非法下标及稳定错误code，便于区分根因；只记录结构数量，不输出正文或任意metadata值。由同一converter生成，不加第二套日志或校验owner。Review passed。

升级数据门：旧v12派生SQLite descriptor可能已把offset数组保存成预览字符串，单改producer不能让已有索引重新变好。使用原projection版本失效机制12→13，从原始journal流式重建派生索引，不修改源journal，不让用户手动删目录，也不猜测被截断的metadata。真实SQLite旧meta/坏descriptor冷开回归须比较源journal字节完全不变、原offset数组恢复并可生成模型输入；该迁移与错误元数据修复归原projection owner。Review passed，发布前Required。

## 2026-11-16 旧会话工具封禁与新会话预览崩溃（scope revision 5）

来源：作者评论6910822183明确报告升级后所有窗口近乎不能调用工具，错误为`Unresolved archived context: only exact current-session history reads are permitted`；评论6910834514报告新窗口`contentItems.filter is not a function`。原0.59.1首次写入失败JRN-09仍独立调查，不用本节两个已复现回归冒充原首因。

复现选择reproduce，L3 bugfix。真实native组合（SessionRun、模型输入builder、真实工具分派，模型流固定以排除外部波动）已复现：有archive标记的会话read_file/write_file均未执行；新会话工具返回40段各约1100字符诊断文本后，下一模型轮次抛出作者同文filter异常。另用真实descriptor→模型转换锁定第二个边界；修前证据`/tmp/issue73-tool-before.log`和`/tmp/issue73-contentitems-before.log`。

根因一：runtime把历史不完整误作所有工具的权限，只有本会话历史/澄清白名单，普通只读工具也不允许；读历史不能解除required，解除依赖特殊用户确认。原目标是防止重复旧操作，但缺失上下文不是新请求的未授权证据。根因二：通用preview在字符预算耗尽时把任意值替成字符串，包括resultContentItems数组；类型断言把异常数据伪装成合法协议对象，图像consumer无数组校验直接filter。

选定单一路径：删除runtime的archive工具白名单与8次读取上限，不新增解锁开关或第二套权限；工具仍按原catalog、参数校验、各工具自身权限、取消及写盘失败边界执行。恢复提示只描述事实缺口、引导查历史，提醒不要凭缺失结果重做旧操作；已有明确请求可以继续，不要求通用“确认续做”。旧确认metadata保持可读兼容，已打开的旧问答仍可处理，但不再向新问答追加统一确认要求。

preview的最近owner保持在session-message-chunks：工具part保留type、toolName、toolCallId、state与完成结果的占位语义；可选resultContentItems只输出合法数组项，归档后省略无效/截断的视觉字段，原始journal和body不改、不截断。视觉consumer在原image service边界对历史或扩展输入作数组/有效图像校验，旧版已产生的字符串/空项不再导致崩溃；不把任意损坏值转换成伪图像，不新增持久化迁移或重写用户数据。

最强替代方案“扩大只读白名单/自动确认当前请求”仍会把历史状态变成隐式权限并保留不可自愈锁，拒绝采用。直接关闭存储故障保护会重现内存孤岛，拒绝采用。仅consumer吞异常会继续产生坏协议，故producer和历史consumer共同修正。

黄金验收：①已有归档会话收到明确新任务→真实read_file→write_file→回复，并且旧工具不会被系统自动重放；②新会话返回大诊断结果→下一工具实际执行→最终回复，结果持久化、冷开后可再调用工具；③旧版异常contentItems及有效图像/混合内容→模型转换不崩溃，有效图像仍保留，原完整正文不变；④真实写失败仍中止运行、恢复后同进程可用。AI负责客观验证，无新增视觉偏好验收。

JRN-13=归档不再封禁工具，JRN-14=大结果预览/旧数据不再崩溃，JRN-15=本次0.59.8全部适用发布与Desktop闭环；均Required。plan:not-required（同一连续修复批次，状态保留本节与原日志）。design-document:required（本节）。

mode=design Review：反查原Issue两条回复、完整producer→SessionRun→model输入→tool分派链路；核对源journal不变、现有权限与存储保护保留、旧数据兼容、正常图像回归及冷开后继续工具都列入矩阵。仅删gate不能解决新会话崩溃，仅加Array guard不能阻止producer制造坏字段；以上方案共同关闭两项反例。无未关闭finding，design-review:passed，限本节回归修复，原首因仍unverified。

兼容补充及复审：旧checkpoint.summary已持久化旧版代码生成的只读文案，只修改新常量不足以修复旧窗口。模型投影精确识别这段旧代码文案并用当前说明替换，不改任意用户/模型摘要，不重写journal。已确认的旧确认消息仍能被读取。视觉有效项过滤只由原ToolResultImageService拥有，内容manager的预算计数和视觉附件复用同一判定。该增量有当前数据消费者与反例，补充design-review:passed。

## JRN-09历史版本复现补充（2026-11-16）

本节仅定义调查用实验，不是新的产品修复或发布。复用原Windows诊断workflow，增加显式dispatch的session-journal场景；普通update路径及push行为不变，权限保持contents:read。独立脚本从官方0.59.1 Windows bundle读取manifest并核对原chunk SHA256；仅在副本末尾加观测导出，不改业务实现，原chunk保持原字节。实际Windows/Node24.18.1上运行旧Store/SessionManager/SessionRun/compaction，合成数据home，不读取真实配置、会话或凭据。

两个实验：正常压力与截断tool参数字符串。各用两个会话、1106消息、3239源记录、目标20,963,430字节及240k上下文配置，三轮真实压缩owner后立即高频写入；压缩provider返回协议完整的固定摘要，不执行外部模型或工具。观察源append/projection/catalog/metadata的首个真实异常；不注入人为throw或磁盘故障。冷读必须保留原始历史，且完成回复parts的hash与live一致，否则明确失败。实验失败不自动等于原机首因；Mac预实验不能替代Windows结果，未取得原chunk原机hash也不能宣称二进制完全相同。

plan:not-required（单轮实验）；design-document:已有设计局部补充。方案复审：只读获取历史发布物，SHA/平台不匹配即退出，原实现不改、仅临时副本可观察；坏fixture与persistence首因分开记录，全部并发任务settle后才dispose。原事故目标不缩减，JRN-09仍open。design-review:passed（仅调查工具）。无需changeset，不进入正式publisher。

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

## 桌面dispatch关联返工

真实preflight43884004514已创建但queued时displayTitle仅workflow名，旧标题轮询3分钟误判未创建，parent attempt3失败。GitHub官方2026-02-19已提供return_run_details，可直接返回workflow_run_id，无需猜标题。选用已有desktop-release-github owner封装该确定性API，preflight及desktop build都消费返回runId；删除新dispatch的标题扫描，只保留已有runId恢复入口。保留冻结product SHA及Draft，当前控制平面通过原target=all recovery运行，不重复发包。design Review passed：直接id没有并发串单/排队标题依赖；缺失id明确失败，不再盲dispatch；API请求用stdin JSON避免shell插值，接收字段严格验证。测试覆盖queued无标题、参数原样、两调用方返回id和缺失id拒绝；真实all恢复必须证明进入正确child。

直接ID后真实API还存在run已创建、jobs接口尚未创建的排队窗口。preflight43886363977派发成功，初次jobs查询404，随后预检success。状态读取统一归已有github owner：先取不含jobs的run字段，queued/requested/waiting/pending不读jobs；活动/终态再读jobs保留失败与耗时诊断。API请求失败不伪造成功。设计/实现Review追加通过，实际四种排队状态与终态失败jobs均有行为回归。
