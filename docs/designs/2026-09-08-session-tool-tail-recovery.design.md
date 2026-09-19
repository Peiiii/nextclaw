# 会话刷新后重复工具消息：定位与恢复方案

日期：2026-09-08。状态：原修复与真实实例验证完成，已合入并推送主干；2026-09-19 因低内存 VPS 暴露的无界完整重放补充修复已合入、部署并完成生产复验。

## 2026-09-19：大会话 tail 同步不得退化为无界完整重放

### 事故与验收契约

生产 VPS 的日报专用会话 `ncp-mttygc4l-8213285c` 已增长到约 157 MB journal、118 MB message projection 和 10 万余条事件。一次中断恢复在增量 tail 中看到 seed 无法证明归属的旧工具事件后，`readNcpAgentSessionProjectionTail` 按原设计读取完整 journal；实现同时分配完整 Buffer、UTF-8 字符串、`split("\n")` 行数组和事件对象，V8 heap 在约 650 MB 触顶。NextClaw 主进程于 2026-09-19 09:07:50 CST 崩溃，systemd 重启后，同进程内另一条普通前台会话被标记为失败。整机当时仍有约 1 GiB available memory、1.9 GiB 可用 swap 和 13 GiB 可用磁盘，因此根因不是宿主资源耗尽，而是恢复路径的无界瞬时分配。

contract-id: session-tool-tail-bounded-recovery；parent-goal: 大会话恢复与普通前台会话可以共存，不因任何 session 加载路径触发进程级 OOM；scope-revision: 2（用户要求统一修复整份 session 加载）。

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| BOUNDED-01 | true | 增量 tail 缺失工具归属时不读取并解析整份 journal | passed | 历史 owner 逐行定位回归通过；旧 `Buffer(size) + split + events[]` fallback 已删除 |
| BOUNDED-02 | true | journal 中可定位的旧工具归属仍恢复到原消息，增量与完整语义一致 | passed | 跨 checkpoint 迟到工具结果与 48 项 journal/projection 定向回归通过 |
| BOUNDED-03 | true | journal 中无法定位或投影已不含 owner 时明确诊断并忽略不安全事件，不合成虚假消息 | passed | unknown tail、终态迟到事件与损坏投影回归通过 |
| BOUNDED-04 | true | 原 journal、消息投影和用户历史不删除、不改写、不丢失 | passed | 损坏投影重建测试核对 journal 不变；实现只替换派生投影，不改写恢复源 |
| BOUNDED-05 | true | 同一生产大会话边界复验后服务不重启，健康检查与普通 AI 请求正常 | passed | 0.57.0 生产大会话完成 `run.finished` 且固定回复命中，随后普通前台会话同样完成；应用 PID `218395`、systemd `NRestarts=0`、内外健康 200、部署后 OOM 日志 0 条 |
| BOUNDED-06 | true | 正常 get/list/run 恢复优先读取当前消息投影，不完整读取 journal；投影缺失或损坏时仅逐行流式恢复 | passed | projection-first loader 与两遍流式 fallback 已实现；130.8 MB 合成 journal 在 192 MB heap 下恢复成功 |
| BOUNDED-07 | true | projection tail 本身按行增量读取，单次同步不分配 `journalSize - offset` 大 Buffer | passed | tail 两遍逐行扫描；消息顺序、活动态、完成/取消/中断回归通过 |
| BOUNDED-08 | true | 首次追加、元数据更新和投影重建等间接入口不得为取得 seq/metadata 隐式完整加载消息历史 | passed | 尾部反向 seq 读取、sidecar 时间戳与 metadata 回归、损坏投影流式重建通过 |

### 范围判定

这是原恢复能力面的统一有界加载合同缺口，不是新的状态模型。最先命中的工具归属 fallback 只是其中一个入口；同一 journal 还会被 `loadSession()`、投影损坏 fallback、首次追加和元数据更新完整物化。唯一事实 owner、事件合同、projection schema、消息身份与前端行为均不需要改变；修复留在 kernel 的 journal/projection 读取 owner。

### 修订方案

