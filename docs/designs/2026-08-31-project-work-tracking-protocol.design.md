# 项目 AI 工作实时追踪协议设计

> 状态：待用户确认
>
> 日期：2026-08-31
>
> 产品愿景：[NextClaw 产品愿景](../VISION.md)
>
> 基础设计：[只读项目观测 V1](2026-08-30-read-only-project-observer-v1.design.md)

`design-document: required`

`plan: required before implementation`

## 1. 结论

项目观察不能只在 AI 完成任务后读取一组最终汇总 Marker。它必须把项目内 AI 的实质工作表达为一串**及时发生的状态进入事件**，让用户尽快看到：哪个 AI 正在推进哪一项工作、当前处于哪个节点、是否阻塞、产生了哪些产物、是否已经由 AI 验证、是否正在等待用户验收。

推荐采用以下最小完整链路：

```text
内置 project-observation-setup Skill（安装器）
              │ 用户确认后一次建立
              ▼
项目根 AGENTS.md ────────────────┐
  常驻最小硬约束                 │
                                 ▼
.nextclaw/project.yaml ──► 项目内 project-work-tracking Skill
  机器可读事实源              渐进加载的执行方法
                                 │
                                 ▼
                   AI 在节点开始前输出紧凑 Marker
                                 │
                  既有 Session / Run 事实 ─────┐
                                 ▼             ▼
                         Projects 只读观察与状态折叠
                                 │
                                 ▼
                    项目主页实时显示工作与阶段
```

这里不增加特殊项目会话、不增加运行时 Skill 注入、不追踪 `requested skills`，也不建立新的任务数据库。会话选择项目后已经拥有项目根目录；后续 AI 通过标准 `AGENTS.md` 和 Skill 渐进加载机制遵守项目约定。

## 2. 用户任务与成功标准

### 2.1 用户任务

用户从项目创建普通会话并让 AI 工作后，不需要另外登记任务，也不需要等 AI 最终完成；进入项目主页即可看到真实的 AI 运行、工作项及当前节点，并能沿来源回到会话或产物验证结果。

### 2.2 可观察成功

一条正确链路必须同时满足：

1. 新项目 setup 时，AI 先给出一套最小推荐，经用户一次确认后建立完整约定；
2. 普通项目会话不依赖用户手工指定 Skill，也不依赖 Projects 页面注入特殊元数据；
3. AI 开始实质工作时，先报告工作项和当前节点，再开展该节点的工作；
4. 进入新节点时立即报告，不能在最终回复里批量补写历史节点；
5. 项目主页能在任务仍运行时看到最新节点；
6. 节点可以跳过、回退和返工，同一工作项始终复用同一 ID；
7. AI 验证与用户验收分离，AI 不能替用户宣布验收完成；
8. AI 未遵守 Marker 时，项目主页仍能依据已有 Run 事实显示“AI 正在运行”，但明确标注工作项或阶段尚未报告，不能猜测；
9. 历史的完整 `nextclaw.project/v1 kind=work-item ...` Marker 继续可读。

## 3. 现状证据与根因

当前实现已经具备以下基础：

- `.nextclaw/project.yaml` 可以声明项目上下文、工作项流程、产物 glob、Marker 协议和 Skill 根目录；
- Kernel Projects feature 已经拥有配置解析、文件扫描、Marker 解析、状态投影和只读快照；
- 项目主页能够读取同一份 Projects 快照；
- `project-observation-setup` 已经能指导 AI 创建 `project.yaml` 和根 `AGENTS.md`；
- 会话和 Run 本身已有运行状态、Agent、模型、时间与消息事件。

但现有合同有四个缺口：

1. **持续激活缺口**：根 `AGENTS.md` 只让 AI 在需要完整语法时读取内置 setup Skill。普通干活的 AI 未必加载一个名为 setup 的 Skill；setup 方法和日常执行方法由同一个入口承担，触发语义不清。
2. **事件时机缺口**：现有文案主要要求“报告 Marker”，没有把 Marker 明确定义为“进入节点前发生的事件”，所以 AI 容易在最终回复一次输出多个完整 Marker。
3. **协议成本缺口**：当前工作项 Marker 每次要求重复 `kind`、标题、流程、阶段和状态。高频状态切换成本过高，也没有定义字段继承和会话内当前工作项。
4. **实时消费缺口**：前端查询当前带有静态陈旧时间，Marker 解析主要面向已形成的消息快照；没有冻结“完整 Marker 行一出现就更新项目状态”的端到端行为。

