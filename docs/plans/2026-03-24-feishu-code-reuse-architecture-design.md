# NextClaw 飞书能力复用与架构设计

## 文档目的

这份文档回答的不是“要不要对齐飞书官方插件能力”，而是：

在 NextClaw 以 AgentOS 为目标、同时要求`最佳可维护性`、`最低新增复杂度`、`最大化复用飞书官方实现`的前提下，我们应该如何吸收飞书官方插件的实现。

设计基线：

- 能直接复用的代码，尽量直接复用或最小改造后复用
- 一旦代码已经强耦合 OpenClaw 生命周期、配置模型、trace/runtime、plugin-sdk，就不能硬搬
- 高价值能力必须纳入路线图，但优先以可持续的抽象方式落地

上位判断见：[飞书官方插件的 AgentOS 视角评估](./2026-03-24-feishu-agentos-evaluation.md)

## 结论先行

结论很明确：

1. 飞书官方插件里`大部分能力代码是可迁移的`
2. 不能直接拿来用的，主要是少量 OpenClaw 接壳层
3. 对 NextClaw 最优的方案不是“整体依赖官方包”，也不是“全部重写”，而是：

`以官方插件为 upstream reference，做选择性代码吸收`

具体策略：

- 纯飞书层：优先复制逻辑，最小改造
- 半耦合层：保留核心算法，重写适配层
- 强耦合层：只参考设计，不复制实现

## 官方包审计结论

基于 `@larksuiteoapi/feishu-openclaw-plugin@2026.3.8` 的实际拆包结果：

- 包本身是 MIT 协议，可合法复用，但应保留版权头与来源说明
- 它已经分成几个相对清晰的层：
  - `src/core/*`
  - `src/messaging/*`
  - `src/tools/oapi/*`
  - `src/tools/oauth*`
  - `src/channel/*`

一个非常关键的发现是：

`真正直接 import "openclaw/plugin-sdk" 的 JS 文件只有少数几类`

主要包括：

- `src/channel/plugin.js`
- `src/channel/config-adapter.js`
- `src/channel/onboarding.js`
- `src/messaging/inbound/dispatch.js`
- `src/messaging/inbound/handler.js`
- `src/messaging/outbound/actions.js`
- `src/card/reply-dispatcher.js`
- 少量 IM resource 工具
- `src/core/accounts.js`

这说明：

- 官方插件的“飞书能力层”大体上是可搬的
- 被 OpenClaw 绑死的主要是“插件生命周期接入层”

## 复用分层

### A 类：可直接吸收的纯飞书层

这类代码主要依赖飞书 SDK、自身数据结构、少量通用依赖，不深度绑定 OpenClaw 运行时。

优先吸收对象：

- `src/core/lark-client.js`
  - 飞书 SDK client 创建、brand/domain 解析、header 注入、缓存管理
- `src/core/config-schema.js`
  - 飞书配置模型和 cross-field 校验
- `src/tools/oapi/*`
  - calendar / task / bitable / sheets / wiki / drive / chat 等大量 OAPI 工具
- `src/messaging/converters/*`
  - 飞书消息类型解析和内容转换
- 部分 card builder / markdown formatter

这类代码的特点：

- 核心逻辑本质上是“调飞书 API + 参数转换 + 结果格式化”
- 并不依赖 OpenClaw 的 agent orchestration 才能成立

对这类代码的策略：

- 可以直接复制逻辑
- 允许前期保留较接近 upstream 的文件结构
- 但进入 NextClaw 后，应逐步收敛到 TypeScript、现有命名规范、现有测试规范

换句话说：

`允许 copy in，但不允许永远保持“外来 compiled JS 黑盒”状态`

## B 类：可保留核心逻辑，但必须重写薄适配层

这类代码有较强价值，但外围接壳方式已经是 OpenClaw 风格。

优先对象：

- `src/core/tool-client.js`
- `src/tools/helpers.js`
- `src/tools/oauth.js`
- `src/tools/oauth-batch-auth.js`
- `src/card/reply-dispatcher.js`
- `src/core/accounts.js`

这类代码的问题不是“逻辑不好”，而是它们默认站在 OpenClaw 的世界里：

- 配置路径是 OpenClaw 的
- trace context 是 OpenClaw 的
- 错误恢复、scope 检查、runtime 注入是 OpenClaw 的
- tool registration contract 是 OpenClaw 的

因此这里的正确策略不是整文件复制，而是：

1. 保留内部策略与算法
2. 重写入口和上下文注入方式
3. 让这些模块只依赖 NextClaw 的抽象

例如：

- `ToolClient` 的核心价值在于：
  - 统一 TAT/UAT 选择
  - scope 校验
  - token 管理
  - invoke 封装

这些都值得保留。

但它不应继续依赖：

- OpenClaw trace context
- OpenClaw config 结构
- OpenClaw error model

我们应该把它改成：

- `NextclawFeishuClient`
- `NextclawFeishuAuthContext`
- `NextclawFeishuScopeGuard`

让“策略复用”和“壳层解耦”同时成立。

## C 类：只参考设计，不直接复制的强耦合层

这类代码与 OpenClaw 产品壳层绑定过深，不值得为了“少写一点”直接搬运。

主要包括：

- `src/channel/plugin.js`
- `src/messaging/inbound/dispatch.js`
- `src/messaging/inbound/handler.js`
- `src/messaging/outbound/actions.js`
- `src/channel/onboarding.js`
- `src/channel/config-adapter.js`

原因：

- 这些模块直接绑定 OpenClaw 的 channel plugin contract
- 会话历史、reply dispatch、pairing、directory、CLI command、diagnose command 都按 OpenClaw 结构组织
- 即使复制进来，也会把 NextClaw 反向拖向 OpenClaw 的模型

