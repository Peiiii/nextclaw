# Sessions Spawn Unification Plan

## 背景

当前 NCP 会话编排同时暴露了 `spawn`、`sessions_spawn`、`sessions_request` 三个入口。

其中：

- `spawn` 表示“创建 child session + 立即发任务 + 等最终回复 + 自动恢复源会话”
- `sessions_spawn` 表示“只创建 standalone session”
- `sessions_request` 表示“向已有 session 发起一轮 request”

这套分工在底层上是成立的，但在 AI-facing 工具表面上有两个问题：

1. `spawn` 和 `sessions_spawn` 名称高度相似，却又不是简单别名，模型选择成本高。
2. “创建 child session” 这件事被拆成了单独工具名，而不是统一在 session creation 语义里表达，产品体验不够统一。

## 长期目标对齐 / 可维护性推进

- 这次改动是在增强 NextClaw 作为统一入口的地位，而不是继续堆一个局部补丁。统一 session creation 入口，比继续保留两个近义工具更符合“统一体验优先”。
- 这次优先推进的是“删一个入口，而不是再加一层兼容壳”。目标是删除 `spawn` 这个 AI-facing 工具名，把 child session 也收进 `sessions_spawn`。
- 删不掉的部分是“request 完成后当前会话要不要继续”这层语义，因为它不是会话关系本身，而是一次 request 的完成策略；这部分继续显式保留，但收敛成更直接的 `notify: "none" | "final_reply"` 参数表达。
- 本次最小维护性推进点是：删除 `spawn` 注册、删除 `spawn` 提示文案、删除 `spawn` 专属前端判定，把“是否 child”“是否立即请求”都收敛进一个工具结果模型。

## 现状问题

### 1. 对外工具模型割裂

- `spawn` 是 child-session shortcut
- `sessions_spawn` 是 standalone session creation
- `sessions_request` 是 request primitive

AI 需要先判断“这是不是 child”“是不是要立即开跑”“是不是要恢复当前会话”，然后再在两个近义名字之间做选择。这不符合“意图优先”。

### 2. child 关系表达不统一

当前系统内部已经通过 `parentSessionId` 表达父子关系，但对外工具层仍用独立工具名 `spawn` 来表达“这是 child session”。这会让产品语义停留在历史术语上，而不是会话树模型本身。

### 3. 前端右侧 child session 面板绑定在旧入口心智上

此前右侧 child session 面板主要跟随 `spawn` 结果打开。删除 `spawn` 后，前端必须改成根据“本次 `sessions_spawn` 结果是否指向 child session”来决定是否走右侧面板，而不是再依赖旧工具名。

## 目标

1. 删除 AI-facing 的 `spawn` 工具。
2. 将 child session creation 收敛为 `sessions_spawn(scope="child")`。
3. 让 `sessions_spawn` 可选支持“创建后立刻发起首轮 request”。
4. 保持 `sessions_request` 继续作为独立 primitive，负责对既有 session 发起后续 request。
5. 前端 child session 右侧面板改为跟随 `sessions_spawn` 的 child 结果，而不是跟随旧 `spawn` 名称。

## 非目标

- 不重做 session tree 存储模型。
- 不新增 `parent_session_id` 作为 AI-facing 参数。
- 不把 `sessions_request` 删除或折叠进 `sessions_spawn`。
- 不为旧 `spawn` 保留长期并行注册。

## 新 contract

### sessions_spawn

`sessions_spawn` 升级为统一的 session creation 工具：

```ts
sessions_spawn({
  scope?: "standalone" | "child",
  task: string,
  title?: string,
  model?: string,
  runtime?: string,
  agentId?: string,
  request?: {
    notify: "none" | "final_reply",
  },
})
```

语义：

- `scope` 省略或为 `standalone`：创建普通 session
- `scope = "child"`：创建当前 session 的 child session
- `request` 省略：只创建 session，不立即发起 request
- `request` 存在：创建 session 后，立即将顶层 `task` 作为首轮 request 发送给该新 session
- 若 `scope = "child"` 且 `request.notify = "final_reply"`，则行为等价于旧 `spawn`

说明：

- 顶层 `task` 继续保留为必填，兼容当前 `sessions_spawn` 的“用 task 生成标题”行为
- 当存在 `request` 时，这个 `task` 同时也是首轮 request 的任务文本
- `title` 用于覆盖默认标题；若省略，则继续由 `task` 生成摘要标题