因此这不是单纯的提示词错误，也不是单个页面刷新错误，而是横跨 setup、项目约定、事件产生、状态折叠和 UI 消费的**能力面缺失**。修复范围必须覆盖这一条链路，但不扩展成新的项目执行引擎。

## 4. 设计原则与边界

### 4.1 单一事实源

- `.nextclaw/project.yaml` 是流程、节点、产物分类和协议启用状态的机器事实源；
- 项目根 `AGENTS.md` 只拥有每轮必须遵守的最小硬约束和 Skill 路由；
- 项目内 `project-work-tracking` Skill 只拥有执行方法、紧凑语法和项目化示例；
- Session / Run 拥有 AI 是否正在运行、失败或结束等系统事实；
- Marker 事件拥有 AI 主动声明的工作项、节点和状态变化；
- Projects Kernel feature 拥有解析、校验、事件折叠和只读快照；
- UI 只消费快照和既有运行事件，不自行解析 Marker 或推断阶段。

### 4.2 轻量与可插拔

Projects 保持一个独立 feature 切片。它只读取项目文件、项目 Skill、会话消息和已有 Run 事实，不进入 Agent 执行主链路，不要求其它 runtime 为 Projects 写专用状态。

任何支持项目根 `AGENTS.md` 和标准 Skill 发现的 Agent 都可以完整参与；暂时不遵守该约定的 runtime 仍通过 Run 事实获得最低限度可见性。

### 4.3 明确事实优先

- 工作项和节点只来自有效 Marker；
- 运行中、失败、完成等 Run 状态只来自系统记录；
- 产物集合来自配置 glob，某个工作项与产物的关联来自 Artifact Marker；
- 不从文件名、会话标题、工具调用或模型输出内容猜工作项和阶段；
- 缺失字段时展示“尚未报告”，而不是静默隐藏或自动补全。

### 4.4 工作项粒度

Work Item 是用户意图中的一项可持续推进、可交付或可形成决策的工作，不是每轮消息、每个工具调用或 AI 的每个内部步骤。

以下通常应成为工作项：

- 形成一份方案、完成一个功能、修复一个问题；
- 完成一次研究、分析或投资调研；
- 起草或修订一个内容单元；
- 对已有结果进行一轮明确的复核和交付。

以下默认不成为工作项：

- 不推进项目状态的简短知识问答；
- 读取一段文字、查看一个文件等内部步骤；
- 同一工作项中的工具调用和临时思考；
- 仅为了填满项目主页而虚构的事项。

项目相关讨论如果目标是形成决策或推进方案，应作为工作项进入 `exploration`；普通闲聊只显示会话或 Run 活动，不强行生成工作项。

## 5. 方案比较

| 方案 | 做法 | 优点 | 主要问题 | 结论 |
| --- | --- | --- | --- | --- |
| A. 只写根 `AGENTS.md` | 把完整协议、流程和示例全部常驻 | 触发最直接 | 每轮上下文过重；项目差异和协议细节污染常驻规则；维护重复 | 不采用 |
| B. 只保留内置 setup Skill | 普通 AI 需要时自行发现并读取 setup Skill | 文件少；机制看似简单 | setup 与日常工作触发不同；已证明普通工作不会稳定加载；不能保证首个 Marker 时机 | 不采用 |
| C. 根规则 + YAML + 项目 Skill | 根规则负责强制触发，YAML 是事实源，项目 Skill 负责渐进式方法 | 触发可靠、Token 低、项目自包含、运行时解耦 | setup 多生成一个项目文件，需要一致性复核 | **采用** |
| D. 专用报告工具或运行时闸门 | Agent 必须调用结构化工具才能继续 | 强制性最强 | 引入写入语义和主链路耦合，扩大 runtime 与 Projects 边界 | V1 延后 |

方案 C 的代价是 setup 从两个资产增加到三个资产，但这正好把“每轮都要知道”和“需要时再读”分开，新增名词拥有明确职责，不需要新的 framework、registry、adapter 或数据库。

只有在方案 C 上线后，真实数据仍证明多种 runtime 大量漏报 Marker，才重新评估方案 D；不能以未来可能性提前建设。

