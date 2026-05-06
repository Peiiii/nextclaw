# NextClaw 世界级用户文档系统设计

**Goal:** 为 NextClaw 设计一套世界级、面向用户、可长期扩展、可稳定治理的文档系统，使公开文档站成为用户理解与进入 NextClaw 的默认入口，同时把完整命令参考、AI 自管理知识、内部设计沉淀清晰分层，不再互相污染。

**Architecture:** 采用“四层文档系统”架构：`公开用户文档站` 承担用户主路径；`完整命令索引` 承担查询型参考；`AI/CLI 自管理真相源` 承担系统完整命令合同；`内部设计与迭代文档` 承担团队交付与治理知识。公开文档站内部再按“用户任务生命周期 + 页面类型合同 + 真相源边界”三条主线组织，确保新内容未来不会再次退化为页面堆砌和命令堆砌。

---

## 1. 设计目标

这份文档不是在回答“某一页怎么写”，而是在回答四个更上位的问题：

1. NextClaw 的公开文档站到底是什么，不是什么。
2. 整个文档系统应该分成哪些层，每层服务谁。
3. 公开文档站应该分成哪些模块，每个模块包含哪些页面，每页必须承担什么职责。
4. 未来新增内容时，团队如何稳定判断“该写到哪、怎么写、谁是源头”。

这份设计的目标不是“比现在整洁一点”，而是：

- 让用户第一次进入文档站时，不再被命令、实现细节或抽象功能词淹没。
- 让用户可以沿着清晰路径完成安装、接入、开始使用、持续运行、远程访问与排障。
- 让高阶参考仍然存在，但退到正确位置。
- 让 AI 自管理合同继续完整存在，但不再反向主导用户站结构。
- 让文档体系具备世界级产品应有的可预测性、一致性、扩展性和准确性。

---

## 2. 为什么现在的状态还不够

当前文档站的问题，不是某一篇写得不好，而是系统层的几个错位同时存在：

### 2.1 公开站承担了过多“系统自说明”职责

一些本来更适合给 AI、自管理链路、高阶操作者或查询型用户使用的命令知识，过早出现在公开用户路径中。  
结果是用户会被大量命令表面、运行方式和系统机制打断，而不是被引导完成任务。

### 2.2 页面是存在的，但页面职责不稳定

例如：

- `commands.md` 既像完整参考，又像用户会被直接引导去看的页面。
- `after-setup.md` 既像动作建议页，又像产品 capability 导航页。
- `advanced.md`、`configuration.md`、`remote-access.md`、`runtime-hosting.md` 容易出现职责交叉。
- `tutorials` 既承接“新手一步一步做”，又承接“专题解决方案”，还承接“平台/生态入口”。

一旦页面职责不稳定，后续内容只会继续被打补丁式塞进去。

### 2.3 模块名和页面名还没有形成真正的“分类语义”

例如“功能”“教程”“命令”“进阶”这类模块，如果没有明确收录规则，就会逐渐退化为：

- 看起来有分类
- 但分类不构成约束
- 新页面还是按直觉往里塞

这不是世界级文档系统该有的结构。

### 2.4 缺少页面类型合同

当前更像是在“写一堆文档页面”，而不是在维护一套有严格页面类型的系统。

但世界级文档系统的关键不是页数，而是每种页面都有固定职责，例如：

- `Guide` 解释一个能力是什么
- `Tutorial` 带用户一步一步完成一个目标
- `Reference` 提供完整查询
- `Runbook` 解决运行/恢复问题
- `Overview` 负责帮助用户做路径选择

如果不定义这些页面类型，内容很容易互相串味。

---

## 3. 世界级文档系统的标准

对 NextClaw 来说，“世界级”不是华丽文案，而是下面这些结构性标准同时成立：

### 3.1 对用户来说足够短

新用户进入站点后，不需要先懂：

- Agent runtime
- Secrets refs
- Host autostart owner
- Plugin marketplace
- 完整 CLI 表面

而是先完成“装上、跑通、开始用”。

### 3.2 对高阶用户来说足够深

高阶用户仍然能找到：

