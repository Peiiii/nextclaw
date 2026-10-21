# 上下文压缩韧性：确定性视图与可选摘要

## 状态与用户目标

2026-10-19 调研与设计，尚未实现、尚未改变已发布行为。第一轮参考 Codex、pi；第二轮按几百 MB 会话加载风险补齐性能合同；最终补查 OpenCode 与官方 DeepSeek Harness，收敛为分层、增量、有界的主链路。前两轮不完整处已在原文替换，不把局部正确性审查当作性能或整体可用性结论。范围仍为方案，不执行产品实现或发布。

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
| OpenCode `f394d9d410bc6bb7cafcebfc5e3180a9b80ebed9` | 当前实现在 `packages/core/src/session`；summary/recent 分开，实际过长拒绝后有界缩小输入，格式无效只提醒一次；完成事件才形成新视图，分页把 cursor/LIMIT 下推数据库 | 复用增量摘要、真实错误分类和持久定位；其 LIMIT 仍不能独自证明单条大对象的读取上限 |
| 同版 OpenCode 大输出 | 工具输出按字节/行数限制，完整输出另存，模型只见有限片段与引用 | 在进入后续轮次前阻止巨大正文膨胀；不照搬文件路径与 7 天清理策略，NextClaw 的引用须授权可读且不得提前清理 |
| DeepSeek Harness `687f282e8625c6b8d11ff58211a90524be2e4317` | 先做可持久重放、无需模型的工具结果裁剪，再测压力；普通 pressure 压缩失败仍可继续；overflow 仅在 surface generation 实际前进后有限重试 | 区分“优化没成功”和“无法继续”，进展是重试前提；不把它当作 DeepSeek 模型内部或网页端实现 |
| 同版 DSH 投影缓存 | 以日志身份和 watermark 校验派生缓存；部分 coldSnapshot 调用仍要求调用方提供完整 log | 借鉴身份与增量 fold；不能因为存在投影缓存就认定其冷加载对 H 有界，也不照搬 pruner 的整段 Array.from 大字符串处理 |

主要源码入口：

