# Native 单次长任务自动上下文压缩

## 迭代完成说明

- 根因：Native runtime 只在 run 开始前执行一次 context preflight；一次 run 内的工具结果与追加输入继续增长时，后续模型轮次只经过硬预算裁剪，没有再次进入语义压缩。与此同时，同一 run 的多个模型轮次共用一条持续增长的 assistant message，单纯复用 timestamp checkpoint 会把压缩后新增的 parts 一并过滤。首次实现还只对齐了 Codex 的触发时机和生命周期，没有继续核对 replacement history：pre-run 仅留最后一条 raw message，mid-run 不留任何真实用户原文，summary 因而成了旧历史的唯一载体。后续纠偏又确认，若 checkpoint 不固化 raw tail 成员、最终预算闸不知道稳定边界，刚保留的用户原文仍可能被下一层硬裁剪删除，provider 前缀也会随动态 suffix 抖动。真实 3000-token 复现进一步暴露三个独立缺口：工具 schema 没进入压缩预算、8156 字符 summary 未经最终 provider 预算面验证就安装、源码热重载在 `run.started` 后终止进程却没有向 journal 写统一终态。事故会话还证明首个所谓成功 checkpoint 实际只保存了 161 个字符且中途截断；旧逻辑只检查 `content` 非空，没有检查 finish reason、结构收尾和可安装摘要预算。与此同时，session/UI preview 只统计 history，漏掉约 25K 的 system/tool 固定输入，导致界面尚未接近总窗口时后端已经越过压缩线。后续真实会话又暴露跨 Agent 混合：session 持久化为 researcher，但前端续聊错误地把全局 Agent 选择 main 写入 request metadata 和历史 run spec；缓存又只按 session 保存 fixed token，预览再用 researcher profile 补算 total/trigger，最终拼出不存在于任何 provider 请求的“main 33K 固定输入 + researcher 28K 压缩线”；开发态半热更新还把新缓存字段读成 0。
- 确认方式：修前失败测试构造“两次模型采样 + 一次工具结果”的 Native run，观测到 preflight 只调用一次且没有 phase；随后对照 Codex `rust-v0.144.1` 的 pre-turn / mid-turn compaction 调度与上下文窗口实现。
- 根因修复：保留一个 phase-aware preflight owner，在工具结果或追加输入要求继续 run 时执行 `mid-run` 检查；mid-run checkpoint 记录 streaming assistant 的 message id 与已覆盖 part 数量，后续投影只保留新增 parts，并注入仅供模型使用的 continuation message。压缩完成后再以 20K token 为最大独立预算、以当前模型实际触发线为硬约束，从最近向前选择 raw session 中的真实用户消息；最老的入选边界消息可保留带截断标记的头尾，其余精确原文与摘要一起进入 replacement model view。checkpoint 同时固化 retained raw-tail id；projection 返回稳定消息数量，builder 再传递合并 system 中的 summary 字符边界。最终预算闸先只按稳定消息自身确定性规范化启动上下文尾部，随后冻结 provider 前缀，动态 suffix 不再反向改写它。summary 输入与输出都由本次窗口动态求解，最终 replacement history 必须在同一预算面通过后才能安装。kernel 新增 Agent 保存阶段门，按真实 context/tool contribution chain 求解最低窗口；journal 启动恢复则把未闭合 run 统一追加为 interrupted `run.error`，并收敛 assistant/tool/preview 状态。上下文预算缓存改为绑定持久化 session Agent 的原子事实；Kernel 生成 run spec 时也以已有 session Agent 为准，客户端单次 metadata 不能偷换身份。只有真实 run 写缓存，session preview 保持纯查询；前端已有会话发送优先使用 session Agent，只有新草稿使用全局 Agent 选择。Native fixed 为 0 的不完整快照不再展示。
- 纠偏依据：Codex local compaction 的 20K user-message budget、remote v2 的 64K retained-message budget，以及真实 user / session wrapper / stale developer context 的分流过滤证明，角色级保真是压缩输出合同的一部分，不能由“已经生成 summary”替代。
- 设计依据：[Codex 对齐的自动上下文压缩设计](../../designs/2026-08-08-codex-aligned-context-compaction.design.md)。
- 本轮 stable-prefix 收口过程记录：[working-notes.md](work/working-notes.md)。
- 兼容性：旧 v1 checkpoint 继续走既有 timestamp 投影；Codex、Claude Code、Hermes 等 runtime-owned 会话不增加 NextClaw 外层压缩。
- 运行内展示顺序根因：append-only journal 本身一直按 `assistant parts → compaction marker → 后续 assistant parts` 正确记录；错误发生在 UI projection。continuation assistant 被合并回一条持续增长的 canonical assistant message 后，timeline builder 又把 compaction 一律当成 message-level 独立虚拟行，只能把 marker 排在整条 assistant 之后。修复保留 journal service marker 作为唯一事实源，但让 `mid-run + continuation part anchor` 投影为 assistant 内部 process part；pre-run/manual 与旧无锚点 marker 仍是会话级分隔。`compressing → compressed/failed/cancelled` 复用同一个 service message id 和 custom-part key，状态更新不重挂载相邻运行内容。
- 冷重载再次错序的更深根因：message projection 在每个 marker boundary 后无状态重放 journal tail，同一 assistant 的新增分段按 message ID 覆盖了旧累计快照。真实故障中七段 parts 为 `16+11+6+5+9+8+9=64`，checkpoint 锚点是累计的 `16/27/33/38/47/55/64`，但 reload API 只剩最后 9 parts，前端只能把全部锚点夹到末尾。修复把 `NcpAgentSessionMessageProjectionStore` 收敛为 canonical read-model owner：projection meta 持久化 active assistant replay frontier，tail replay 先恢复完整 assistant 再消费增量；projection 首建/升级则用完整 journal record 与实际读取 byte offset 原子重建，不让 UI 拼接持久化碎片。
- continuation pre-run 再次掉到卡片外的根因：此前只给 mid-run marker 写 assistant part anchor；continue 前的 pre-run marker 仍被当作普通 session boundary，而随后产生的 assistant segment 又会折叠回原 visual surface，原边界因此失去可见消息坐标并被 timeline flush 到整张卡片末尾。最终设计把 physical timeline、assistant segment graph 和 visual surface 分成三层；新 continuation pre-run 在 summary 调用前即写入 target assistant 的 message id 与 part count，UI 统一换算成 surface 绝对边界，旧 marker 只通过可证明的 hidden continuation edge 做 legacy 映射。另一个恢复缺口是 page projection 的 tail replay 只 seed active assistant，没有 seed 已物化的 `compressing` marker；projection v6 现把 pending compaction IDs 与 active assistant 一起作为 replay frontier，后续 tail 只有 abort/error 时也能原位结算 marker。
- 流程复盘：本功能前期把预算、runtime、journal、projection、continuation 和 UI 当成多个局部 bug 推进，缺少先行的统一领域模型与完整状态矩阵，造成局部测试通过后问题反复转移。设计文档已重构为规范设计，明确领域对象、单一 owner、预算公式、checkpoint/marker 合同、状态机、三层投影坐标、恢复与兼容；`nextclaw-solution-design` 同步增加跨层状态型功能的设计阶段门，禁止再用单点测试或真实 smoke 代替完整设计。

