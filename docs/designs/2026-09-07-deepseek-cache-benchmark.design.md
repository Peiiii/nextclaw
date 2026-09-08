# DeepSeek 缓存修复与低成本真实任务追踪

## 五阶段累计实验 active contract：staged-cache-v1

parent-goal：用统一真实任务重新测量原版、五个累计优化阶段和 DSH，给出完整指标、相邻/原版变化与逐阶段分析，并同步中英文报告和费用曲线。L2 small-change；设计复用现有 worker、fixture、观察器与预算 owner，仅新增阶段源码编排。plan: not-required（单批顺序测量）。

| ID | Required | 合同 | Status | 证据 |
|---|---|---|---|---|
| SC-01 | true | 阶段源码可追溯，只有累计指定优化不同，公共 facade 绑定修复全阶段保留 | passed | 2026-09-08-staged-study/manifest.json及各样本fingerprint |
| SC-02 | true | 同一三任务、2048 输出上限、enabled/high、隔离 HOME，21 个真实样本全部记录 | passed | report.json：21/21通过，无length |
| SC-03 | true | 每阶段费用/缓存/输入输出/耗时/调用/通过率及增量，完整 usage 核账 | passed | report.json/report.md；112请求求和匹配ledger |
| SC-04 | true | 中英文首屏三版本、五阶段指标及分析、费用曲线来自同一实验 | passed | bilingual blog + deepseek-staged-cost.svg，图表由本次report生成 |
| SC-05 | true | 不重启产品，不提交发布，预算 USD 0.25 / 180 请求，不挑选重跑 | passed | ledger：USD 0.094429860，112请求；21唯一样本 |

阶段顺序：S0 原版；S1 模型轮次；S2 提示精简/常驻技能去重与顺序；S3 搜索工具声明稳定；S4 压缩范围；S5 参数按需查询。任务间轮换执行顺序，减少固定先后效应；每个样本新进程和 HOME，供应商缓存不能清空。所有调用采用当前相同价格窗口并保留原 usage。一次三任务观测不宣称统计显著性；压缩未触发时明确本任务集无机制覆盖，不把阶段波动归因于压缩。旧结果保留历史诊断，不拼入新曲线。源码快照只在独立临时目录重建，不修改活跃源码。

契约 review：不添加上线、统计显著性或自动监控等未请求验收；保留每阶段失败分析，避免只交成功样本。当前阶段门为源码 manifest 与零付费 dry-run 通过后才发真实请求。

## 2026-09-08 验收补充：成本接近 DSH

参数按需原型三任务 3/3 通过，USD 0.008571780，较最近 DSH 0.010015264 低约 14.4%。正式方案冻结：ToolProviderManager 为本次已收集的工具快照添加保留名称 tool_schema；查询直接读取同一快照，不重新发现或执行工具。原 NcpTool.parameters、执行器和 executeCollectedToolCall 的 AJV/validateArgs 均不变。仅 kernel buildProviderTools 的模型副本对低频复杂 schema 使用固定 object 声明；基础文件/执行/网页、node_repl、结构化结果和极小 schema 保留完整参数。该公共 builder 同时用于 native 请求与预算估计，避免两个体积口径。NCP wire 类型和原工具权限不变；外部自有模型 builder 继续使用完整参数。必须验证查询后创建真实隔离项目、原始参数校验仍拒绝非法输入、查询前后声明不变，并重测正式路径三任务。原型只作候选证据，正式路径成绩另列。

下一候选仅在隔离 benchmark 试验：完整工具名和原始描述始终声明；常用文件/执行/网页工具保留完整 schema，其余参数用固定 object schema 宣告，通过常驻 tool_schema 查询原始参数。只改变请求的模型可见副本，真实 NCP registry 继续使用完整 schema、原执行器与权限。schema 查询只返回当前请求已授权目录，不扩展能力或改变后台就绪逻辑。先测同三任务费用及参数查询正例，未验证前不落入产品默认路径；实验报告必须标注模式，不能与 full-schema 混作同条件回归。