- [Codex local](https://github.com/openai/codex/blob/4635d489254ba6d80eb6d2ef501929b0c617b6ec/codex-rs/core/src/compact.rs)、[history 配对删除](https://github.com/openai/codex/blob/4635d489254ba6d80eb6d2ef501929b0c617b6ec/codex-rs/core/src/context_manager/history.rs)。
- [Codex remote 安装](https://github.com/openai/codex/blob/4635d489254ba6d80eb6d2ef501929b0c617b6ec/codex-rs/core/src/compact_remote_v2_installation.rs)、[安装原语](https://github.com/openai/codex/blob/4635d489254ba6d80eb6d2ef501929b0c617b6ec/codex-rs/core/src/session/mod.rs)、[输出校验](https://github.com/openai/codex/blob/4635d489254ba6d80eb6d2ef501929b0c617b6ec/codex-rs/core/src/compact_remote_v2.rs)。
- [Codex token-budget 路径](https://github.com/openai/codex/blob/4635d489254ba6d80eb6d2ef501929b0c617b6ec/codex-rs/core/src/compact_token_budget.rs)、[OpenAI 官方压缩说明](https://developers.openai.com/api/docs/guides/compaction)。官方说明明确远程压缩项是不透明状态；不能承诺复刻其内部质量。
- [pi 压缩](https://github.com/earendil-works/pi/blob/d2e7d8b7c1d31d3661f769d5caef7ba8d50c3e03/packages/coding-agent/src/core/compaction/compaction.ts)、[序列化与文件身份](https://github.com/earendil-works/pi/blob/d2e7d8b7c1d31d3661f769d5caef7ba8d50c3e03/packages/coding-agent/src/core/compaction/utils.ts)、[session projection/append](https://github.com/earendil-works/pi/blob/d2e7d8b7c1d31d3661f769d5caef7ba8d50c3e03/packages/coding-agent/src/core/session-manager.ts)、[自动恢复](https://github.com/earendil-works/pi/blob/d2e7d8b7c1d31d3661f769d5caef7ba8d50c3e03/packages/coding-agent/src/core/agent-session.ts)。
- [OpenCode 压缩](https://github.com/anomalyco/opencode/blob/f394d9d410bc6bb7cafcebfc5e3180a9b80ebed9/packages/core/src/session/compaction.ts)、[大输出](https://github.com/anomalyco/opencode/blob/f394d9d410bc6bb7cafcebfc5e3180a9b80ebed9/packages/core/src/tool-output.ts)、[数据库分页](https://github.com/anomalyco/opencode/blob/f394d9d410bc6bb7cafcebfc5e3180a9b80ebed9/packages/core/src/session/store.ts)。
- [DSH pressure/overflow](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/compaction/compaction-basic/src/index.ts)、[无模型裁剪](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/compaction/compaction-tool-result-pruner/src/index.ts)、[范围提交与稳定性](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/compaction/compaction-basic/src/region.ts)、[投影缓存边界](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/session/session-projection-cache/src/index.ts)。

## 推荐方案与替代方案

选择“原 journal + 持久派生索引 + 有界活动窗口 + 分层压缩恢复”。确定性代码管理源与预算，增量模型摘要负责通常的任务连续性，只有不能继续使用原窗口时才启用归档恢复。模型不拥有覆盖边界、工具执行状态、权限、预算证明或持久提交。

最终主链路按以下顺序执行，不建立多套可切换引擎：

```text
完整 journal ──增量投影──> 持久索引/位置与轻量描述
                              ├─> UI 有界页面
                              ├─> Runtime 有界活动窗口
                              └─> 授权后的原文分片

活动窗口：未到软线 → 正常续跑
          接近软线 → 机械瘦身 → 仍需压缩则一次增量摘要
          摘要失败且旧窗口仍装得下 → 保持原事实，延后再试
          硬线/真实 overflow 且无安全窗口 → 恢复视图，先核实再续做
```

其中软线为 `0.8 × hardInputLimit` 的初始默认；`hardInputLimit = 模型窗口 - 正常输出 reserve - 预算误差余量`。与之比较的输入量已含 system/context、实际工具 schema、用户/assistant/tool 消息及 provider 协议开销；固定输入不能在阈值和估算中重复扣两次。给摘要分内容槽时再从这个完整请求预算扣除其它已占空间。首次求解仍须证明固定输入与最小近期边界可装下，不能对小窗口机械套比例。每次发送前仍检查实际完整输入，软线只提供提前量，不是容量证明。

机械瘦身只针对有原文引用的大工具/附件正文和重复表示，保留工具配对、身份、错误/已观察结果与近期用户原话；不把未知状态改为成功，不删除原始事件。新工具结果进入活动视图时即按字节预算表示，避免累积到极限再处理。既有当前工具协议是否支持来源回读由同一历史/资产 owner 闭环，引用不可用时不得静默裁剪。

模型输入是“上次有效摘要 + 此后需要收敛的有界新历史”，近期完整交互单独保留；不把全部 journal 每次重喂一遍。若活动源本身含无法纳入摘要的范围，必须显式记录，不用成功摘要掩盖。

普通 pressure 摘要失败时，只要原活动窗口仍可发送且没有新增不明归档，保持旧 checkpoint 和原窗口继续。失败指纹及 token 水位归原生命周期诊断：新增长达到软硬线间隔的一半、模型/配置实质变化或发生真实 overflow 才允许再尝试；同一源与预算下不在每个 tool step 重发。实际 overflow 只在持久缩减且重算输入后最多续跑一次。这个延后策略关闭“偶发格式错误就进入恢复态”和“每步重新压缩”的可用性缺口。

请求缓存沿 epoch 保持稳定：规则、已安装摘要与冻结近期区间不因 UI 翻页或下一轮重新挑选而变化，新消息/回读证据追加在 suffix。机械裁剪只在明确的压力转换中持久发布一次、与新的预算事实同步；不能每轮按变化的“重要性评分”重排旧前缀。正常窗口、UI 预览与归档正文分别计量，不能用更高缓存命中率掩盖更大的总输入或多余摘要调用。

| 方案 | 优点 | 不能关闭的风险 / 代价 | 决定 |
| --- | --- | --- | --- |
| 修 70% 重试，保留多批全成功，持久化草稿 | 当前 diff 较小，晚批失败可少算一些 | 任一模型内容失败仍能使全链阻断；草稿又引入失效、恢复和存储状态 | 不采用为根治架构 |
| 纯滑动窗口、直接丢弃老模型上下文 | 无摘要依赖，路径简单 | 无任务恢复合同会导致遗忘和重复动作；无法满足连续性 | 不独立采用 |
| 确定性视图、可选摘要、可回读归档 | 把历史保存/边界/预算从模型成功中解耦，失败仍可响应与核实 | 极端降级时需读原文，无法安全恢复的副作用需用户澄清 | 采用 |
| 默认后台并行预摘要 / 全面使用 provider 原生压缩 | 可减少部分前台等待，原生能力可能有更高摘要质量 | 增加候选过期与无效调用，原生状态不能跨所有 provider 重放，均不解决全量读取 | 当前不引入；先用单条前台链路闭合资源与恢复合同 |

不新增摘要服务集群、独立长期记忆库、后台压缩调度或持久批次草稿。优先删除全历史串行摘要的强依赖，并复用原 session/journal/budget owner。

## 用户链路与可保证结果

1. 用户在原会话继续长任务。打开会话只读持久索引与有界窗口，不触发模型压缩或全量回放。Native runtime 达到软压力线时再尝试减小活动视图；原始消息不改写。
2. 机械处理足以缓解压力则不调用摘要模型；否则准备可安装的确定性后备视图，并尝试一次有界增量摘要。两者都保留规则、最新请求、近期完整交互和明确来源。
3. 摘要成功且没有新增未恢复范围时继续原请求；摘要不合格但旧窗口仍可安全发送，则保持旧事实正常继续并延后再试。只有必须移出尚未被承接的历史、无法满足硬输入预算或执行状态不明时才安装 `recovery-required` 后备视图，界面明确“已保留历史，正在恢复任务上下文”。不能把降级显示成完整语义已恢复，也不能因下一次摘要成功解除继承的未解决范围。
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

- 一次压缩动作默认一次摘要调用；机械处理足以减压时零调用。provider 瞬态重试由原 provider owner 负责并有独立次数/时间上限；不再按批数放大语义调用次数。普通 pressure 的失败按水位延后，不触发原请求回放。
- 摘要阶段总时限默认 60 秒，包含该请求的传输重试；和用户取消使用不同的类型化原因。超时放弃可选摘要，软压力仍可用时延后、硬压力才进入后备视图；用户取消终止整个动作。迟到响应不能改变候选或越过安装 revision 校验。主请求仍遵守原 run 的取消/超时合同，不新增并行后台任务。
- 模型只读有界源：可安装的前次摘要与预算允许的新历史；未进入摘要源的区间显式归档。不能强求每条源身份经串行调用后才换窗口。
- 仅完整响应、非空可见文本、无工具调用、预算合格的摘要进入内容槽。内部可继续提示四节格式，但标题、完成注释或 JSON 拼写不再控制历史安装资格。
- 截断、空输出、错误格式、超限、thinking-only、异常 finish reason 均丢弃该内容槽；旧窗口能用时维持它，否则使用已求解后备视图并标记恢复。不补写模型遗漏的事实。
- 摘要不能改变覆盖范围、工具状态、权限或恢复标记；原用户/工具内容按数据引用，不能通过摘要提高指令权限。
- 摘要 provider 与主请求 provider 同时不可用时，返回真实 provider 故障；本方案不保证外部模型离线时仍能生成答案，也不把失败伪装成成功。

### 4. 原文回读必须真实可用

现有 `sessions_history` 只取尾部且每条最多约 4000 字符，缺少指定历史位置及片段分页；`session_search` 主要提供会话关键词命中。仅在 checkpoint 放 journal 指针不足以闭环。

在原 `sessions_history` owner 上增加会话内范围读取和不透明 cursor，复用 `SessionManager` / `SessionPersistence` 的分页能力；单条超大消息还须增加完整 part/文本分片读 contract，不能把 UI preview 当完整证据，也不能先加载全会话再截成一页。复用同一授权后的精确 session ID，cursor 绑定 session、revision、message 和范围，不能跨会话或越权读取。

返回稳定 message/part 坐标、工具身份、已观察到的结果、截断标记、下一 cursor 和剩余范围；每页服从当前恢复窗口的字节/token 上限。不能绕过 tool registration、平台授权或存储 owner 直接读宿主文件。Native 的本地/托管宿主都必须实现同一 contract；缺少注册或读权限时明确 `history-unavailable` 并阻止自动副作用恢复。

原文与资产引用寿命跟随对应会话/用户删除规则，不能照搬上游短期工具文件的自动清理期限，让合法 checkpoint 在数日后失去证据。位置/身份失效必须返回可区分错误；不通过猜测新消息或其它会话内容“修复”旧引用。

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

平台落盘边界：目录同步仅在支持该操作的POSIX路径执行；Windows文件flush使用可写handle，源记录与恢复意图文件仍强制flush，普通I/O错误不得吞掉。Windows不宣称具备POSIX目录fsync的同等掉电语义；进程中断后的源/metadata回滚由同一durable intent保证。实现事实及官方依据见交付日志中的0.59.2 Windows矩阵返工记录。

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

本地存储选定为原 projection owner 下的**派生 SQLite 投影**，复用现有 SQLite opener/事务能力，原 JSONL 不改格式、不迁移原文：消息表只存有界描述/ordinal，part 与正文按不超过 64 KiB 的片段物化，tool-call owner 有独立索引，另有 checkpoint/source revision/投影 watermark。用主键或有序索引定位后再 LIMIT，不把整条大 JSON 塞进一行再读取。它替换现有派生 `messages.jsonl + offsets` 的大行读取表示，不额外维护另一套 canonical 事实；可由原 journal 重建，旧派生版本逐会话准备，不全库强迁移。

UI 读描述，运行入口读取已安装 checkpoint 所选区间和受限 tail 对应的 part，历史工具读指定片段。完整消息的 SDK/导出入口仍可显式组装，但不能被普通打开、续跑或回读间接调用。投影更新事务只发布已物化的片段、归属与 watermark；内存热视图增量更新受影响内容，不能每个 delta 重序列化整个 W。最终 model-visible request 仍由同一个 builder 根据这些来源构造，存储不拥有第二套模型裁剪策略。

兼容风险已取证：现有 `sqlite-database.store.ts` 在 Node 内建 SQLite 不可用时，`sql.js` 分支通过 readFileSync 加载整库，持久化通过 database.export/writeFileSync 导出整库。该分支不能承载这里的大型消息投影并被宣称满足 O(P+D) 与增量写预算。参考本地运行目标固定为 Node 22.23.2 的内建 SQLite；桌面/托管适配也须使用各自具备索引与局部读写的真实后端。不能静默撤销既有 Node 支持或在旧 Node 上悄悄进入同样有问题的 fallback；实施发布矩阵必须单列便携分支的可用性和性能边界，未闭合前不得宣传所有兼容宿主均有大日志保障。无需为此自研 B-tree、KV 框架或新增平行索引 owner。

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
| 任意空/乱码/截断/格式异常摘要 | 内容槽可丢弃；原窗口能用则延后，硬容量不足才使用后备视图 | 正常继续或明确恢复，不抛 opaque batch failure |
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
3. **局部推进性**：在存储正常、模型至少容纳最小恢复请求且主 provider 可用的前提下，普通压力失败可以沿原窗口继续，硬压力失败仍能构造/提交恢复窗口。总摘要调用次数与历史批数无关，不为一次格式异常强迫任务恢复。
4. **终止性**：一次摘要、一次候选重求、一次 overflow replay、八次有进展的恢复读取分别有预算；provider 的独立重试也有次数和时间上限，不存在无界递归或相同状态循环。
5. **副作用隔离**：恢复态的工具 dispatch 由代码限制，模型编造完整摘要/成功标记不能越过；未核实业务条件不自动解锁。
6. **语义限制**：源覆盖、标记完整、回读完成均不能证明模型理解正确。任意历史的无损语义压缩、任意外部动作 exactly-once、供应商永不宕机不在可证明集合；必须通过可回读证据与保守停止管理，不能用成功率数字掩盖。

因此验收的核心反例是“让摘要器永远失败”。在此前提下，系统仍须守住保存、结构、预算、有限调用与只读恢复；不能仅用一个好模型的成功演示证明韧性。

## 实现验收与交付门

本轮交付设计文件与源码证据，非新运行版本。`design-document: required`。后续实现跨 checkpoint/runtime/history/tool contract，`plan: required`；实施前须形成执行计划并完成方案 Review，不以本轮研究报告替代运行验收。

黄金验收：

- 原 UI/渠道发起长任务 → 多次自动压缩 → 成功路径保持原任务、约束、完成证据和下一步；压缩不新增工具副作用，冷重载投影相同。
- 同一路径令摘要器永久空输出/拒绝服务 → 软压力保持原窗口且不在每步重试 → 达硬压力时安装明确恢复窗口 → 自动读回真实原文 → 只读回答/核实；不能恢复的条件只问具体业务澄清，不再出现 opaque batch failure，也不默默重做动作。
- 压缩生成中取消、刷新、重启、追加、rewind → 只观察旧 checkpoint 或完整有效的新 checkpoint；后续消息与 parts 恰好投影一次。

正式验证针对不变量：property-based 随机历史/part 边界及预算、状态模型的提交/取消/并发转换、摘要永久失败及每个 I/O 边界故障注入、v1/v2 读写和旧数据、跨本地/托管 history 回读权限与大消息分片、实际 provider 多轮长任务。TypeScript、原 diff-only maintainability、匹配文档与真实入口验证按触达范围执行；测试通过不代表未测试模型和任务无语义遗忘。

上线须同批覆盖 core/kernel/runtime/server/UI/history portable provider 和真实托管存储适配；新增 v2 由新版本读取 v1/v2、只写 v2，不物理迁移旧 journal。不为旧 checkpoint 伪造来源覆盖证明；首次遇旧数据重新建立可验证来源，必要时进入恢复。旧二进制不支持 v2 的降级运行不宣称兼容，应明确拒绝或使用已验证的完整 journal 恢复入口。

原设计只加本补充方案链接，当前运行事实不改写。本轮不增加 changeset、NPM/Desktop/runtime release，也不声称客户故障已上线解决。

## 实施细化：Node 20 的局部 SQLite 与旧事件解析

用户于 2026-10-19 授权完整实施验证与正式产品 patch 发布；前文“研究、非运行版本”描述研究时状态，当前实施进度由 [执行现场](../work/2026-10-19-context-compaction-resilience/current-state.md) 拥有。

Node 20 支持保持：大型消息投影复用 SQLite opener 的合同，显式选择局部文件驱动；Node 22 使用 node:sqlite，Node 20 使用 libsql 的本地同步 SQLite 兼容接口，禁止该投影落入 sql.js 整库 fallback。既有小元数据数据库的兼容行为不改变。libsql 自带平台原生包，实施须覆盖 Node 20/22 与发行产物的依赖闭包、缺二进制明确失败；不能以本机加载成功代替发布安装验证。无运行时远程数据库或新服务。

旧 JSONL 巨型记录的维修使用流式 JSON token 解析器，字符串与数组不得先完整组装；有界事件骨架和原文片段进入原派生投影事务，再按既有 replay owner 处理事件语义。大工具结果的 args/result 等结构使用片段引用，不能伪装成完整结果供模型盲用。原始 journal 格式保持不变。

正文分片进一步按 NcpPart 的顶层字段归一化：字符串使用原文片段，args/result 等结构字段使用 JSON token 片段。text/reasoning/args delta 只追加相应字段，result 只替换对应字段；不能为一次 delta 重新序列化累计巨型 part。精确 part 读取按字段顺序输出可拼接的 JSON 片段，cursor 同时绑定字段/分片位置与消息 revision；字段存储不引入另一套消息或执行语义。维修以现有 replayer 求解有界事件骨架，源字段由 token 流直接物化，不能用骨架覆盖未改变的完整字段。该细化保持前述 owner、完整性和性能合同，审查需特别验证旧工具 late-result、跨分片 Unicode 和重建恢复点。

有界运行态不可把预览写回完整 assistant 快照。派生 seed 对确实缺正文/早期 parts 的 assistant 明确标记 `nextclaw_partial_projection` 并携带物理 part 索引；这些运行态生成的 MessageSent/MessageCompleted 仍保留在原 v1 journal envelope，但其新投影元数据明确声明只更新生命周期/头部，正文由此前已持久化的原始快照与增量拥有。完整重放与增量投影必须在同一 replay owner 识别此标记，保留原 parts，不把预览当作全文；显式用户编辑不携带这一内部运行态标记。未建立原始消息的 partial 帧须拒绝，不能悄悄当作全文。普通完整快照和旧 journal 不改变语义。

此路径只在 v2 检查点之后启用；不宣称旧二进制能够理解 v2/partial 语义。受控降级须通过当前 reader 的完整 journal 恢复/导出入口产生已验证完整旧格式快照，不能直接让旧 reader 忽略新标记继续运行。实施必须对照完整原始重放、冷重启、跨多个压缩 epoch、晚到工具结果和完整导出，证明没有删去已有正文；这些 Required 未证明前不启用或发布。

`design-review: passed`（此细化）：驱动仅隔离 Node 缺内建 SQLite 这一真实变化点；SQL schema 和读写合同相同。解析器不拥有消息或工具状态。必须用节点版本、巨型字符串、故障和分片重组验证，不以依赖 API 的可用性推断预算已经通过。

## 本轮方案审查结论

实施期细化（2026-10-20）：每次新压缩生成独立 UUID，继承未解决缺口时仍保留原恢复边界；摘要来源被裁剪即降级，正常 stop 不能证明来源完整。分页使用 covering identity index 后逐条取 descriptor，源数据读取累计2.5MiB后结束本页，单检查点metadata上限1MiB；页面只投影状态，完整检查点留在原记录。维修解析完整保留预算内的checkpoint，超预算显式失败，不能悄悄截短再当作完整摘要。显式全记录导出/编辑仍允许全量读取并从journal重放，不能消费展示预览作为原文。DO事务使用microtask yield，避免input gate等待timer的死锁；Node维修继续定时让出事件循环。上述细化保持原复杂度与预算；连续大检查点、源保真、实际DO和冷恢复反例必须证明。

`design-review: passed`，范围仅限本文架构与后续验收合同，不表示新实现已通过运行验证。审查过的反例及已落实的设计修正：

- 好摘要不能掩盖未进入源的历史：archived-only 强制继承恢复状态，结构覆盖与语义完整分开。
- 巨量碎片不能令 manifest 变为新超限源：默认归档加有界覆盖区间，不枚举全量身份。
- 用户指出性能缺口后，原正确性审查结论在性能维度失效。本轮补查存储、Runtime seed、UI 与托管入口，用原 store 的 256 MiB/64 MiB 合成探针确认隐藏全量读取，新增复杂度、字节/内存/等待预算和索引损坏的可见维修合同；以上为架构审查，所有新性能目标仍待实现证明。
- OpenCode/DSH 对照后再修正“任何坏摘要都恢复”的过强策略：普通 pressure 与实际 overflow 分开；先机械处理，增量摘要失败但原窗口能用时延后；只有真实持久缩减才允许原请求重试。该路径保留安全限制，同时减少无必要的恢复、模型调用与缓存失效。
- 存储决策已收敛为原 owner 内的消息描述/part 分片/身份索引与 watermark 的派生 SQLite 投影，避免用“大 JSON 行 + LIMIT”假装有界；实际读取原 SQLite opener 后明确排除其整库 sql.js fallback 的大日志性能承诺，不自研索引引擎。兼容宿主须分别验证，不能以 Node 22 的结果替代。
- “原文仍在磁盘”不能冒充可恢复：精确范围、单消息分片、两类宿主注册与授权为实施 Required 条件。
- 模型自称恢复不能解锁动作：dispatch 白名单和未知业务条件的确认边界属于 runtime 合同。
- 迟到生成、取消和追加不能越过提交边界：source/revision 校验、单一串行追加与线性化点明确。
- 任意 tokenizer/模型永久离线不能被设计假装解决：条件化预算保证、外部故障和语义限制已披露。

后续不必等待客户日志才开工，但实施时若上述任一 Required 条件缺失，不能仅以删除当前错误文案交付。研究证据与方法纠偏已回写本专题及原设计入口，不新增全局提示词或治理规则。
