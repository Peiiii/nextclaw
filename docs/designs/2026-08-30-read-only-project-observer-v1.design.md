# 只读项目观测 V1 设计

> 状态：当前实现依据
>
> 日期：2026-08-30
>
> 产品愿景：[NextClaw 产品愿景](../VISION.md)
>
> 前序探索：[项目治理主页设计](2026-08-25-project-governance-hub.design.md)
>
> 前序范围裁决：[项目治理主页 V1 功能范围决策](2026-08-26-project-governance-hub-v1-scope.design.md)
>
> 交互原型：[项目主页 · 工作项中心版](2026-08-27-project-home-ai-core.prototype.html)
>
> 工作追踪补充合同：[项目 AI 工作实时追踪协议设计](2026-08-31-project-work-tracking-protocol.design.md)。其中三资产 setup、紧凑 Marker、Run 兜底与实时更新取代本文较早的双资产 setup 和完整工作项 Marker 约定。

> 原型当前只作为布局、三视图、流程画布、Artifact 工作台和响应式交互的结构基线；其中写入按钮、强事实文案和静态演示数据尚未按本文完成语义收敛，不能作为 V1 行为合同。

## 1. 当前裁决

项目主页 V1 不是项目管理器或项目治理控制面，而是 **Projects 产品 feature 当前提供的一项配置驱动、来源可追溯、来源可组合的只读观测能力**。项目事实和状态仍然只读；唯一的窄写入能力，是把用户对“AI 正在等待回复”的明确回答直接发送回原会话。

它只回答以下问题：

- 这个项目的目标、愿景、约定和上下文来源是什么？
- 当前有哪些能够被明确证明的工作项？
- 工作项被记录在哪个阶段，依据是什么？
- 哪些文件或外部来源被配置或标记为项目产物？
- AI 曾明确标记过哪些待关注信号和重要变化？
- 每项信息来自哪里、何时被观测、当前是否仍然可访问？

项目主页只读取和组合已经存在的事实，不拥有或修改这些事实。确认和拒绝不是项目状态写入，而是复用现有会话发消息能力向来源 Session 发送一条普通用户消息。

```text
Project Config + Project Files + Session Markers + Existing Read APIs
                              ↓
              Projects Feature / Observation
                              ↓
                  Read-only Project Snapshot
                              ↓
                        Project Home UI
```

当前版本不以“让用户在项目主页完成所有项目操作”为目标。除回复 AI 明确声明的等待请求外，用户需要继续工作时，项目主页只负责打开真实来源、已有会话或现有产品入口。

## 2. 设计原则

### 2.1 观测只读，回复复用现有发送链路

项目主页不创建或修改：

- Project；
- Work Item；
- Workflow；
- Artifact 关系；
- Skill；
- 项目约定；
- 待关注信号；
- Activity 历史。

“打开来源”“打开原会话”“查看文件”属于导航，不属于项目治理写操作。AI 通过显式 Marker 声明自己正在等待确认或拒绝时，前端可以直接复用现有 Agent Run 消息发送接口回复来源 Session；后端项目观测 feature 仍然只负责解析和查询，不新增项目写 API 或中转 service。

### 2.2 明确事实优先于智能猜测

V1 只接受配置、结构化文件规则、AI 显式 Marker 和现有系统只读接口提供的事实。不使用新的大模型调用重新阅读聊天并推断项目状态，也不从文件更新时间推断工作完成度。

无法证明的信息显示为未知或不展示，不用演示数据补齐版面。

### 2.3 来源保留所有权

愿景文件、项目规则、会话、产物文件和 Skill 继续拥有自己的正文。项目主页只保存或返回引用，不复制第二份正文，不建立新的平行事实源。

### 2.4 来源组合不引入扩展框架

V1 由 Projects feature 显式组合四个只读观测来源。各来源保持独立失败和独立诊断，但首版不建立 `adapters/` 目录或独立 Adapter 架构层，也不增加动态 registry、独立进程、通用插件运行时或跨进程协议；出现新的真实来源时，在 Projects feature 内增加一个明确来源并加入组合入口。只有来源确实需要独立发布、隔离权限或跨产品复用时，才重新设计新的运行边界。

### 2.5 Agent 主链路不感知项目观测

Agent Runtime 和 Session 执行链不依赖 Projects 的观测能力；Kernel 只把它作为独立的 Projects 查询服务装配，不把它接入 Agent Run 主链路。内置的 `project-observation-setup` Skill 只负责指导 AI 建立、维护项目观察约定并提供完整 Marker 语法；真正持续生效的是项目自己的 `.nextclaw/project.yaml` 和根 `AGENTS.md`。Skill 不是项目主页查询、普通会话或 Agent Runtime 的运行依赖。

## 3. 产品边界

### 3.1 V1 包含

- 在现有会话侧边栏的项目视图中，项目前置披露图标只展开/收起子会话，项目名称在保留侧边栏的同时进入右侧项目主页；
- 项目概览；
- 只读工作项列表、看板和甘特图；
- 只读工作项详情和 Workflow 画布；
- 项目产物分类、浏览和稳定工作台预览；
- 项目 Skills 只读展示；
- 项目上下文与工作约定只读展示；
- 仅在项目尚未具备完整观测条件时，显示一次明确的“开始观测此项目”引导；
- 待关注信号和观测动态；
- AI 明确等待用户时的确认、拒绝和打开原会话；
- 来源、观测时间、数据质量和诊断信息；
- 打开项目文件、原会话或其它真实来源。

### 3.2 V1 不包含

- 新建、编辑、删除或拖拽更新 Work Item；
- 创建或初始化项目；
- 除回复明确等待请求外，通过项目主页发起新的 Agent 工作；
- 对普通待关注信号执行确认、拒绝、延期、关闭或审批；
- 图形化 Workflow 编辑；
- 修改日期、依赖或里程碑；
- 关联、取消关联或修改 Artifact；
- 安装、启停、删除或发布 Skill；
- 修改项目配置或工作约定；
- 自动从普通聊天、文件名或文件更新时间生成业务事实；
- 项目治理数据库、事件溯源或通用任务管理后端；
- 团队协作、Portfolio、资源规划和模板市场。

这些能力不是永久否定，而是不属于只读观测 V1。

## 4. 最小用户链路

```text
项目列表
  → 打开项目主页
  → 先看到当前已经可证明的 Session、Skills 与项目文件入口
  → 若尚未配置，理解“工作项 / 分类产物为什么为空”与下一步
  → 在项目会话中让 AI 勘察项目并提出一套观测 setup 推荐
  → 用户确认后由既有会话文件编辑链路同时写入 project.yaml 与根 AGENTS.md 的简短入口
  → 刷新主页，查看可观测工作项、分类产物和待关注信号
  → 对 AI 明确等待的请求确认、拒绝或打开原会话
  → 打开真实文件或原始会话
  → 返回项目主页
```

