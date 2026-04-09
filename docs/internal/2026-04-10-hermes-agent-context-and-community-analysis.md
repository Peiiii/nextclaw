# Hermes Agent 默认上下文与社区口碑调研

## 1. 背景

这份调研的目标，不是判断 `Hermes Agent` 是否“全面最好”，而是回答三个更有产品价值的问题：

1. 它为什么会被很多人评价为“开箱就很好用”。
2. 它默认到底给模型塞了什么上下文与 runtime 机制。
3. 这些优点里，哪些值得 `NextClaw` 借鉴，哪些只是特定社区偏好或阶段性热度。

这份文档默认对齐 [NextClaw 产品愿景](../VISION.md)：

- 我们要学的是“如何更好地成为统一入口与能力编排层”
- 不是为了追热点，把别人的 feature list 生搬硬套进来

## 2. 研究范围与方法

### 2.1 研究时间

- 本轮研究完成时间：`2026-04-10`

### 2.2 事实来源分层

本次结论分三层：

1. **高置信技术事实**
   来自 Hermes 官方文档、官方仓库、默认配置示例与源码。
2. **中置信外部判断**
   来自第三方技术评测或架构解读。
3. **中低置信社区口碑**
   来自 Reddit 等公开讨论，适合看“大家反复在夸什么/吐槽什么”，不适合当技术事实来源。

补充说明：

- `Starkslab` 这类代码优先型评测权重较高
- `OpenAIToolsHub` 这类泛工具评测站只作为外围感知信号，权重较低

### 2.3 口碑样本说明

社区口碑部分不是严格统计学研究，而是人工抽样归类：

- 以最近公开讨论为主
- 优先看“有明确使用经历”的帖子，而不是纯转发或标题党
- 同一条样本命中多个优点标签时，每个标签只记一次
- 明显带宣传口吻或实现细节可疑的内容会降权
- 因此频次只能理解为“方向性强弱”，不能理解为精确民调

口碑频次主要基于 `12` 个主样本，外加若干支持性信号。

## 3. 总结结论

一句话结论：

**Hermes Agent 当前的口碑优势，核心不是“某个神秘专属模型更强”，而是“强主模型 + 很厚的 agent runtime + 很重的上下文工程 + 比很多竞品更顺手的产品化封装”。**

更具体地说：

- 技术层面，它默认做得最重的是：
  - 分层 prompt 组装
  - 持久记忆与会话检索
  - skills 作为程序化记忆
  - 强工具调用纪律
  - 长上下文压缩与缓存
  - 多渠道入口与大量工具表面
- 社区层面，最常被反复提到的优点是：
  - 记忆/连续性/skills 真的有感
  - 比 OpenClaw 一类方案更少折腾
  - 本地/自托管/模型自由度高
  - 更像一个“完整 agent 产品”而不只是聊天壳
- 但代价也很明确：
  - prompt 与工具 schema 很厚
  - token 消耗容易偏高
  - 小模型或小上下文环境下体验可能掉得很快
  - gateway / Telegram / 本地模型链路仍有不少粗糙边角

## 4. 官方默认上下文与 runtime 结论

## 4.1 它默认不是靠 “Hermes 自家模型” 取胜

这是最容易被误解的一点。

根据官方仓库与源码：

- 默认示例配置的主模型是 `anthropic/claude-opus-4.6`
- 默认 `provider` 为 `auto`
- 默认 `base_url` 指向 `OpenRouter`
- 辅助任务默认偏向 `Gemini Flash`

更关键的是，Hermes 仓库里还明确提示：

- `Nous Research Hermes 3 / 4 models are NOT agentic`
- 官方建议 agent workflow 使用 Claude、GPT、Gemini、DeepSeek 等具备更成熟工具调用能力的模型

所以它的“好用”本质上不是“默认用了某个 Hermes 神模”，而是：

- 先选一个强主模型
- 再通过 runtime、上下文工程和工具纪律把这个模型扶正

## 4.2 默认 system prompt 不是一层，而是一整叠

官方 `Prompt Assembly` 文档与源码给出的组装顺序，大致是：

1. `SOUL.md` 身份层
2. tool-aware guidance
3. 可选静态人格块
4. 可选 system message
5. `MEMORY` 冻结快照
6. `USER` 冻结快照
7. skills 索引
8. 项目上下文文件
9. 时间戳 / session id / model / provider
10. platform hint

这里最重要的不是“层数多”，而是**它有意识地区分了稳定层和瞬时层**。