## 6. Setup 的完整交付合同

### 6.1 Setup 的职责

内置 `project-observation-setup` Skill 只负责安装和维护项目观察能力，不负责普通任务期间的持续执行。

它需要在读取项目材料后，一次向用户展示：

1. `.nextclaw/project.yaml` 完整草案；
2. 项目根 `AGENTS.md` 将新增或更新的最小章节；
3. `.agents/skills/project-work-tracking/SKILL.md` 完整或关键草案；
4. 推荐的工作项流程及其在当前项目中的解释；
5. 推荐的产物分类、路径与命名；
6. 仍属于假设的少量内容。

用户一次确认，或提出少量修改后确认。确认前不写入；确认后通过既有文件编辑链路一次写入三个资产。Projects 页面不新增配置写 API。

### 6.2 空项目

目录为空且用户没有说明目标时，setup 只问一个必要问题：这个项目准备完成什么，或希望得到什么结果。

拿到答案后直接提供整套推荐，不把用户带入多轮 DSL 问卷。此时：

- `project.context` 可以为空，不能引用尚不存在的愿景文件；
- 默认使用通用工作项生命周期；
- 可以规划用户确认后的产物 glob；
- 创建项目内 tracking Skill，但不为产物分类创建空目录。

### 6.3 写入后复核

setup 完成前必须重新读取三个资产并校验：

- `project.yaml` 顶层和 `observation` 层级正确；
- 根规则只出现一个项目观察章节，原内容未丢失；
- 根规则引用的项目 Skill 路径真实存在；
- Skill 使用的流程、节点和产物分类 ID 都存在于 YAML；
- Artifact 示例路径符合对应 glob；
- 新推荐不包含 `requested skills`、`kind=work-item`、`item=` 或 `title=`；
- 没有创建另一套项目绑定、运行时注入或状态存储。

任何一项失败都先修正，不能声称 setup 完成。

## 7. 三个项目资产

### 7.1 `.nextclaw/project.yaml`

YAML 继续使用现有固定骨架，承担机器可读配置。示例：

```yaml
schema_version: 1

project:
  summary: NextClaw 是面向用户的长期个人智能搭档，目标是成为 AI 时代的个人操作层。
  context:
    - id: product-vision
      role: 产品愿景
      source: docs/VISION.md

workflows:
  - id: general-work
    label: 通用工作项生命周期
    stages:
      - id: exploration
        label: 探索与目标澄清
      - id: planning
        label: 规划与拆解
      - id: design
        label: 方案设计
      - id: proposal-review
        label: 方案评审
      - id: execution
        label: 执行与产出
      - id: verification
        label: 结果验证
      - id: acceptance
        label: 用户验收

observation:
  markers:
    - protocol: nextclaw.project/v1
  artifacts:
    - id: designs
      label: 方案设计
      include:
        - docs/designs/**/*.design.md
    - id: plans
      label: 执行计划
      include:
        - docs/plans/**/*.plan.md
    - id: logs
      label: 迭代记录
      include:
        - docs/logs/**/README.md
  skills:
    - root: .agents/skills
```

YAML 不保存当前工作项、当前阶段或动态状态；这些是 Marker 和 Run 的事实。V1 不增加脚本、表达式、正文语义匹配、TODO 解析或通用规则 DSL。

### 7.2 根 `AGENTS.md`

根文件只写每轮都必须知道的最小约束，推荐语义如下：

```markdown
## 项目工作追踪

- 本项目使用 `.nextclaw/project.yaml` 定义工作项流程、产物分类和 `nextclaw.project/v1` 协议。开展会推进项目状态的实质工作前，先读取该配置和项目内 `project-work-tracking` Skill。
- 首个工作节点 Marker 必须在该节点的分析、工具调用或文件修改之前输出；后续进入新节点时立即输出。Marker 表示“现在进入该状态”，禁止在最终回复批量补写历史节点。
- 同一工作项始终复用同一个随机 ID；切换工作项必须重新声明 ID。AI 验证通过只能进入用户验收，只有用户看到结果后明确确认才能完成。
- 不为填充项目主页虚构工作项、阶段、产物、日期或状态。
```

根规则不复制完整 Marker 语法、不复制所有 workflow 和 artifact glob，也不要求普通 AI 再读取内置 setup Skill。

