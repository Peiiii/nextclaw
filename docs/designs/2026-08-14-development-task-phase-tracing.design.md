# 开发任务阶段标记与轻量统计设计

## 文档状态

- 状态：设计完成；2026-08-25 补充任务类型与设计决策合同
- 日期：2026-08-14
- 上游设计：[开发 Skill 生命周期重构设计](./2026-08-14-development-skill-lifecycle.design.md)
- 目标：在不依赖 Codex App metadata、数据库或常驻服务，且不为 marker 增加专用模型轮次的前提下，用可见、可解析的英文文本标记为开发任务和生命周期阶段建立稳定边界，并从现有 rollout 中按需统计 Token 消耗。

## 背景

Codex 的 rollout 已经记录逐次模型调用的累计 Token、模型、reasoning effort、时间和工具事件，但会话不是任务：

- 一个会话可以连续处理多个开发任务；
- 一个任务可以跨多个用户回合、会话和子 Agent；
- validation、review 和返工可以多次回到 implementation；
- 只按 thread 汇总无法判断某个需求或阶段真正消耗了多少资源。

事后依靠自然语言猜测阶段边界不稳定；依赖特定 App metadata 又会把开发体系绑定到宿主实现。需要一个比语义分类更确定、比平台集成更轻的边界协议。

## 核心判断

采用一条可启停的最小主链：

```text
development-lifecycle 发现已启用 development-task-telemetry
  -> 根 Agent 一次性加载该扩展的紧凑合同
  -> AI 在原本就要发送的进度消息中声明可见 marker
  -> 确定性脚本从原始 assistant 消息解析 marker
  -> 同一脚本读取 rollout 中已有的 Token 累计快照
  -> 按模型响应和 marker 顺序计算 Token 增量并归入 task / phase
  -> 按需输出任务报告
```

AI 只声明任务和阶段边界，不自报 Token、耗时、成本或质量。所有数值来自原始日志和确定性计算。

## 设计原则

1. **边界协议解耦**：marker 是普通可见 ASCII 文本，不依赖 App metadata、隐藏字段或专有协议；Token 事实仍由各宿主的只读 usage adapter 提供。
2. **无打标专用轮次**：marker 必须附着在本来就要发送的消息上。除根任务开始处一次性加载紧凑 Skill 外，禁止为打标新增回复或工具调用；初始化开销必须可见、可测，不能在每个阶段重复发生。
3. **单一事实源**：rollout usage 是资源消耗事实；marker 只提供归属边界。
4. **失败关闭**：无法确定归属时进入 `unattributed`，不得用语义猜测补齐。
5. **阶段可回退**：阶段是可重复 Span，不是假设单向瀑布。
6. **轻量优先**：不建设数据库、daemon、自动路由器或综合评分；本地大盘只投影确定性报告。
7. **可见即规范**：用户可以看到当前阶段，AI 也必须公开声明真实的 lifecycle owner 切换。
8. **能力可插拔**：生命周期只暴露稳定阶段状态；marker 协议、解析器和报告作为独立扩展整体启停，禁用后不改变生命周期的阶段判断与完成门。

## 目标与非目标

### 目标

- 为同一会话中的多个任务建立明确边界；
- 为任务记录稳定的主类型，支持比较不同工作类型的 Token 与阶段分布；
- 为跨会话、跨子 Agent 的同一任务建立关联；
- 自动计算任务和阶段级 Token；
- 正确处理阶段返工、重复 marker、缺失 marker、异常中止和计数器重置；
- 输出覆盖率和警告，使不完整数据不能伪装成精确结果；
- 保持用户可读、模型可遵守、脚本易解析；
- 支持明确区分 installed、enabled 和 active，使能力可以独立安装、启停、升级和删除。

### 非目标

- 不在首期自动选择或切换模型；
- 不依赖 Codex App、IDE 或模型供应商提供 phase metadata；
- 不从自然语言自动识别任务或阶段；
- 不建立长期数据库或远程可视化平台；
- 不让任务类型替代风险分级、设计门或阶段判断；
- 不把 Bug 复现扩展为第八个 phase 或新的 telemetry 字段；复现是 `bugfix` 在 Task Understanding 与 Validation 内部共享的证据活动；
- 不精确计算 CPU 时间、工具 API 费用或并行关键路径；
- 不把动态价格查询和账单估算纳入 v1 核心报告；
- 不用单一综合分替代质量、成本和速度的独立判断；
- 不把普通回答、讨论或非开发任务强行纳入七阶段流程；
- 不建设通用插件管理器、依赖注入容器或动态运行时；首期只定义一个轻量 lifecycle 扩展挂载合同。