1. `getSession`、无分页 `listSessionMessages` 和 run 启动优先从有效 message projection 读取当前消息，再逐行同步固定边界内的 journal tail。它们不再把已经折叠进投影的历史事件重新物化；内存下界仍包含模型实际需要的当前消息集合，但不再同时持有原始 journal、拆分行和全部事件对象。
2. 投影缺失、版本过期或损坏时，对固定 journal size 做两遍逐行扫描：第一遍只收集 replay 为判断“中断错误是否被后续事件覆盖”所需的小型索引和 session 活动元数据；第二遍把单个事件喂给同一个 stateful replay owner。完整数组 replay 与流式 replay 共用状态迁移，不维护两套恢复语义。
3. 增量 tail 同样逐行扫描，不再 `Buffer.alloc(size - offset)`。第一遍建立必要的终态覆盖索引和 seed/message/tool 归属需求，第二遍按现有 replay 语义恢复；当前同步固定到打开文件时观察到的 size，并发追加交给下一轮。
4. 未知 toolCallId 的历史 owner 在已投影前缀 `[0, projectedJournalOffset)` 中逐行定位，只解析匹配的 `message.tool-call-start`，再从 projection 逐条读取 owner seed。无法定位或 owner 已不在 projection 时保留原 journal、输出结构化诊断并忽略不安全 tail 事件，不完整回放、不合成虚假消息。
5. projection 的 messageId→ordinal 索引逐条读取消息建立，只保留 ID/ordinal，不为查一个 owner 同时物化全部消息。读取完整当前消息时逐条解析并合并 tail；这是调用模型所需的语义数据，不包含被历史增量替代的旧版本。
6. 首次 append 的 next seq 由有界 journal 扫描取得；metadata 更新使用 sidecar/catalog 活动快照，不因改一个字段加载消息正文。投影损坏重建复用流式 journal 恢复结果，禁止回到旧的 `readFile + split + events[]`。

不采用提高 V8 heap 或 systemd 内存上限：它只推迟无界分配并挤压共存服务。不采用删除/截断大会话或关闭日报任务：这会牺牲用户数据或功能，且不能防止其它长会话复发。不新增完整 tool ownership 数据库：现有 journal 与 projection 已能闭环，新增持久化 owner 会引入迁移和双写一致性问题。

### 状态与验证补充

| 场景 | 必须证明 |
| --- | --- |
| owner 位于旧 journal、消息仍在投影 | 有界扫描定位原 messageId，tail 工具结果进入原消息，结果与完整恢复一致 |
| tool start 不存在 | 返回既有安全状态并产生诊断，不完整 replay、不合成消息 |
| owner 消息已被 projection 淘汰 | 不猜测归属；其它消息、终态和 projection offset 正常推进 |
| 大 journal + 小 tail | 峰值不随完整 journal 线性物化，原 `readFile(size) -> split -> events[]` 路径不可达 |
| 有效 projection + 冷启动 run | 只物化当前消息与小 tail，157 MB 历史 journal 不进入 heap |
| projection 缺失或损坏 | 两遍逐行恢复与数组 replay 语义等价，并重建派生 projection；损坏行仍安全跳过 |
| 首次 append / metadata 更新 | seq 与活动元数据正确，且不触发消息历史完整加载 |
| 并发追加 | 当前同步使用固定 size 前缀，后续事件由下一轮同步接续，无丢失或重复 owner |
| 生产热更新 | 备份可回滚；同一大会话触发同步时 MainPID/NRestarts 不变，health 正常，普通新会话完整回复 |

黄金验收链路：用户从真实公网聊天入口发送普通消息；即使后台大会话恢复并触发旧工具归属查找，服务仍持续连接并返回完整回复，页面不再把请求显示为无原因取消。AI 先用生产大会话副本和定向测试证明语义与内存边界，再在备份可回滚的前提下更新 VPS active runtime；用户只需判断最终聊天体验是否符合预期。

本地验证记录：会话恢复、projection、timeline、compaction 原定向 48 项通过，提交门扩大复跑为 56 项通过；排除一个与本改动无文件交集的既有 context-provider 固定文案失败后，kernel 其余测试通过；匹配 TypeScript、定向 ESLint、kernel build 与 diff-only maintainability 通过。低内存验证使用本地合成数据，不包含生产会话正文。

