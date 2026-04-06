# Session-Agent Binding And Cron Target Design

## 背景

当前多 Agent 的第一阶段已经成立：

- Agent profile / avatar / home directory 已成立
- UI 草稿态已经可以选择 Agent
- 会话列表与会话头部已经可以展示 Agent

但核心闭环还没有真正完成：

- 新会话创建时，草稿态选择的 Agent 还没有被正式固化到会话模型里
- cron 任务也还没有正式表达“这条任务归哪个 Agent 执行”

于是现在会出现一个语义落差：

- 用户界面看起来已经在“选择和谁对话”
- 但领域模型里，这个“谁”还不是一等字段

本方案只解决这个问题域：

- 会话归属哪个 Agent
- cron 归属哪个 Agent
- 默认 Agent 如何解析

不扩展到群聊、mention、运行时切换、Agent 编排网络等后续问题。

## 愿景对齐

NextClaw 的目标是成为 AI 时代的个人操作层，而不是功能垃圾场。

这意味着多 Agent 设计必须满足：

- 语义清晰
- 可预测
- 可维护
- 可扩展
- 不把领域语义偷偷塞进技术细节

“会话属于哪个 Agent” 是明确的产品语义和领域语义，因此它应该在领域模型里被正式表达，而不是编码进某个 ID 格式里。

## 目标

建立一个统一且长期稳定的规则：

1. 新会话 / session spawn 支持可选 `agentId`
2. cron 任务支持可选 `agentId`
3. 不传时走默认 Agent
4. 一旦创建完成，会话或任务的 Agent 归属固定
5. `agentId` 成为一等字段，不依赖 `sessionKey` 承载该语义

## 非目标

- 不支持对已创建会话中途切换 Agent
- 不支持消息级临时切换 Agent
- 不设计群聊 Agent 选择规则
- 不设计 mention / alias 体系
- 不引入第二套真相源

## 核心判断

### 1. `agentId` 应该是可选参数

这是产品上最自然的设计。

原因：

- 用户不需要每次都显式指定
- AI 也不应该被强迫每次都传
- 默认逻辑应该稳定且可预测

因此新会话、spawn、cron 都统一支持：

```ts
agentId?: string
```

含义：

- 显式传值：使用指定 Agent
- 缺省：解析默认 Agent

### 2. 默认值不应该是写死 `"main"`，而应该是“默认 Agent”

今天默认 Agent 基本等价于 `main`，但产品语义上它不应该写死成某个字符串常量。

正确表达应是：

- 缺省 `agentId` => 解析默认 Agent
- 如果系统没有额外配置，则默认 Agent 自然退化为 `main`

这能保证：

- 产品语义正确
- 未来可演进
- 代码里不会到处散落 `"main"` 这种硬编码

### 3. `sessionKey` 只是标识符，不承载 Agent 语义

这是本方案最关键的决定。

`sessionKey` 的职责应该是：

- 标识一条会话

不应该承担：

- 表达该会话归属哪个 Agent

也就是说，我们明确拒绝下面这种设计成为主方案：

- `agent:<agentId>:...`
- 从 `sessionKey` 里解析 `agentId`

原因：

- 这会把领域语义塞进 ID 格式
- 会增加耦合
- 会让后续迁移、重命名、模型演进变得别扭
- 会破坏“ID 只是 ID，业务字段就是业务字段”的边界

### 4. `session.agentId` 才是会话归属的唯一真相源

正确的领域模型应该是：

- `session.key`：会话标识符
- `session.agentId`：这条会话归哪个 Agent

即：

- `sessionKey` 不猜 Agent
- UI 不从 key 推导 Agent
- 运行时也不从 key 推导 Agent

谁负责这条会话，应该直接读字段。

### 5. `cron.agentId` 也应成为正式字段

cron 的产品语义和会话一致：

- 一件事最终由某个 Agent 执行

因此 cron 也应正式表达这一点，而不是在执行时偷偷回落到主 Agent。

## 已否决方案

### 方案：把 `agentId` 编进 `sessionKey`

示例：

```txt
agent:engineer:ui:direct:web-abc123
```

否决原因：

- `sessionKey` 被迫承担业务语义
- 会话归属和 ID 格式强耦合
- 前端、后端、适配层都要学习同一套 key 结构
- 将来如果想调整归属表达方式，需要连 ID 体系一起动
- 这不是解耦，而是把业务字段藏进字符串协议

因此该方案不作为正式架构。

## 正式方案

## 一、会话模型

### 会话数据结构

会话需要正式拥有：

```ts
type Session = {
  key: string
  agentId: string
  ...
}
```

其中：

- `key` 是 opaque id
- `agentId` 是归属字段

`agentId` 是唯一真相源。

### 新会话创建

会话创建相关入口统一支持：

```ts
createSession({
  agentId?: string
})
```

规则：

1. 若显式传 `agentId`，直接使用它
2. 若未传，则解析默认 Agent
3. 创建 session record 时，把最终 `agentId` 正式写入会话字段
4. `sessionKey` 正常生成，不携带 Agent 语义

### session spawn

spawn 与新会话保持完全一致：

```ts
spawnSession({
  agentId?: string
})
```

其职责不是“生成特殊格式的 key”，而是“创建一条归属于某个 Agent 的会话”。

### 草稿态

保留现有：

- `selectedAgentId`

但重新定义其语义：

- 它只表示“当前草稿态准备发起给哪个 Agent”
- 它不是已创建会话的真相源

草稿态可以切换 Agent。

一旦草稿 materialize 成正式 session：

- `selectedAgentId` 被写入 `session.agentId`
- 后续该会话的 Agent 归属只读会话字段