项目主页不承担自己的配置编辑器、项目初始化器或任务创建器。配置和 AI 工作约定仍然是项目中的可审阅文件，项目和会话仍由现有入口创建；但项目主页必须提供可理解的入口，把用户带到普通项目会话，委托 AI 勘察、解释并提出一套完整 setup。AI 只能通过既有会话的文件修改与确认语义写入，不能因为用户打开了项目页而静默生成或修改 `.nextclaw/project.yaml` 或 `AGENTS.md`。

用户路径锚点固定为：`会话侧边栏项目视图 → 项目前置图标独立展开/收起，或点击项目名称 → 右侧项目主页 → 侧边栏及项目层级保持 → 点击子会话返回会话工作`。Projects 是独立代码 feature，不是新的全局导航类别；V1 不增加平行的 Projects 导航，也不在主页重复提供项目选择器。

### 4.1 首次使用与配置引导

“没有配置”不是错误、也不是要求用户先理解 DSL 的前置条件。项目主页将它视为一个可解释的准备状态：

| 模块 | 零配置时展示 | 不做什么 | 用户可继续的路径 |
| --- | --- | --- | --- |
| 概览 | 已绑定会话、可读取 Skills、项目根目录和“尚未建立项目观测”说明 | 不伪造摘要、阶段或进度 | 打开项目会话，让 AI 勘察项目并提出观察方案 |
| 工作项 | “尚未有 AI 明确报告的工作项”，说明它需要 Agent 的显式报告 | 不从聊天标题、文件名或最近修改时间猜任务 | 在项目会话中启用项目观测约定；后续 Agent 以 Marker 报告事实 |
| 产物 | “尚未定义哪些文件算项目产物”，同时提供现有项目文件浏览入口 | 不把所有 Markdown、源码或最近文件自动叫作产物 | 让 AI 根据项目目标提出分类规则，或用户手写规则 |
| Skills | 已发现的真实 Skill 和可读取预览 | 不把全局 Skill 假装成项目专属能力 | 打开 Skill 了解其作用，或在项目会话中使用它 |
| 工作约定 | 已存在的规则 / 愿景来源；没有时只说明尚未声明 | 不强迫用户把复杂项目目标写成一句话 | 让 AI 识别并引用已有权威文件，或由用户指定 |

引导卡只在 `project.yaml` 缺失、无效，或尚未声明当前模块所需规则时出现；当已有配置与可观测事实已经足够时自动消失。它不显示“数据质量”“观测时间”等实现元数据，也不在每个 Tab 重复占据空间。

主动作统一命名为“让 AI 帮我建立项目观察”。点击后**新建**一个绑定当前项目根目录的普通项目会话，进入现有聊天页，并把引导 Prompt 预填进输入框；不自动发送。用户可以修改、补充或直接发送，避免项目页替用户发起不可见的 Agent 工作，也不打断正在进行的旧会话。

预填 Prompt 只表达用户的普通任务意图，不携带 Skill ref、选择状态或另一套前端元数据。运行时按既有内置 Skill 发现机制让 AI 自主选择 `project-observation-setup`；页面不强绑 Skill，也不把它变成特殊会话状态。该 Skill 是跨开发、写作、研究和调研等项目共用的 setup 能力；它拥有建立与维护观察配置的完整方法，并要求 AI：

1. 先阅读项目目录、已有会话、Skill 和权威材料，不根据文件名猜项目目标；
2. 用自然语言说明当前已经可以观测什么、哪些信息还不能可靠识别；
3. 直接提出一套最小、可修改的推荐：包含完整 `.nextclaw/project.yaml`、单个工作项适用的生命周期与节点、产物分类与路径，以及根 `AGENTS.md` 的简短“项目观察”入口；没有已经确认的专属流程时固定推荐 `general-work`，场景材料只解释节点含义，不另行发明领域流程；
4. 现有项目优先沿用已经确认的约定和证据；新项目根据目标推荐最小的产物范围。局部不确定性以假设标注，只有会实质改变整体结构且无法合理推断时才问一个必要问题，不把 setup 变成多轮访谈；
5. 只有收到用户一次确认或少量修改后的确认，才通过既有文件编辑链路同步写入 `.nextclaw/project.yaml` 和根 `AGENTS.md`；只写一个不算 setup 完成。

根 `AGENTS.md` 只保留三条稳定入口：本项目使用 `.nextclaw/project.yaml`；实质工作前读取该配置并按真实变化报告 Marker，需要建立、维护配置或查看完整语法时读取内置 `project-observation-setup` Skill；不得为填充项目页虚构事实。真正持续激活观察机制的是项目自己的配置与规则文件，Skill 只拥有可复用的 setup 方法和完整 Marker 语法，避免把字段合同复制进每轮常驻上下文。若已有同名章节则更新而不重复；若文件不存在则创建只含该最小章节的文件。

该 Skill 本身明确 `project.yaml` 的用途、固定结构和字段边界：Artifact 使用路径/glob，工作项由 Marker 报告；TODO/Issue 解析、正文语义匹配和通用规则 DSL 尚未实现。任何不能自动执行的约定必须与 `project.yaml` 分开说明，不能被 AI 虚构成配置字段。setup 不增加运行时 Skill 注入、额外项目绑定或 Skill 追踪元数据；后续 AI 通过项目原有的 `AGENTS.md` 加载链路感知这份约定，再自主读取内置 Skill。

该 Skill 还应覆盖后续的维护场景：当项目目标、权威材料、产物规则或工作流发生变化时，AI 先比较现有配置与新证据、说明影响，再经用户确认修改配置；不得把一次初始化的结论永久固化为不再校验的模板。

该动作复用会话创建、草稿输入、消息发送、文件预览和确认链路，Projects feature 只提供当前项目上下文和入口，不拥有 Agent 执行或写入语义。Skill 内容与配置格式说明由 Agent/Skill owner 维护；UI 只提供稳定的触发意图和当前项目根目录，避免把同一套提示词和判断逻辑复制到多个页面。

## 5. 用户可见信息架构

V1 保留五个主导航，但所有内容均为只读投影。

### 5.1 概览

概览用于回答“项目现在有什么可观察事实”，按以下权重组织：

1. 项目摘要、愿景和上下文来源；
2. 待关注信号；
3. AI 报告的建议；
4. 当前工作；
5. 最近产物；
6. 项目能力摘要；
7. 最近观测动态。

概览同时显示：