### 7.3 项目内 `project-work-tracking` Skill

固定位置：

```text
.agents/skills/project-work-tracking/SKILL.md
```

它是普通项目工作期间的执行方法，至少包含：

- 何时算实质项目工作，何时不创建工作项；
- 先读 `project.yaml`，从中选择真实 workflow、stage 和 artifact category；
- Marker 是进入节点事件，必须先报告再工作；
- 紧凑 Marker 语法、字段继承和工作项切换；
- 随机 ID 的格式、生成和复用规则；
- 阻塞、恢复、返工、AI 验证和用户验收；
- 项目采用的文件命名与日志目录约定；
- 根据当前项目材料生成的少量示例。

它不复制整个 YAML；YAML 仍是流程和路径的事实源。首版默认只有一个 `SKILL.md`。只有项目方法确实变长时，才把项目专属示例拆进 `references/`，不能把内置 setup Skill 的所有通用场景材料复制到每个项目。

内置 setup Skill 可以继续保留软件开发、内容创作、研究分析等通用 reference，用于生成贴合项目的本地 Skill；本地 Skill 是生成后的项目约定，不是内置 Skill 的副本。

## 8. 通用工作项生命周期

没有已经确认的专属流程时，setup 固定推荐：

```text
exploration → planning → design → proposal-review
            → execution → verification → acceptance
```

节点语义：

| 节点 | 通用含义 | 不代表什么 |
| --- | --- | --- |
| `exploration` | 讨论、调研、目标澄清、问题理解 | 整个项目的探索期 |
| `planning` | 拆分范围、顺序、资源和执行方法 | 项目路线图 |
| `design` | 冻结产物结构、方案或实现设计 | 只限软件架构 |
| `proposal-review` | 执行前审查方案和风险 | 最终结果验收 |
| `execution` | 实现、撰写、分析、制作或修改实际产物 | 只限写代码 |
| `verification` | AI 自检、测试、复核或证据验证 | 用户已接受结果 |
| `acceptance` | 把已验证结果交给用户确认 | AI 自己宣布完成 |

这是一套语义坐标，不是强制流水线：

- 可以从真实节点开始；
- 可以跳过不适用节点；
- 可以退回任意前序节点；
- 方案评审失败可以回到 `design`；
- 验证失败可以回到 `execution`；
- 用户要求修改可以从 `acceptance` 回到相应节点；
- 所有返工沿用同一工作项 ID。

项目已有可靠的专属工作项流程时可以沿用，但必须描述**单个工作项**的生命周期，不能把整个项目的路线图阶段写成工作项节点。

## 9. 紧凑 Marker 合同

### 9.1 核心语义

Marker 是事件，不是最终摘要。最新有效事件折叠为当前状态，后出现的事件覆盖同一工作项的相应字段；阶段回退是合法事件。

第一条语义 Marker 必须在读取项目配置和 tracking Skill 后、任何实质分析或执行前成为一条完整输出行。读取规则和配置属于协议 preflight，可以发生在首个 Marker 前；项目实质工作不可以。

### 9.2 工作项 Marker

新工作的首次声明：

```text
[nextclaw.project/v1 id=wi_7km4q2x9dn name="实现项目实时观测" stage=exploration]
```

同一会话、同一当前工作项进入新节点：

```text
[nextclaw.project/v1 stage=design]
```

切换到新工作项：

```text
[nextclaw.project/v1 id=wi_p8r3m6vh2k name="优化产物命名" stage=exploration]
```

切回项目中已有工作项：

```text
[nextclaw.project/v1 id=wi_7km4q2x9dn stage=execution]
```

阻塞和恢复：

```text
[nextclaw.project/v1 status=blocked]
[nextclaw.project/v1 stage=execution]
```

进入验收和用户确认后完成：

```text
[nextclaw.project/v1 stage=acceptance]
[nextclaw.project/v1 status=completed]
```

### 9.3 字段规则