生产部署记录：修复提交 `4fe335f75` 已快进推送 `origin/master`。部署产物以正式 `nextclaw@0.57.0` 标签为基线移植该修复；纯净标签重建 kernel SHA-256 与线上原文件逐字节一致，避免再次混入未发布的 core 合同。仅替换 active runtime 的 kernel bundle，原文件、修复文件和可执行 `rollback.sh` 保存在 `/home/admin/.nextclaw/hotfix-deployments/20260919-session-bounded-4fe335f75`。生产大会话从 seq 107568 继续到 107581，依次产生 `message.sent`、`run.started`、`message.completed`、`run.finished`，固定回复校验通过；用户给出的普通前台会话随后也 `run.finished` 且固定回复校验通过。两轮后应用 PID、systemd 主 PID 均保持不变，`NRestarts=0`，本机及公网健康均为 200，部署以来无 `FATAL ERROR`、heap OOM 或 allocation failed。17321 的无关进程仍为原 PID 669。用户已在知悉凭据暴露后明确要求继续并部署；生产验收通过不改变既有凭据仍须另行轮换的事实。

## Active acceptance ledger

contract-id: session-tool-tail-recovery；parent-goal: 修复刷新后重复工具消息，验证通过后合入主干；scope-revision: 1（用户确认）。

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| TAIL-01 | true | 原始日志恢复为正确消息，九次真实工具结果不丢失 | passed | 9419 事件、9 个保存边界；正文、思考、工具结果与耗时一致 |
| TAIL-02 | true | 活动 checkpoint、完整恢复和增量恢复等价，取消/错误/完成后不被迟到工具复活 | passed | 六轮九工具的 live/full/incremental 等价及终态迟到事件回归通过 |
| TAIL-03 | true | 旧错误投影可从 journal 重建，原始事件不变，不执行模型或工具 | passed | v7 错误投影重建回归；两个真实原会话修复，journal 哈希不变 |
| TAIL-04 | true | 匹配类型检查、回归与审查通过，真实产品链路复验 | passed | 101 项测试、两个包 tsc、治理审查；真实新会话三次请求六次工具，运行中与完成后刷新通过 |
| TAIL-05 | true | 仅本任务改动合入 origin/master，主工作区 WIP 保留 | passed | 修复提交 e12f7d315 已推送 origin/master，本地主干快进；五个其它 WIP 文件哈希不变 |

阶段图：实现 → 验证 → Review → 合入主干，均已完成。上述 Required ID 全部关闭。省略与本问题无关的发布平台和视觉偏好标准。

实现学习：旧 pending 快照没有独立旧格式或完成证据，不能安全推定 final，因此保留事实，不新增猜测式 legacy 兼容。状态管理器须将活动 assistant 快照纳入 streaming 槽位，才能一致处理取消。增量 tail 出现 seed 无法归属的工具事件时，回到同一 journal replay 获取历史归属；正常活动链路仍只重放 tail。

## 目标与范围

真实用户会话回复结束后，刷新出现额外的「Use 3 tools」与等待动画。恢复后的消息身份、内容和终态必须与实际执行一致；历史读取不得启动模型或重新执行工具。

这项修复服务于 [产品愿景](../VISION.md) 中连续、可信的个人操作层。沿用 [journal 持久化设计](2026-05-14-session-journal-persistence-design.md) 的事件事实源，以及 [metadata 存储设计](2026-05-19-session-metadata-storage-design.md) 的原始事件与派生数据边界。

风险 L3；design-document: required；plan: not-required。恢复实现、派生数据版本升级及定向回归已在同一批完成。

## 已确认的证据

用户入口为 `http://127.0.0.1:5318/chat/sid_bmNwLW10c3FudTh5LTY4bTVkdjFw`，对应 session `ncp-mtsqnu8y-68m5dv1p`。真实后端为本机 18792。

- 实际页面刷新复现额外工具消息和等待动画。
- messages API 返回 session idle，但三条消息中最后一条 assistant 仍为 streaming。
- 原始 journal 共 9419 个事件，只有一次 run.started、一次 run.finished。九次工具调用全部发生于真实最终回复之前，没有回复结束后的新工具调用。
- 正常 assistant 有完整正文和九个工具结果。多余 assistant 的 ID 为 `tool-call_00_P4uwnTDvJs6DN3AKFVHw2096`，其中三个结果的 toolCallId 都已存在于正常回复，名称均为 unknown。
- 多余消息不是 journal 中发送过的消息，而是恢复器生成后写入消息投影的记录。
- 使用生产 replay 函数、真实 journal、生产投影的分段边界和 active seed 规则进行增量重放，精确复现相同的多余消息 ID、三个工具 ID 和 streaming 状态。
- 同一日志完整重放得到七个重复结果。仅在临时实验副本保留原始 pending/streaming 状态后，两种重放均得到一条用户消息和一条 final assistant，九个工具结果保留。该实验确认因果，不替代正式回归。