- Docker
- `systemd`
- LaunchAgent
- Remote Access
- Command Index
- Advanced Configuration

但这些内容不能污染主用户路径。

### 3.3 对未来内容来说足够稳

每新增一项能力，团队都能明确判断：

- 它属于哪个模块
- 它应该是 `Guide` / `Tutorial` / `Reference` / `Runbook`
- 它应不应该进入公开站主路径
- 它是不是应该只进入 `USAGE.md`

### 3.4 对 AI 和系统来说足够准

完整命令合同、Agent CRUD、Marketplace、Plugin、Automation 等系统级知识，必须仍然可以被 AI 精确读取和使用，但不需要强行进入用户主站。

### 3.5 对品牌来说足够统一

文档站必须体现 NextClaw 的产品定位：

- 统一入口
- 意图优先
- 能力编排
- 开箱即用
- 自感知与自治

文档本身也应该表现出“统一入口”的气质，而不是像很多开源项目那样由 CLI 参数表驱动。

---

## 4. 文档系统总架构

整个 NextClaw 文档系统应被明确分成四层。

## 4.1 第一层：公开用户文档站

位置：

- `apps/docs`

受众：

- 普通用户
- 已开始使用但需要更深路径的用户
- 部分高阶用户

职责：

- 解释产品是什么
- 引导用户完成关键任务
- 提供必要的运行与排障指导
- 提供可查询但非主路径的参考页

不承担：

- AI 自管理完整合同
- 仓库内部设计与迭代记录
- 全量系统内建知识沉淀

这是用户默认入口。

## 4.2 第二层：完整命令索引

位置：

- 公开文档站中的 `commands.md`

受众：

- 想查某条命令的用户
- 高阶操作者
- AI 辅助使用

职责：

- 作为公开 CLI 的尽可能完整索引
- 支持按主题查找
- 把“产品动作”映射到“命令名称”

不承担：

- 新手上手主流程
- 概念解释主责任
- 产品 capability 介绍主责任

它是 `reference`，不是 `onboarding`。

## 4.3 第三层：AI / CLI 自管理真相源

位置：

- `docs/USAGE.md`
- `packages/nextclaw/resources/USAGE.md`

受众：

- AI
- 系统自管理链路
- 高阶系统操作

职责：

- 承担完整命令合同
- 承担自管理操作说明
- 为运行时内建 guide 提供事实来源

不承担：

- 公开文档站主信息架构

## 4.4 第四层：内部设计与交付文档

位置：

- `docs/plans`
- `docs/designs`
- `docs/logs`

受众：

- 团队成员
- 贡献者
- AI 协作者

职责：

- 设计、方案、变更、发布、复盘、治理

不承担：

- 对用户公开的稳定产品说明

---

## 5. 公开文档站的一级模块设计

公开文档站不应该只是“页面列表”，而应该是“模块系统”。  
每个一级模块必须有：

- 明确目标
- 明确受众
- 明确边界
- 明确页面类型
- 明确不应该收什么

以下是推荐的最终一级模块。

## 5.0 一级模块排序原则

一级模块的顺序不是按“内容是否存在”排序，而是按“对绝大多数用户完成核心任务是否重要”排序。

公开文档站前排只允许出现下面这些语义：

- 理解产品
- 安装与开始使用
- 接入能力与最小配置
- 日常使用
- 持续运行与排障

下面这些内容即使有价值，也默认不得占据主路径前排：

- 项目动态
- 路线图
- Project Pulse
- 品牌叙事扩展材料
- 生态观察
- 面向少数高阶场景的专题教程

这些内容应该被降级到站点尾部、次级导航、`Project` 区或旁路参考层，而不是进入用户首次浏览时的主决策链路。

## 5.1 模块一：认识 NextClaw

### 目标

帮助用户回答：

- NextClaw 是什么
- 为什么值得用
- 它适合我吗
- 它和普通聊天产品有什么差异

### 页面类型

- `Concept`
- `Overview`

### 应收内容

- Introduction
- Vision
- 典型使用方式
- 产品边界

### 不应收内容

- 命令清单
- 详细配置流程
- 宿主托管细节

### 当前建议页面

- `introduction.md`
- `vision.md`

