# Kernel Run Pipeline Design

## 目标

这份文档只聚焦两个问题：

1. `ContextBuilder` 最小应该依赖什么、输出什么
2. `NextclawKernel.run()` 最本质的主流程应该怎么拆

这里先不讨论：

- 具体实现细节
- 存储后端
- provider / tool / skill 的细分策略
- CLI / UI / server 的壳层接法

## 设计原则

- 最小依赖
- 最通用
- 最本质
- 概念分离清楚

核心判断：

- `session` 是场景 owner
- `context` 不是第一性状态，而是一次运行看到的上下文快照
- `run` 的本质是“某个 session 里发生了一批新消息，然后系统据此推进一次执行”

## `ContextBuilder`

### 最小依赖

`ContextBuilder` 只依赖：

- `SessionManager`

理由：

- `session` 才是场景状态 owner
- `messages`、历史、变量、workspace、会话级 metadata，本质都属于 session 语义
- `context` 应该是从 session 派生，而不是自己再拥有一套独立状态

当前不建议让 `ContextBuilder` 直接依赖：

- `AgentManager`
- `TaskManager`
- `SkillManager`
- `ToolManager`
- `LlmProviderManager`

这些属于执行决策或运行时能力，不属于“上下文来源”。

### 输出

`ContextBuilder` 应输出一个运行上下文快照，推荐概念名：

- `RunContext`

它回答的问题是：

**“这一次 run，系统应该看到什么上下文？”**

最小建议结构：

```ts
type RunContext = {
  sessionId: SessionId;
  history: NcpMessage[];
  latestMessages: NcpMessage[];
  workspace?: string | null;
  memoryRefs: string[];
  variables: Record<string, unknown>;
};
```

注意：

- `RunContext` 不应直接包含最终的 `model / provider / tools / skills` 选择结果
- 那些属于后续执行决策，而不是 context 本身

## `run` 的最小主链

`run(input)` 的本质可以拆成下面这条主链：

1. 接收输入事件
   - 输入本质是：某个 `session` 里来了新的 `messages`

2. 写入 session
   - 新消息先进入 `SessionManager`
   - 因为“事件已发生”本身就是 session 状态的一部分

3. 构建上下文
   - `ContextBuilder` 基于 session 组装 `RunContext`

4. 决定怎么跑
   - 基于 `RunContext + input.metadata`
   - 决定 agent / model / provider / skills / tools 等执行策略

5. 创建 task
   - `TaskManager` 为这次执行打开一个 task

6. 执行
   - 真正调用后续 runtime / executor

7. 回写结果
   - 把执行产出的 messages / events 写回 session

8. 收尾 task
   - 标记 success / failed / cancelled

## 概念边界

这条链里，每一层只回答一个问题：

- `SessionManager`
  - 当前场景里发生了什么

- `ContextBuilder`
  - 这次运行应该看到什么

- `ExecutionResolver`
  - 这次应该怎么跑

- `TaskManager`
  - 这次执行现在处于什么状态

- `Executor`
  - 这次执行实际产出了什么

## 当前推荐结论

当前最推荐的收口方式：

- `ContextBuilder` 只依赖 `SessionManager`
- `ContextBuilder` 只输出 `RunContext`
- `RunContext` 只表达上下文，不表达最终执行策略
- `run()` 的最小主流程是：
  - `accept input`
  - `persist inbound to session`
  - `build run context`
  - `resolve execution plan`
  - `open task`
  - `execute`
  - `commit outputs back to session`
  - `close task`

## 暂留问题

后续最值得继续收敛的点只有一个：

- `input.metadata` 应该只是 hint，还是应该进一步收敛成一个独立的 `ExecutionIntent`