官方还明确把以下内容排除在持久缓存前缀之外：

- ephemeral system prompt
- prefill messages
- 某些 gateway 注入层
- 某些 later-turn recall

这说明 Hermes 在 prompt 工程上的重点不是“尽量多塞”，而是“哪些东西必须常驻，哪些东西应该只在本轮出现”。

## 4.3 默认会给模型强行补一层“执行纪律”

Hermes 最值得注意的一点，是它不只告诉模型“你是谁”，还会告诉模型“你该怎么干活”。

默认 runtime 会在特定模型家族上注入 `tool-use enforcement`，覆盖：

- 说了要做，就立刻调工具
- 不要只描述计划
- 如果工具能做，就不要只口头承诺
- 没完成就继续做，不要提前收尾

对 GPT/Codex/Gemini 等模型，它还会继续加执行纪律提示，例如：

- 哪些任务必须用工具验证，不能凭空回答
- 什么时候应该继续搜索/重试
- 什么时候必须先看文件/看环境/看 git 再回答

这层很像“agent 操作规程”，而不是普通的系统提示词。

它非常可能就是很多用户感到“这个模型更会干事”的核心原因之一。

## 4.4 它默认把“记忆”“历史检索”“skills”做成三层，而不是一锅粥

Hermes 的连续性设计不是简单地把历史会话全塞回 prompt，而是至少拆成了三层：

1. **MEMORY / USER**
   持久化、人工可见、会在 session 开头以冻结快照注入。
2. **session_search**
   通过会话检索回忆历史过程，而不是把过程混进长期记忆。
3. **skills**
   把复杂工作流沉淀成可复用文档与脚本，作为程序化记忆。

这套设计很重要，因为它直接避免了两个常见陷阱：

- 把所有东西都塞进长期记忆，最后变成垃圾场
- 把所有历史都硬塞 prompt，最后又贵又乱

官方默认字符上限也体现了这种克制：

- `memory_char_limit: 2200`
- `user_char_limit: 1375`

这不是追求“无限记忆”，而是追求**有边界、可维护、可缓存的记忆**。

## 4.5 项目上下文加载很克制，不是把所有规则全扔进去

Hermes 对项目上下文采用优先级加载，而不是一股脑全塞：

- `.hermes.md`
- `AGENTS.md`
- `CLAUDE.md`
- `.cursorrules`

并且是 **first match wins**，只取一种主上下文类型。

还有几个关键点：

- 单文件默认上限 `20,000` 字符
- 超长时按 `70% head + 20% tail` 截断
- 子目录上下文是渐进发现，不是开局一次性全量注入

这说明 Hermes 的默认哲学是：

**项目上下文很重要，但必须控制预算，不能让 prompt 工程反噬本身。**

## 4.6 它默认依赖大窗口模型，但并不把窗口当无限资源

Hermes 没有一个固定写死的全局 context length。

官方文档说明它会按以下顺序尽量探测：

- 显式配置
- provider / custom provider 元数据
- endpoint `/models`
- Anthropic `/v1/models`
- `models.dev`
- fallback defaults

文档还明确指出：

- 同一个模型在不同 provider 下窗口可能不同
- `claude-opus-4.6` 在 Anthropic direct 可到 `1M`
- 在 GitHub Copilot 可能只有 `128K`
- 实在探测不到时，会退到广义默认值，文档写的是 `128K default`

Hermes 也没有等到上下文打满才处理，而是默认：

- 到上下文 `50%` 时触发压缩
- `target_ratio = 0.20`
- 也就是压缩后大致保留约 `总窗口 10%` 的近期尾部

再叠加 Anthropic prompt caching，它实际上是在试图把“大 prompt runtime”的成本压低到还能接受。

## 4.7 它默认是“厚 runtime”，不是轻壳

官方架构文档里，Hermes 的默认形态非常明确：

- `47` 个已注册工具
- `20` 个 toolsets
- CLI 与消息平台默认共享一整套核心工具
- browser、terminal、file、memory、session_search、skills、delegate、execute_code 都在默认核心面里

这意味着用户感觉到的“开箱即用”，不是因为聊天框好看，而是因为它默认已经是：

- 带浏览器
- 带终端
- 带文件操作
- 带记忆
- 带会话检索
- 带技能机制
- 带多渠道入口

它更像一个有很多预装能力的 agent OS，而不是一个轻量聊天容器。

## 5. 为什么它会被觉得“开箱就会干活”

综合官方设计与第三方评测，Hermes 的“会干活感”主要来自 6 个叠加因素。