| 字段 | 规则 |
| --- | --- |
| `id` | 工作项 ID。新工作首次必须提供；切换工作项必须提供；不再使用 `item` 表示工作项 |
| `name` | 用户可读名称。新 ID 首次必须提供；同一 ID 后续继承；不再使用 `title` |
| `stage` | YAML 中的节点 ID。进入节点时提供；可前进、跳过或回退 |
| `workflow` | 只有无法从已知工作项或唯一适用流程确定时提供；默认首次由配置中的唯一/推荐流程解析 |
| `status` | 默认是 `active`，仅在 `blocked`、`completed`、`cancelled` 等异常变化时提供 |

高频工作项事件不再写 `kind=work-item`。其它低频事件仍有显式事件名，避免语义冲突。

### 9.4 会话游标与继承

Projects 投影对每个来源会话分别维护当前工作项游标：

- 新会话的第一条工作 Marker 必须包含 `id`；
- 同一会话省略 `id` 时继承该会话当前工作项；
- 出现另一个 `id` 时切换游标；
- `name` 从同一工作项的历史首次声明继承；
- 同一 ID 在项目范围代表同一工作项；
- 多个 AI、多个会话拥有独立游标，不能互相继承省略字段；
- 缺少可继承上下文时产生诊断，不猜测工作项。

### 9.5 ID

推荐格式：

```text
wi_<10 位小写无歧义字母数字>
```

例如 `wi_7km4q2x9dn`。字符集排除容易混淆的 `0/o/1/l/i`。ID 在项目范围内稳定、不可重生成；创建新 ID 前应避开当前已观测 ID。V1 由 Agent 按 Skill 方法生成，不增加服务端 ID 分配接口。

### 9.6 Artifact 与 Request

文件真实写入且匹配 YAML 分类后，报告：

```text
[nextclaw.project/v1 artifact path="docs/designs/2026-08-31-example.design.md" category=designs]
```

Artifact 默认继承来源会话的当前工作项。低频事件若需要关联非当前工作项，使用显式 `work-id=`；不复用含义不清的 `item=`。

AI 进入用户验收并确实需要明确回答时，可以报告：

```text
[nextclaw.project/v1 request=req_8cq6v3m7xk response=confirm-reject prompt="请确认是否接受本次结果"]
```

`request` 是请求事件名，`request=` 是请求自己的随机 ID；它默认继承当前工作项。用户回复后再报告同一请求已解决，并依据用户结论完成或返工。具体低频事件的完整兼容语法在实现计划中冻结，不能为了本次高频阶段追踪顺带重做 signal、schedule 和 request 的全部产品模型。

## 10. 状态折叠与实时链路

### 10.1 两层可见性

项目主页组合两类互补事实：

1. **系统 Run 事实**：哪个 AI / 模型正在运行、排队、失败、被中断或结束；
2. **语义 Marker 事实**：它在推进哪个工作项、处于哪个节点、是否阻塞、关联哪些产物。

这样即使 AI 尚未输出第一条 Marker，用户也能看到：

```text
AI 正在运行 · 尚未报告工作项与阶段
```

Marker 到达后，同一运行条目被语义信息增强，而不是另造一份 Activity。Projects 不从 Run 状态推断阶段，也不把 Run 结束自动等同于工作项完成。

### 10.2 流式解析

- 只解析 assistant 的完整 Marker 行；
- 流式文本尚未出现闭合 `]` 或完整换行时视为未完成片段，不产生错误诊断；
- 完整有效行一出现即可进入事件折叠，无需等待整条消息 final；
- 消息 final 后仍无法解析的协议行才产生 `PROJECT_MARKER_INVALID`；
- 同一消息多条事件按文本顺序排序，顺序比相同时间戳更权威；
- 重连或刷新后从持久消息重新折叠，结果必须一致；
- 重复消费同一 `sessionId + messageId + line/event index` 不得重复生成活动。

### 10.3 UI 更新

项目页复用现有会话 / Run 事件或查询失效机制；工作项查询不能只依赖固定 `staleTime` 等用户手动刷新。适用行为：

- Run 开始：立即出现运行态；
- 首个完整 Marker：补充工作项和阶段；
- 后续阶段 Marker：原条目原位更新，同时保留活动历史；
- Run 失败：显示失败事实，工作项保持最后已报告阶段；
- 页面刷新或重进：从同一持久事实恢复一致状态。

UI 不新增自己的 Marker parser、计时器状态 owner 或阶段推断逻辑。

## 11. 产物与日志约定

### 11.1 文件命名

过程性和决策性文档默认使用“创建日期 + 主题 + 角色后缀”：