## 5.2 模块二：开始使用

### 目标

帮助用户在最短时间内完成：

- 安装
- 启动
- 打开 UI
- 第一次配置
- 进入下一步

### 页面类型

- `Tutorial`
- `Quickstart`

### 应收内容

- Quick Start
- What To Do After Setup

### 不应收内容

- 全量命令表
- 深层机制解释
- 高级部署路径

### 当前建议页面

- `getting-started.md`
- `after-setup.md`

## 5.3 模块三：接入与配置

### 目标

帮助用户接入能力，而不是解释所有系统内部结构。

### 页面类型

- `Guide`
- `How-to`
- `Configuration Guide`

### 应收内容

- Configuration
- Model Selection
- Channels
- Secrets
- Tools

### 不应收内容

- 用户首次安装主路径
- 宿主运行与常驻
- 完整 CLI 索引

### 当前建议页面

- `configuration.md`
- `model-selection.md`
- `channels.md`
- `secrets.md`
- `tools.md`

## 5.4 模块四：使用与自动化

### 目标

帮助用户把 NextClaw 从“装好了”推进到“真的在用”。

### 页面类型

- `Guide`
- `Usage Guide`

### 应收内容

- Chat Capabilities
- Session Management
- Cron / Automation

### 不应收内容

- 宿主部署
- 高级配置文件机制
- 完整命令表

### 当前建议页面

- `chat.md`
- `sessions.md`
- `cron.md`

## 5.5 模块五：运行与托管

### 目标

承接一切“让 NextClaw 持续存在”的语义。

这是整个体系里最关键的新模块，因为它把过去散落在命令页、教程页和用户误解里的内容收口成一条清晰主线。

### 页面类型

- `Overview`
- `Runbook`
- `Hosting Guide`

### 应收内容

- Runtime & Hosting overview
- Background & Autostart
- Remote Access
- Docker deployment
- Host runtime models

### 不应收内容

- 模型/Provider 接入
- 全量插件/Marketplace 内容
- 纯开发者内部设计

### 当前建议页面

- `runtime-hosting.md`
- `background-autostart.md`
- `remote-access.md`
- `tutorials/docker-one-click.md`

## 5.6 模块六：学习与资源

### 目标

承接那些“确实有用，但不属于主路径核心链路”的专题教程与资源入口。

这个模块的定位不是“继续教新手上手”，而是为已经完成基础使用的用户提供按主题深入的学习材料。

### 页面类型

- `Tutorial Hub`
- `Scenario Tutorial`

### 应收内容

- Tutorials Hub
- Provider options tutorial
- Claude/Codex/Hermes tutorial
- Feishu tutorial
- MCP tutorial
- Local Ollama tutorial
- Resource hub / Examples

### 不应收内容

- 核心产品概念
- 命令索引
- 宿主运行基本总览
- 首次上手主流程
- 对大多数用户无关的项目动态

### 当前建议页面

- `tutorials.md`
- `tutorials/*`
- `resources.md`

## 5.7 模块七：参考与排错

### 目标

保留查询能力，但明确降级为旁路层。

### 页面类型

- `Reference`
- `Index`
- `Troubleshooting`

### 应收内容

- Core Commands
- Command Index
- Troubleshooting
- 术语说明（未来可补）

### 不应收内容

- 新手主上手流程
- 产品概念解释主责任

### 当前建议页面

- `core-commands.md`
- `commands.md`
- `troubleshooting.md`

## 5.8 模块八：进阶

### 目标

承接那些“确实重要，但不应该打断大多数用户”的能力与机制。

### 页面类型

- `Advanced Guide`
- `Expert Configuration`

### 应收内容

- Advanced Configuration
- Multi-Agent Routing

### 不应收内容

- 新手接入路径
- 主产品价值解释
- 宿主运行总览

### 当前建议页面

- `advanced.md`
- `multi-agent.md`

## 5.9 模块九：项目与生态背景

### 目标

承接那些“可以公开存在，但不应打断用户完成产品任务”的项目背景信息。

这不是用户操作文档的一部分，而是品牌、路线图、社区、项目状态的次级信息层。