## 测试/验证/验收方式

- 修前基线：`DefaultNcpAgentRuntime` 测试实际只收到一次 `undefined` phase，预期的 `pre-run / mid-run` 失败。
- 三个触达 package 的 `tsc` 均通过：`@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/ncp-agent-runtime-next`。
- 定向测试通过：runtime 10 条；core compaction + final pruner 17 条；kernel preflight + builder 18 条。覆盖 phase 调度、全量 mid-run plan、真实用户消息 token 选择、20K 固定上限、实际窗口动态上限、边界截断、part boundary、rolling compaction 不复活旧历史、retained raw tail、连续 projection 深度相等、provider stable-prefix 保护、超大启动上下文确定性规范化与不可变前缀超预算显式失败。
- package 全量测试：runtime 13/13、core 210/210、kernel 268/268 通过。kernel 首次并行全量回归曾在未触达的 session projection 测试出现一次临时文件并发 rename `ENOENT`；该文件单独复跑 16/16，通过后同一整包命令复跑 268/268。
- 后续事故定向验证：core 完整 213/213、runtime-next 13/13、NCP toolkit 43/43、kernel 完整 275/275 通过；新增保存阶段门定向验证为 kernel 24/24、server 6/6、UI 5/5，三包 `tsc` 均通过。fake provider 验证 summary 输入加动态输出不超过模型窗口，fake journal 验证进程重启后只追加一次 canonical 中断终态，全程零真实模型 Token。补充的摘要完成性测试覆盖 `finishReason=length`、结构不完整和 reasoning-only 三种失败；完整预算一致性测试覆盖 runtime surface、session API 和 UI 28K/35K 压缩压力。最终身份/预算纠偏定向回归为 kernel 17/17、UI 12/12，两个包 `tsc` 与关键文件 ESLint 均通过。隔离冷启动实例加载真实问题会话副本后，session API 返回 `agentId=researcher`、`fixedInputTokens=25601`、`dynamicInputTokens=273`、`totalContextTokens=35000`、`reservedContextTokens=7000`、`triggerContextTokens=28000` 与 `completeInputBudget=true`，证明系统与工具进入了同一原子预算快照，且全程未调用模型。新增冲突源合成 session：session 固定为 researcher，而客户端 metadata、历史 run spec 与缓存故意写成 main；运行态与冷启动重建都必须返回 researcher 的 35K total、7K reserve、28K trigger，且 fixed 大于 0；UI 对 complete=true 但 fixed=0 的半热更新快照也有回归防线。
- 真实本地源码实例验收：对当前 researcher 保存 `100` 返回 400，不再夹成 `1000`；保存 `3000` 返回“当前至少需要 32562 tokens”，随后 GET 仍为原值 `1000`，证明拒绝发生在持久化之前。该最低值由当前实例实际 instructions、完整工具 schema 与输出预留计算，不是测试常量。
- package lint：runtime 零问题；core 与 kernel 零错误。core 的 24 条 warning 和 kernel 的 1 条 warning 均位于本次未触达文件；所有本次触达文件的 targeted ESLint 为零问题。
- 当前源码完整构建成功，并通过隔离 clone-config 实例验证；构建产生的 `ui-dist` hash 漂移已用 `pnpm clean:generated` 清理，`pnpm check:generated-clean` 通过。
- 第一轮真实 Native smoke：`minimax/MiniMax-M3`、26K context、默认 20% reserve、同一 run 内两次顺序 `exec` 各返回 9500 字符。原始输入估算 36,989 token，mid-run 压缩后为 17,352，低于 20,800 触发线；checkpoint 为 `compressed / mid-run`、`continuationMessageCoveredPartCount=4`，最终保留两个 tool canary 并以 `run.finished` 结束。
- 用户原文保真 smoke：同样使用 26K context 和两次 9500 字符工具结果。原始输入估算 38,528 token，压缩后为 18,767；checkpoint 明确记录原始 user message id `user-msjt80oc-ze2hplxh` 到 `preservedUserMessageIds`，而不是只依赖 summary。最终回复逐字包含 `USER_RAW_RETENTION_CANARY_84721`、两个 tool canary 和通过标记，并以 `run.finished` 结束。隔离源码实例验收后已停止，未影响用户当前运行实例。
- 真实摘要超软目标事故复验：问题会话中 MiniMax 返回约 1200-token summary，而实现把 969-token 软目标误当成不可安装硬上限，导致真实自动压缩在 provider 已成功返回后拒绝 checkpoint。新增修前失败用例先稳定复现“约 120% 软目标但仍低于硬空间”的输出；修复后 `targetSummaryTokens` 只指导生成长度，`maxInstallableSummaryTokens` 才负责安装拒绝。新的 `pnpm validate:context-compaction` 以 fake provider/journal 覆盖 core、runtime、kernel、server；当前共 59 条零 Token 测试，作为该功能开发与后续修改完成时的专项验收入口，不接入通用发布门禁。隔离当前源码实例随后使用真实 `minimax/MiniMax-M3`、researcher 35K/7K 和 3 条 canary 消息执行手动压缩，HTTP 200，checkpoint 为 compressed，最终完整输入 26,745/28,000，保留最新用户原文并向 journal 追加单一压缩事件；隔离实例验收后已停止，用户 5174 未重启。
- 连续压缩终止事故复验：真实会话第一次 mid-run checkpoint 已成功安装为 27,531/28,000，但后续工具结果再次超窗时，摘要调用仍只得到 4,096 completion token，MiniMax-M3 默认 thinking 消耗预算并以 `finishReason=length` 结束，导致 run.error。修复后摘要请求使用窗口允许的 8K completion headroom、明确请求 `thinkingLevel=off`，OpenAI-compatible MiniMax-M3 Chat wire 实际发送 `thinking: { type: "disabled" }`。隔离当前源码实例以 researcher 35K/7K 串行执行三次 9,000 字符真实 `exec`：checkpoint 覆盖量依次为 3、7、11，三次滚动压缩后仍继续模型 round，最终返回 `DOUBLE_COMPACTION_REAL_SMOKE_OK` 并以唯一 `run.finished` 结束；未出现 `run.error` 或摘要截断。隔离实例已停止，用户 5174 未重启。
- 最终真实功能验收不是只调用 compaction service：隔离当前源码实例使用真实 Native runtime、真实 `minimax/MiniMax-M3`、真实 `exec` 工具，在同一个 run 中串行产生四段各 9,000 字符的工具结果。页面先实时出现“正在压缩较早上下文”，随后同一分割线原位变为“较早上下文已自动压缩”；四次滚动压缩分别将 35,771→26,802、38,250→26,902、38,498→26,930、38,543→26,730，模型继续完成全部四个工具并返回 `COMPACTION_FUNCTIONAL_OK`。刷新后四条终态仍在，再发送真实 follow-up，模型准确回复 `DONE_CANARIES=4`，证明 checkpoint 已持久安装且恢复后确实进入下一次 provider 输入。
- 用户原故障会话也做了原位功能复验：点击“继续运行”后，页面实时显示压缩中，首次把 173,550 token 输入压到 27,294，随后又完成 39,016→27,110、35,608→27,035 并继续真实工具链。为避免故意构造的无限压力任务继续消耗 Token，验收成立后主动停止；该动作暴露压缩 marker 可能永久停在 `compressing` 的取消竞态。修复后 AbortSignal 贯穿 runtime、preflight 与 provider，同一 marker 依次写入 `compressing → cancelled`，再写 `message.abort`；隔离实例用真实 12,000 字符工具结果在 summary 调用期间点击停止，约一秒内 UI 变为“上下文压缩已取消”，刷新后保持终态并显示“继续运行”。历史 journal 中已有的孤儿 `compressing` 也会在 projection 重建时依据后续 `message.abort` / `run.error` 恢复为 cancelled / failed，不修改 append-only journal；用户原故障会话刷新后已验证恢复正确。
- 最终源码一致性复验：完成恢复职责拆分后重新执行完整源码构建并重启隔离实例，不复用旧 dist。发送一条不调用工具的低成本真实续聊时，最终源码按预期触发 pre-run 压缩，UI 先显示 `compressing`，约 14 秒后同一 marker 变为 `compressed`，估算输入从 40,970 降为 27,070；随后真实 MiniMax-M3 回复精确文本 `FINAL_SOURCE_OK`，journal 以 `run.finished` 闭合。刷新页面后压缩终态和回复均保持，证明最后一次结构整理没有让已验收行为与最终构建脱节。
- 冻结源码后的双会话真实功能矩阵：从当前源码完整构建隔离实例 `context-compaction-matrix`，使用全新 researcher 35K session、真实 Native runtime、真实 MiniMax-M3 和真实 `exec`。矩阵 A 串行执行三段各 9,000 字符的工具输出，三次 checkpoint 分别为 35,968→26,535、37,716→26,621、37,883→26,645，最终精确回复 `MATRIX_A_ROLLING_OK`；刷新后三条 marker 与回复均保持，再发送无工具 follow-up，3 秒内精确回复 `MATRIX_A_RELOAD_OK`。矩阵 B 执行一段 12,000 字符工具输出，在 UI 可见 `compressing` 时点击停止，同一 checkpoint `ctx-1786184346160` 由 36,509→28,321 的 `compressing` 原位转为 `cancelled`；刷新后 cancelled 与“继续运行”同时保持。点击继续后没有重复工具调用，新 checkpoint 将 36,825→26,820 并变为 `compressed`，真实模型最终精确回复 `MATRIX_B_CONTINUE_OK`；再次刷新后 cancelled marker、compressed marker、最终回复同时存在且运行状态已闭合。两个 journal 共记录 4 次工具结果、3 个成功滚动 checkpoint、1 个 cancelled checkpoint、3 个 `run.finished` 与 1 个预期 `message.abort`；隔离实例验收后已停止。
- 用户新报告会话 `ncp-msk7fd6f-9h3ak3x4` 的“压缩后终止”经端到端核查并非 compaction 失败：journal 先完成 46,019→26,676 的 `compressed` checkpoint，模型已继续产生后续 reasoning；约 2.2 秒后开发实例 PID 91692 以 code 143（`SIGTERM`）退出并由新 PID 启动，恢复层才追加 canonical interrupted `run.error`。该事故暴露的是验收环境污染：实现过程中修改源码触发开发态重载，会打断正在运行的用户会话。真实功能 smoke 因此固化为“隔离实例、全新 session、当前源码完整构建、矩阵期间冻结源码”，不再把用户开发实例作为唯一验收环境。
- 同一故障会话的零 Token UI 回放补齐了此前遗漏的时序功能验收：当前源码 5174 页面展开 assistant 运行过程后，检测到 4 个 `assistant` 内压缩项、0 个会话级压缩行，4 个 marker 全部属于同一个 assistant article；DOM 顺序实际为“思考/工具 → 压缩 → 后续思考/工具”，并且每个 checkpoint 后仍有后续过程内容。定向测试另外覆盖空 summary 的 `compressing` 可见态、同一 run 多次 checkpoint、continue assistant 的 part offset、pre-run 独立分隔以及状态更新 DOM identity；本轮相关 kernel/UI/agent-chat-ui 共 79 条测试通过，三个 package 的 `tsc` 均通过。
- stream/reload isomorphism 修复先用“三段同 ID assistant + 三次 boundary + 无新增 delta 直接 abort”建立修前失败，确认冷投影只剩最后一段且状态错误保留为 streaming；修复后 kernel projection/journal/recovery 与 UI timeline 共 41 条定向测试通过，Kernel/UI `tsc` 通过。随后复制真实七次压缩故障 journal 和旧 projection 到隔离临时目录，当前源码冷重建得到 64 parts、final assistant 与 7 个合法累计锚点；最终 projection version=6，并把 pending compaction marker 纳入 replay frontier，全程零模型 Token且不修改原会话。当前 5174 API 已返回同一真实 assistant 的 64 parts/final；另一个可见故障页面在真实浏览器中刷新前后完整 DOM snapshot 相等，3 个 compressed 与 1 个 cancelled marker 数量、归属和顺序保持一致。
- 最终提交前专项入口 `pnpm validate:context-compaction` 扩展为 core、runtime、kernel、NCP toolkit、agent-chat-ui、server、UI 七层真实功能合同，共 135 条零 Token 测试通过；覆盖 summary/replacement history、pre/mid-run、最终 provider build、accepted-run、journal/page projection、pending marker 恢复、custom part 与 continuation placement。8 个受影响 package 的 `tsc` 均通过。整包回归中 core 217/217、runtime 14/14、toolkit 45/45、agent-chat-ui 254/254、server 168/168 通过；kernel 唯一失败是未触达的 panel-app VM 测试环境缺少 `URLSearchParams`，UI 唯一失败是未触达的 workspace preview 测试没有包裹 Presenter Provider，均与本批无关并未在本提交中修改。
- 对用户报告会话 `ncp-mskabhmk-r8q3t5e5` 做了提交前真实浏览器回归：修复前两个 continuation pre-run marker 会成为卡片外独立 divider；当前热更新前端中 11 个成功/取消/失败压缩 marker 全部为 `data-context-compaction-placement=assistant` 且属于同一 assistant article，独立 timeline marker 为 0。强制无缓存刷新后 11 个 marker 的文案、归属与相对顺序逐项一致。