真实压缩追测新增根因：compaction planner 按 provider message 选择保留尾部，但 checkpoint 仅保存 NCP message ID；多轮调用共用一个 assistant ID，因此仅保留最后一轮的决策在 projection 中恢复了整条 assistant，包括已经摘要化的旧工具结果。修复采用现有模型轮次边界：转换器公开带 partStart 的分组转换，compaction checkpoint 记录保留消息的最小 part 起点，projection 仅保留该起点后的 parts，并重定位轮次 offsets；中途压缩的既有 part slice 同步重定位。旧 checkpoint 缺少起点时保留旧整条行为，不猜测或删历史。验收须证明历史不重复、保留尾部及工具调用配对完整、原 journal 不变、压缩后正常继续，费用包含摘要调用。

后续低风险优化：常驻 skill 清单保留完整描述，普通可用清单排除相同 ref，避免同一 skill 重复发送。系统上下文将固定产品规则置于 workspace/session/reference 等可变内容前；ReplyFormat 的会话资产路径置于该块末尾。规则文本、工具定义和执行权限保持，验证组合上下文完整、正确会话路径与实际多任务 cache usage。跨任务缓存效果单独说明，不能冒称完全冷启动费用下降。

在同模型、同任务、相同输出上限与 clean-home-v1 隔离环境，双方全部通过外部任务验收的前提下，NextClaw 任务集总费用不超过 DSH 的 105%。优先争取更低，但不得靠删除能力、降低质量、截断失败样本、热缓存空转达标。任务运行 PASS 与成本达标分开报告。

工具声明与执行就绪状态分离：session_search 从启动起就声明；后台索引尚未完成时立即返回明确 NOT_READY，失败时返回 UNAVAILABLE，不伪装为空结果，不因索引完成改变声明。真正条件加载的模块仍由模块启用条件决定能力。

真实稳定工具对照（stable-tools-matrix）：NextClaw 与 DSH 均 3/3 通过，费用分别 USD 0.012718164 / 0.009978432，仍高约 27.5%，尚未达标。缓存 81.59% / 80.82%；后续应定位额外输入、输出及调用开销，不能继续将成本差异统称为缓存问题。保留此前提示词 A/B 费用上升及预算截停证据。

- contract-id: deepseek-cache-20260907
- parent-goal: 真实复现并定位 NextClaw DeepSeek Flash 缓存/费用异常，修复已确认的历史改写，并交付可反复运行的小预算真实任务基准。
- scope-revision: 4；核查并修复系统 HOME 泄漏全局 skills 的基准隔离缺陷，重测干净环境成本差距；未授权定时付费、重启宿主、提交或发布。
- 风险 L3；bugfix；reproduce；design-document: required；plan: not-required（一个实现与验证批次）。

## 证据与当前判断

2026-09-07 用本机配置的 DeepSeek 官方 API、NextClaw kernel 公共 Harness、隔离 home 和合成文件复现。没有修改用户原配置，API key 仅从原文件读入进程环境。

- 三轮普通对话输入 15694/15764/15814，命中 1024/15616/15744。后续轮次约 99%，累计仅 68.51%；冷启动可解释部分低累计值。
- 五文件串行核对：输入从 15756 增至 23103，缓存停在约 15872，热轮命中从 92% 降到 69%。真实请求中 system/tools 不变，早期 assistant 的 reasoning/content/tool_calls 却被每轮重写。
- 完整链路：runtime 多次 generate -> 同一 NCP assistant.parts 累积 -> DefaultNcpContextBuilder -> ncpMessageToOpenAiMessages 把所有轮次合并 -> DeepSeek。转换器丢失轮次顺序是本次已证实的边界错误。
- 旧 smoke 依赖已移除的 ProviderManager 导出，NCP 模式按时间与 model 匹配旧日志且只取最后一条；不足以统计多调用任务。
- DeepSeek 当前文档：缓存按已持久化前缀匹配，构建需数秒，best effort；95% 不适合无条件用于含首次冷输入或大量新增工具结果的总量。

## 方案

修复归 runtime 和 message converter。runtime 在同一 assistant 开始后续模型轮次时，用现有 MessageSent 的部分消息 upsert 合同保存 `model_round_part_offsets` 元数据；转换器按原始 parts 下标切片后逐轮转换，保留并行工具组。边界是模型调用事实，不按文字有无或执行时间猜测。metadata 不展示给用户，也不改变消息 ID、最终结算或 token 用量 owner。