### 页面类型

- `Project Overview`
- `Public Product Context`

### 应收内容

- Project Pulse
- Vision
- Roadmap
- Release notes
- Community / Ecosystem

### 不应收内容

- 用户操作手册
- 系统自管理合同
- 新用户首次必读内容
- 主导航前排入口

### 当前建议页面

- `project-pulse.md`
- `vision.md`
- `roadmap.md`
- `release-notes.md`
- `community.md`

## 5.10 推荐目录结构

为了避免“方案只有信息架构，没有文件落位”，这里明确给出推荐目录结构。

这一节回答的不是“概念上有哪些模块”，而是“仓库里最终应该怎么放”。

### 文档系统总目录树

```text
docs-system/
├── public-docs-site/                         # 面向用户的公开文档站
│   ├── understand-nextclaw/
│   ├── get-started/
│   ├── connect-and-configure/
│   ├── use/
│   ├── runtime-and-hosting/
│   ├── learn-and-resources/
│   ├── reference-and-troubleshooting/
│   ├── advanced/
│   └── project/
│
├── command-index/                            # 查询型公开命令参考
│   └── commands.md
│
├── ai-cli-source-of-truth/                   # AI / CLI 自管理真相源
│   ├── docs/USAGE.md
│   └── packages/nextclaw/resources/USAGE.md
│
└── internal-delivery-docs/                   # 团队内部设计与交付文档
    ├── docs/plans/
    ├── docs/designs/
    └── docs/logs/
```

### `apps/docs` 的推荐实际结构

```text
apps/docs/
├── zh/
│   ├── guide/
│   │   ├── introduction.md
│   │   ├── vision.md
│   │   ├── getting-started.md
│   │   ├── after-setup.md
│   │   ├── configuration.md
│   │   ├── model-selection.md
│   │   ├── channels.md
│   │   ├── secrets.md
│   │   ├── tools.md
│   │   ├── chat.md
│   │   ├── sessions.md
│   │   ├── cron.md
│   │   ├── runtime-hosting.md
│   │   ├── background-autostart.md
│   │   ├── remote-access.md
│   │   ├── tutorials.md
│   │   ├── resources.md
│   │   ├── core-commands.md
│   │   ├── commands.md
│   │   ├── troubleshooting.md
│   │   ├── advanced.md
│   │   └── multi-agent.md
│   ├── tutorials/
│   │   ├── docker-one-click.md
│   │   ├── provider-options.md
│   │   ├── local-ollama.md
│   │   ├── mcp.md
│   │   └── feishu.md
│   └── project/
│       ├── roadmap.md
│       ├── release-notes.md
│       ├── community.md
│       └── project-pulse.md
│
└── en/
    ├── guide/
    │   ├── introduction.md
    │   ├── vision.md
    │   ├── getting-started.md
    │   ├── after-setup.md
    │   ├── configuration.md
    │   ├── model-selection.md
    │   ├── channels.md
    │   ├── secrets.md
    │   ├── tools.md
    │   ├── chat.md
    │   ├── sessions.md
    │   ├── cron.md
    │   ├── runtime-hosting.md
    │   ├── background-autostart.md
    │   ├── remote-access.md
    │   ├── tutorials.md
    │   ├── resources.md
    │   ├── core-commands.md
    │   ├── commands.md
    │   ├── troubleshooting.md
    │   ├── advanced.md
    │   └── multi-agent.md
    ├── tutorials/
    │   ├── docker-one-click.md
    │   ├── provider-options.md
    │   ├── local-ollama.md
    │   ├── mcp.md
    │   └── feishu.md
    └── project/
        ├── roadmap.md
        ├── release-notes.md
        ├── community.md
        └── project-pulse.md
```

### 目录结构原则

- `zh` 与 `en` 必须保持同构，不允许中文站和英文站长期出现结构漂移。
- `guide` 只承接用户主路径与稳定能力说明，不承接项目动态。
- `tutorials` 只承接专题教程，不承接核心概念、命令索引或项目背景。
- `project` 只承接路线图、发布说明、社区、Project Pulse 这类尾部信息，不进入主路径前排。
- `commands.md` 必须保留在 `guide` / `reference` 侧，但它是旁路查询页，不是新手主路径入口。
- `docs/USAGE.md` 与 `packages/nextclaw/resources/USAGE.md` 不属于公开站目录结构的一部分，不能反向支配 `apps/docs` 的信息架构。