## 发布/部署方式

- 本轮源码、测试、changeset、设计文档与迭代记录随当前本地提交纳入版本历史；未推送、未发布、未部署，也未重启用户当前运行实例。
- 已添加 changeset，后续随统一 patch 发布进入 NextClaw 与对应 workspace 包。
- 数据库 migration、线上 API smoke、desktop/runtime update manifest：不适用；本次只改变 Native agent runtime 的本地模型上下文编排。

## 用户/产品视角的验收步骤

1. 先在 researcher 高级配置中输入 `3000` 并保存；应看到包含动态最低值的明确错误，刷新后原配置不变。输入 `100` 也不得被偷偷显示或保存成 `1000`。
2. 使用 Native 会话发起一个会连续执行多个工具、并产生较大工具结果的长任务。
3. 让同一 run 在工具结果后继续下一轮模型请求，不要拆成多个用户 turn。
4. 确认 session metadata 出现 `last_context_compaction.phase=mid-run`，并包含 continuation message part boundary 与 `preservedUserMessageIds`。
5. 对 pre-run/manual 压缩确认 checkpoint 同时记录 `retainedMessageIds`；同一 checkpoint 的后续请求只在稳定前缀之后追加或裁剪动态内容。
6. 确认压缩后不会重复已完成工具调用，后续模型仍能逐字引用最近用户约束、记得关键工具结果，并正常完成最终回复。
7. 在工具调用中模拟进程重启后刷新页面；assistant 应为中断错误、工具调用为 cancelled、右侧允许继续运行，不能仍显示“执行中”。
8. 使用 Codex 等 runtime-owned 会话时，确认仍由其自身上下文 owner 管理压缩，不出现 NextClaw 二次压缩。
9. 打开上下文指示器详情；35K 窗口应显示 7K 输出预留与 28K 自动压缩线，并把系统与工具、会话内容分别列出。输入达到 28K 时主圆环应为 100%，而不是 80%。
10. 展开发生过 mid-run compaction 的 assistant 运行过程；压缩提示应出现在对应工具/思考之间，不得作为独立会话行堆到整条 assistant 消息之后。完成态可以随运行过程折叠，展开与刷新后顺序必须一致。
11. 对同一个发生至少两次 mid-run compaction 的会话记录刷新前顺序，再刷新页面；逐项核对 marker 前后的 reasoning/tool、assistant 终态和未完成工具状态。只看到相同 marker 数量不算通过。
12. 在一次已取消/中断的 assistant 上点击“继续运行”；pre-run 压缩在新 assistant segment 尚未出现时就应显示在原 assistant 末尾，新 segment 到达后只能追加在该 marker 之后。再次继续并刷新，所有 pre-run/mid-run marker 都必须留在各自 continuation segment 边界，不能堆到整张卡片末尾。