无边界的既有持久消息沿用原转换行为，不能捏造旧轮次。该读取分支只服务已持久历史；新 native runtime 一律写边界。退出条件是旧历史全部迁移或不再受支持；cleanup owner 为 NCP runtime。损坏的显式边界拒绝处理，不静默吞掉。

备选：仅按 reasoning/text 分组会误判无文本连续调用和并行工具；每轮创建新 UI 消息会改变会话展示与结算；新协议事件增加无必要传播面。因此复用现有完整消息 upsert 和 metadata。

追踪器复用 `smoke:prompt-cache`，新增隔离 Harness suite：固定请求、连续对话、按文件内容逐步发现下一文件并核对数量。真实网络调用，任务内容可确定性验收；无 mock 成功。只观察本次进程的目标模型请求，保存 usage 原字段、每次调用耗时、请求结构摘要和稳定前缀比例，不保存凭据、用户文件或完整提示。

固定任务版本；每次新会话防止继承测试历史；记录代码 revision、模型、配置摘要、时间、冷/热两种汇总。费用为供应商 usage × 显式价格快照的估算，区别于供应商账单实扣。价格包含来源和货币，不猜汇率。逐请求限制输出、次数、输入大小、超时与最坏费用预留；预算不足在发出下次请求前停止，缺用量标记不完整。默认小预算，人工运行；定时器只需重复同一命令，本次不创建。

## Active acceptance ledger

| ID | Required | 合同 | Status | 证据 |
|---|---|---|---|---|
| CACHE-01 | true | 普通对话和多工具真实修前基线，核对统计口径 | passed | /tmp/nextclaw-cache-investigation/calls.jsonl 与 request-*.json |
| CACHE-02 | true | 保留轮次、并行工具、最终回答及重载后的历史顺序 | passed | converter 8 项、runtime-next 25 项及两个包 tsc |
| CACHE-03 | true | 同任务真实修后复验，逐请求前缀稳定、任务完成与费用比较 | passed | before/after JSON；68.66% → 84.38%，改写 5 → 0 |
| CACHE-04 | true | 可重复基准入口、预算、详细报告、离线比较与文档 | passed | task-suite、6 项指标测试、中英文排障文档；未创建定时器 |
| CACHE-05 | true | 验证、维护性检查、结果交接并披露外推限制 | passed | 维护性 0 错误；迭代记录保存证据、授权边界与局限 |
| CACHE-06 | true | 同模型同任务真实 DSH 对照及公开基准调查 | passed | 官方 DSH 0.1.2-rc.1 sdk：7 调用、任务正确、82.83%、USD 0.004913404；SWE-bench/Terminal-Bench 官方资料 |
| CACHE-07 | true | 三类任务、私有 package、单命令重跑与离线比较，追加费用不超过 USD 0.05 | passed | files v1/config v1/repair v2，双方 3/3；追加 USD 0.022928752；11 项离线测试、预算前置阻断 0 请求 |
| CACHE-08 | true | 文档站中英文报告、详细耗时/token/费用与脱敏证据 | passed | 2026-09-08 博客及 public/benchmarks JSON；VitePress 构建通过 |
| CACHE-09 | true | 系统 HOME/CWD/XDG 与数据目录共同隔离，干净环境真实成本对照 | passed | 干净五文件双方 7 调用，差 29.34%；约 76.93% 差额来自首轮；完整三任务被预算阻断，不提供整体成绩 |

最新研究范围：用户强调代表真实持续任务的机制成本，不能将短冷启动样本当作产品总体成本。当前结论仅解释七调用样本，长任务压缩/重试/恢复和自然修复链路仍无新证据。产品提示优化尚未实施；优先定义代表性任务后再做真实消融，不能因删减开场提示就宣称机制优化完成。

修订 4：bugfix/reproduce，L2，design-document required（沿用本合同），plan not-required。隔离 owner 为 benchmark 子进程启动器；NextClaw 与 DSH 使用各自空 HOME/workspace/XDG，保留原生内置能力，只从用户配置提取官方路由密钥。worker 启动断言 HOME/CWD；报告记录环境版本，阻止与旧报告直接回归比较。默认产品技能加载符合用户预期，不为测试修改产品技能策略。先使用 USD 0.027 剩余预算重测；仅当干净结果仍有显著差距再沿具体费用项优化。