### sessions_request

`sessions_request` 不改语义，继续用于：

- 向已有 session 发起后续 request
- 复用既有 standalone session
- 复用已存在的 child session

## 返回值规则

### 1. 只创建 session

返回：

```ts
{
  kind: "nextclaw.session",
  sessionId: string,
  isChildSession: boolean,
  parentSessionId?: string,
  lifecycle: "persistent",
  title: string,
  sessionType: string,
  createdAt: string,
}
```

### 2. 创建 session 并立即发起 request

返回：

```ts
{
  kind: "nextclaw.session_request",
  requestId: string,
  sessionId: string,
  isChildSession: boolean,
  parentSessionId?: string,
  spawnedByRequestId?: string,
  task: string,
  status: "running" | "completed" | "failed",
  notify: "none" | "final_reply",
}
```

也就是说：

- `sessions_spawn` 的返回 kind 取决于是否带 `request`
- 前端不应该再用“工具名是不是 `spawn`”来决定 session 行为
- 前端应该根据返回结果里的 `kind / isChildSession / parentSessionId` 判定展示与打开方式

## 错误规则

- 若 `scope` 非 `standalone | child`，直接报错
- 若 `request` 存在但 `notify` 不是 `"none" | "final_reply"`，直接报错
- 若 `scope = "child"` 但当前调用上下文缺少 source session id，直接报错
- 不支持通过参数任意指定 `parent_session_id`

## 后端实现方案

### 1. 删除 `spawn` 工具注册

- 从 NCP tool registry 移除 `spawn`
- 删除相关 system prompt guidance
- 删除 `spawn` 对模型的建议文案

### 2. 扩展 SessionSpawnTool

`SessionSpawnTool` 负责：

1. 解析 `scope`
2. 决定是否注入当前 `sourceSessionId` 作为内部 `parentSessionId`
3. 若没有 `request`，直接创建 session 并返回 `nextclaw.session`
4. 若有 `request`，走统一 broker 创建 request，并返回 `nextclaw.session_request`

### 3. 扩展 broker primitive

新增统一 primitive：

- 创建任意新 session
- 可选绑定父 session
- 可选在创建后立即 dispatch request

这样 `spawn` 删除后，仍然只有一条“新 session + request”主链，不会复制出第二套逻辑。

## 前端适配方案

### 1. 工具卡片识别

前端 session tool card builder 应支持：

- `sessions_request`
- `sessions_spawn`
- 可选保留旧 `spawn` 历史消息的识别能力，但不再依赖它作为当前主路径

### 2. 右侧 child session 面板触发规则

当工具结果满足以下任一条件时，点击卡片应打开右侧 child session 面板：

- `kind = "nextclaw.session"` 且 `isChildSession = true`
- `kind = "nextclaw.session_request"` 且 `isChildSession = true`

否则：

- `isChildSession = false` 时，进入普通 session 视图

### 3. 卡片文案

`sessions_spawn` 结果需要明确区分：

- 只是创建了 child session
- 创建后已经开始跑 request
- 是否会在完成后自动恢复源会话

## 迁移规则

旧 `spawn`：

```ts
spawn({
  task,
  label,
  model,
  runtime,
  agentId,
})
```

迁移为：

```ts
sessions_spawn({
  scope: "child",
  task,
  title: label,
  model,
  runtime,
  agentId,
  request: {
    notify: "final_reply",
  },
})
```

## 测试计划

至少覆盖：

1. `sessions_spawn` 默认创建 standalone session
2. `sessions_spawn(scope="child")` 创建 child session
3. `sessions_spawn + request + standalone` 创建 standalone session 并立即发起 request
4. `sessions_spawn + request + child + notify="final_reply"` 行为等价旧 `spawn`
5. `sessions_request` 仍可继续指向由 `sessions_spawn(scope="child")` 创建出的 child session
6. system prompt 不再提到 `spawn`
7. 前端 tool card 在 `sessions_spawn` child 结果下仍能打开右侧 child session 面板

## 验收标准

1. 模型可只通过 `sessions_spawn` + `sessions_request` 完成原先 `spawn` 的全部主路径能力。
2. 工具定义中不再出现 `spawn`。
3. child session 在 UI 中仍可通过工具卡片打开右侧面板。
4. standalone session 仍进入普通 session 视图，不误入 child 面板。
5. 完成态回写、源会话恢复、child follow-up 这些旧 `spawn` 能力不回退。