### 5.1 主模型默认就够强

它默认示例不是小模型起步，而是直接把强前沿模型放在默认主路径上。

这让很多用户第一印象不会被“便宜但不够稳”的默认模型拖垮。

### 5.2 runtime 默认就替模型补齐 agent 纪律

Hermes 不是把 agent 行为全押给模型天赋，而是显式补：

- 工具调用纪律
- 执行持久性
- 失败重试导向
- memory / session_search / skills 的分工提示

这会显著减少“模型很聪明但不爱动手”的情况。

### 5.3 它把连续性问题拆对了

不是“更长聊天记录”解决一切，而是：

- 用户画像
- 稳定偏好
- 历史检索
- 工作流沉淀

分别处理。

这比很多“全靠大 prompt”和“全靠向量库”的方案更容易让用户形成“它真的记得我”的感知。

### 5.4 它默认就有产品入口，而不是只有 terminal demo

Hermes 不只是本地 CLI。

社区反复提到它的 gateway / Telegram / Open WebUI / API 等入口，这让它更像“可日常使用的 agent”，而不是“开发者 demo”。

### 5.5 它对 builder 用户足够友好

skills、local model、SSH、browser、cron、OpenAI-compatible API 这些设计，直接讨好了最容易写长帖传播口碑的一群用户：

- 喜欢自己搭
- 喜欢本地跑
- 喜欢长期用
- 喜欢把 agent 接进 homelab / VPS / 自动化链路

### 5.6 它默认承认 agent 很重，并试图正面管理这种重

很多方案的问题不是不重，而是“重但不承认”。

Hermes 至少把这些重度机制做成了显式系统：

- 分层 prompt
- 压缩
- 缓存
- auxiliary model
- skills progressive disclosure

这让它即便是厚 runtime，也不像纯粹堆料。

## 6. 社区口碑结论

## 6.1 口碑整体判断

从近期开源社区讨论看，Hermes 的主流正面口碑并不是“推理质量碾压一切”，而是：

**它比很多同类 agent 更像一个可以日常运行的完整系统。**

支持性热度信号也很强：截至 `2026-04-10`，其 GitHub 仓库公开页面显示约 `42.9k stars`、`5.5k forks`。这不能直接证明满意度，但至少说明它已经不是边缘小众项目。

大家夸它时，常见叙事不是：

- “模型太神了”

而更像：

- “它终于不像实验玩具了”
- “比 OpenClaw 少折腾很多”
- “记忆和技能这套是有感的”
- “本地跑、走 Telegram、接 homelab 很顺手”

## 6.2 高频优点归类

下表频次基于 `12` 个主样本的人工归类，属于方向性判断：

| 优点标签 | 粗略频次 | 说明 |
| --- | --- | --- |
| 记忆 / 连续性 / skills 有感 | `~6/12` | 不是单纯长上下文，而是“会记事、会召回、会沉淀流程” |
| 本地 / 自托管 / 隐私 / 模型自由度 | `~5/12` | Ollama / LM Studio / VPS / 本地文件落盘是高频卖点 |
| 比同类更少折腾 / 迁移更顺 / just works | `~4-5/12` | 尤其在和 OpenClaw 的比较里出现很多 |
| 更像完整产品而不是聊天壳 | `~4/12` | 多入口、工具多、可做自动化、适合长期运行 |
| 稳定性更好 / 没那么容易炸 | `~3-4/12` | 主要来自与 OpenClaw 的对比型评价 |
| 安全意识更强 / 更容易做沙箱化 | `~3/12` | 不是人人都提，但在 power user 群体里很重要 |

## 6.3 高频优点的真实含义

### A. “记忆好”其实是在夸分层连续性

不少人会把它说成“记忆管理很好”，但更准确的理解应该是：

- 记忆不是单独一项 feature
- 而是 `memory + session_search + skills` 共同构成了连续性感知

这和很多产品宣传的“long-term memory”不是一回事。

### B. “开箱顺”其实是在夸产品化封装

社区很多评价都带有强烈的比较对象，尤其是 `OpenClaw`。

所以 Hermes 被夸“开箱顺”，往往不是说它真的零配置，而是说：

- 配置链路更像产品
- 默认路径更清楚
- 少一点自己 debug agent 本身的痛苦

### C. “本地可用”其实是在夸主权感与控制感

对很多用户来说，Hermes 的吸引力不是性能最优，而是：

- 我可以自己选模型
- 我可以把数据留在本地
- 我可以通过 Telegram / SSH / VPS 长期托管它

