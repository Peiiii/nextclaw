---
name: project-observation-setup
description: Use when setting up or maintaining a project's observation contract, including project.yaml, the root rule, and the project-local work-tracking Skill.
description_zh: 建立或维护项目观察约定时使用；统一生成 project.yaml、根常驻规则与项目内工作追踪 Skill。
---

# 项目观察设置

本 Skill 只负责一次性建立和后续维护项目观察约定。项目可以是开发、写作、研究、调研或其它需要持续沉淀材料的工作。真正让后续机制持续生效的是项目自己的 `.nextclaw/project.yaml`、根 `AGENTS.md` 和项目内 `project-work-tracking` Skill。Projects 页面不注入本 Skill，也不追踪它是否被请求或使用。

## 先建立可证明的事实

1. 确认当前项目根目录，并先阅读用户指出的材料、现有项目说明、相关会话和可用 Skill。
2. 区分三类结果：已经有直接证据的事实、可以由用户确认的候选、尚不能可靠判断的信息。
3. 不要仅凭文件名、目录名、最近修改时间或会话标题，把普通文件推断成产物、工作项、阶段或项目目标。

## `.nextclaw/project.yaml` 是什么

它是项目的**只读观察配置**：告诉 Projects 页面这个项目的权威材料是什么、单个工作项采用哪些生命周期、哪些稳定文件集合算项目产物，以及后续 AI 如何报告动态事实。它不是项目正文、任务数据库、当前状态快照，也不是一份任意的自然语言规则文档。

它固定包含以下内容：

- `project`：项目摘要，以及愿景、路线图、规则、架构等原始上下文文件；
- `workflows`：项目中**单个工作项**可采用的生命周期和节点；
- `observation.markers`：`nextclaw.project/v1`，供 AI 后续报告真实的工作项、阶段和产物关联；
- `observation.artifacts`：设计、计划、报告、迭代记录等稳定产物集合的路径或 glob 分类；
- `observation.skills`：项目 Skill 根目录。

`context` 是项目的输入和依据；Artifact 是项目过程中形成、需要在项目页持续查看的产物。不要因为文件同为 Markdown 就混为一类。

## Setup 必须同时建立三件事

项目观察 setup 不是只生成一个 YAML。它必须在同一份方案中同时建立：

1. `.nextclaw/project.yaml`：Projects 页面可读取的机器配置，包含项目上下文、工作项生命周期、产物分类与路径、Marker 协议和 Skill 根目录；
2. 项目根 `AGENTS.md` 中的简短“项目工作追踪”约定：每轮常驻，只负责强制触发和路由；
3. `.agents/skills/project-work-tracking/SKILL.md`：普通项目工作期间渐进加载的执行方法、紧凑 Marker 语法和项目专属约定。

完整 Marker 方法进入项目内 Skill，不要复制进 `AGENTS.md`。`AGENTS.md` 只保留以下最小入口；已有同名章节时更新它，不要重复追加：

```markdown
## 项目工作追踪

- 本项目使用 `.nextclaw/project.yaml` 定义工作项流程、产物分类和 `nextclaw.project/v1` 协议。开展会推进项目状态的实质工作前，先读取该配置和项目内 `project-work-tracking` Skill。
- 首个工作节点 Marker 必须在该节点的分析、工具调用或文件修改之前输出；后续进入新节点时立即输出。Marker 表示“现在进入该状态”，禁止在最终回复批量补写历史节点。
- 同一工作项始终复用同一个随机 ID；切换工作项必须重新声明 ID。AI 验证通过只能进入用户验收，只有用户看到结果后明确确认才能完成。
- 不为填充项目页虚构工作项、阶段、产物、日期或状态。
```

项目根不存在 `AGENTS.md` 时，确认后创建只含该最小章节的文件；已经存在时保留其它内容，只新增或更新这一节。不要另建一套运行时注入、项目绑定、`requested skills` 或 Skill 追踪元数据机制。

## 提出一套可确认的推荐

先读取已有材料、代表性产物和项目内 Skill，再判断项目类型与现有工作方式。在写入前直接提出一套最小、可用的推荐，不要先用开放式问题让用户从零设计。除非项目已有经过用户确认的工作项流程，否则每次 setup 都优先推荐下文规定的 `general-work` 通用生命周期；场景差异用于解释每个节点在当前项目里的含义，不另行发明一套领域流程。推荐必须一次展示：

- `.nextclaw/project.yaml` 完整草案；
- 建议单个工作项采用的生命周期及节点；
- 建议归档的产物分类及路径；
- 将写入根 `AGENTS.md` 的上述简短章节；
- 将写入 `.agents/skills/project-work-tracking/SKILL.md` 的完整草案；
- 仍基于假设的少量内容。

用户可以一次确认，或提出少量修改后再确认。只有缺失信息会实质改变整体结构、且无法从项目描述和现有证据作出合理推荐时，才提出一个必要问题；不要把 setup 变成多轮访谈。