- 快照生成时间；
- 已启用的数据源；
- 各数据源是否成功；
- 过期、冲突、无法归属和解析失败数量。

“需要你处理”在本版本拆成两类：

- **待关注信号**：`attention` 和 `warning` 信号进入待关注区域，`info` 信号可以作为 AI 报告的建议展示；它们只能打开来源，不能确认、拒绝或关闭。
- **等待你回复**：AI 通过 `request` Marker 明确声明正在等待用户，并声明支持 `confirm-reject` 时，卡片可以直接显示“确认”“拒绝”和“打开原会话”。

项目主页不会因为用户点击按钮而直接把请求改成已解决。消息发送成功后显示“已回复，等待 AI 更新”；AI 后续报告 `resolved` 或 `expired` 后，观测快照才更新最终状态。

### 5.2 工作项

Work Item 是被 AI 显式 Marker 识别出来的只读工作单元，不是项目主页创建和管理的任务记录。V1 不支持从结构化索引、Frontmatter、文件名或目录布局生成 Work Item；以后如有真实需求，在 Projects feature 内增加新的明确观测来源，不扩展 V1 配置 DSL。

普通文件不能因为名字像计划或最近被修改就自动升级成 Work Item。

工作项保留三种视图：

- **列表**：只要存在可观测工作项即可使用；
- **看板**：只有配置中存在对应 Workflow，且工作项有可验证阶段时使用；
- **甘特图**：只有来源提供明确开始时间、结束时间、里程碑或依赖时使用。

三种视图读取同一份快照。缺少看板或甘特图所需字段时，保留视图能力但显示“数据不足”，不虚构节点、日期、依赖或进度条。

工作项详情可展示：

- 标题、描述、类型和来源；
- 当前阶段及其 Marker；
- Workflow 定义及可观测节点；
- 关联 Artifact；
- 待关注信号；
- 原会话、Run 或文件来源；
- 相关观测动态和诊断。

“继续工作”改为“打开原会话”；没有原会话时不创建新会话。打开原会话或真实文件意味着离开只读观测表面，后续是否可写由原始会话或文件界面自己的权限和行为决定。

### 5.3 产物

Artifact 是被项目配置的分类规则匹配，或被 AI Marker 明确关联的文件与外部引用。Artifact 与普通文件区分开：

- 路径匹配只能证明文件符合项目分类规则；
- AI Marker 只能证明 AI 曾声明该文件与某个工作项有关；
- 文件是否存在和可读由文件读取器验证；
- 三者不一致时保留冲突，而不是静默选择一个结果。

产物模块保留分类列表和项目级稳定工作台。用户可以预览、打开路径、查看匹配规则和关联来源，不提供编辑、标记或关系修改。

### 5.4 Skills

Skills 页面只展示能够被项目目录、项目配置或现有 Skill 读取接口证明的能力：

- 名称和说明；
- 来源层级与路径；
- 是否可读取；
- 配置声明的适用工作流或阶段。

可读取的 Skill 点击后复用现有会话工作区的文件预览链路，在项目根目录边界内以 Markdown 渲染其 `SKILL.md`；不新增另一套预览、文件读取或右侧面板实现。不可读取的 Skill 不提供该动作。

项目主页不安装、启停或修改 Skill，也不把全局 Skill 自动伪装成项目专属 Skill。

### 5.5 项目上下文与工作约定

原“工作约定”入口调整为更准确的“项目上下文与约定”，只读展示：

- 项目摘要；
- 愿景、范围、路线图、成功标准等来源引用；
- AGENTS.md、品牌指南、研究规范等约定来源；
- 来源角色、路径、可读性和最近检查时间。

项目目标不要求压缩成一句话。摘要用于快速识别，完整目标继续由一份或多份权威文件拥有。

## 6. 事实来源与证据边界

### 6.1 项目配置

配置可以证明项目如何被解释，包括上下文引用、工作项 Workflow 定义、Artifact 分类和数据源规则。配置不能证明动态工作已经发生。

### 6.2 文件系统

文件读取器可以证明：

- 文件是否存在；
- 是否在项目边界内；
- 是否符合某个明确的 glob 或 Frontmatter 规则；
- 大小、格式和文件系统更新时间；
- 当前是否可读取。

文件系统更新时间只作为文件元数据展示，不自动解释为项目 Activity、阶段变化或完成时间。

### 6.3 AI 显式 Marker

Marker 可以证明“某个 AI 在某个来源会话的某个时间明确报告了这项信息”。它不能证明报告内容已经被独立验证。

Marker 必须保留：

- 原始会话或 rollout；
- assistant message 或 frame；
- 时间；
- runtime 与来源类型；
- 解析结果或解析错误。

### 6.4 现有系统读取接口

项目注册表、Session 项目上下文、项目文件和 Skill 视图继续作为只读来源。它们提供已有事实，不因项目主页出现而改变 owner。

### 6.5 证据标签

UI 不使用模糊的数值“可信度”，而使用可解释标签：

- `项目配置`：来自项目配置的声明；
- `文件观测`：由文件系统直接验证；
- `AI 报告`：由 AI Marker 声明；
- `系统记录`：来自已有 NextClaw 结构化记录；
- `无法归属`：存在数据但不能可靠关联到当前项目；
- `冲突`：多个来源对同一字段给出不兼容值。

状态文案必须同时表达事实强度和来源，不能把 AI 报告写成系统已经独立验证的事实：

- 使用“AI 报告 · 已完成 · 10 分钟前”，不单独显示“已完成”；
- 使用“文件观测 · 存在 · 刚刚检查”，不写“产物有效”；
- 使用“项目配置 · 开发流程”，不写“系统已采用开发流程”；
- 使用“系统记录 · 原会话可打开”，不写“可以继续推进”。

## 7. `.nextclaw/project.yaml` V1

配置文件是可选的。没有配置时，项目主页仍可显示项目注册信息、能够明确归属的已有 Session 和项目 Skill；Work Item、Workflow 和 Artifact 分类不做默认猜测。

概念结构冻结如下：

```yaml
schema_version: 1

project:
  summary: 面向长期 AI 工作的项目主页
  context:
    - id: vision
      role: 愿景
      source: docs/VISION.md
    - id: working-rules
      role: 工作约定
      source: AGENTS.md

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
      label: 设计
      include:
        - docs/designs/**/*.md
    - id: plans
      label: 计划
      include:
        - docs/plans/**/*.md
    - id: logs
      label: 迭代记录
      include:
        - docs/logs/**/*.md

  skills:
    - root: .agents/skills
```

V1 约束：