## 验证范围

测试覆盖串行/并行工具、无 reasoning 的连续工具轮次、末尾答案、序列化重载、已有历史、视觉结果与失败边界。真实基准的门分别判断结果正确、usage 完整、前缀是否改写；缓存率是观测值，不把上游 best effort 伪装成固定保证。

这组任务代表短对话与多步文件工具链；不声称覆盖用户原修复 dsh 的账单、长任务压缩或不同 provider/model 定价。移除泛化的“必须所有场景 95%”标准，因其会错误拒绝正常冷输入与新增上下文。未引入新的调度平台或成本数据库。

完整结果、持久报告目录及复跑入口见 [迭代记录](../logs/v0.48.8-deepseek-cache-benchmark/README.md)。修订后黄金指标固定为三类任务累计缓存输入 / 累计输入，包含首次输入：NextClaw 82.63%，DSH 80.29%。旧五文件 84.4% 属于子集，不能直接视为回归。DSH 总费用仍较低，命中率必须与同任务成本核查。配置 off 未转成 API 关闭字段是独立限制，两边本次实际均为 enabled/high。

代码归 private workspace package `@nextclaw/agent-benchmark`，任务、接入、计量、报告分离；scripts 只保留旧入口。DSH 外部可选安装，产品不依赖基准。默认 USD 0.05 共享预算，逐请求预留，缺 usage 不释放。先保留版本化文件报告，不建设后台、数据库或插件框架。repair v1 失败保留，双方统一升级 v2 后通过；仅相同任务版本和条件可做回归比较。

## 2026-09-08 提示上下文优化提案（用户已授权，首批已实施）

### 目标与结论边界

在能力发现、关键约束、工具语义和任务完成质量不退化的前提下，减少完整真实任务总费用。缓存率是诊断指标，不能以增加固定前缀或重复调用提高分数。短样本中约 94% 差额可由额外固定上下文解释，不等于这些内容全部冗余，更不等于能节省 94%。不承诺未经实测的费用降幅。

本次 design-document required，plan not-required（先冻结一批局部候选，不同步执行全部方向）。实现 owner 为 kernel context providers；专项操作细则归已有 builtin skill 或 tool schema。保持现有加载主链路，不新增关键词分类器、检索服务、技能注册框架或动态工具裁剪。

实施更新：用户授权统一优化后，完成 A 的参数去重、B 的 inline 细则迁移及消息交付规则的等义压缩。系统仍保留 inline 声明仅用于展示、不得调用 show_panel_app 作 inline 等边界；Mermaid 简短规则归 visualize-output，JSON 示例、参数、布局归其 inline-display reference，仅 inline 分支继续读取。新增已有 app 展示入口和压缩后重读要求。工具目录、思考预算、技能列表及安全规则不变。以下提案中的完整任务 A/B 与压缩后行为矩阵尚未全部验证，不能据首批冒烟宣称全场景无损或实际任务费用已下降。

### A：优先试验会话工具参数说明去重

现状：native-static-context 的 Session Orchestration 约 1574 字符；scope/start/wait/notify 与 target 对象格式同时出现在 sessions_spawn / sessions_request schema 描述中。工具 schema 本来就随请求提供，无需增加读取调用。

拟保留在系统提示的精确职责：

- 子会话不能继续创建会话，必须向父会话返回进一步委派需求。
- 使用非默认 runtime 前检查已安装 runtime，不能猜。
- 新任务使用 sessions_spawn，已有会话使用 sessions_request；区分创建与继续。
- 用户明确要空闲会话时才 start=false；wait 与 notify 是独立策略。
- 其余参数形状、枚举和默认值以本轮工具 schema 为准。

从系统提示移除重复的 enum 列表、默认值逐条解释及 target JSON 示例；工具定义、实现默认值和校验完全不改。目标是数百字符的低风险减量，不将它夸大为解决 30% 成本差距。风险是减少强调可能影响模型选择，不能仅凭字符串测试宣称无损。