完全空白的项目属于上述必要问题场景：如果目录没有能够说明目标的材料，用户也没有描述准备做什么或希望得到什么产出，不得默认它是软件开发、研究、写作或其它项目，也不得先生成某个领域的配置草案。此时只问一个简短问题：“这个项目准备做什么？用一句话描述目标或希望产出的结果即可。”拿到回答后直接给出整套推荐，不再追加开放式问卷。

`.nextclaw/project.yaml` 按下面的固定骨架生成：

```yaml
schema_version: 1

project:
  summary: <项目简短摘要>
  context:
    - id: <稳定标识>
      role: <愿景、规则、路线图等角色>
      source: <原始文件路径>

workflows:
  - id: <工作项流程标识>
    label: <工作项流程名称>
    stages:
      - id: <工作项节点标识>
        label: <工作项节点名称>

observation:
  markers:
    - protocol: nextclaw.project/v1
  artifacts:
    - id: <分类标识>
      label: <分类名称>
      include:
        - <稳定路径或 glob>
  skills:
    - root: .agents/skills
```

YAML 层级是解析合同，不得调整：顶层只允许 `schema_version`、`project`、`workflows`、`observation`；`markers`、`artifacts`、`skills` 必须全部位于 `observation` 下。尤其不要把 `skills` 写成顶层字段。

`workflows` 的层级不能混淆：每个 Workflow 描述“一项工作如何从开始走到交付”，供多个 Work Item 复用；每条 Work Item Marker 用 `workflow` 和 `stage` 报告该工作项当前所在节点。它不是整个项目的宏观阶段、路线图或里程碑。项目级路线和里程碑仍放在权威上下文文件中；V1 不为它们新增配置字段。

### 默认推荐：通用工作项生命周期

没有已经确认的项目专属流程时，使用下面这套固定默认值，不要根据软件、写作或研究场景改名、删改或重新排序：

```yaml
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
```

这是用于观测单个工作项的统一语义坐标，不是强制打卡清单：工作项可以从适合的节点开始、跳过不适用节点，也可以在用户提出修改后退回前序节点；返工必须沿用原工作项 ID。`proposal-review` 是执行前对方案的检查，`verification` 是 AI 对实际结果的自检、测试或复核，二者不能混为一谈。

`acceptance` 与 `verification` 必须严格分开：AI 验证通过只表示结果具备提交条件，无权自行宣布整个工作项完成。此时进入 `stage=acceptance`，需要明确答复时再报告关联当前工作项的开放 `request`。只有用户在看到结果后明确确认，或通过已有确认入口发出确认消息，后续 AI 才能把请求报告为 `resolved`，并把当前工作项报告为 `status=completed`。用户在工作开始前说“完成它”不算事后验收；用户要求修改时，让原工作项退回 `design`、`execution` 或 `verification` 等真实节点。

默认只在项目已经存在用户确认的专属工作项流程、且替换它会破坏现有约定时沿用原流程。不同场景如何解释同一套节点，按需读取一个最匹配的 reference；混合项目只有在单一 reference 明显不足时才补读第二个：

- 软件开发：`references/scenarios/software-development.md`
- 创作与内容生产：`references/scenarios/creative-writing.md`
- 研究、调研与分析：`references/scenarios/research-analysis.md`

`status=active|blocked|completed|cancelled` 表示工作项的通用执行状态，`stage` 表示它在所选生命周期中的业务节点。设计节点时应优先表达真实的工作过程，不要把整个项目阶段误写成节点，也不要为了填满看板机械复制状态枚举。

Workflow 对单条工作项是可选分类。只有工作项确实会经历配置中的那套生命周期时，才选择对应节点；不能因为已有 Workflow 就选择“最接近”的一个。没有适用流程时只报告工作项事实，不创造新节点。

具体内容来自已读取的材料：`context` 只引用已经存在、已经读取并且确实拥有愿景、规则或路线图角色的文件；`workflows` 优先从已有的**工作项级**流程定义或 Skill 正文提取；`artifacts` 从实际的设计、计划、报告、迭代记录等稳定文件集合提取，并用路径或 glob 表示。不要只输出 `project.context`；不要把愿景、路线图等输入材料误当成 Artifact；不要凭文件名猜测，先读取代表性正文再归纳分类。

空项目中尚未创建的愿景、路线图或规则文件可以作为未来建议单独说明，但不得提前写入 `project.context`，否则 setup 完成后会立即产生缺失来源。此时使用 `context: []`；等文件真实创建并读过后，再经确认加入配置。Artifact 的 include glob 可以规划用户确认后的未来归档路径，因为它表达匹配范围，不声称文件已经存在。

对于还没有既定规范、但已经知道目标的新项目，默认推荐上述通用工作项生命周期，并根据用户描述和已有材料解释它在当前场景中的落地方式，同时推荐少量清晰的产物分类和目录。整套 setup 仍是待用户确认的项目建议；不要为了看起来完整而增加领域专属节点或无意义分类，也不要创建空目录来伪装已有产物。