## 扩展启用与管理

### 最小扩展合同

`development-lifecycle` 继续是阶段状态和切换的唯一 owner。它只增加一个可空的 `Lifecycle observer` 插槽，以及以下通用约束：

- 只加载插槽中明确启用的 observer；空值表示不启用 observer；
- 扩展可以观察 task / phase 转换并附加输出，但不能改变阶段 owner、路由、返工或完成门；
- 同一根任务只初始化一次扩展；阶段切换不得重复读取扩展 Skill；
- 子 Agent 由父任务传入扩展名、task-id 和当前 phase，不自行扫描全局配置；若其上下文未继承完整扩展合同，必须自行加载一次紧凑 Skill 后再输出 marker；
- 扩展缺失或加载失败时，开发任务继续执行并明确警告 telemetry unavailable，不得阻塞交付；
- v1 同一任务最多启用一个会修改可见首行的 lifecycle observer，避免多个插件竞争 marker 位置和生效顺序；其它分析能力读取同一原始 trace，不再向 AI 输出叠加协议。

启用状态直接维护在 lifecycle 已有入口中，不新增 manifest、registry 文件或多插件排序机制：

```text
Lifecycle observer: development-task-telemetry
```

这里的三种状态必须分开：

| 状态      | 含义                                                          |
| --------- | ------------------------------------------------------------- |
| installed | 扩展 Skill 文件存在，但不代表任何任务会自动加载               |
| enabled   | 扩展名出现在 lifecycle observer 插槽，开发根任务应加载一次    |
| active    | 当前任务已经成功加载扩展并输出合法 `task=start` / `task=join` |

管理动作保持可逆：把插槽设为空即禁用；需要再次启用时恢复一行；先禁用再删除 Skill 即卸载。一级索引只常驻 name、description 和 path，最终实测 description 增量为 183 个字符；完整 Skill 正文仍只在触发时加载。`AGENTS.md` 不保存扩展清单或 marker 语法，避免常驻上下文随扩展数量增长。

显式绕过 lifecycle、直接进入单阶段 owner 的任务默认不继承扩展。没有 marker 时，解析器只能把相应 usage 计入 corpus 级 `unattributed`，不能识别或命名出一个具体的 untracked task；报告必须明确披露这一观测盲区。若产品目标要求这些任务也被追踪，应让调用入口显式加载 `development-task-telemetry`，不能把协议复制到七个阶段 Skill。

## Marker 协议

### 命名空间与版本

固定命名空间为 `nextclaw.dev`，首个协议版本为 `v1`：

```text
[nextclaw.dev/v1 ...]
```

不使用 Codex 的 `::directive{}` 形式，避免与宿主指令碰撞；不使用通用 `[phase=...]`，避免与用户内容、第三方 Agent 或普通日志冲突。

`nextclaw.dev/v1` 是保留命名空间。AI 只有在发生真实 task / phase 转换时才能把合法 marker 放在第一行；文档说明、代码示例和用户要求复述必须放到后续正文或 fenced code block，禁止用合法 marker 作为第一行示例。

### 固定语法

根线程开始或重新打开任务：

```text
[nextclaw.dev/v1 task=start id=<task-id> name="<task-name>" type=<task-type> phase=<phase>]
```

子线程加入同一任务：

```text
[nextclaw.dev/v1 task=join id=<task-id> phase=<phase>]
```

当前线程切换阶段：

```text
[nextclaw.dev/v1 phase=<phase>]
```

子线程正常离开任务：

```text
[nextclaw.dev/v1 task=leave id=<task-id> status=<status>]
```

根线程关闭任务：

```text
[nextclaw.dev/v1 task=end id=<task-id> status=<status>]
```

字段顺序固定，不接受同义写法。`name` 是受长度和字符集约束的展示文本；其它字段均为固定枚举或 ID。

### 固定枚举

`phase` 只允许：

```text
task-understanding
design
implementation
validation
review
delivery
retrospective
```

它们与现有七个 `development-*` 阶段 owner 一一对应，不增加第二套阶段分类。

`status` 只允许：

```text
completed
blocked
cancelled
failed
```

`task-type` 只允许：

```text
feature
bugfix
small-change
```