验收：对照创建后继续工作、显式等待、静默独立任务、显式空闲任务、向已有会话发任务、子会话禁止再委派六种意图。校验模型生成的参数与实际编排结果，外部动作使用隔离会话；结合现有工具测试和 scoped tsc。任何违约回退该候选，不顺带改动其它提示。

### B：第二批试验展示细则按需读取

现状：ReplyFormatContextProvider 约 4886 字符，visualize-output 与 panel-app-creator 已包含部分相同细则，但 payload.params 等内容并非完整重复，禁止整体删除。

常驻保留：自包含最终回复、基础 Markdown/文件链接、能力触发条件、读取对应 skill 的强制要求、只使用已验证事实、展示方式边界，以及会话资产目录。专项细则中的系统级禁止事项不因下放而降低优先级。

候选迁移：inline JSON 参数及示例、Panel Card 尺寸/布局等非通用细节，先逐条确认已有 owner；缺失内容补齐到对应已有 skill，再从常驻段落移除。普通文件任务不需要读取这些细则；明确可视化、隐含图形表达、展示已有 Panel App 均必须仍能找到正确规则。不能把“展示已有 app”错误导向“创建 app”。若无法用已有触发合同完整覆盖，则保留对应常驻规则，不增加猜测式路由。

风险：触发遗漏、规则优先级下降、读取长 skill 反而增加专项任务成本、读取后被压缩丢失。验收必须包含普通修复负例、明确和隐含可视化正例、已有 app 展示、缺失/无法读取 skill、压缩后继续展示。无法读取完整合同不得猜参数或偷偷改成另一种交付方式；不得因本次优化扩大 fallback 行为。

### 暂不实施

- 不截断全部 skill 描述、不删除工具、不降低思考或输出上限；这些会改变能力与比较条件。
- 不根据每轮关键词增删 system/tools；避免破坏稳定缓存前缀。
- 不凭七轮样本修改压缩、历史、重试算法；先取得对应真实问题的证据。
- 不同时重写可视化、消息路由和自管理三套规则，保证能归因及撤销单项。

### 验证与决策

先免费核对规则覆盖、真实请求组装和分项字符，字符减量不冒充 token 或费用收益。然后以同版本任务、同模型/思考/输出预算、clean-home-v1 环境比较原版与单项候选，至少覆盖完整的跨文件调查—修改—测试—失败修正链路以及该能力正例。任务自然结束，不人为凑轮次；失败和额外技能读取全部计费。先做 NextClaw 自身 A/B，仅候选通过后再与 DSH 比较，减少无信息增量的付费运行。

通过条件：固定外部验收通过，关键行为矩阵无新增失败，完整任务总费用下降且专项正例没有明显新增开销；一轮小样本只作为试点证据，边界或结果波动时做针对性复测，不宣布所有场景绝对无损。报告同时呈现首轮与后续成本、输入/输出/缓存、工具/API 调用、重试、压缩及耗时。新付费验证仍受既有预算约束，本提案本身不触发 API 调用。

## 后续证据驱动的实施与最终验收

最新用户验收为隔离同任务质量下 NextClaw 费用不高于 DSH 105%，最好更低。先修复真实发现的 session_search 就绪变更声明、压缩只按消息 ID 恢复整个多轮 assistant 的问题；对应原先“暂不修改”限制已因真实复现及授权解除。

参数渐进加载归 ToolProviderManager 的同次工具快照与 buildProviderTools 的原生请求展示层，预算估计复用同一展示层。工具名称和完整用途始终声明；基础工具、小 schema、结构化结果保持完整参数，其他工具通过稳定 tool_schema 查原始 schema。原 NcpTool.parameters、validateArgs、权限和执行入口不变。非原生运行时继续消费原完整参数；不在 benchmark 观察器做产品请求改写。查询后不膨胀声明，真正条件模块仍按启用条件出现。

最终 formal-schema-matrix：双方 3/3，NextClaw / DSH 费用 0.008648220 / 0.009965920 USD，低 13.22%；核心命中率 83.95% / 79.95%，均 0 前缀改写。真实 schema 查询和创建项目验证通过，额外花费 0.001996312 USD。固定三任务达标不等于全部模型及长会话无损；复杂跨模块任务扩充保持显式选择，不提高默认运行成本。详细历史与验证边界归迭代记录及中英文技术报告。
