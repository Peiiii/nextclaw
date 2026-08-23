# Extension 管理与会话持续关注设计

> 状态：Design Ready
>
> 日期：2026-08-23
>
> 范围：全局 Extension 管理、会话级持续关注展示与基础管理
>
> 落地状态：已实现并完成定向验证

## 1. 结论

采用两个职责不同、但不新增平行管理体系的入口：

1. **全局 Extension 管理**：继续使用设置中的 Extension/插件/拓展管理，负责安装、更新、启用、停用和移除广义扩展能力。Extension 是否支持持续关注，只作为它能力声明的一部分。
2. **会话级持续关注管理**：在具体会话内展示该会话实际建立的 Context/Event 关系，并执行暂停、恢复和移除。

Extension 是可扩展能力的载体，会话持续关注是“某个会话调用 Extension 后建立的持续关系”。安装了 Extension 不代表任何会话已经关注了某个对象；只有 Agent 在会话中调用相关能力后，才产生会话级关系。

首版不新增专门的 Observation Provider 全局页面，也不复制 Extension 的安装、发现和生命周期管理。

用户界面统一使用“持续关注”，不直接暴露抽象的 “Observation”。在持续关注面板内，将两种关系分为两个可独立管理的分组：

- **状态**：对应 Context Binding，为会话继续运行提供最新状态；
- **事件**：对应 Event Subscription，符合条件的事件可以进入会话。

两组共享同一个会话范围和操作语义，但列表、计数和详情字段分别呈现，避免把“读取状态”和“接收事件”混成一个概念。

## 2. 当前事实

- Kernel 已有唯一的 `ObservationManager`，拥有 bind、subscribe、list、get、pause、resume、remove 语义。
- 持久状态中已有 `bindings`、`subscriptions`、`deliveries`，并保存状态、原因、创建/过期时间、Context 最近读取时间、事件抑制与投递状态。
- Observation 关系既可通过 `manage_observations` Agent 工具管理，也可在会话工作台和设置中的 Extension 页面查看；事件投递后还会作为会话时间线中的专用“外部事件”消息展示。
- 当前 UI 的会话 workspace 已有 overview、child sessions、project files、cron 等入口，持续关注可以沿同一会话工作区进入。
- 当前 Observation capability 是由 Extension manifest 发现的，Kernel 的 `discoverObservations` 返回 Extension 能力描述；全局能力继续复用 Extension catalog/runtime，不新增平行 Provider registry。
- Event Subscription 的跨会话修改目前不在 Agent 工具合同内，因此会话页只管理当前会话；全局 Extension 页不直接修改会话持续关注关系。

## 3. 用户任务与成功条件

用户有两个相邻任务：

- 在设置中管理“系统装了哪些 Extension、哪些 Extension 可用”；
- 在某个会话内确认“这个会话正在持续关注什么、为什么会被唤醒、现在是否正常”，并能暂停、恢复或移除关联关系。

成功条件：

- Extension 管理与会话持续关注边界清楚，不把“已安装扩展”和“已建立观察关系”混为一谈；
- 当前会话的状态/事件关系均可见，不同会话类型行为一致；
- 每条记录有可理解的名称、类型、状态、基本配置摘要和生命周期信息；
- 暂停、恢复、移除完成后界面立即反映结果，刷新后仍一致；
- 空、加载、错误和关系已失效时都有明确反馈；
- 前端不能读取或修改其它会话的持续关注关系。

## 4. 方案比较

| 方案 | 优点 | 代价 | 判断 |
| --- | --- | --- | --- |
| A. 新增专门的 Observation Provider 管理页 | 能集中展示 Observation 能力 | 和 Extension 管理重复；把 Extension 错误收窄成观察专用对象 | 不采用 |
| B. Extension 全局管理 + 会话持续关注面板 | 复用现有 Extension owner；清楚区分安装能力和会话关系；实现范围最小 | 全局页不会单独展示每个会话的 Observation 使用量 | **推荐**，符合当前架构和长期可扩展性 |
| C. 只在会话内展示持续关注 | 最简单 | Extension 的存在和会话关系容易被用户混淆；全局安装管理仍缺少统一说明 | 作为 B 的会话部分，不单独成立 |