- Workflow 是单个 Work Item 可复用的生命周期，不是整个项目的宏观生命周期、路线图或里程碑；每条 Marker 的 `stage` 只表示该工作项自身所在节点；
- 项目没有已经确认的专属流程时，setup 固定推荐 `general-work`：探索与目标澄清、规划与拆解、方案设计、方案评审、执行与产出、结果验证、用户验收；节点可以按事实跳过和回退，不强制逐项打卡；
- Workflow 对单条 Work Item 是可选分类；不匹配任何已配置生命周期时使用 `workflow=none stage=none`，不得为了填满看板硬套最接近的流程；
- `status` 表示工作项的通用执行状态，`stage` 表示所选 Workflow 中的业务节点，两者不是同一个概念；
- `verification` 由 AI 执行，`acceptance` 由用户拥有；AI 验证通过后只能报告 `stage=acceptance status=active` 并打开关联的确认请求，用户明确确认后才能报告 `status=completed`；
- 项目级阶段继续由愿景、路线图或计划文档拥有，V1 不新增平行的项目阶段字段；
- `project.context` 只引用已经存在且读取验证过的权威文件；新项目可以规划未来上下文文件，但文件创建前保持 `context: []`，不制造缺失来源诊断；
- 所有相对路径以项目规范化根目录为基准；
- 路径和 glob 不得越过项目根目录；
- 默认不跟随指向项目外部的符号链接；
- 未知字段给出诊断，不静默改变语义；
- `schema_version` 不支持时只降级基础项目信息，其它分区显示配置不兼容；
- 配置不包含当前 Work Item 状态、Artifact 实例列表、待关注信号或 Activity；
- V1 不支持配置继承、任意表达式、脚本执行和通用规则 DSL。

## 8. `nextclaw.project/v1` Marker 与回复元数据

项目 Marker 复用开发任务遥测的核心原则：固定命名空间、严格语法、只在真实事实变化时输出、解析失败可诊断、观察者不改变被观察系统。

V1 需要五类 assistant Marker：

```text
[nextclaw.project/v1 kind=work-item id=<id> title="<title>" workflow=<workflow|none> stage=<stage|none> status=<active|blocked|completed|cancelled>]

[nextclaw.project/v1 kind=artifact item=<work-item-id> path="<project-relative-path>" category=<category-id>]

[nextclaw.project/v1 kind=schedule item=<work-item-id> start=<YYYY-MM-DD|none> end=<YYYY-MM-DD|none> milestone=<true|false> depends-on=<comma-separated-work-item-ids|none>]

[nextclaw.project/v1 kind=signal id=<id> item=<work-item-id|none> status=<open|resolved> level=<info|attention|warning> message="<message>"]

[nextclaw.project/v1 kind=request id=<id> item=<work-item-id|none> status=<open|resolved|expired> response=<confirm-reject|open-session> prompt="<message>"]
```

Marker 合同：

- 每行只包含一个 Marker；
- 字段顺序和枚举固定；
- `id` 使用稳定、小写、可移植标识；
- `workflow=none` 和 `stage=none` 是合法的“来源未声明”值，不代表系统生成了默认 Workflow 或阶段；
- Marker 的 `workflow` / `stage` 必须描述这一条 Work Item 自身的生命周期与节点，不得用整个项目当前处于“设计期、写作期、发布期”等宏观阶段代替；
- 标题、消息和 prompt 有长度上限，不能包含双引号、右方括号或换行；
- Marker 归属优先来自 Session 的结构化 `project_root`，不允许只凭工作项名称归属项目；
- 同一个 Work Item 的最后一条有效 `work-item` Marker 形成当前状态，历史 Marker 形成只读动态；
- `artifact` Marker 建立报告关系，文件读取器仍需独立验证目标；
- `schedule` Marker 只报告明确存在的日期、里程碑和依赖；没有该 Marker 时甘特图显示数据不足，不从文件时间推断；
- `signal` 由后续 Marker 报告 `resolved`，项目主页本身不解除信号；
- `request` 只有在 `status=open` 且 `response=confirm-reject` 时显示直接回复按钮；其它请求只打开原会话；
- `general-work` 的结果通过 AI 验证后，必须由同一工作项的开放 `request` 表示等待用户验收；Projects 的确认按钮仍只向来源 Session 发送消息，后续 AI 收到明确确认后才能把请求更新为 `resolved` 并把工作项更新为 `completed`；
- 不在 Marker 中放正文、秘密、绝对路径或任意 JSON；
- 非法 Marker 不参与投影，但进入 `diagnostics`。

项目 Skill 可以教 AI 输出这些 Marker。没有安装或启用对应 Skill 时，Marker 数据源为空，其它数据源继续工作。

聊天界面是否隐藏合法 Marker 属于呈现层决策，不改变存储的原始 assistant text，也不要求 Agent Runtime 增加专用调用协议。

用户确认或拒绝时，项目主页前端直接调用现有 `/api/agent-runs/send` 链路，目标是 `request` Marker 的来源 Session。发送的消息正文使用用户可理解的自然语言，例如“确认：继续发布 v1”；同时在现有 `NcpMessage.metadata` 中携带：

```ts
{
  project_observation_response: {
    protocol: "nextclaw.project/v1";
    requestId: string;
    decision: "confirmed" | "rejected";
  }
}
```

该 metadata 由 Kernel 内独立的 `ProjectObservationService` 在刷新时读取，用于识别“用户已经回复”；`SessionManager` 和 Agent Runtime 不解释其中的项目语义。发送使用稳定 `idempotencyKey`，避免重复点击产生两条相同回复；运行中的来源 Session 继续遵循现有 `queue` / `prefer-steer` 交付语义。

## 9. 后端技术结构

### 9.1 上位 feature 与代码归属

仓库已经存在 Projects 主链路，V1 沿现有边界扩展，不新增并列的 Project Observer feature：

- Kernel 的 Projects feature 拥有项目注册、根路径规范化、观测快照、归一化和合并等稳定产品语义；
- `nextclaw-server/src/features/projects` 只拥有 Projects 的 HTTP controller、参数校验和远程视图映射；
- `nextclaw-client-sdk` 继续通过现有 `client.projects` 命名空间暴露 Projects API；
- `nextclaw-ui/src/features/projects` 成为独立项目产品界面，Chat 只保留项目选择和会话关联，不拥有项目主页。

Kernel 的 `ProjectObservationService` 负责：

- 验证目标是已注册项目；
- 规范化项目根目录；
- 加载并校验配置；
- 调用明确的只读观测来源；
- 归一化事实、生成诊断和快照；
- 向 Server、CLI 和以后真实出现的其它入口提供同一只读查询合同。