- `feature`：新增或实质改变用户、开发者或系统可用能力；必须显式判断是否需要 Design 和稳定设计文档，但不因类型本身机械进入或跳过。
- `bugfix`：恢复已有合同或预期行为；必须显式判断是否需要 Design 和稳定设计文档，决策依据是风险、根因、修复路径、验证判定和真实方案分叉，不能因为修复代码很少就自动跳过，也不能因为属于 Bug 就机械进入 Design。
- `small-change`：局部、可逆、沿用既有惯例且不改变用户任务或跨层合同的琐碎改动；它只是 Design 可跳过的必要信号之一，仍需同时满足 lifecycle 的全部设计门。

三类按“当前任务的主要意图”互斥归类。优先判断是否恢复既有合同（`bugfix`），再判断是否新增或改变能力（`feature`）；只有两者都不是且满足局部琐碎边界时才使用 `small-change`。类型不是风险等级：三类任务都继续独立标记 L0-L4。

### Bug 修复的复现门

复现是 Bug 修复最强的默认证据，但不是每个 `bugfix` 的强制独立阶段。Task Understanding 必须显式选择 `reproduce` 或 `skip-reproduction`：

- 根因、失败边界或修复后的可观察判定任一不确定时，必须先复现；优先使用低成本的最小复现、边界回放或定向失败测试，不机械追求昂贵端到端环境。
- 只有直接证据已经同时锁定根因与违约边界，并且存在确定、贴近风险的修后验证时，才可跳过复现；必须记录所依据的证据和修后判定方式。
- 时间、环境和 Token 成本用于选择最小充分复现层级，或在证据已经充分时支持跳过；不能单独成为“未复现也算验证通过”的理由。

执行过复现时，Validation 必须尽量沿同一入口和观察指标证明“修前失败、修后通过”。跳过复现时，Validation 必须使用预先声明的替代证据证明原合同恢复，并披露没有建立修前失败基线。复现决定不进入 marker：它不改变任务主类型，也不创建新的 lifecycle owner；后续若确实需要统计复现率，再单独版本化扩展协议。

`task-id` 只允许 6 到 32 位小写 ASCII 字母、数字、下划线和短横线，必须以字母或数字开头。`task-name` 建议 8–30 个字符、最多 64 个字符，不含 `"`、`]` 或换行。

新 `task=start` marker 必须同时提供 `name` 和 `type`。解析器继续兼容历史上缺少两者之一的 v1 marker：缺失字段投影为 `null`，大盘显示“历史未知”，不得根据任务名称或阶段反推。任务 reopen 必须复用原名称和类型；发现同一 task-id 的非空类型冲突时保留首次类型并报告数据质量警告。

根线程在第一次 `task=start` 时生成一次非加密短随机 ID，推荐使用 `dt-` 加 8 位小写十六进制字符，例如 `dt-7f3a2c91`。子线程必须从父任务输入中原样复用该 ID，禁止自行重建。ID 只要求在当前 workspace 的可读取 rollout 范围内唯一；发现第二个不同根线程使用相同 ID 时报告冲突。

### 位置与可见性

- marker 必须出现在 assistant 原始消息的第一物理行；
- marker 可以跟在项目要求的 `[我严格遵守规则]`、`[深思模式]` 等前缀之后；
- 第一行最多出现一个 `nextclaw.dev/v1` marker；
- marker 后可以继续写正常中文进度说明；
- 解析器只扫描第一行，不扫描用户消息、工具输出、引用、代码块或 compaction summary；
- marker 只在任务或阶段真实变化时出现，不在每条进度消息中重复。

示例：

```text
[我严格遵守规则][深思模式][nextclaw.dev/v1 phase=validation] 实现已完成，现在开始定向验证。
```

## 生命周期与不变量

### 线程状态

每个线程最多拥有一个 active task 和一个 active phase：

```text
inactive
  -> task=start | task=join
active(task, phase)
  -> phase=<next phase>
active(task, next phase)
  -> task=leave | task=end
inactive

任意非法或冲突转换
  -> desynchronized
desynchronized
  -> 只接受新的合法 task=start | task=join 重新建立状态
```

阶段可以重复和回退，例如：

```text
implementation -> validation -> implementation -> validation -> review
```

新的 phase marker 隐式关闭当前 phase Span 并打开新 Span；连续重复的相同 phase marker 视为幂等重复，不新建 Span。

### 任务状态