## 5. 信息架构与交互

### 5.1 全局 Extension 管理

全局入口继续放在现有「设置」中的 Extension/插件/拓展管理，不新增 Observation 专属页面。Extension 列表可以在能力摘要中标记“支持持续关注”，但不把 Observation 作为 Extension 的唯一用途。

本轮落地的入口为「设置 → Extensions」：展示已发现 Extension、版本、运行状态、活跃使用数、渠道能力，以及状态/事件持续关注能力；页面不复制会话关系，也不暴露 Extension 的内部命令、环境变量或完整 manifest。

全局 Extension 页面负责：

- 安装、更新、启用、停用和移除 Extension；
- 查看 Extension 的通用能力、权限和运行状态；
- 进入 Extension 详情，了解它是否提供 Context/Event 观察能力。

Extension 的安装、发现、启动和通信仍归 Extension owner。持续关注 UI 不新建 `ProviderManager`、Provider registry 或第二套 Extension 生命周期。

### 5.2 会话级入口

在现有 workspace overview 中增加 **持续关注** 条目，位置跟随会话关系类内容。条目显示当前会话持续关注总数；没有关系时仍显示入口，帮助用户发现这项能力。异常关系的数量和原因进入面板后集中展示。

首版不额外增加会话 header 快捷入口，避免同一个入口在 workspace 外重复出现。后续若用户频繁从会话主区进入，可复用同一 navigation state 增加快捷方式，不新增页面。

### 5.3 持续关注面板

面板标题为“持续关注”，顶部显示当前会话名称/ID和汇总：总数、状态数量、事件数量、需要处理数量。

- **状态**：对应 Context 关系；每次继续会话时提供最新状态；
- **事件**：对应 Event 关系；符合条件的事件可以进入会话。

两个分组可以独立管理，但不拆成两个页面。每组按创建时间倒序排列；首版不提供搜索、排序和复杂筛选，因为这是单会话的关系列表，不是大规模资源目录。

### 5.4 记录内容与操作

每条会话持续关注关系显示：

- Extension 的名称和简短描述；没有名称时回退到 `extensionId`；
- 所属分组：状态或事件；
- 状态标签：运行中、已暂停、异常、已过期或不可用；
- 用户可理解的安全配置摘要，例如观察对象、项目或条件；
- 创建时间、过期时间（如有）；
- 状态关系显示最近读取时间；事件关系显示待处理、被抑制和投递失败数量。

配置是 Extension 观察能力的 opaque JSON，前端不直接解释业务结构，也不直接渲染完整配置。服务端返回一个受限的 `safeConfigPreview`：只保留少量顶层标量，敏感键（token、secret、password、cookie、apiKey、credential 等）统一掩码，长值截断；无法安全概括时显示“已配置”，避免把凭据泄漏到界面。

记录卡片直接展示描述、状态原因、生命周期和安全配置摘要，避免首版再引入详情 drawer。操作只有：

- active：暂停、移除；
- paused：恢复、移除；
- degraded/expired/broken：移除；只有 Kernel 明确允许恢复时才显示恢复。

移除属于不可逆关系变更，必须确认；暂停/恢复直接执行并在按钮上显示 pending。首版不提供“编辑配置”，配置变化统一由 Agent 重新建立关系，避免前端复制 bind/subscribe 的业务语义。

### 5.5 会话时间线中的事件消息

事件触发后沿用普通消息的会话时间线和持久化顺序，但保留 `service` 角色与通用的 `observation.event` 扩展片段，避免把外部事件误认成用户发言，也不把消息合同绑定到具体产品或协议品牌。前端将该片段投影为“外部事件”卡片，展示事件类型、来源 Extension、发生时间和事件 ID；payload 默认折叠，展开后查看，且受长度上限约束。事件本身不再是隐式的后台投递状态，用户可以在事件卡片和后续助手回复之间看到触发关系。