最初调查未重启服务、未改真实 journal 或投影、未发送新消息。最终验证已在检查会话全部空闲后重启真实 18792 服务并加载修复，沿原 5318 产品入口复验：第二个原会话由九条恢复为六条消息，第一个由三条恢复为两条，原 journal 哈希不变。另通过正常新会话 `ncp-mtssrt1o-8wjrey72` 发起三次请求，共六个只读工具调用；运行中刷新继续同一请求，完成后刷新保持六条 final 消息，消息全量哈希一致。本文不保存用户聊天正文、配置或工具结果内容。

## 生成路径与「三个／七个」差异

| Journal 序号 | 增量恢复行为 |
| --- | --- |
| 569 | 第一轮含两个工具的 assistant message.sent 本来是 streaming，却被 createReplayEvent 转成 final；activeMessageId 丢失。 |
| 956–969 | 下一段没有原 assistant seed，也没有新的 run.started。正常工具开始被 unknown-tail guard 拦截；没有 messageId 的 tool result 绕过该 guard，fallback 创建 tool-* 消息。本轮快照同时恢复正常 assistant，投影因此有两条 assistant。 |
| 1005–1032 | 下一段只以多余消息为 active seed，两个 gateway 结果继续被归入它，累计三个。 |
| 1033–5323 | 后续显式正文开始允许重新建立正常 assistant；当前 streaming 对象被切换。本段不再返回多余消息，但投影 synchronize 是增量 upsert，不能把「本段没有返回」解释为删除，于是已持久化的三个结果残留。 |
| 9418–9419 | 正常回复完成，run 结束。其 messageId 指向正常 assistant，不能结算另一个合成 ID。 |

完整重放不会在保存边界重建 replay context：第一轮被错误标记 final 后，terminalMessageIds 一直保留正常 assistant ID，后续开始事件持续被拦截，剩余七个结果均流入多余消息。

关键代码：

- `packages/nextclaw-kernel/src/utils/ncp-agent-session-replay-event.utils.ts`：createReplayEvent 无条件将 assistant pending/streaming 转为 final。
- `packages/nextclaw-kernel/src/utils/ncp-agent-session-replay.utils.ts`：terminalMessageIds、unknown-tail guard 和 bootstrap 的恢复规则。
- `packages/nextclaw-kernel/src/stores/ncp-agent-session-message-projection-persistence.store.ts`：只恢复 active seed、分段重放和增量 upsert。
- `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-conversation-tool-call.manager.ts`：工具归属找不到时选择当前 streaming 或合成 tool-* ID。

## 根因判断

原设计已经要求 journal replay 与 live 状态等价；实现中的旧历史兼容把「保存过的中途消息」等同于「已完成消息」，破坏该合同。工具归属缺失时的自动合成又把恢复错误扩散成可持久化的虚假消息。增量 checkpoint 无法正确延续活动消息，使两条恢复路径产生不同结果。

范围判定为会话恢复能力面的合同缺口：涉及完整恢复、增量投影和旧数据升级，不能只改 UI。现有事件已经能够表达正确身份和状态，判别实验支持沿现有 owner 修正，无需重做 NCP 架构或新增第二套投影系统。

已有测试检查了终态后的迟到 tool start，却没有覆盖同一迟到调用的 result；增量等价测试使用 service 边界消息，没有覆盖真实 assistant 中途快照后继续调用工具。另有 legacy draft message.sent 测试明确期待转 final，因此不能把删除转换的一行实验当作完整修复。

## 解决方案

### 1. 恢复器忠实保留执行状态

kernel journal replay 负责事件适配和恢复上下文；NCP conversation state manager 继续负责消息状态迁移，projection 只存储其结果。

- 正常执行期间的 message.sent 保留消息自身状态，不能因落盘或刷新提前终结。
- 完成、错误、取消按原有权威事件作用于对应 message/run，终态后不允许迟到开始或 delta 重新建立消息。
- 宿主失去执行归属时，由现有 interruption 恢复流程产生明确中断事实；不在普通 replay 中把未完成输出伪装成成功。
- legacy draft 兼容移到明确的旧数据导入/迁移边界。不能仅凭 pending/streaming 判定旧数据：同样状态会出现在现代活动 run 中。无充分旧格式依据时保留事实并报告恢复状态，不猜测完成。