Projects 观测进入 Kernel 不等于进入 Agent 主链路。Agent Runtime 和 Session 执行链不依赖 `ProjectObservationService`；它只单向读取 `ProjectManager`、`SessionManager`、Core `SkillsLoader` 和项目文件。只有这些 owner 的公共读取能力确实不足时，才在原 owner 补充不含 Work Item、Artifact、Signal 或 Activity 语义的窄 reader。

### 9.2 目录与公共入口

V1 采用以下最小目录边界：

```text
packages/nextclaw-kernel/src/features/projects/
  index.ts                                       # Kernel Projects 唯一内部 feature 入口
  managers/project.manager.ts                    # 迁入现有项目身份、注册和根路径 owner
  services/project-observation.service.ts         # 新增只读快照聚合 owner
  stores/project.store.ts                        # 迁入现有项目注册持久化
  types/project.types.ts                         # 迁入现有稳定项目类型
  types/project-observation.types.ts              # 新增观测快照、来源和诊断合同
  utils/                                          # 按真实复杂度放配置、Marker 和路径纯逻辑

packages/nextclaw-server/src/features/projects/
  index.ts                                       # Projects 服务端唯一公共入口
  controllers/projects.controller.ts             # 现有项目注册 API
  controllers/project-observation.controller.ts  # 新增只读观测 HTTP 边界
  types/projects-api.types.ts                     # 现有 Projects API 类型

packages/nextclaw-client-sdk/src/
  services/projects.service.ts                    # 现有 client.projects，新增 getObservation
  nextclaw-client.manager.ts                      # 已有 projects namespace，不新增命名空间
  index.ts                                        # 从 package 根导出公共类型

packages/nextclaw-ui/src/features/projects/
  index.ts                                        # Projects UI 唯一入口
  pages/project-home-page.tsx                     # 项目主页路由表面
  components/                                     # 概览、工作项、产物、Skills、上下文展示
  hooks/use-project-observation.ts                # 快照查询与刷新
  presenters/project-home.presenter.ts            # 同一快照到多视图的纯投影

packages/nextclaw-service/src/controllers/commands/project/
  project-command.controller.ts                   # 现有 Projects CLI owner，新增 observe

packages/nextclaw/src/cli/app/
  register-project-commands.ts                    # 注册 nextclaw projects observe
```

现有 ProjectManager、ProjectStore 和 Project 类型直接迁入同一 feature root，更新内部导入后删除旧路径，不保留平行 alias。观测不新增第二个 store，也不预建 `adapters/`、`providers/`、`registry/` 或新的 workspace package。确实出现持久 UI 状态、独立发布边界或稳定跨产品复用后，再按证据增加对应 owner。

#### Kernel 内部隔离合同

Projects 采用“可抽包但暂不拆包”的强边界：

1. `features/projects/index.ts` 是 Kernel 内其它 feature 的唯一导入入口；跨 workspace 的 Server、Service 和 CLI 只从 `@nextclaw/kernel` package 根导入 Projects 公共合同，不得 deep import Projects 内部文件。
2. `ProjectObservationService` 构造参数只接收明确的 `ProjectManager`、`SessionManager` 和必要配置，不接收整个 `NextclawKernel`，不从组合根反向查询任意 manager。
3. Projects 可以读取其它 owner 的公共快照或查询方法，但不得读取它们的 store、私有文件格式或内部 utils；其它 owner 不导入 Projects 观测类型。
4. `ProjectObservationService` 是无持久状态的查询 owner，不订阅 Agent 事件、不写 Session、不修改 Project，也不拥有后台生命周期。
5. Server、CLI 和 UI 只消费 Projects 公共合同，不各自复制配置、Marker、合并和诊断规则。
6. 跨 feature 新依赖必须能解释为当前观测链路所需的稳定事实；不能因“以后也许有用”把任意 Kernel 能力接入 Projects。

#### 边界保障机制

Projects 的隔离不能只依赖实现者记住本文，也不能把这次的具体文件名和缺陷写成长期流水账。V1 使用下面四层机制：

| 层次 | Owner | 作用 | 是否阻断 |
| --- | --- | --- | --- |
| 高层原则 | 仓库根 `AGENTS.md` | 规定 feature owner、Kernel / Server 分工、唯一公共入口和禁止无依据新增架构层 | 否，指导 AI 决策 |
| 具体合同 | 本设计文档 | 冻结 Projects 的目录、依赖方向、只读语义、拆包触发条件和验收标准 | 否，作为实现与 Review 依据 |
| 就近规则 | Kernel、Server、UI 的 `features/projects/AGENTS.md` | 只沉淀各层长期稳定的 owner、依赖方向和只读边界，不复制设计细节 | 否，进入目录时直接约束 Agent |
| 自动治理 | module structure、package public imports、topology 检查及对应测试 | 阻断跨 feature deep import、跨 workspace 子路径导入、非法目录和反向包依赖 | 是 |

不增加 feature-local `README.md`，避免与设计文档和 scoped `AGENTS.md` 形成重复 owner。`AGENTS.md` 只保留即使实现演进也应成立的边界原则；协议字段、页面清单和验收用例仍由本设计与自动化测试拥有。

实现阶段必须运行：

```bash
pnpm preflight:module-structure -- <planned-paths...>
pnpm lint:new-code:module-structure -- <touched-paths...>
pnpm lint:new-code:governance -- <touched-paths...>
pnpm check:topology
```

其中 planned-path preflight 分两步：先验证并创建各 feature 的 `index.ts`，再验证其角色子目录和文件，避免在公共入口尚不存在时误判。现有通用检查如果无法阻断本文要求的某类真实越界，优先补强通用治理规则及其 fixture / test；不新增只匹配 Projects 文件名或某一条 import 文本的窄脚本。

#### 为什么当前不拆 workspace package

当前 Projects 与 Kernel 同进程、同运行环境、同发布节奏，并直接使用 Kernel 已有的 Project 与 Session owner。现在拆成 `@nextclaw/projects` 会新增 workspace 依赖、构建与类型产物、版本和发布闭环；如果设为私有包，还要解决已发布 Server/CLI 如何打包它。这些成本暂时没有独立运行时或独立消费者收益支撑。

只有出现以下任一真实证据才重新评估拆包：Projects 需要独立发布；存在不依赖 Kernel 的第二个产品消费者；必须在独立进程或权限域运行；Kernel 因依赖 Projects 被迫引入不应拥有的上层依赖。文件数量、代码行数或“看起来更解耦”本身不构成拆包理由。

### 9.3 观测来源组合

逻辑合同：

```ts
type ProjectObservationSource = (
  context: ProjectObservationContext,
) => Promise<ObservationBatch>;
```

Kernel 的 `ProjectObservationService` 直接依赖现有 `ProjectManager` 和 `SessionManager`，并使用 Kernel 已依赖的 Node 文件系统、YAML 与 Core `SkillsLoader`。它在内部显式组合来源函数，查询时逐个调用并合并结果。首版只有：

