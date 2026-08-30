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

> 原型当前只作为布局、三视图、流程画布、Artifact 工作台和响应式交互的结构基线；其中写入按钮、强事实文案和静态演示数据尚未按本文完成语义收敛，不能作为 V1 行为合同。

## 1. 当前裁决

项目主页 V1 不是项目管理器或项目治理控制面，而是一个**配置驱动、来源可追溯、可插拔的项目观测层**。项目事实和状态仍然只读；唯一的窄写入能力，是把用户对“AI 正在等待回复”的明确回答直接发送回原会话。

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
                    Project Observer
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

### 2.4 可插拔不是进程级插件优先

V1 通过只读 `SourceAdapter` 扩展事实来源。首版不为了“可插拔”引入新的独立进程、通用插件运行时或跨进程协议；只有出现需要独立发布、隔离权限或跨产品复用的真实需求时再抽离。

### 2.5 Agent 主链路不感知项目观测

Agent Runtime、Session 执行和 Kernel 不依赖 Project Observer。项目 Skill 可以选择指导 AI 输出 Marker，但 Skill 是可选事实生产器，不是项目主页的运行依赖。

## 3. 产品边界

### 3.1 V1 包含

- 从侧边栏项目入口进入项目主页；
- 项目概览；
- 只读工作项列表、看板和甘特图；
- 只读工作项详情和 Workflow 画布；
- 项目产物分类、浏览和稳定工作台预览；
- 项目 Skills 只读展示；
- 项目上下文与工作约定只读展示；
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
  → 查看项目上下文和数据来源状态
  → 查看可观测工作项
  → 查看阶段、产物和待关注信号
  → 对 AI 明确等待的请求确认、拒绝或打开原会话
  → 打开真实文件或原始会话
  → 返回项目主页
```

项目主页不承担“从零开始做事”的链路。项目和会话仍由现有入口创建；项目配置可以由用户手工维护，也可以由项目外部的 Skill 或 Agent 按自身确认规则生成。

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

Work Item 是被 AI 显式 Marker 识别出来的只读工作单元，不是项目主页创建和管理的任务记录。V1 不支持从结构化索引、Frontmatter、文件名或目录布局生成 Work Item；以后如有真实需求，通过新的 SourceAdapter 增加，不扩展 V1 配置 DSL。

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

配置可以证明项目如何被解释，包括上下文引用、Workflow 定义、Artifact 分类和数据源规则。配置不能证明动态工作已经发生。

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
- runtime / adapter；
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
  - id: development
    label: 开发流程
    stages:
      - id: task-understanding
        label: 任务理解
      - id: design
        label: 方案设计
      - id: implementation
        label: 开发实现
      - id: validation
        label: 验证
      - id: review
        label: Review
      - id: delivery
        label: 交付

observation:
  markers:
    - protocol: nextclaw.project/v1

  work_items:
    - type: marker

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
- 标题、消息和 prompt 有长度上限，不能包含双引号、右方括号或换行；
- Marker 归属优先来自 Session 的结构化 `project_root`，不允许只凭工作项名称归属项目；
- 同一个 Work Item 的最后一条有效 `work-item` Marker 形成当前状态，历史 Marker 形成只读动态；
- `artifact` Marker 建立报告关系，文件读取器仍需独立验证目标；
- `schedule` Marker 只报告明确存在的日期、里程碑和依赖；没有该 Marker 时甘特图显示数据不足，不从文件时间推断；
- `signal` 由后续 Marker 报告 `resolved`，项目主页本身不解除信号；
- `request` 只有在 `status=open` 且 `response=confirm-reject` 时显示直接回复按钮；其它请求只打开原会话；
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

该 metadata 用于项目观测解析器在刷新后识别“用户已经回复”，不要求 Kernel 解释新的项目语义。发送使用稳定 `idempotencyKey`，避免重复点击产生两条相同回复；运行中的来源 Session 继续遵循现有 `queue` / `prefer-steer` 交付语义。

## 9. 后端技术结构

### 9.1 代码归属

V1 在 `nextclaw-server` 中新增独立项目观测 feature，负责：

- 验证目标是已注册项目；
- 规范化项目根目录；
- 加载并校验配置；
- 调用只读 SourceAdapter；
- 归一化事实、生成诊断和快照；
- 暴露一个只读查询 API。

Kernel、Agent Runtime 和 Session 执行链不依赖该 feature。只有现有公共读取能力确实不足时，才补充不含项目观测语义的窄 reader。

### 9.2 SourceAdapter

逻辑合同：

```ts
interface ProjectObservationSource {
  readonly id: string;
  collect(context: ProjectObservationContext): Promise<ObservationBatch>;
}
```

首版内置：

- `ProjectConfigSource`；
- `ProjectFileSource`；
- `NextClawSessionMarkerSource`；
- `ProjectSkillSource`。

Codex rollout、其它 Runtime、自动化或外部研究源以后通过新的 adapter 接入，不修改已有来源解析器。

每个 adapter 独立失败；一个来源失败不能阻止其它分区返回。失败进入统一诊断，不返回伪造空成功。

### 9.3 归属规则

内部统一使用 canonical `rootPath`。来源归属顺序：

1. Session 结构化 `project_root` 与项目 canonical root 相同；
2. Runtime adapter 提供经过规范化并能证明的 workspace 绑定；
3. 无法证明时进入 `unattributed`，不按名称、最近会话或目录相似度猜测。

worktree、符号链接、子目录和外部 rollout 必须经过同一规范化合同。V1 不跨不同 canonical root 自动合并项目。

### 9.4 存储与缓存

V1 不新增数据库。事实源分别是配置文件、项目文件、Session / rollout 和现有系统记录。

项目快照在查询时生成。性能需要时可以增加进程内缓存：

- 缓存键使用 canonical `rootPath`；
- 配置与文件来源使用路径、大小、`mtime` 等签名失效；
- Session Marker 来源使用现有记录的稳定更新时间或游标失效；
- 缓存不是事实源，服务重启后可以安全丢失；
- 手动刷新绕过缓存并重新观测。

V1 不新增稳定 `projectId`，不修改现有项目注册表身份合同。

## 10. 只读 API 与快照

首版只提供一个聚合查询：

```text
GET /api/projects/observation?rootPath=<registered-project-root>
```

服务端必须验证 `rootPath` 对应已注册项目并再次规范化，不能把该接口变成任意本地目录读取器。

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
- 单一 adapter 设置超时和诊断，避免一个来源阻塞整个主页；
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
  → 项目主页展示、打开来源并向明确 request 回复原会话
```

第一阶段不接外部 Codex rollout，不后台持续扫描，不创建持久缓存，不实现项目状态写入。确认和拒绝只复用现有前端消息发送链路。等 NextClaw 自有 Session Marker 链路稳定后，再增加外部 Runtime adapter。

## 15. 验收标准

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

## 16. 后续但不属于 V1

- 外部 Runtime 和 Codex rollout adapter；
- 后台文件监听与增量快照；
- Artifact 版本、候选和派生关系的只读投影；
- 自动化运行结果的只读来源；
- 用户通知跳转；
- 项目观测配置模板；
- 项目主页写入、审批和执行控制面。

只有只读观测证明真实用户价值后，才重新讨论写入能力；不得把未来控制面预埋进 V1 的领域模型和 API。