### 2. 工具结果必须有可证明的消息归属

- 正常链路按 toolCallId 关联原有 messageId，跨 checkpoint 保留活动消息及其工具关联，不靠当前屏幕最后一条消息猜归属。
- replay 对开始、参数、执行状态、结果使用一致的归属和终态判定。已存在工具的迟到结果可按原合同更新原 part，但不得复活消息或创建另一条 assistant。
- 对当前 seed 中缺失但历史中可定位的归属，使用已有 journal/消息索引恢复原消息；无法归属的事件保留在原 journal 并产生诊断，不通过 tool-* fallback 制造成功的用户历史。
- 限定在持久化恢复边界修复该问题，不未经消费者审计便全局删除 toolkit 的行为，不扩张公共协议或新增通用恢复框架。

### 3. 增量恢复与完整恢复使用同一语义

- checkpoint 保留真实活动消息和恢复所需关联；activeMessageId 不能被人为 final 清空。
- 分段仅改变执行成本，不能改变消息 ID、工具归属、内容或最终状态。
- 不将增量尾部未返回的消息视为删除；本次残留由修复后的完整重建解决，避免误删正常历史。

### 4. 修复已经受影响的历史投影

- 先修并验证完整 replay，再升级消息投影版本，使旧投影不能继续作为有效数据返回。
- 通过明确的投影升级/重建动作，从原始 journal 重建派生消息与索引；完成验证后替换派生产物。该动作不调用模型、不执行工具、不改写原 journal。
- 重建按 session 串行，以一致 journal offset 为边界，后续事件从该 offset 接续；中途失败保留 journal，可重试，不把旧错误投影宣称为健康。
- 本现场 journal 完整，实验已证明可恢复两条正确消息。若其它会话的 journal 自身就含有错误合成消息或缺失事件，需另行诊断，不能套用按 unknown 名称或 tool-* 前缀删除的规则。
- 不新增页面加载时隐式执行业务的修复逻辑；缓存版本与重建使用现有 storage owner，迁移动作和结果明确可观察。

## 状态与验证矩阵

| 场景 | 必须证明 |
| --- | --- |
| 普通最终回复 | 完整正文、工具结果、顺序与元数据不丢失，无额外 assistant。 |
| 运行中刷新 | 正常消息仍活动，继续接收同一 run 的工具和正文。 |
| 中途 assistant 快照后继续工具 | 同一消息持续累积工具，checkpoint 不改变状态和身份。 |
| 结束后刷新、分页重进、冷加载 | 消息集合及终态与 live 一致，无新增等待动画。 |
| 失败、取消、宿主中断 | 明确终态，迟到 start/result 均不复活消息；不自动重新执行。 |
| 新一轮执行/用户重试 | 新旧 message/run 归属分离，旧终态 guard 不阻断合法新 run。 |
| 旧投影升级 | 从 journal 重建消除派生重复，原始事件不变；重复重建幂等。 |
| 旧 draft 历史 | 在明确旧数据边界处理，现代活动消息不被误判。 |

正式实现应增加脱敏多轮工具事件 fixture，比较实时状态、各实际保存边界的增量投影和完整重放；断言消息 ID 集合、状态、正文、工具唯一性及结果。覆盖运行中和结束后不同切点，补迟到结果与已有取消/中断回归。

实现后执行匹配范围的 TypeScript 检查、kernel 恢复/投影与 toolkit 相关测试、diff-only review。最终沿真实产品链路验收：保留用户入口，修复后刷新此会话；另在正常会话中进行真实模型多轮工具请求，分别于运行中与结束后刷新。临时重放只作为根因与自动回归证据，不作为用户验收环境。

## 取舍与交付边界

前端隐藏 unknown 或 idle 下所有工具消息会掩盖错误历史；仅删缓存会让未修复的完整重放产生七个重复结果；仅保留 streaming 虽修复本样例，但遗漏旧历史、中断与迟到结果合同。以上均不足以交付。

保留 journal、现有 state manager 和 projection owner；删除正常重放中的无条件终态转换及无归属事件的虚假消息生成路径；不做无证据需要的协议重构和全仓状态框架调整。本次不发布 NPM；原始会话事件不改写，仅由现有投影 owner 重建派生记录。已完成上述真实链路验证，交付范围是验证后的主干集成。