- `ProjectConfigSource`；
- `ProjectFileSource`；
- `NextClawSessionMarkerSource`；
- `ProjectSkillSource`。

这些名称表达事实来源，不是新的架构层级。某个来源需要转换外部协议或格式时，由该来源内部承担转换职责，不再外包成一层 Adapter 目录或通用模板。首版没有动态发现、来源注册中心或扩展模板。新增 Codex rollout、其它 Runtime、自动化或外部研究来源时，只有在需求成立后才增加相应读取函数，并在唯一组合入口显式加入。

每个来源独立失败；一个来源失败不能阻止其它分区返回。失败进入统一诊断，不返回伪造空成功。

### 9.4 接入点与依赖方向

标准依赖方向只有一条：

```text
Projects UI
  → client.projects.getObservation()
  → GET /api/projects/:projectId/observation
  → Server ProjectObservationController
  → Kernel ProjectObservationService
  → ProjectManager / SessionManager / project files / Core SkillsLoader

nextclaw projects observe
  → Kernel ProjectObservationService
```

允许的接入点：

- Server `app/router.ts` 只负责把 `/api/projects/*` 路由装配到 Projects controller，controller 不复制聚合规则；
- Client SDK 只在现有 `ProjectsService` 增加方法，消费者不直接拼 URL；
- UI app route 只导入 `features/projects` 的公共入口；
- 现有 Projects CLI 直接调用同一 Kernel service，不启动本地 HTTP，也不复制读取逻辑；
- 项目主页回复等待请求时，UI 直接调用现有 `client.agentRuns` 发送入口，不经过 Projects 后端；
- 项目 Skill 只产生 Marker，Session 只保存既有消息，二者都不导入 Projects 观测代码。

禁止的反向依赖：Agent Runtime、Session、文件和 Skill owner 不依赖 Projects 观测类型、快照或 UI；Server 也不能成为快照合并规则的第二 owner。未来若出现跨 UI、CLI 和自动化共享的真实项目写语义，继续由 Kernel 的 Projects feature 承接，但不能把写入塞进只读 `ProjectObservationService`。

### 9.5 归属规则

项目注册拥有稳定 `id`，它是 API、UI 路由与缓存的项目身份；ID 使用 12 位 URL 安全随机字符（72 位熵），不暴露路径，也不把冗长 UUID 直接暴露给用户。canonical `rootPath` 只保留在 Kernel 内部，用于注册、归属与受控文件读取。历史注册表升级时在 Kernel 启动阶段一次性补齐 ID 并原子写回，保留原有路径、名称、模板和时间字段；读取接口不触发迁移写入。

内部继续使用 canonical `rootPath` 进行来源归属，顺序为：

1. Session 结构化 `project_root` 与项目 canonical root 相同；
2. Runtime 来源提供经过规范化并能证明的 workspace 绑定；
3. 无法证明时进入 `unattributed`，不按名称、最近会话或目录相似度猜测。

worktree、符号链接、子目录和外部 rollout 必须经过同一规范化合同。V1 不跨不同 canonical root 自动合并项目。

### 9.6 存储与缓存

V1 不新增数据库。事实源分别是配置文件、项目文件、Session / rollout 和现有系统记录。

项目快照在查询时生成。性能需要时可以增加进程内缓存：

- 项目观测缓存键使用稳定 `projectId`；
- 配置与文件来源使用路径、大小、`mtime` 等签名失效；
- Session Marker 来源使用现有记录的稳定更新时间或游标失效；
- 缓存不是事实源，服务重启后可以安全丢失；
- 手动刷新绕过缓存并重新观测。

项目 ID 只解决项目身份、路由和查询寻址；它不引入新的项目观测数据库或另一个事实源。

## 10. 只读 API 与快照

首版只提供一个聚合查询：

```text
GET /api/projects/:projectId/observation
```

服务端必须先验证 `projectId` 对应已注册项目，再由 Kernel 使用已登记的 canonical `rootPath` 观测，不能把该接口变成任意本地目录读取器。

概念响应：

```ts
interface ProjectObservationSnapshot {
  asOf: string;
  project: ObservedProjectContext;
  sources: ObservationSourceStatus[];
  workflows: ObservedWorkflow[];
  workItems: ObservedWorkItem[];
  artifacts: ObservedArtifact[];
  signals: ObservedSignal[];
  requests: ObservedRequest[];
  activity: ObservedActivity[];
  skills: ObservedSkill[];
  diagnostics: ObservationDiagnostic[];
  dataQuality: "complete" | "partial" | "unavailable";
}
```

`ProjectObservationSnapshot` 及其合并、冲突和证据语义由 Kernel Projects feature 拥有。Server API 默认直接投影这份合同，只增加传输层错误包裹和必要的远程路径脱敏，不重新定义第二套领域类型；Client SDK 从 package 根暴露对应公共类型。

列表、看板、甘特图、概览和详情都从同一快照或同一快照合同的服务端分页投影读取，不能在前端各自推导一套状态。

首版数据量可控时返回完整快照；达到真实性能阈值后再把 Work Item、Artifact 和 Activity 拆成分页查询，不提前增加多组 API。

## 11. 合并、冲突与降级

### 11.1 合并规则

- Workflow 定义和 Artifact 分类由配置拥有；
- 文件存在性由文件读取器拥有；
- Work Item 当前状态由最新有效 Marker 拥有；
- Marker 与文件的 Artifact 关联保留为“AI 报告”，文件验证结果单独保留；
- Request 的等待状态来自最新有效 assistant Marker；用户消息 metadata 只能证明“回复已发送”，不能自行把请求改成 `resolved`；
- Activity 由 Marker 时间线和明确系统记录构成，不把普通文件 `mtime` 自动解释成业务事件。

### 11.2 冲突规则

- Marker 引用了配置中不存在的 Workflow 或阶段：保留工作项，阶段显示未知并产生诊断；
- Marker 引用了不存在或越界的 Artifact 路径：保留报告关系，文件状态显示不可访问并产生诊断；
- 多个来源对同一动态字段冲突：显示最新可归属事实，同时保留冲突来源和警告；
- 来源无法归属当前项目：不进入项目业务列表，只进入来源状态和诊断。

### 11.3 空态

- 无配置：显示基础项目信息，并说明未配置观测规则；
- 无 Marker：说明无法观测工作项和阶段，不进行推断；
- 无 Workflow：显示状态和来源，不绘制流程画布；
- 无 Artifact：显示已检查的分类和规则；
- 无待关注信号：不占据大块首屏空间；
- 来源失败：其它来源继续展示，失败分区明确标记；
- 配置版本不兼容：显示基础项目信息和配置诊断；
- 来源冲突：并列提供来源跳转，不静默掩盖。