- 一个 `task-id` 只能有一个根线程；
- 一个任务只有一个主类型，根线程首次 `task=start` 负责声明；子线程继承 task-id，不重复声明或自行分类；
- 根线程使用 `task=start` 和 `task=end`；
- 子线程使用 `task=join` 和 `task=leave`；
- 根线程只有在没有 active child lane 时才能输出 `task=end status=completed`；cancelled、failed 或 blocked 可以先关闭根线程，但仍存活的 child lane 必须进入报告警告并使数据质量为 partial；
- 任意 task=end 后发现返工或恢复时，根线程使用相同 ID 再次 `task=start`，计为 reopen；
- 同一线程在旧任务未 leave/end 前开始或 join 另一个 task，视为状态冲突；
- 没有关闭 marker 的线程按日志终止状态记为 `incomplete`，不能推断为 completed。
- 状态冲突、同一响应帧多个 marker 或 end/leave 的 task-id 不匹配时，线程进入 `desynchronized`；之后的 usage 全部进入 `unattributed`，直到新的合法 task=start/join 明确恢复，禁止继续沿用可能错误的旧状态。

## Token 归因算法

### 响应帧

解析器按 rollout 顺序把记录划分为模型响应帧。一个响应帧以本次 `token_count` usage 事件结束，包含该次响应产生的 reasoning、assistant message、tool call 和 marker。

marker 在响应帧中的生效顺序固定为：

- `task=start`、`task=join`、`phase=<phase>`：先应用状态转换，再归因该帧；声明进入新阶段的那次模型调用属于新阶段；
- `task=leave`、`task=end`：先把该帧归入当前 task / phase，再关闭线程状态；最终回复自身的 Token 不会丢失。

每个响应帧最多接受一个合法 marker；出现多个 marker 时整帧进入 `unattributed` 并产生警告。

跨线程报告采用两遍解析，避免文件遍历顺序影响结果：第一遍只索引所有根 `task=start`、task-id 和所属 workspace，并检查根 ID 冲突；第二遍再逐线程执行状态机、解析 join/leave 和计算 usage。找不到根任务的 join 在第二遍结束后才确定为 unresolved，不因子线程文件先被读取而误报。

### 增量计算

`total_token_usage` 是累计快照，禁止直接求和：

```text
frame_usage = current_total_token_usage - previous_total_token_usage
```

计算字段包括：

```text
input_tokens
cached_input_tokens
cache_write_input_tokens
output_tokens
reasoning_output_tokens
total_tokens
```

不变量：

- `cached_input_tokens` 是 input 的子集，不额外加到 total；
- `cache_write_input_tokens` 单独保留用于成本计算，不额外加到 total；
- `reasoning_output_tokens` 是 output 的子集，不额外加到 total；
- 出现负增量意味着计数器重置或日志异常，开启新的 counter segment 并记录警告；
- 只有读取到从 rollout 起点开始的完整 counter segment，第一条累计快照才能以零为基线；日志从中途开始、前置 segment 缺失或轮转不完整时，第一帧 usage 记为 unavailable；
- 缺少 usage 的响应帧记为 usage unavailable，不填零；
- failed、cancelled、blocked 和返工调用均计入消耗；
- marker 自身产生的 Token 也计入所在阶段。

### 机械归属覆盖率

没有 active task 或 active phase 的 usage 进入 `unattributed`。覆盖率分为任务口径和扫描口径，避免同一线程里的其它任务污染当前任务：

```text
task_mechanical_coverage = task_attributed_tokens
  / (task_attributed_tokens + unattributed_tokens_within_task_lanes)

corpus_mechanical_coverage = all_attributed_tokens / all_observed_tokens
```

任务口径只覆盖该 task 从 start/join 到 end/leave 的 lane 区间；其它任务和任务之间的 inactive usage 不进入当前任务分母。无法关联到任何 task 的孤立 usage 只进入 corpus 级 `unattributed` 和全局警告。

报告状态：

```text
complete    所有观测 usage 都有合法 marker 状态归属
partial     存在未归属、usage unavailable、非法 marker、状态冲突或异常中止
unavailable 没有可读取的 usage 数据
```

解析器不得为了提高 coverage 使用自然语言分类、最近阶段兜底或静默修复。

机械归属完整不等于阶段语义一定正确。AI 已经静默进入 validation、却忘记输出 phase marker 时，解析器无法从纯文本协议自动识别该遗漏；这类错误不会降低 mechanical coverage。首批 5 到 10 个任务必须人工抽样核对 marker precision，并把“机械覆盖率”和“抽样语义准确率”分开披露。在准确率得到验证前，阶段统计保持 experimental，不能作为自动路由依据。