## 红区触达与减债记录

### packages/nextclaw-server/src/features/config/stores/server-config.store.ts

- 本次是否减债：否。
- 说明：本轮只让 Agent `contextTokens` 保存进入 kernel 动态最低窗口校验，没有继续向该 store 增加预算计算或压缩产品语义；该文件仍承担多域配置默认值与持久化归一化，是既有配置热点。
- 下一步拆分缝：先按 chat/session/provider 三个域拆分配置构建与默认值归一化。

## 可维护性总结汇总

- 本次是新增用户能力，允许必要生产代码增长；压缩主链没有新增第二套 manager、adapter、factory 或 summary 算法。新增的 `AgentContextWindowManager` 是配置保存阶段的独立流程 owner，复用同一 provider 输入序列化和 token estimator，而不是预算代理层。
- 代码增减（10 个触达 TS/测试文件）：新增 386 行、删除 22 行、净增 364 行；排除测试后新增 139 行、删除 22 行、净增 117 行。增长主要来自 phase 合同、part-boundary 投影与失败/rolling/builder 回归测试。
- 用户原文保真纠偏追加触达 6 个 TS/测试文件：新增 371 行、删除 5 行、净增 366 行；排除测试后新增 175 行、删除 1 行、净增 174 行。生产增长集中在 checkpoint 可选字段、20K/实际窗口双重 token 预算、最新优先选择、边界截断和 raw timeline 重投影；测试覆盖完整保留、20K 固定上限、实际窗口动态上限、截断、mid-run 与 rolling 行为。
- stable-prefix 收口后的当前 11 个触达 TS/测试文件相对 `HEAD` 合计新增 711 行、删除 48 行、净增 663 行；排除测试后新增 367 行、删除 33 行、净增 334 行。它覆盖用户原文保真与 stable-prefix 两次纠偏的当前未提交源码，不把无关工作区 WIP 计入本迭代。
- runtime 只负责 follow-up 生命周期的触发时机，kernel preflight/manager 继续拥有预算、摘要和 checkpoint，projection utils 继续只做无状态视图变换。
- 通过复用同一 preflight hook 与已有 checkpoint v1 可选字段，避免平行链路和持久数据迁移；preflight event 应用逻辑收敛为一个 async-generator method，消除了 pre-run / mid-run 重复分支并清除了本次新增 lint warning。
- maintainability guard 无阻塞项，有两条跟踪警告：`input-budget-pruner.service.ts` 为 520/600 行、本轮增长 90 行；`context-compaction.service.ts` 为 304/600 行、本轮增长 138 行。前者仍是唯一 provider 硬预算 owner，双边界裁剪共享同一估算与协议清理状态；后者仍是 compaction plan/checkpoint 与用户消息选择 owner。当前拆文件会把同一预算不变量拆散，收益低于间接层成本；若继续增长，前者优先拆出纯 token/content 估算策略，后者优先把用户消息选择建模成明确策略 owner。
- 已使用 `post-edit-maintainability-review` 做独立复核；本次是新增用户能力，必要增长已通过复用既有 checkpoint、projection、builder 和 pruner owner 收敛，没有新增 manager/文件/目录或平行裁剪链路，也没有为压低行数牺牲边界类型与失败可观察性。
- 用户纠偏已沉淀到 `code-investigation-workflow`：以后对齐外部有状态机制时，必须分别核对触发、输入、replacement state、角色级保真、持久化恢复、失败重试与测试证据，禁止用“触发时机一致”外推为整体语义对齐。
- UI 时序修复没有新增第二份 compaction store 或 timeline 状态：kernel 只补全 checkpoint 开始态锚点，message timeline projection 负责把持久 marker 映射为内联 NCP extension，通用 agent-chat-ui 只增加无 NextClaw 业务含义的 custom-part render seam。自动 guard 无阻塞项；当前累计 compaction 批次在 preflight、timeline、container 与 chat-message 文件上接近预算线，因此触发主观复核。结论为通过：新增 seam 分别位于既有 owner，未增加 manager/factory/双写路径；后续若继续扩展 timeline projection，应优先把独立 compaction placement 算法迁入同 feature 的专用 projection owner，而不是继续增长 container 或通用 message renderer。
- 最后一次收口把 continuation placement 继续留在单一 timeline projector，没有给组件或 continuation 按钮增加特判；projection v6 只在现有 meta frontier 中增加 pending compaction IDs，没有新增恢复 store。首次全范围 guard 发现 message projection store 跨过 400 行预算、续跑 hook 测试新增用例使单个 describe 越过函数预算；收口后把无状态 meta 校验、active assistant/pending compaction 推导复用到既有 projection utils，并把同文件测试按“命令采用 / history 与 hydration”拆成两个行为分组，两个阻塞项均消除。journal utils 中与 replay 无关的会话标题推导也移入独立纯 utils，使文件从本批一度 402 行降到 377 行。最终 scoped maintainability guard 为 0 error；targeted ESLint 为 0 error，剩余 8 条均是触达热点的既有体积或 provider 复杂度 warning，没有新增 disable、平行 owner 或补丁分支。

## NPM 包发布记录

- `@nextclaw/core`：需要 patch，待统一发布。
- `@nextclaw/ncp-agent-runtime-next`：需要 patch，待统一发布。
- `@nextclaw/ncp`、`@nextclaw/ncp-toolkit`：需要 patch，待统一发布。
- `@nextclaw/ncp-react`：需要 patch，待统一发布。
- `@nextclaw/kernel`：需要 patch，待统一发布。
- `@nextclaw/server`、`@nextclaw/ui`：需要 patch，待统一发布。
- `@nextclaw/agent-chat-ui`：需要 patch，待统一发布。
- `nextclaw`：需要 patch，待统一发布。
- 本轮未执行 NPM publish；changeset 已通过 `pnpm release:summary -- --json` 合同校验，无素材错误。本能力没有用户界面视觉变化，release-note 截图不适用。