也就是说，Hermes 的一部分口碑来自“主权感”，不只是“能力感”。

### D. “像完整产品”其实是入口能力的胜利

一些评价本质上是在夸它已经接近“个人 AI 操作层”的雏形：

- 有多入口
- 有工具
- 有连续性
- 能运行在常开设备上
- 能接真实环境

这和 NextClaw 的方向最相关。

## 6.4 反复出现的槽点与风险

正向口碑之外，社区也反复出现几类负面反馈：

### A. token 消耗重

这是最稳定的负面反馈之一。

原因并不神秘：

- system prompt 厚
- 工具 schema 厚
- agent loop 本身重
- 调试时容易频繁读文件、调工具、压缩上下文

所以 Hermes 的体验很依赖：

- 大窗口模型
- 好一点的工具调用模型
- 愿意接受较重的 token 成本

### B. 小模型 / 本地模型下体验波动大

社区里一边有人夸本地可用，一边也有人明确说：

- 小模型不够聪明时，安全与工具选择会出问题
- context 太小会明显吃力
- 速度会比 LM Studio 纯聊天慢很多

这再次证明：Hermes 的优势不是“轻”，而是“重系统在强条件下更完整”。

### C. setup / gateway / Telegram 等边缘链路仍不够平

虽然有人称赞安装顺、迁移顺，但同样有人反馈：

- onboarding 循环
- Telegram token / gateway 配置异常
- 本地 provider 配置让人困惑

这说明 Hermes 当前的“产品化程度”虽然已经比不少同类好，但离真正低摩擦消费级产品仍有距离。

### D. 某些社区内容带有明显热度放大

近期 Hermes 讨论热度很高，但部分帖子明显更像：

- 转发
- 宣传
- 二次总结

而不是真正长期使用后的严肃复盘。

因此当前社区口碑可以作为方向信号，但不能直接当成成熟度证明。

## 7. 对 NextClaw 的启发

## 7.1 最值得学的不是模型，而是 runtime 设计

从 NextClaw 视角看，Hermes 最值得借鉴的不是“默认配哪个模型”，而是这几个系统层能力：

1. **分层上下文**
   身份、规则、记忆、项目上下文、瞬时提示不要混在一起。
2. **分层连续性**
   durable memory、session recall、procedural memory 要拆开。
3. **工具执行纪律**
   不能只希望模型自己突然变勤快。
4. **入口产品化**
   一个 agent 是否像“操作层”，很大程度取决于入口整合而不是单轮回答质量。
5. **上下文预算治理**
   厚 prompt 可以，但必须有压缩、缓存、渐进加载。

## 7.2 Hermes 的高频优点，与 NextClaw 愿景高度相关

把社区高频夸点翻译成 NextClaw 语言，其实非常贴近我们的上位目标：

- 大家夸“多入口可用”
  - 对应的是 NextClaw 的 **入口优先**
- 大家夸“会记住我 / 会延续”
  - 对应的是 **统一体验优先**
- 大家夸“能接工具和真实环境”
  - 对应的是 **编排优先**
- 大家夸“更像真实工作台”
  - 对应的是 **长期地位优先**

也就是说，Hermes 的口碑亮点并不是偏离 NextClaw 愿景的偶然 feature，而是一些非常接近“AI 时代个人操作层”形态的信号。

## 7.3 但 NextClaw 不应直接照搬它的“厚”

Hermes 的问题也提醒我们：

- 厚 system prompt 容易吃掉预算
- 小模型下体验容易断崖
- agent runtime 一旦变成大一统巨石，维护成本会迅速上升

因此 NextClaw 更合理的借鉴方向应该是：

- 学它的分层原则
- 不照搬它的 prompt 体积
- 学它的产品闭环
- 不照搬它的全部 runtime 堆叠

换句话说，NextClaw 应该吸收 Hermes 的“结构正确”，而不是复刻它的“重量级实现形态”。

## 7.4 当前对 NextClaw 的直接建议

基于这次调研，最值得优先推进的不是“支持 Hermes”，而是把我们自己的 agent runtime 判断再推进一小步：

1. **明确 NextClaw 的上下文分层模型**
   至少区分：身份层、长期偏好层、历史检索层、项目层、会话瞬时层。
2. **把“procedural memory / skill memory”当成一级问题**
   不要把所有连续性都丢给聊天历史或 profile。
3. **给 runtime 增加更明确的工具行动纪律**
   让“会干活感”来自系统设计，而不是偶然 prompt。