## 时间口径

首期只报告可被文本和日志时间戳确定的口径：

- `task_elapsed`：根线程首次 task=start 到最终 task=end 的日历时间；
- `span_elapsed`：某个线程 phase marker 到下一个 marker 的日历时间；
- 并行子线程的 Token 可以相加，但 elapsed 不相加。

首期不把 `span_elapsed` 命名为模型执行时间或 CPU 时间；它可能包含工具等待、用户等待或外部阻塞。

## 成本与跨模型比较

原始报告始终保留各 Token 分量、model 和 reasoning effort。v1 核心报告不查询价格、不估算账单。未来需要成本对比时，只能在报告之外生成带版本的派生值：

```text
api_equivalent_cost
pricing_source
pricing_version
```

它不等于 Codex 订阅账单。价格缺失或上下文计价档位不确定时不输出成本估算，成本模块也不得成为 marker 解析和 Token 报告的依赖。

成本必须逐响应帧按当时的 model、上下文计价档位、uncached input、cached input、cache write 和 output 单价计算后再求和；禁止先把整个任务聚合成一组 Token 再套用单一价格，否则混合模型、混合上下文档位和中途价格变化会被算错。

不同模型的 Token 数不能单独证明效率提升；后续路由实验还必须结合任务完成状态、验证结果、Review findings 和 reopen 情况。本协议只提供资源归因事实，不拥有质量裁决。

## 解析失败与异常场景

| 场景                                                       | 处理                                              |
| ---------------------------------------------------------- | ------------------------------------------------- |
| 普通阶段前进                                               | 关闭当前 Span，打开新 Span                        |
| 历史 start marker 缺少 name 或 type                        | 接受并投影为 null，不猜测                         |
| 同一 task-id reopen 时类型冲突                             | 保留首次非空类型并警告，数据质量 partial          |
| validation 返回 implementation                             | 允许，生成新的 phase Span                         |
| 连续重复相同 phase                                         | 幂等忽略并记录重复次数                            |
| 第一行代码示例含 marker                                    | 只有 active lifecycle 允许 marker；否则忽略并警告 |
| 用户消息或工具输出含 marker                                | 忽略                                              |
| compaction summary 重复 marker                             | 忽略，summary 不是 assistant 原始消息             |
| 一个响应帧出现多个 marker                                  | 整帧未归属并警告                                  |
| 非法 phase / status / id                                   | 忽略 marker，整帧未归属并警告                     |
| task=start 时线程已有其它 active task                      | 状态冲突，线程进入 desynchronized                 |
| child 使用未知 task-id join                                | join 进入 pending，找不到根任务时报告 partial     |
| end / leave 的 task-id 与 active task 不同                 | 整帧未归属，线程进入 desynchronized               |
| completed 根任务结束时仍有 active child                    | 根任务状态 incomplete，报告 partial               |
| cancelled / failed / blocked 根任务结束时仍有 active child | 接受根状态，保留 child 警告并报告 partial         |
| 日志突然终止                                               | 保留已观测 Token，任务 incomplete                 |
| usage 累计值下降                                           | 新建 counter segment，报告 reset warning          |
| 重复执行统计脚本                                           | 每次从原始日志重算，不重复入账                    |

## 最小任务报告

```text
Task: 7f3a2c
Type: feature
Status: completed
Data quality: complete
Mechanical attribution coverage: 100%
Marker precision: experimental / audited sample result
Model configuration: gpt-5.6-sol / high

Totals
- Input tokens
- Cached input tokens
- Cache write input tokens
- Output tokens
- Reasoning output tokens
- Total tokens
- Model calls
- Tool-call rounds（输入日志可稳定识别时）
- Task elapsed

By phase
- Phase
- Span count
- Total tokens
- Share of task tokens
- Model / effort

Warnings
- Invalid markers
- Unattributed tokens
- Counter resets
- Incomplete child lanes
- Usage unavailable
```

报告由确定性脚本生成，不调用模型，不默认写入仓库。只有用户明确要求或正式实验需要时才导出持久化摘要。

## Owner 与最小落点

若进入实现，保持四个清晰 owner，只新增一个可选 Skill，不建设第二套 lifecycle：