这里最好的做法是：

- 学它的职责切分
- 不学它的壳层接口

## 推荐架构

为了兼顾维护性和复杂度，建议只引入`一个新的飞书平台层包`，不要一口气拆很多包。

推荐新增：

- `packages/extensions/nextclaw-feishu-core`

职责：

- 飞书账号与 client 管理
- OAuth / token / scope 能力
- 飞书 OAPI 能力封装
- 消息转换器
- card builder / formatter
- 平台能力服务：document / storage / structured-data / schedule / task / identity

现有包职责调整如下：

- `packages/extensions/nextclaw-channel-runtime`
  - 只保留渠道接入、消息 ingress/egress、session routing、channel-specific runtime glue
- `packages/extensions/nextclaw-channel-plugin-feishu`
  - 只保留 OpenClaw-compatible 壳层导出
- `packages/nextclaw-server` 或未来统一 tool/runtime 层
  - 调用 `nextclaw-feishu-core` 暴露管理能力和工具能力

这样做的原因：

1. 不把“飞书工作面能力”塞进 channel runtime
2. 不新增过多中间层
3. 飞书消息面和飞书工作面共享同一套 auth/client/account 基础设施
4. 未来接别的平台时，可以复用工作面抽象，而不是复用飞书壳层

## 通用抽象建议

飞书能力吸收时，不应直接以“飞书产品名”作为顶层能力模型，而应先落入 NextClaw 的通用工作面：

- `messaging`
- `document`
- `storage`
- `structured-data`
- `schedule`
- `task`
- `identity`

飞书只是这些工作面的一个 provider。

这能带来两个直接收益：

1. 飞书实现不会污染上层产品抽象
2. 后续接 Google Workspace / Notion / Slack / GitHub / Jira 时，不需要再推翻一次模型

## 代码吸收策略

### 策略 1：不把官方包作为生产依赖

不建议让 NextClaw 运行时直接依赖 `@larksuiteoapi/feishu-openclaw-plugin`。

原因：

- 它的公共入口就是 OpenClaw plugin contract
- 升级会把 NextClaw 绑到 OpenClaw 的接口波动
- 出问题时很难局部替换

正确方式是：

`把它当 upstream source，不当 runtime dependency`

### 策略 2：采用“复制后持有”的 ownership 模式

对于 A/B 类模块：

- 首次引入时允许直接复制逻辑
- 保留 upstream 来源说明
- 一旦进入 NextClaw 仓库，就由 NextClaw 负责后续维护

不要做：

- 运行时动态桥接官方包内部实现
- 用大量 wrapper 包一层层转接 upstream 内部文件

这种方式短期看省事，长期看最难维护。

### 策略 3：以“最小可工作的整块吸收”代替“碎片拼装”

比如：

- 日历能力就整块吸收 `calendar/*`
- 任务能力就整块吸收 `task/*`
- 表格能力就整块吸收 `bitable/*` + `sheets/*`

而不是每次只抠一个 API 方法出来拼接。

因为：

- upstream 已经做过参数模型和错误处理
- 整块吸收的上下文更完整
- 后续升级和 diff 更容易

## 分阶段落地建议

### Phase 0：源代码吸收准备

- 固定 upstream 参考版本
- 建立来源清单
- 标注 A/B/C 三类文件
- 明确 license header 保留方式

### Phase 1：先搭 `nextclaw-feishu-core`

优先吸收：

- client / accounts / config-schema
- tool-client 核心逻辑
- OAuth / token / scope 基础设施

目标：

- 先让飞书平台层能独立存在

### Phase 2：补强消息面

优先补：

- 入站 richer parsing
- 媒体收发
- thread/topic
- 流式 card
- route / account / session glue

目标：

- 先把飞书作为强入口做完整

### Phase 3：补工作面

优先顺序：

1. document / wiki / drive
2. structured-data：bitable / sheets
3. schedule / task

目标：

- 从“消息入口”升级到“工作面入口”

### Phase 4：通用能力抽象

等飞书路径稳定后，再把共性上提成通用 provider surface。

注意：

`不要在飞书能力还没跑顺之前过早抽象`

## 风险与防线

### 风险 1：把 OpenClaw 壳层一起搬进来

后果：

- NextClaw 架构边界被污染
- 未来维护时不断出现 “这段到底是 OpenClaw 逻辑还是 NextClaw 逻辑”

防线：

- 严格按 A/B/C 三类处理

### 风险 2：为了“保持 upstream 一致”而长期保留外来代码风格

后果：

- 仓库内部风格断裂
- 后续改动成本越来越高

防线：

- 允许 bootstrap 期复制
- 一旦进入主线，就按 NextClaw 风格持续归一

### 风险 3：过早抽象成全平台通用层

后果：

- 复杂度上升
- 真正飞书能力迟迟落不了地

防线：

- 先有 `nextclaw-feishu-core`
- 后有跨平台通用面

## 当前推荐决策

推荐立即执行的不是“写飞书全部功能”，而是：

1. 确认 upstream 固定版本和来源清单
2. 建立 A/B/C 分类清单
3. 设计并落地 `nextclaw-feishu-core`
4. 先做消息面 P0
5. 再逐块吸收文档 / 表格 / 日历 / 任务能力

## 下一步产物

这份文档之后，建议马上新增两份执行文档：

1. `飞书官方插件文件级吸收清单`
内容：
- 哪些文件归 A/B/C
- 每个文件的处理方式
- owner

2. `nextclaw-feishu-core implementation plan`
内容：
- 包结构
- 首批要落的模块
- 验证计划
- 每阶段验收标准