```text
docs/designs/YYYY-MM-DD-<topic>.design.md
docs/plans/YYYY-MM-DD-<topic>.plan.md
docs/reviews/YYYY-MM-DD-<topic>.review.md
docs/research/YYYY-MM-DD-<topic>.research.md
```

日期是首次创建日期，后续编辑不改名。稳定的业务正文、代码、数据集和稿件使用项目自己的稳定名称，不强制日期前缀。项目已有明确命名规范时优先沿用。

### 11.2 日志是目录束

默认日志结构：

```text
docs/logs/YYYY-MM-DD-<topic>/
  README.md
  validation.md        # 可选
  screenshots/         # 可选
  attachments/         # 可选
```

只有项目真实存在版本概念时才增加版本层：

```text
docs/logs/YYYY-MM-DD-<topic>/
  v1.2.0-<topic>/
    README.md
```

`README.md` 说明做了什么、为什么、范围、结果、验证和后续事项。V1 的 Artifact 配置匹配 `docs/logs/**/README.md`；目录名用于展示，附件不平铺成多个“迭代日志”产物。

## 12. Owner 与代码接入边界

### 12.1 目录

```text
packages/nextclaw-core/src/features/agent/shared/skills/
  project-observation-setup/
    SKILL.md                              # setup / maintenance owner
    references/scenarios/                # 通用生成参考

<project-root>/
  AGENTS.md                               # 常驻最小规则
  .nextclaw/project.yaml                  # 项目观察配置事实源
  .agents/skills/project-work-tracking/
    SKILL.md                              # 项目日常追踪方法

packages/nextclaw-kernel/src/features/projects/
  types/project-observation.types.ts      # 公共快照和事件合同
  utils/project-observation-marker.utils.ts
                                          # 新旧 Marker 唯一 parser
  utils/project-observation-projection.utils.ts
                                          # 事件折叠和来源游标
  services/project-observation.service.ts # 只读来源组合 owner

packages/nextclaw-server/src/features/projects/
  controllers/project-observation.controller.ts
                                          # HTTP 只读边界

packages/nextclaw-client-sdk/src/services/
  projects.service.ts                     # projects 命名空间公共查询

packages/nextclaw-ui/src/features/projects/
  hooks/use-project-observation.ts        # 查询与既有事件失效
  presenters/                             # 展示模型
  components/                             # 纯展示与导航
```

### 12.2 依赖方向

```text
UI → Client SDK → Server → Kernel Projects
                              ↓ read only
                  Project / Session / Run / Files / Skills
```

- 产品语义留在 Kernel Projects，不下沉到 Server；
- Server 不解析 Marker、不折叠状态；
- UI 不扫描文件、不解析消息；
- Agent Runtime 不依赖 Projects，也不为它注入 Skill；
- setup Skill 通过普通 AI 文件编辑能力建立项目资产；
- 不新增 `adapter/` 目录或同义 service / manager 转发层。

## 13. 状态与场景矩阵

| 场景 | Producer | Projects 当前事实 | 用户看到什么 | 不变量 |
| --- | --- | --- | --- | --- |
| Run 刚开始，尚无 Marker | Session / Run | 运行中，无工作项游标 | AI 正在运行，尚未报告工作项与阶段 | 不猜阶段 |
| 新工作首次进入探索 | AI Marker | 新 ID、name、exploration、active | 新工作项和探索节点 | Marker 先于实质工作 |
| 进入设计 | AI Marker | 同 ID，stage=design | 原工作项更新到设计 | 不新建第二项 |
| 方案退回 | AI Marker | 同 ID，从 proposal-review 回 design | 显示回到设计，活动保留轨迹 | 允许逆向迁移 |
| 切换工作项 | AI Marker | 会话游标指向显式新 ID | 两个工作项分别保持状态 | 省略字段只继承当前游标 |
| 两个 AI 并行 | Run + 各自 Marker | 两个独立来源游标 | 分别显示 Agent / 模型 / 工作项 / 阶段 | 不跨会话继承 |
| 阻塞 | AI Marker | status=blocked，阶段不丢失 | 阻塞状态和原节点 | 不用 `stage=blocked` |
| 恢复执行 | AI Marker | 新 stage 或默认 active | 状态恢复，节点更新 | stage 事件隐含 active |
| AI 验证通过 | AI Marker | stage=acceptance, active | 等待用户验收 | AI 不得 completed |
| 用户要求修改 | 用户消息 + AI Marker | 同 ID 回到真实节点 | 原工作项继续返工 | 不生成新 ID |
| 用户确认 | 用户消息 + AI Marker | acceptance, completed | 工作项完成 | 必须是事后明确确认 |
| Run 在 Marker 前失败 | Run | 失败，无语义工作项 | AI 运行失败，未报告工作项 | 不隐藏失败 |
| Marker 格式错误 | AI 文本 | 原状态不变，增加诊断 | 可见诊断或未报告提示 | 不部分猜测字段 |
| 刷新 / 重进 | 持久消息和 Run | 重新折叠同一结果 | 与刷新前一致 | 幂等 |
| 历史完整 Marker | 历史消息 | 按兼容 parser 读取 | 历史工作项仍存在 | 不要求迁移旧消息 |