1. `development-lifecycle`：决定真实阶段切换，维护可空 observer 插槽，并把 task / phase 事实交给活动扩展；不拥有 marker 语法，不计算指标。
2. `development-task-telemetry`：拥有扩展启停语义、可见 marker 合同和 AI 执行约束；只观察 lifecycle，不改变阶段状态。
3. rollout parser script：与 telemetry Skill 同目录，解析 marker、维护状态机、计算 usage 和生成报告；是统计语义的唯一 owner。
4. usage adapter：由 parser 内部使用，只负责把 Codex rollout 或其它宿主的只读 usage 日志转换为统一响应帧；格式变化只修改 adapter。宿主不提供 usage 时仍可识别 task / phase，但 Token 状态为 unavailable。

推荐首期落点：

```text
.agents/skills/development-lifecycle/SKILL.md
.agents/skills/development-task-telemetry/SKILL.md
.agents/skills/development-task-telemetry/scripts/report-task-phase-usage.mjs
.agents/skills/development-task-telemetry/scripts/report-task-phase-usage.test.mjs
.agents/skills/development-task-telemetry/scripts/lib/task-phase-protocol.mjs
.agents/skills/development-task-telemetry/scripts/lib/codex-rollout-adapter.mjs
.agents/skills/development-task-telemetry/scripts/lib/task-phase-analyzer.mjs
```

`development-lifecycle/SKILL.md` 只增加通用扩展合同和一个可空 observer 插槽，不复制 marker 语法。完整语法只保留在 telemetry Skill 和脚本测试中。

默认不修改 `AGENTS.md`：现有规则已经要求普通开发任务进入 `development-lifecycle`。只有试运行证明 direct phase entry 是必须覆盖的主流入口，且显式激活扩展仍不能解决时，才重新评估是否值得增加一句常驻路由约束；即使升级，完整 marker 语法也不得进入 `AGENTS.md`。

明确禁止新增：

- 第二个 marker / metrics / tracing Skill；
- 通用 extension manager、独立 manifest 或动态插件发现机制；
- metrics manager / service / daemon；
- phase metadata adapter；
- marker 专用模型调用；
- 自动语义补标；
- 首期 dashboard 或数据库。

### 初始化开销边界

可插拔意味着启用时存在一次额外的 Skill 加载成本，不能继续宣称绝对零开销。首期把这部分限制为：

- 根任务只读一次紧凑 `SKILL.md`，目标正文不超过约 800 个中英文 Token；
- parser、fixture 和长异常合同按需读取，不进入日常开发上下文；
- 子 Agent 优先消费父任务传入的最小活动合同，不重复读取整份扩展；
- 报告单列 `pre_start_unattributed`；它包括扩展初始化在内的 start marker 前消耗，不能未经证据全部命名为 telemetry 成本，也不能悄悄算入某个业务阶段；
- telemetry 初始化的净开销通过启用/禁用样本对照估计，不从单个线程的 `pre_start_unattributed` 武断推导；
- 试运行同时比较启用与禁用样本；若观测开销接近或超过节省收益，默认保持禁用。

## 最小验证标准

实现阶段必须使用合成 rollout fixture 覆盖：

1. 单线程单任务正常阶段切换；
2. 同线程连续两个任务；
3. implementation / validation 往返；
4. root + child join / leave；
5. 多 child 并行 Token 汇总；
6. 重复、非法和缺失 marker；
7. task reopen；
8. usage unavailable 和累计计数器重置；
9. abrupt termination；
10. 重复执行报告无重复计数。

再选 5 到 10 个真实开发任务试运行，人工核对 marker 精度、归属覆盖率、用户噪音和 telemetry 初始化开销。至少保留一组禁用扩展的可比基线；试运行没有证明价值前，不进入自动模型路由和长期平台化。

## 退出条件

只有同时满足以下条件，才认为 v1 设计达到可实施状态：

- marker 合同不存在多义解析；
- 跨线程 task 关联和同线程多任务不会串账；
- 累计 usage 不会重复求和；
- 缺失和异常数据不会伪装成精确结果；
- 不新增 marker 专用模型轮次、数据库、daemon 或用户操作，且唯一的 Skill 初始化开销被单独披露；
- 统计脚本可以完全从原始日志重算；
- 报告明确区分机械归属覆盖率与抽样语义准确率；
- 清空 lifecycle observer 插槽后，普通开发流程不再加载、输出或依赖 telemetry；
- 后续增强可以通过新协议版本演进，不修改 v1 历史语义。
