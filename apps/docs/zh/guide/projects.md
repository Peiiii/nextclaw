# 查看项目进展与材料

Projects 页面把一个已注册项目里的工作项、产物、Skills、上下文和 AI 报告集中到同一处。它适合写作、研究、投资分析、软件开发等需要多轮推进和持续积累材料的工作。

## 打开项目主页

先在聊天侧边栏创建项目或添加已有目录。在项目视图中，点击项目名称打开项目主页；前置图标只用于展开或收起该项目的会话。项目主页可以查看五类信息：

- **概览**：项目摘要、待关注事项、数据来源和最近变化；
- **工作项**：以列表、看板或甘特图查看 AI 明确报告的工作项；
- **产物**：查看配置匹配或 AI 标记的项目文件；
- **Skills**：查看项目目录中可用的 Skills；
- **工作约定**：查看愿景、规则和其它上下文文件的引用。

这些内容是只读观测结果。Projects 页面不会创建任务、改变阶段、修改文件或安装 Skill。只有 AI 明确表示正在等待回复时，页面才会提供确认或拒绝；回复会发送回原会话，并由 AI 后续报告最终状态。

## 首次建立项目观察

配置不是前置条件。没有可用的 `.nextclaw/project.yaml` 时，概览页会显示 **让 AI 帮我建立项目观察**。点击它会复用普通新建会话，自动选中当前项目，并把引导内容预填到输入框；不会自动发送，也没有额外的“绑定项目”步骤。

你可以补充背景后再发送。内置的“项目观察设置”Skill 会先阅读已有材料、会话和 Skills，然后直接给出一套可修改的推荐，包括适合当前项目中**单个工作项**的生命周期与节点、产物分类与路径，以及三个相互引用的项目资产：`.nextclaw/project.yaml`、根 `AGENTS.md` 中的最小常驻规则、`.agents/skills/project-work-tracking/SKILL.md` 中的日常追踪方法。项目没有已经确认的专属流程时，默认推荐同一套 `general-work` 通用生命周期；软件、写作和研究等场景只改变节点的具体解释，不各自发明一套流程。已有项目已经采用明确流程时则保留原约定。

Workflow 描述的是一项工作如何从开始走到交付，供多个工作项复用，不是整个项目的宏观阶段。例如小说项目的“全书构思、世界观、全书写作、出版”属于项目级推进；单个章节或设定任务的“明确目标、起草、修订、定稿”才属于工作项 Workflow。项目路线和里程碑可以保留在愿景、路线图或计划文档中，当前 V1 不把它们塞进工作项看板。

默认生命周期是“探索与目标澄清 → 规划与拆解 → 方案设计 → 方案评审 → 执行与产出 → 结果验证 → 用户验收”。节点是可跳过、可回退的观测坐标，不是强制打卡清单。最后两步具有不同权限：AI 只能完成结果验证；验证通过后工作项仍保持进行中，并进入用户验收。只有用户看到结果后明确确认，或者通过已有确认入口发出确认消息，AI 才会把工作项报告为完成。用户要求修改时沿用原工作项并退回真实节点。

setup 不会变成多轮问卷。项目完全为空、用户也没有说明目标时，AI 只会先问“这个项目准备做什么或希望产出什么”，不会擅自假设成软件、研究或写作项目；得到一句目标说明后便直接给出整套推荐。通常只需要一次确认，或提出少量修改后再确认；确认后 AI 才通过正常文件编辑链路统一写入并复核三个资产。YAML 供 Projects 页面解析，根规则让每轮 AI 知道必须加载项目 tracking Skill，Skill 则渐进提供完整语法和项目专属方法。尚未支持的 TODO/Issue 筛选、正文语义匹配等自然语言约定，也不会被伪装成可执行配置。

## 开始项目工作

项目已有可用配置、但还没有工作项时，概览和工作项页会提供 **开始项目工作**。它同样只是复用普通新建会话，自动选中当前项目并预填可编辑的引导文字。你也可以直接在新会话中使用原有的项目选择器，两者进入的是同一条会话链路。

setup 完成后，真正持续生效的是项目根 `.nextclaw/project.yaml`、`AGENTS.md` 和项目内 `project-work-tracking` Skill：配置保存项目专属的流程、产物范围和协议声明，根规则负责稳定触发，项目 Skill 负责日常执行方法。内置 `project-observation-setup` 只在建立或维护约定时使用；Projects 页面不会建立特殊会话类型、运行时注入链路、`requested skills` 或额外的 Skill 追踪元数据。

## 可选项目配置

在项目根目录创建 `.nextclaw/project.yaml`，可以声明项目摘要、完整上下文文件、Workflow、产物目录和 Skill 目录。复杂目标不需要压缩成一句话，可以直接引用愿景或工作约定文件。

```yaml
schema_version: 1

project:
  summary: 一个长期研究项目
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
    - id: reports
      label: 研究报告
      include:
        - reports/**/*.md
  skills:
    - root: .agents/skills
```

配置文件不是打开项目页的前置条件。没有配置时，页面仍会显示项目注册信息以及能够明确归属的会话和 Skills；没有证据的工作项、节点、产物和日期不会被自动补全。当前产物分类只支持路径或 glob 匹配；工作项则需要 AI 在真实状态变化时显式报告 Marker。推荐通过页面入口完成整套 setup；如果手动创建配置，也应同时建立根 `AGENTS.md` 的简短入口和项目内 `project-work-tracking` Skill，避免后续 AI 不知道要遵守观察约定。

## AI 如何报告项目事实

根规则会让 AI 在实质工作前读取项目 tracking Skill。Marker 表示“现在进入这个节点”，必须在该节点的分析、工具调用或文件修改前输出，不能在最终回复中批量补写。例如：

```text
[nextclaw.project/v1 id=wi_7km4q2x9dn name="完成研究报告" stage=exploration]
[nextclaw.project/v1 stage=execution]
[nextclaw.project/v1 artifact path="reports/final.md" category=reports]
```

同一会话会继承当前工作项、名称和流程，因此节点切换只需报告变化字段；切换工作项或开启新会话时必须重新声明稳定随机 ID。AI 自检通过后只进入 `acceptance`，不会提前报告 `completed`；用户看到结果并明确确认后才完成。历史完整 V1 Marker 仍然可以读取。

页面会保留来源会话和观测时间，并区分“AI 报告”“文件观测”“项目配置”和“系统记录”。非法 Marker、损坏的配置或越界路径只会产生诊断，不会让整个项目主页失效。

## 从命令行读取同一快照

```bash
nextclaw projects observe /absolute/path/to/project --json
```

CLI 与 Projects 页面读取同一份 Kernel 快照，适合脚本、Agent 或无界面环境。命令只接受已经注册的项目根目录，也不会创建新的项目数据。