只使用以上结构中的字段；不要写 `version`、`authoritative_sources`、`observation_rules`、顶层 `markers` 或任意脚本、表达式和动态状态。当前 Artifact 只支持路径或 glob，不支持按正文语义自动匹配；当前工作项只来自后续 AI 的 Marker，不解析 TODO 或 Issue。

目标、文件角色、产物范围或工作流有局部不确定时，明确标注假设并给出最佳推荐；不要因为存在少量不确定性就停止方案，也不要为了填满项目页虚构已有数据。

如果用户提出当前 V1 尚不能自动执行的约定（例如按 TODO/Issue 筛选工作项、按正文语义识别产物），明确说明这个边界。经确认后可以把该约定沉淀在普通项目文档中，再以 `project.context` 引用；不得伪装成已生效的 `project.yaml` 规则。

## 确认后一次写入

只有用户明确确认整套方案后，才通过既有文件编辑与确认链路一次创建或更新 `.nextclaw/project.yaml`、根 `AGENTS.md` 的“项目工作追踪”章节和 `.agents/skills/project-work-tracking/SKILL.md`。三者共同构成 setup 完成态，不得只写其中一部分；Skill 是否在当前会话中保持加载不属于项目状态。

写入后必须重新读取三份文件并复核：YAML 层级正确；根规则只出现一次且原内容未丢失；根规则引用的项目 Skill 真实存在；Skill 使用的流程、节点和产物分类 ID 均存在于 YAML；新约定不包含 `requested skills`、`kind=work-item`、`item=` 或 `title=`。发现错误先修正；只有复核通过才能声称 setup 完成。

## 生成项目内 `project-work-tracking` Skill

项目内 Skill 是日常执行 owner，frontmatter 固定使用：

```yaml
---
name: project-work-tracking
description: Use before substantive work in this project to report the current work item and stage through the configured NextClaw project protocol.
description_zh: 在本项目开展实质工作前使用；按项目配置及时报告工作项、节点、状态和产物。
---
```

正文必须用当前项目的语言写清以下规则：

- 先读 `.nextclaw/project.yaml`，流程、节点和产物分类以该文件为准；
- 项目相关讨论如果要形成决策或推进方案，属于实质工作；不推进项目状态的简短问答和内部工具步骤不单独建工作项；
- Marker 是“现在进入这个状态”的事件。读取配置和本 Skill 后，必须先输出首个完整 Marker，再开始该节点的实质分析、工具调用或文件修改；进入下一节点、返工、阻塞或恢复时立即报告，禁止在最终回复批量补写历史节点；
- 工作项可以从真实节点开始、跳过节点或回到前序节点；返工沿用原 ID；
- 新工作 ID 使用 `wi_` 加 10 位小写无歧义随机字母数字，项目内稳定且不重复；新 ID 首次必须同时报告 `id`、`name` 和 `stage`；
- 同一会话的当前工作项可以省略重复字段；切换工作项必须重新声明 `id`；新会话第一条 Marker 必须显式声明 `id`；
- `stage` 事件默认恢复为 `active`，只有 `blocked`、`completed`、`cancelled` 才显式写 `status`；
- AI 验证通过进入 `acceptance`，只有用户看到结果后明确确认才报告 `completed`；用户要求修改时用同一 ID 回到真实节点；
- 文件真实存在且匹配 YAML 分类后才报告 Artifact；日志采用项目确认的目录束约定；
- 不虚构事实，不追踪使用了哪个 Skill，不创建 `requested skills` 元数据。

正文必须教授以下紧凑语法并配少量项目化示例：

```text
[nextclaw.project/v1 id=wi_7km4q2x9dn name="<工作项名称>" stage=<stage-id>]
[nextclaw.project/v1 stage=<stage-id>]
[nextclaw.project/v1 id=<已有工作项-id> stage=<stage-id>]
[nextclaw.project/v1 status=blocked]
[nextclaw.project/v1 artifact path="<project-relative-path>" category=<category-id>]
[nextclaw.project/v1 request=<request-id> response=confirm-reject prompt="<需要用户回答的问题>"]
[nextclaw.project/v1 request=<request-id> status=resolved]
```

每个 Marker 必须独占一整行。`workflow` 只在多个流程导致节点含义不明确时提供；当前工作项、`name`、流程和状态按协议继承。Artifact 和 request 默认关联当前工作项，关联其它工作项时使用 `work-id=`。

Skill 最后补充当前项目确认的文件命名和日志目录约定，以及 1–3 个真正匹配当前项目的阶段解释。不要复制整个 YAML，也不要复制所有通用场景 reference。

## 维护而非固化

当项目的目标、权威材料、产物规则或工作流发生变化时，先比较新证据与现有配置并说明影响，再请求确认。不要把一次初始化的结论当作永久有效的模板。

## 不做的事

- 不由 Projects 页面创建任务、修改阶段、安装 Skill 或建立另一套项目数据库；
- 不因用户打开项目页而静默写入配置；
- 不把项目观察结果当作 Agent Runtime 的必需前提。