## 14. 兼容与迁移

协议名保持 `nextclaw.project/v1`，避免让历史项目配置和消息失效。解析器同时接受：

1. 历史完整语法：

   ```text
   [nextclaw.project/v1 kind=work-item id=sample title="..." workflow=general-work stage=execution status=active]
   ```

2. 新的紧凑语法：

   ```text
   [nextclaw.project/v1 id=wi_7km4q2x9dn name="..." stage=execution]
   ```

新的 setup 和项目 tracking Skill 只教授紧凑语法；旧语法作为只读兼容输入保留，不再由 AI 生成。历史消息不重写，历史工作项不换 ID。

现有只配置了 `project.yaml + AGENTS.md` 的项目不应突然失效。再次执行 setup maintenance 时，AI 展示差异并经用户确认补充项目 tracking Skill、更新根章节；未迁移前仍按旧 Marker 读取，项目页可以提示“项目工作追踪约定可升级”，不能静默修改用户仓库。

`requested skills` 不是本能力的任何配置、消息元数据、快照字段或 UI 状态。若历史代码只为该机制保留相关路径，应在实现阶段证明无其它 owner 后删除，不能做名字替换或兼容别名。

## 15. 失败语义与诊断

| 失败 | 行为 |
| --- | --- |
| 缺少 `project.yaml` | 显示 setup 引导；普通项目工作仍可运行 |
| 缺少项目 tracking Skill | 显示配置不完整诊断；不自动写文件 |
| 根 `AGENTS.md` 未引用 Skill | 显示 setup 不完整；不声称日常 AI 会遵守 |
| YAML 节点与 Skill 示例不一致 | setup 复核失败；运行时无效 stage 被拒绝并诊断 |
| 首个 Marker 缺少 ID | 不创建工作项；保留 Run 可见性并诊断 |
| 新 ID 缺少 name | 不创建匿名工作项；诊断缺失字段 |
| 省略字段无可继承游标 | 忽略该语义事件并诊断，不向前跨会话猜测 |
| Artifact 路径不存在或越界 | 不建立有效关联；按既有安全边界诊断 |
| 流式 Marker 尚未完整 | 等待，不诊断 |
| 完整消息含错误 Marker | 原状态不变，记录可定位诊断 |
| UI 事件订阅中断 | 查询恢复后从持久事实重建；不保留平行本地真相 |

## 16. 实现切片

设计确认后需要单独形成执行计划，建议分为三个可独立验证的切片：

1. **项目约定与协议**：重构 setup Skill 的三资产输出；新增项目 tracking Skill 模板；冻结紧凑语法、继承、随机 ID 和历史兼容 parser。
2. **实时状态投影**：把完整流式 Marker 行纳入幂等事件折叠；组合已有 Run 事实；补齐并行会话、返工、刷新和错误诊断。
3. **产品消费与文档**：项目页实时失效 / 更新，呈现运行兜底和阶段状态；同步中英文用户文档；用空项目和真实普通会话完成端到端验收。

每个切片必须复用同一 Kernel owner，不能分别在 Skill、Server 和 UI 复制一套协议解释。

## 17. 验收标准

### 17.1 AI 交付前验收