---

## 6. 页面类型合同

这是实现“世界级、一致、可扩展”的关键。  
以后每新增一页，必须先判断页面类型，再写内容。

## 6.1 `Quickstart`

适用页面：

- `getting-started.md`

固定回答：

1. 前置条件是什么
2. 最短命令链路是什么
3. 首次打开后做什么
4. 最小验证怎么做
5. 下一步去哪

禁止出现：

- 大段背景解释
- 全量命令表
- 深层机制

## 6.2 `After Setup`

适用页面：

- `after-setup.md`

固定回答：

1. 配完后马上做什么
2. 哪些动作最能最快体现价值
3. 什么时候进入“长期可用”路径
4. 下一步去哪

禁止出现：

- 完整参考式写法
- 过多 flags 和低层配置

## 6.3 `Guide`

适用页面：

- `configuration`
- `channels`
- `secrets`
- `tools`
- `chat`
- `sessions`
- `remote-access`

固定回答：

1. 这项能力是什么
2. 它解决什么问题
3. 用户在什么情况下应该看它
4. 关键路径是什么
5. 相关页有哪些

禁止出现：

- 成为完整命令索引
- 同时兼任 runbook 和 quickstart

## 6.4 `Overview`

适用页面：

- `runtime-hosting`
- `tutorials`

固定回答：

1. 这个主题下有哪些路径
2. 各路径适合谁
3. 什么时候选哪条
4. 接下来该去哪

禁止出现：

- 把所有细节都塞进总览页

## 6.5 `Runbook / Hosting Guide`

适用页面：

- `background-autostart`
- Docker / host runtime pages

固定回答：

1. 这个运行路径适合谁
2. 启用前提是什么
3. 怎么启用
4. 怎么验证
5. 怎么撤销 / 回滚
6. 什么时候应该换另一条路径

禁止出现：

- 把它写成新手第一步

## 6.6 `Reference`

适用页面：

- `core-commands`
- `commands`

固定回答：

1. 这页的定位是什么
2. 它服务谁
3. 该怎么查
4. 正文按稳定主题索引

禁止出现：

- 假装自己是主 onboarding 流程

## 6.7 `Tutorial`

适用页面：

- `tutorials/*`

固定回答：

1. 适合谁
2. 前置条件
3. 一步一步操作
4. 成功判定
5. 常见失败
6. 下一步

禁止出现：

- 同时承担百科和参考职责

## 6.8 `Advanced`

适用页面：

- `advanced`
- `multi-agent`

固定回答：

1. 谁应该看
2. 为什么不放在新手主路径
3. 机制是什么
4. 风险和边界是什么

禁止出现：

- 假装面向所有用户

---

## 7. 页面命名与模块命名规范

世界级文档系统不能只靠“感觉差不多”，必须有命名规则。

## 7.1 一级模块命名规则

一级模块名必须是“用户能理解的任务/阶段/角色词”，而不是纯技术实现词。

推荐：

- 开始使用
- 接入与配置
- 使用与自动化
- 运行与托管
- 参考与排错
- 进阶

不推荐一级直接叫：

- CLI
- Runtime
- Infra
- Owner
- Agent Runtime

除非该模块明确面向高级用户且有强约束说明。

## 7.2 页面命名规则

页面名必须清楚表达它是：

- 概念页
- 总览页
- 教程页
- 参考页
- 排障页

例如：

- `核心命令` 明确比 `命令` 更适合主用户路径
- `命令索引` 明确比 `命令` 更适合完整 reference
- `运行与托管总览` 明确比 `运行` 更能表达页面职责
- `后台运行与自启动` 明确比 `Autostart` 更容易被用户理解

## 7.3 Tutorial 命名规则

专题教程页名要同时包含：

- 目标对象
- 关键工具/平台
- 结果

例如：