### 已创建会话

已创建会话不支持中途切换 Agent。

原因：

- 会话上下文已经建立
- 归属切换会引入上下文所有权混乱
- 产品语义上，一条会话就是在和某个 Agent 对话

如果用户要换对象，应该新建会话，而不是在原会话内换人。

## 二、Cron 模型

### 数据结构

cron job 也应正式拥有 Agent 归属字段：

```ts
type CronJob = {
  id: string
  ...
  payload: {
    message: string
    agentId?: string
    ...
  }
}
```

或者等价地提升到 job 顶层字段也可以，但本次优先选择最小语义增量：

- 放在 cron payload 内

因为它表达的是：

- 这条执行任务的目标 Agent

### 创建规则

cron add 支持：

```ts
agentId?: string
```

规则：

1. 显式传值：使用指定 Agent
2. 缺省：解析默认 Agent
3. 创建 job 时正式写入该字段

### 执行规则

调度触发时：

1. 读取 job 的 `agentId`
2. 若为空，则解析默认 Agent
3. 使用该 Agent 的上下文执行任务

注意：

- 不允许再默认偷偷落回主 Agent
- 运行时必须消费字段，而不是猜测

## 三、默认 Agent 解析

系统应有统一 helper：

```ts
resolveDefaultAgentId(...)
```

规则统一为：

1. 若存在 `default: true` 的 Agent，取它
2. 否则取 `main`

这个 helper 应成为唯一入口，避免：

- 前端自己猜一套
- 后端自己猜一套
- CLI 再猜一套

## 四、前端交互规格

### 草稿态

当前聊天页仍然保持轻量：

- 草稿态允许选择 Agent
- 位置仍在欢迎态 / 引导区
- 不放在持续存在的输入框底部

原因：

- 输入框底部意味着“可以随时切换”
- 这会和“已创建会话归属固定”的规则冲突

### 会话创建

当用户在草稿态发出第一条消息时：

1. 根据草稿态选中的 Agent 决定 `agentId`
2. 创建正式 session
3. 把 `agentId` 写入 session
4. 后续页面读取该 session 的 `agentId`

### 会话列表

会话列表展示 Agent 信息时，应直接读取：

- `session.agentId`

然后再去关联 Agent profile：

- displayName
- avatar

不是从 `sessionKey` 猜。

### 会话详情头部

会话头部同理：

- 直接根据 `session.agentId` 展示 Agent

## 五、CLI / API 规格

### Session spawn

CLI / API 支持：

```bash
nextclaw sessions spawn --agent engineer
```

也支持不传：

```bash
nextclaw sessions spawn
```

语义：

- 不传 => 默认 Agent

### Cron add

CLI / API 支持：

```bash
nextclaw cron add --name daily-review --message "review inbox" --cron "0 9 * * *" --agent engineer
```

也支持不传：

```bash
nextclaw cron add --name daily-review --message "review inbox" --cron "0 9 * * *"
```

语义同样是：

- 不传 => 默认 Agent

### AI 自管理

因为 `nextclaw` CLI 会暴露完整能力，所以 AI 可以自然学会：

- 创建 Agent
- 创建指定 Agent 的新会话
- 创建指定 Agent 的 cron

这也符合我们之前的产品判断：

- 优先通过产品能力暴露功能
- 让 AI 直接能操作产品

## 六、实现原则

### 原则 1：删除 key-based Agent 语义

若现有代码里存在：

- 从 `sessionKey` 推导 `agentId`
- 依赖 key 前缀表示 Agent

这类逻辑都应被视为待删除对象，而不是继续扩散。

### 原则 2：字段优先，metadata 次之

若某条信息已经是正式领域字段，就不要把它只放在 metadata。

metadata 可以镜像，但不能成为主语义层。

### 原则 3：默认逻辑强，分支少

不做过多选择型配置，不弹额外确认，不引入多套模式。

规则就是：

- 可传 `agentId`
- 不传走默认 Agent

### 原则 4：前后端同一语义

前端、CLI、后端、调度器都必须共享同一套规则：

- 会话归属字段化
- cron 归属字段化
- 默认 Agent 统一解析

## 七、实施建议

按下面顺序推进：

1. 会话模型正式补 `agentId`
2. 新会话创建 / spawn 入口补 `agentId?: string`
3. 前端草稿态在 materialize 时写入该字段
4. UI 展示链路改为读取 `session.agentId`
5. 删除前端从 `sessionKey` 推导 Agent 的逻辑
6. cron payload 正式补 `agentId?: string`
7. cron CLI / 调度执行链路贯通

## 八、验收标准

满足以下条件才算闭环：

1. 草稿态选择 Agent 后，首条消息创建出的正式 session 带有正确 `agentId`
2. 会话列表和会话头部展示的 Agent 来自 session 字段，而不是 key 推导
3. `session spawn` 可以显式指定 Agent，也可以缺省走默认 Agent
4. `cron add` 可以显式指定 Agent，也可以缺省走默认 Agent
5. cron 触发时实际使用的是 job 绑定的 Agent
6. 代码主链中不再把 `sessionKey` 当作 Agent 归属真相源

## 九、结论

这次多 Agent 设计在这个问题域上的最终结论是：

- Agent 归属是领域字段，不是 ID 格式
- `session.agentId` 是会话归属唯一真相源
- `cron.payload.agentId` 是定时任务归属正式字段
- `sessionKey` 只是标识符，不承载 Agent 语义

这套设计更轻、更清晰、更自然，也更符合 NextClaw 作为长期基础设施与统一入口产品的方向。