## 12. 安全与性能边界

- 配置引用、glob 和 Marker path 必须限制在项目根目录；
- 默认不读取项目外符号链接目标；
- Marker 是不可信文本，只解析固定字段，不执行脚本、不渲染原始 HTML；
- 快照默认只返回文件元数据和安全摘要，正文预览复用现有受控文件读取接口；
- 文件扫描设置最大文件数、最大深度和忽略目录；
- 单一来源设置超时和诊断，避免一个来源阻塞整个主页；
- API 沿用现有项目访问授权和路径边界；
- 快照不回传系统绝对路径给不应看到本机路径的远程客户端。

## 13. 原型调整合同

现有原型的整体布局、工作项三视图、Workflow 画布、Artifact 工作台和响应式结构继续保留。进入实现前需要完成以下语义调整：

- 删除“新工作”“创建”“调整流程”“与 AI 继续”等泛化写入入口；
- “继续工作”替换为“打开原会话”；
- “需要你处理”替换为“待关注信号”；
- 普通待关注卡片只允许查看来源，不提供确认、拒绝、稍后处理或关闭；
- `request(confirm-reject)` 卡片保留确认和拒绝，直接复用现有前端消息发送能力；发送后显示“已回复，等待 AI 更新”；
- 工作约定移除编辑和 AI 修改入口；
- Skills 移除安装、启停、删除和治理操作；
- Artifact 移除关联和修改动作；
- 列表、看板和甘特图增加数据不足状态；
- 所有 AI 状态使用“AI 报告”标签，不再显示无来源的“已完成”“当前有效”或“可继续推进”；
- 每个关键事实增加来源、观测时间和可访问状态；
- 增加无配置、无 Marker、来源失败、冲突和无法归属演示状态；
- 移除固定的软件 Workflow 演示依赖，使用配置驱动的演示快照。

## 14. V1 最小实现切片

第一条实现链路只证明：

```text
已注册本地项目
  → 读取可选 project.yaml
  → 匹配配置声明的 Artifact
  → 解析当前项目 Session 中的合法 Marker
  → 聚合项目 Skill
  → 返回 ProjectObservationSnapshot
  → 项目主页或 nextclaw projects observe 读取同一结果
  → UI 打开来源并向明确 request 回复原会话
```

第一阶段不接外部 Codex rollout，不后台持续扫描，不创建持久缓存，不实现项目状态写入。确认和拒绝只复用现有前端消息发送链路。等 NextClaw 自有 Session Marker 链路稳定并出现真实需求后，再增加外部 Runtime 观测来源。

## 15. 验收标准

### 15.1 产品与行为合同

1. Kernel 与 Agent Runtime 不引入 Work Item、Artifact、Signal 或 Activity 的新写入语义。
2. 没有 `.nextclaw/project.yaml` 的项目可以打开主页，并清楚说明哪些信息无法观测。
3. 配置可以通过文件路径引用完整愿景和约定，不要求把复杂目标压缩成一句话。
4. 一个项目 Skill 可以指导 AI 输出 Marker；未使用该 Skill 时项目主页仍能展示其它来源。
5. 合法 Marker 能生成工作项、阶段、产物关系、待关注信号和等待回复请求，非法 Marker 只产生诊断。
6. 文件 glob 只生成配置允许的 Artifact，不能越过项目根目录。
7. 列表、看板、甘特图和工作项详情读取同一份快照；缺少证据时不虚构数据。
8. 所有动态事实都能打开原会话、Marker 或文件来源。
9. worktree、软链接或无法证明归属的 rollout 不会被静默合并进当前项目。
10. 项目主页没有创建、更新、审批、关闭或执行项目治理动作；确认和拒绝只向明确来源 Session 发送普通用户消息。
11. 任一数据源失败时其它分区仍可使用，并明确显示 `partial` 和诊断。
12. 服务重启后无需恢复项目观测数据库，重新查询可以重建同等快照。
13. `nextclaw projects observe --json` 与项目主页读取同一 Kernel 快照合同，不通过本地 HTTP，也不复制解析和合并规则。
14. 桌面与移动端都从现有会话侧边栏的项目名称进入主页；披露图标只改变展开状态，名称点击不改变展开状态；项目主页保留原工作区导航语境，不新增全局 Projects 入口或二次项目选择。
15. “建立项目观察”必须一次提出 `.nextclaw/project.yaml` 与根 `AGENTS.md` 的组合方案；用户确认后同步写入，后续普通项目会话无需额外绑定、特殊会话类型或运行时注入即可感知并遵循 Marker 约定。
16. 配置中的 Workflow 必须是工作项级生命周期；项目宏观阶段不得直接驱动工作项看板或替代单个 Work Item 的 `stage`。
17. 没有既定流程时 setup 推荐 `general-work`；AI 自检与用户验收是两个独立节点，AI 自检通过不能直接完成工作项，只有用户明确确认后才能报告 `completed`。

### 15.2 AI 交付前自验标准

以下项目全部满足，才能向用户声明 V1 已完成；单独通过页面截图或单元测试不算交付完成。

#### A. 结构与依赖

1. Kernel、Server 和 UI 都只有一个 `features/projects/index.ts` 公共入口；跨 feature deep import 和跨 workspace 子路径导入检查通过。
2. 原有 ProjectManager、ProjectStore 和 Project 类型已经迁入 Kernel Projects feature，旧路径被删除，不保留 alias、wrapper 或第二套类型。
3. `ProjectObservationService` 只接收明确的 Project、Session 和配置读取 owner，不接收整个 `NextclawKernel`，不依赖 Server、Service、Client SDK 或 UI。
4. Agent Runtime、SessionManager 和其它 Kernel owner 不导入 Projects 观测类型；它们只提供自己拥有的通用只读事实。
5. Server controller 只做请求校验、调用 Kernel 和远程路径映射，不解析配置、Marker 或合并快照。
6. CLI 和 Server 调用同一个 Kernel Projects 公共合同；UI 只通过 `client.projects` 访问，不直接拼接 HTTP URL。
7. 没有新增 `adapters/`、`providers/`、动态 registry、观测数据库、后台订阅或 `@nextclaw/projects` workspace package。

#### B. 自动化证据