4. **优先强化统一入口体验**
   如果多 runtime、多渠道、多工具最终仍是碎片化入口，那就没学到 Hermes 真正被夸的地方。
5. **对上下文成本建立显式治理**
   包括预算、压缩、缓存、分层加载和模型差异化策略。

## 8. 最终判断

如果只用一句判断来概括：

**Hermes Agent 当前最成功的地方，不是证明了“更大的 prompt 就会赢”，而是证明了“当一个 agent 真被做成连续、可编排、多入口、可长期使用的操作层雏形时，用户会明显感知到它和普通聊天壳的区别”。**

这件事对 NextClaw 是正向信号。

因为它说明市场对“AI 个人操作层”的直觉其实已经出现了，只是大多数产品还没有把这条路线做成真正稳定、统一、可持续的产品。

## 9. 参考资料

### 9.1 官方资料

- [Hermes Prompt Assembly](https://hermes-agent.nousresearch.com/docs/developer-guide/prompt-assembly/)
- [Hermes Context Compression & Prompt Caching](https://hermes-agent.nousresearch.com/docs/developer-guide/context-compression-and-caching/)
- [Hermes Context Files](https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files/)
- [Hermes Memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory/)
- [Hermes Skills System](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/)
- [Hermes Providers](https://hermes-agent.nousresearch.com/docs/integrations/providers/)
- [Hermes Architecture](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture/)
- [GitHub Repository](https://github.com/NousResearch/hermes-agent)
- [Default CLI Config Example](https://raw.githubusercontent.com/NousResearch/hermes-agent/main/cli-config.yaml.example)

### 9.2 第三方评测 / 外部判断

- [Starkslab: Hermes Agent Review: What It Actually Does](https://starkslab.com/notes/hermes-agent-review-what-it-actually-does)
- [OpenAIToolsHub: Hermes AI Agent Framework Review](https://www.openaitoolshub.org/en/blog/hermes-agent-ai-review)

### 9.3 社区样本

- [Reddit / LocalLLaMA: Anybody who tried Hermes-Agent?](https://www.reddit.com/r/LocalLLaMA/comments/1ro9lph/anybody_who_tried_hermesagent/)
- [Reddit / LocalLLaMA: Running Hermes Agent locally with LM Studio](https://www.reddit.com/r/LocalLLaMA/comments/1rwhi2h/running_hermes_agent_locally_with_lm_studio/)
- [Reddit / degoogle: Replaced a bunch of cloud AI services with a self hosted agent](https://www.reddit.com/r/degoogle/comments/1sct3x0/replaced_a_bunch_of_cloud_ai_services_with_a_self/)
- [Reddit / hermesagent: Switched from OpenClaw to Hermes Agent — not looking back](https://www.reddit.com/r/hermesagent/comments/1s69sru/switched_from_openclaw_to_hermes_agent_not/)
- [Reddit / hermesagent: Moved from OpenClaw to Hermes, now lost on provider choice](https://www.reddit.com/r/hermesagent/comments/1scgv91/moved_from_openclaw_to_hermes_now_lost_on/)
- [Reddit / hermesagent: High token consumption with Hermes Agent](https://www.reddit.com/r/hermesagent/comments/1s8iaog/high_token_consumption_with_hermes_agent/)
- [Reddit / hermesagent: Local models = poor results observed](https://www.reddit.com/r/hermesagent/comments/1s6mhzz/local_models_poor_results_observed/)
- [Reddit / hermesagent: Hermes Terminal slower than LM Studio](https://www.reddit.com/r/hermesagent/comments/1sgj51d/hermes_terminal_slower_than_lm_studio/)
- [Reddit / hermesagent: openshell sandbox self-hosted post](https://www.reddit.com/r/hermesagent/comments/1s8y35q/put_hermes_agent_inside_nvidias_openshell_sandbox/)
- [Reddit / aiagents: architecture summary post](https://www.reddit.com/r/aiagents/comments/1sd7ot8/i_looked_into_hermes_agent_architecture_to_dig/)

## 10. 备注

这份文档的目标是帮助 NextClaw 做产品与架构判断，不是为 Hermes 背书，也不是做竞品拉踩。

如果后续要继续深入，最值得补的不是更多口碑截图，而是两件更硬的工作：

1. 选一个最小 NextClaw runtime，做一次 `Hermes 式上下文分层` 对照实验。
2. 选一个真实用户闭环，验证“统一入口 + 记忆 + 技能沉淀”是否真的提升长期留存感。
