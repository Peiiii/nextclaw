# Competitive Leaderboard App Design

## 目标

在 `apps/competitive-leaderboard` 落成一个“龙虾类产品研究榜单”应用，但它不是 NextClaw 的单向宣传页，而是一个长期可更新、以公开证据为核心的研究型索引站。

这个方向与 [NextClaw 产品愿景](../VISION.md) 对齐的地方在于：

- 它服务的是“统一入口与能力编排”的外部解释框架，而不是继续往主产品里塞功能。
- 它帮助用户理解“个人 AI 操作层”这一产品形态，而不是只看单个功能点。
- 它让 NextClaw 以被评对象身份出现，而不是预设结论的营销主角。

## 这次回炉后明确放弃的东西

上一版里最不可信的部分已经被明确放弃：

- 不再使用主观 `rawScore`
- 不再用 persona 权重去强行制造分榜
- 不再把 chat UI、workflow builder、workspace assistant 硬塞进同一总榜
- 不再引用仓库里的内部对比/宣传文档作为证据源

第一性原则只有一条：

> 如果公开证据不够，就不打分；如果产品不是同类，就不混排。

## 类目定义

这里的“龙虾类产品”不是泛指所有 AI 应用，而是更窄的一类：

- 官方主定位是 `personal AI assistant`、`personal AI OS`、长期自持 AI 入口、长期 agent 入口，或高度相近的产品表达
- 用户心智是“我在用一个长期 AI 助手 / AI 入口 / AI 操作层”，而不是“我在搭一个平台”或“我在用一个 chat UI”
- 产品通常同时具备以下若干能力：
  - 本地或自托管
  - 多渠道或多入口
  - 工具 / 技能 / 插件扩展
  - 后台任务 / 自动化
  - 记忆 / 个性化
  - 控制台 / Web / 桌面入口

## 分层模型

### Core Comparable

只有真正能和“个人 AI 助手 / AI OS / 长期 agent 入口”直接比较的产品进入这一层，并参与统一总榜。

当前核心样本：

- NextClaw
- OpenClaw
- QwenPaw
- Hermes Agent
- ZeroClaw
- PicoClaw
- IronClaw
- Leon

### Watch

这一层保留龙虾类生态里的直接衍生物、fork、wrapper、轻量重实现，以及“形态成立但更边界 / 更早期 / 更窄场景”的样本，用来观察生态走向，但不进入统一总榜。

当前观察层样本：

- Sentient
- OpenDAN
- zclaw
- ClawX
- OpenLobster
- n8nClaw

## 纳入标准

每个产品都按 5 个公开可核验条件做纳入判断：

1. 官方是否明确把自己定义为个人 AI 助手 / AI OS
2. 是否是独立入口产品，而不是 builder / chat UI / suite 附属功能
3. 是否明确支持本地或自托管
4. 是否明确存在行动层：工具、自动化、任务执行、外部连接等
5. 是否存在官方仓库、官网或官方文档可供核验

规则：

- `core`：必须满足“独立入口 + assistant / AI OS 心智”，并且足够适合作为主流同类产品统一比较
- `watch`：保留直接衍生物、fork、wrapper、轻量重实现，以及边界型 / 早期型 / 窄场景样本
- 证据不足或形态不清时，宁可保守降级，也不硬进总榜

## 评分模型

统一总榜只对 `core` 层计算，满分 100：

### 1. 公共信号：40 分

- GitHub stars：18 分
- GitHub forks：8 分
- 最近活跃度：6 分
- 官方 docs 是否存在：4 分
- 开源许可证是否清晰：4 分

这一部分只看公开可量化指标，不掺主观判断。

### 2. 能力覆盖：60 分

10 个能力项等权，每项 6 分：

- 本地或自托管控制
- Web / 控制台入口
- 多渠道触达
- 语音能力
- 定时或后台自动化
- 工具 / 技能 / 插件扩展
- 记忆与个性化
- 任务执行能力
- 多环境部署
- 官方文档与上手路径

单项打分规则：

- `yes` = 6 分
- `partial` = 3 分
- `no` = 0 分

## 证据模型

本次实现把“证据”放在数据结构中心，而不是后置补充：

- 每个产品都有官方来源列表
- 每个产品都有证据条目列表
- 每个纳入判断和能力项都挂接证据 id
- 没有官方公开证据的能力默认不给分

可接受证据源：

- 官方 GitHub repo / README
- 官方 docs
- 官方网站
- GitHub API 的 repo 元数据

明确排除：

- 仓库里的内部宣传文档
- 社区二手总结
- 无法回溯到官方来源的能力描述
- 已审查但不纳入当前总榜的典型大厂产品，如：
  - 腾讯元器：官方定义更接近智能体创建 / 分发平台
  - 通义 APP：当前公开形态更像闭源消费助手集合，不具备与自托管龙虾类产品对称比较的公开边界
  - 有道云笔记 AI 工具：官方明确属于云笔记宿主内的 AI 工具箱

## 页面结构

当前页面结构改为 6 大块：

1. Hero
   先解释榜单不是营销页，而是研究索引。
2. Universe Map
   先把 core 和 watch 层画清楚。
3. Core Leaderboard
   只对 core 层做统一总榜。
4. Scoreboards
   把“公共信号榜”和“能力覆盖榜”拆开展示。
5. Product Profiles
   展示每个产品的定位、适用人群、风险提醒和来源。
6. Evidence Drawer + Methodology
   点开后直接看纳入判断、能力矩阵、公开指标与证据条目。

## 数据与实现结构

### 服务端

- `CompetitiveLeaderboardDataService`
  - 负责装载产品种子、方法论、披露和变更记录
- `CompetitiveLeaderboardScoringService`
  - 负责公共信号计算、能力覆盖计算、统一总榜与榜单分解

### 数据文件

- `server/leaderboard-products.data.ts`
  - 当前版本的研究数据底座
- `server/leaderboard-methodology.data.ts`
  - 方法论、版本和 changelog

### 前端

- `UniverseMap`
- `RankingBoard`
- `SubRankingBoard`
- `ProductProfileGrid`
- `EvidenceDrawer`
- `MethodologyPanel`

前端只负责展示，不再承载评分逻辑。

## 已知限制

- 当前 universe 仍是人工维护的研究快照，不是自动抓取管线
- 证据覆盖已经足够支撑第一版，但并不等于“行业最终名单”
- `leaderboard-products.data.ts` 仍然偏长，本次先以可信数据完整度优先；后续可以继续按层拆分
- 非龙虾类但常被拿来比较的产品，当前版本已经主动移出这张榜，而不是继续留在 universe 中制造误导

## 为什么这版更可信

与上一版相比，这版可信度提升主要来自四点：

1. 先定义 universe，再定义总榜，而不是先排分
2. 先用官方公开资料确定类目边界，再做能力判断
3. 先拆出公共信号和能力覆盖，再谈综合分
4. NextClaw 只是被评对象之一，不再预设它一定排第一
5. 连“已审查但排除”的大厂产品也公开写出来，而不是装作没看见

## 后续演进

下一步若继续做，不应马上加更多视觉花样，而应优先补这三件事：

1. 继续扩充真正属于龙虾类生态的 watch universe
2. 把数据文件按 `core` / `watch` 进一步拆模块
3. 逐步引入半自动更新的 GitHub 指标采集，而不是手工维护全部公共信号