1. 配置解析、路径边界、Marker 严格语法、来源归属、合并冲突和 partial 诊断均有定向单元测试；只有实际实现进程内缓存时才增加缓存失效测试。
2. Kernel service 组装测试证明单一来源失败不会吞掉其它来源，且查询不产生 Project / Session 写入。
3. Server 路由测试证明请求进入 Kernel service，远程响应不泄露不可暴露的绝对路径。
4. Client SDK 测试证明 `client.projects.getObservation(...)` 的路径、查询参数和响应类型正确。
5. UI 测试至少覆盖项目行的披露/名称双动作、项目主页工作区装配、无配置、无 Marker、partial、冲突、列表/看板/甘特同源以及等待回复发送后的状态。
6. CLI 测试证明 `nextclaw projects observe --json` 使用同一 Kernel service，而不是复制解析逻辑或启动本地 HTTP。
7. 对所有触达 TypeScript 的 package 运行并通过 `tsc`；运行定向 test、lint、治理检查和 `check:topology`，随后完成 diff-only maintainability Review。
8. 至少完成一条真实组装冒烟：已注册本地项目 → 配置 / Marker / Skill → Kernel snapshot → Server / SDK → 项目主页，并用 CLI 对照同一份快照的关键 ID 和数据质量。

以下是实现完成后的交付命令模板，不是对当前设计分支已有能力的声明；`nextclaw projects observe` 本身就是 V1 必须实现并测试的交付项。尖括号占位符必须在实际执行时替换为本次真实文件路径，不能把模板文本当作已执行证据。

适用的最小命令集合为：

```bash
pnpm --filter @nextclaw/kernel tsc
pnpm --filter @nextclaw/server tsc
pnpm --filter @nextclaw/client-sdk tsc
pnpm --filter @nextclaw/ui tsc
pnpm --filter @nextclaw/service tsc
pnpm --filter nextclaw tsc

pnpm --filter @nextclaw/kernel exec vitest run
pnpm --filter @nextclaw/server exec vitest run
pnpm --filter @nextclaw/client-sdk exec vitest run
pnpm --filter @nextclaw/ui exec vitest run
pnpm --filter @nextclaw/service exec vitest run
pnpm --filter nextclaw exec vitest run

pnpm exec eslint <touched-ts-files...>
pnpm lint:new-code:governance -- <touched-paths...>
pnpm check:topology
```

实现时可以先跑更窄的测试文件迭代，最终交付证据必须覆盖实际触达的 package；按当前冻结切片预计会触达上述六个 package，某个 package 只有在最终 diff 和运行链路都证明未触达时才能省略。新增用户可见功能还必须包含中英文用户文档、CLI 中英文命令全集更新和 changeset；设计文档、内部 README 或测试不能替代这些交付物。

### 15.3 交付给用户后的验证用例

用户验收以一份可删除的本地样例项目完成，不需要阅读实现代码。每个用例都必须给出可观察的预期结果。

#### 用例 1：零配置仍可打开

1. 注册一个没有 `.nextclaw/project.yaml` 的本地项目，在会话侧边栏切换到项目视图，点击项目前置图标确认只展开/收起子会话，再点击项目名称打开项目主页。
2. 查看概览、工作项、产物和 Skills。

预期：披露图标与项目名称是两个独立动作；主页在保留会话侧边栏的右侧工作区正常打开，且不出现全局 Projects 导航或二次项目选择；基础项目与能够明确归属的 Session / Skill 可以显示；Work Item、Workflow 和 Artifact 分类明确显示“未配置”或“暂无可观测数据”，不出现演示任务、虚构进度和默认软件开发流程。

#### 用例 2：复杂目标引用权威文件

在样例项目创建 `docs/VISION.md`，并配置：

```yaml
schema_version: 1
project:
  summary: 一个用于验证 Projects 观测的样例项目
  context:
    - id: vision
      role: 愿景
      source: docs/VISION.md
observation:
  markers:
    - protocol: nextclaw.project/v1
  artifacts:
    - id: designs
      label: 设计
      include:
        - docs/designs/**/*.md
```

预期：概览显示简短摘要；“项目上下文与约定”显示愿景来源并能打开完整文件；页面不要求把完整愿景复制进一句 `goal` 字段。

#### 用例 3：AI Marker 形成可追溯工作项

在绑定该项目的 NextClaw 会话中让 AI 输出：

```text
[nextclaw.project/v1 kind=work-item id=sample-design title="完成样例设计" workflow=none stage=none status=active]
[nextclaw.project/v1 kind=artifact item=sample-design path="docs/designs/sample.md" category=designs]
```

预期：刷新后出现 `sample-design` 工作项和关联 Artifact；二者都标记为“AI 报告”，可以打开原会话或文件来源；文件不存在时显示冲突或诊断，不伪装成已验证产物。

#### 用例 4：三种视图不制造事实

打开同一工作项的列表、看板和甘特图。

预期：三种视图使用相同工作项 ID；因为示例没有 Workflow 阶段和 schedule Marker，看板、甘特显示数据不足，不自动补阶段、日期、依赖或完成比例。补充合法 Workflow 与 schedule Marker 后，对应视图才展示这些字段。

#### 用例 5：等待回复复用原会话

让 AI 在来源会话输出一个 `status=open`、`response=confirm-reject` 的 request Marker，在项目主页点击“确认”。

预期：来源 Session 收到一条普通用户消息及稳定回复 metadata；项目主页先显示“已回复，等待 AI 更新”，不会直接把请求改成 resolved；重复点击不会产生重复回复；AI 后续输出 `resolved` Marker 后页面才显示最终状态。

#### 用例 6：失败隔离与路径安全

分别尝试损坏 YAML、非法 Marker、`../` 越界路径和指向项目外的符号链接。

预期：页面仍可打开且未失败的分区继续可用；快照显示 `partial` 和具体诊断；越界文件内容及远程不可暴露的绝对路径不出现在响应或页面中。

#### 用例 7：CLI 与页面一致

运行：

```bash
nextclaw projects observe <sample-project-root> --json
```

预期：JSON 与项目主页的工作项 ID、Artifact ID、来源状态、诊断数量和 `dataQuality` 一致；CLI 不要求桌面页面已打开，也不产生新的项目数据。

#### 用例 8：无专用观测存储（非阻塞回归）

可选地在用户允许的测试环境重启服务后，再次打开样例项目或运行 CLI。

预期：无需迁移或恢复 Projects 观测数据库即可重建等价快照；除观测时间外，关键 ID、来源和事实保持一致。

## 16. 后续但不属于 V1

- 外部 Runtime 和 Codex rollout 观测来源；
- 后台文件监听与增量快照；
- Artifact 版本、候选和派生关系的只读投影；
- 自动化运行结果的只读来源；
- 用户通知跳转；
- 项目观测配置模板；
- 项目主页写入、审批和执行控制面。

只有只读观测证明真实用户价值后，才重新讨论写入能力；不得把未来控制面预埋进 V1 的领域模型和 API。