- `Docker 一键部署教程`
- `Claude Code / Codex / Hermes 集成`
- `本地 Ollama + Qwen3 教程`

而不是泛泛写成：

- `Docker`
- `Integration`
- `Provider`

---

## 8. 命令暴露策略

这部分是整个体系的硬约束。

## 8.1 用户主路径只允许最小命令集合

在首页、快速开始、安装后下一步、运行与托管总览等用户主路径中，默认只高频暴露：

- `npm i -g nextclaw`
- `nextclaw start`
- `nextclaw status`
- `nextclaw doctor`
- `nextclaw restart`
- `nextclaw stop`
- `nextclaw update`

## 8.2 场景页允许暴露场景命令

例如：

- 远程访问页可出现 `nextclaw login` / `remote enable`
- 自启动页可出现 `install-systemd`
- Secrets 页可出现 `secrets configure`

但这些命令应从属于场景，不应反向主导页面结构。

## 8.3 完整命令索引尽可能全

`commands.md` 必须尽可能完整覆盖公开 CLI：

- runtime
- service/autostart
- agent
- agents
- remote
- config
- secrets
- channels
- plugins
- marketplace
- cron
- skills

它的目标不是“少”，而是“可查”。

## 8.4 AI 自管理知识不进入公开主路径

完整的 Agent CRUD、自管理规则、JSON 输出约定、runtime discovery 建议等，应继续留在：

- `docs/USAGE.md`
- `packages/nextclaw/resources/USAGE.md`

公开站只在必要时给用户概念入口，不承担完整系统合同。

---

## 9. 真相源矩阵

为了防止未来再次漂移，必须明确每类知识的真相源。

| 内容类型 | 主真相源 | 是否进入公开站 | 说明 |
|---|---|---|---|
| 用户上手路径 | `apps/docs` | 是 | 公开站主责任 |
| 产品能力解释 | `apps/docs` | 是 | 面向用户 |
| 运行与托管说明 | `apps/docs` | 是 | 面向用户/高阶用户 |
| 完整命令索引 | `apps/docs/guide/commands.md` | 是 | 查询型参考 |
| AI 自管理完整命令合同 | `docs/USAGE.md` + `packages/nextclaw/resources/USAGE.md` | 否 | 公开站不承载完整合同 |
| 运行时内建 guide | `packages/nextclaw/resources/USAGE.md` | 否 | 包内事实源 |
| 设计/方案/治理 | `docs/plans` / `docs/designs` | 否 | 团队内使用 |
| 迭代记录/发布记录 | `docs/logs` | 否 | 交付留痕 |

---

## 10. 现有页面的最终归属与处理建议

这一节回答“每个现有文档具体怎么办”。

| 当前页面 | 最终模块 | 页面类型 | 建议动作 |
|---|---|---|---|
| `introduction.md` | 认识 NextClaw | Concept | 保留并进一步强化产品定位 |
| `getting-started.md` | 开始使用 | Quickstart | 保留，持续压缩为最短路径 |
| `after-setup.md` | 开始使用 | After Setup | 保留，做“价值闭环 + 长期可用分流” |
| `configuration.md` | 接入与配置 | Guide | 保留，聚焦用户配置 |
| `model-selection.md` | 接入与配置 | Guide | 保留 |
| `channels.md` | 接入与配置 | Guide | 保留 |
| `secrets.md` | 接入与配置 | Guide | 保留 |
| `tools.md` | 接入与配置 | Guide | 保留 |
| `chat.md` | 使用与自动化 | Guide | 保留 |
| `sessions.md` | 使用与自动化 | Guide | 保留 |
| `cron.md` | 使用与自动化 | Guide | 保留 |
| `runtime-hosting.md` | 运行与托管 | Overview | 保留并作为新宿主总览核心 |
| `background-autostart.md` | 运行与托管 | Runbook | 保留 |
| `remote-access.md` | 运行与托管 | Guide | 保留，职责更清晰 |
| `tutorials/docker-one-click.md` | 运行与托管 / 教程 | Tutorial | 保留，但由运行与托管总览导入 |
| `commands.md` | 参考与排错 | Reference | 保留为完整命令索引 |
| `core-commands.md` | 参考与排错 | Reference | 保留为用户核心命令页 |
| `troubleshooting.md` | 参考与排错 | Troubleshooting | 保留 |
| `advanced.md` | 进阶 | Advanced | 保留 |
| `multi-agent.md` | 进阶 | Advanced | 保留 |
| `tutorials.md` | 学习与资源 | Overview | 保留 |
| `resources.md` | 学习与资源 | Resource Hub | 保留 |
| `project-pulse.md` | 项目 | Project | 保留 |
| `roadmap.md` | 项目 | Project | 保留 |