## 6. 数据与前端边界

只新增 session-scoped Observation 查询视图；全局 Extension 查询继续使用现有 Extension 管理入口，而不是把 Observation 状态塞进会话 summary：

```text
GET /api/ncp/sessions/:sessionId/observations
PATCH /api/ncp/sessions/:sessionId/observations/:kind/:id
  body: { action: "pause" | "resume" | "remove" }
```

服务端 controller 调用 Kernel `ObservationManager`，强制校验记录的 target session 等于 URL 中的 `sessionId`。查询结果是面向 UI 的 projection，包含 bindings、subscriptions、汇总以及每条关系的 Extension 信息和 safe preview；默认不返回事件 payload 和完整 delivery 历史，只返回当前会影响管理判断的计数/错误字段。

前端使用现有 React Query/API wrapper：

- `useNcpSessionObservations(sessionId)` 负责当前会话持续关注关系；
- `useNcpObservationAction(sessionId)` 负责暂停、恢复、移除；
- mutation 成功后只失效当前 session 的 observation query；不新增 Zustand 持久化状态；
- workspace business component 连接 query，展示组件只接收已经派生好的 view model。

这样 Extension/runtime 继续拥有全局 Extension 生命周期，ObservationManager/ObservationStore 继续拥有会话持续关注关系，API 只做 projection，UI 不建立第二个状态 owner。

## 7. 状态与异常矩阵

| 场景 | 用户看到什么 | 处理 |
| --- | --- | --- |
| 未打开持续关注面板 | workspace overview 的“持续关注”入口和数量 | 点击进入当前会话列表 |
| Extension 已停用 | 设置中的 Extension 状态明确；受影响会话显示 degraded/broken | 不把会话关系静默删除 |
| 无持续关注 | 空状态说明“此会话尚未建立持续关注” | 不显示无意义的禁用操作 |
| 加载中 | 保留面板 chrome，列表 skeleton | 不阻塞主会话 |
| 查询失败 | 面板内错误说明和重试 | 不把内部异常栈暴露给用户 |
| active/paused | 正常状态和对应操作 | 操作后重新拉取 authoritative state |
| degraded/broken/expired | 异常状态、原因和可行操作 | 不假装仍在运行 |
| 会话删除或失效 | 列表为空/返回 404 后关闭持续关注面板 | 不残留前端记录 |
| 刷新或重启宿主 | 以服务端持久状态重新加载 | 不使用前端缓存冒充恢复 |

## 8. 非目标与延后项

- 跨会话批量暂停、恢复或移除 Observation；
- 修改 Extension 配置并原地重订阅；
- 事件 payload 的独立时间线、回放、审计日志和趋势图；当前 payload 只随会话事件卡片按需展开。
- 自动诊断 Extension 权限、自动修复和重新授权向导；
- 为某种会话类型建立独立 Observation 数据模型或独立页面；
- 在 UI 中展示完整 opaque config 或凭据。

## 9. 最小验收标准

1. 设置中的 Extension 管理能明确展示 Extension 是否提供状态/事件能力，且不新增第二个全局 Observation 管理入口。
2. 在任意会话建立 Context 和 Events 后，会话 workspace overview 与“持续关注”面板都能显示对应关系及 Extension。
3. 面板的“状态”和“事件”分组可以分别浏览；两组的计数、字段和操作与 Kernel 状态对应。
4. Extension 异常或停用后，受影响会话显示 degraded/broken，而不是关系消失。
5. 暂停、恢复、移除后，列表、汇总和面板入口状态一致；刷新页面仍保持服务端结果。
6. Context 的 `lastReadAt`、Events 的待处理/抑制/错误信息与 Kernel 状态对应。
7. 空、加载、错误、过期/损坏关系和移除确认路径均可操作。
8. 使用其它 `sessionId` 访问或操作记录被服务端拒绝；Extension 全局管理不能越权修改其它会话的关系。
9. 事件触发后在会话时间线中可见为“外部事件”卡片，并能展开查看受限 payload；未识别的扩展片段不会再被静默过滤。