- setup 的空项目、现有项目和升级项目测试覆盖三资产合同；
- 紧凑 Marker parser 覆盖首次声明、继承、切换、回退、阻塞、恢复、验收和错误输入；
- 历史完整 Marker 的现有测试全部保留并通过；
- 多会话投影证明游标互不污染；
- 流式半行不报错，完整行即时生效，刷新后状态一致；
- 没有任何 `requested skills` 新字段或特殊注入；
- Projects Server 仍只有只读查询和已有回复复用，不新增项目状态写 API；
- 触达 TypeScript 的包通过相应 `tsc`；
- 完成 diff-only maintainability review，并确认没有新增 adapter、平行 parser 或 UI 业务 owner。

### 17.2 用户验证用例

1. 创建一个没有主题和文件的空项目，从项目主页点击 setup 引导；
2. 在普通新会话里只说明项目目标，观察 AI 是否一次给出 YAML、根规则和项目 Skill 三份草案；
3. 确认后检查三个文件真实存在且互相一致；
4. 新建另一个普通项目会话，不手工选择 Skill、不使用特殊链接，要求 AI 完成一项实际工作；
5. AI 开始实质工作前，项目主页应先出现工作项和第一个真实节点；
6. AI 切换设计、执行、验证等节点时，项目主页在任务未结束前更新；
7. 要求 AI 返工，确认同一工作项 ID 回到前序节点，没有生成重复工作项；
8. AI 验证后应停在用户验收；用户明确确认后才显示完成；
9. 并行启动两个会话，确认各自 Agent、模型、工作项和节点不会串联；
10. 打开包含旧式完整 Marker 的历史项目，确认原工作项仍可读取。

## 18. 非目标

本设计不包含：

- 项目主页创建、编辑、拖拽或分配任务；
- 项目任务数据库、事件溯源数据库或通用工作流引擎；
- 强制所有 Agent Runtime 接入 Projects 专用 API；
- 前端选择或追踪 Skill；
- `requested skills` 机制；
- 自动从自然语言、TODO、Issue 或文件内容推断工作项；
- 通用脚本 DSL、插件 registry、adapter 抽象层；
- 为每个阶段建立强制审批；
- 把每个工具调用、内部思考或普通问答变成工作项；
- 在本轮直接修改 Skill、协议解析、项目配置或页面实现。

## 19. 防过度设计审计

| 检查项 | 裁决 |
| --- | --- |
| 是否新建项目数据库 | 否，状态由消息事件与已有 Run 事实折叠 |
| 是否修改 Agent 主链路 | 否，使用标准根规则和 Skill 机制 |
| 是否增加特殊项目会话 | 否，复用现有项目选择和普通会话 |
| 是否增加运行时 Skill 注入 | 否，根规则明确路由到项目 Skill |
| 是否引入通用扩展框架 | 否，Projects 内保留明确来源组合 |
| 是否把一次具体错误放大成全局规则 | 否，范围只覆盖已证明重复发生的 producer-consumer 缺口 |
| 是否为未来能力预留未使用字段 | 否，紧凑合同只保留当前工作项、节点、状态和必要低频事件 |
| 是否重复事实 owner | 否，YAML、AGENTS、Skill、Run、Marker 和投影各自拥有不同事实 |
| 是否能更小 | 只改 setup Skill 无法保证普通 AI 持续遵守；只改 UI 无法产生语义事实；当前范围是可闭环的最小能力面 |

## 20. 最终冻结项

本设计冻结以下决策：

1. setup 生成三个项目资产，而不是只生成 YAML 和根规则；
2. 根 `AGENTS.md` 承担常驻硬约束，项目 tracking Skill 承担渐进式执行方法；
3. `.nextclaw/project.yaml` 是流程和产物规则的唯一机器事实源；
4. Marker 是节点进入事件，必须先报告再工作；
5. 高频工作 Marker 使用 `id / name / stage / status` 紧凑语法和会话游标继承；
6. 工作项 ID 使用稳定随机 ID，返工不换 ID；
7. `verification` 归 AI，`acceptance` 归用户；
8. Run 提供自动可见性兜底，Marker 提供语义增强；
9. 历史完整 V1 Marker 继续可读，新 setup 只教授紧凑语法；
10. V1 不增加项目写 API、任务数据库、特殊 Skill 注入、`requested skills` 或 adapter 层。

用户确认本文后，再进入独立实现计划与三切片落地；确认前不以局部代码尝试替代这份协议设计。