---

## 11. 公开站与 `USAGE.md` 的边界规则

这是后续最容易再次漂移的地方，必须写死。

## 11.1 允许双写，但职责不同

例如自启动：

- 公开站负责解释“什么时候需要、各平台怎么选、去哪启用”
- `USAGE.md` 负责完整命令合同、flags、行为说明、自管理知识

双写允许，但两边职责不同。

## 11.2 不允许公开站被 `USAGE.md` 拖着跑

不能因为某个命令在 `USAGE.md` 很重要，就自动把它抬进公开站主路径。

判断标准永远是：

- 普通用户是否真的需要先知道这个才能成功

## 11.3 不允许公开站把完整命令合同做第二份影子真相源

公开站里的 `commands.md` 可以完整，但应维持“查询型参考”写法，不在公开站里重建一份更细的系统合同文档。

更细的合同继续留在 `USAGE.md`。

---

## 12. 世界级质量标准：每页必须满足什么

以后任何对外页面上线前，至少要过下面这套检查。

## 12.1 用户 5 秒判断测试

用户打开页面后 5 秒内，应该知道：

- 这页解决什么问题
- 这页是不是给我看的
- 我下一步该做什么

## 12.2 不跨页抢职责

页面必须知道自己“不负责什么”。

## 12.3 从用户任务出发，而不是从命令出发

页面首先回答目标，命令只是实现手段。

## 12.4 页面末尾必须形成下一步闭环

不能让用户看完后不知道去哪。

## 12.5 命名必须可预测

不能同类页面叫法混乱，今天叫“命令”，明天叫“CLI”，后天叫“参考”。

## 12.6 中英文结构必须一致

如果公开站是双语，那结构、导航、页面职责都应同步一致。

## 12.7 链接优先链接正确层级

例如：

- Quick Start 链接到 Core Commands / Runtime Overview
- 不应该优先把用户送去 Command Index

---

## 13. 对“世界级”的最终落地要求

如果要让 NextClaw 文档系统达到真正高标准，最终效果应该是：

### 13.1 新用户

打开文档站后，只需要理解：

- 怎么安装
- 怎么启动
- 怎么配置
- 怎么开始用
- 怎么让它更稳定

### 13.2 高阶用户

能顺畅找到：

- Docker
- `systemd`
- 自启动
- 远程访问
- 完整命令索引

### 13.3 AI / 系统链路

继续可以依赖：

- `docs/USAGE.md`
- `packages/nextclaw/resources/USAGE.md`

而不会因为公开站变得更用户化，就失去完整系统知识。

### 13.4 团队协作

以后新增一个文档需求时，不再出现：

- “这页该放哪？”
- “到底写 guide 还是 tutorial？”
- “命令要不要直接堆进去？”
- “这个到底放公开站还是放 USAGE？”

因为规则已经被设计文档提前定义了。

---

## 14. 结论

NextClaw 的文档系统，不应该继续沿着“页面逐步打补丁”的方式演化。  
它必须被当成产品入口系统来设计。

对外，它应该是：

- 面向用户的
- 任务流驱动的
- 渐进暴露的
- 结构清晰的
- 高阶能力可查但不打断主路径的

对内，它应该是：

- 页面类型清晰的
- 模块边界清晰的
- 真相源清晰的
- AI/公开站/内部设计文档分层清晰的

因此，NextClaw 世界级文档系统的总原则应明确为：

**公开站服务用户主路径，完整命令索引服务查询型参考，`USAGE.md` 服务 AI 与系统自管理，设计/日志服务团队交付；四层并存，但职责绝不混淆。**
