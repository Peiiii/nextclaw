# 子会话委派深度约束设计

## 背景与真实故障

NextClaw 的产品预期是由顶层会话承担编排职责：顶层会话可以创建一层子会话，子会话只完成收到的任务并把结果交还，不继续创建孙会话。

实际会话 `ncp-mt7gnqr7-ieo2rlr2` 证明该约束没有进入运行时合同：它在 2026-08-24 形成了 22 个会话、最大深度 21 的单链递归。深度 1–20 的每个子会话都看到了 `sessions_spawn` 并再次调用；最深一层只因运行时中断才停止。

这不是模型专属问题。故障运行虽然使用 `codex-sub/gpt-5.6-luna`，但 session runtime 是 `native`；真正决定模型可见工具和会话持久化的是 NextClaw kernel。

相关历史设计：

- [Child 会话上下文继承设计](./2026-06-19-child-session-inherit-context.design.md) 已明确 `parent_session_id` 是父子身份的唯一事实。
- 本设计只补充委派深度不变量，不改变上下文继承、完成通知或父子身份格式。

## 根因分层

### 现象层

- 一个“发起一个子会话测试”的顶层任务产生 21 层嵌套子会话。
- 每层约 5–7 秒再创建下一层，持续消耗模型调用、会话记录和运行资源。

### 直接触发层

- 每个子会话收到的完整工具目录仍包含 `sessions_spawn`。
- 通用 tooling prompt 还无条件建议复杂任务创建子代理。

### 生成路径层

1. `SessionToolProvider` 对顶层会话和子会话无条件注册 `SessionSpawnTool`。
2. 子会话模型调用 `sessions_spawn(scope="child")`。
3. `SessionManager.createSession` 写入新的 `parent_session_id`，但不检查被引用的父会话是否本身已经是子会话。
4. 新孙会话再次得到同一工具目录，循环继续。

现有 `handoffDepth` 不是可靠的父子会话深度事实：它没有持久写入这条 child session 运行链，故障中每层解析值都为 0。父子层级的权威事实仍是 durable `parent_session_id`。

### 防线缺口层

- 可见性缺口：工具目录没有按 canonical session lineage 过滤。
- 权限缺口：会话创建 owner 没有执行层级不变量。
- 反馈缺口：prompt 一方面声明工具目录是完整策略结果，另一方面又在工具不可用场景无条件建议 spawn。
- 验证缺口：已有测试只证明一层 child 可以创建，没有“child 不能创建 grandchild”的负向合同。

## 产品合同与不变量

固定合同如下，不引入配置项：

1. 顶层 session（没有 `parent_session_id`）可以创建 standalone session 或一层 child session。
2. child session（存在 `parent_session_id`）不能创建任何新 session；编排和继续委派由顶层 session 负责。
3. `sessions_request`、`sessions_list`、`sessions_history`、`sessions_update` 等读取、沟通和管理能力不因 child 身份被移除。
4. child 身份来自 catalog/session record 的 canonical metadata，不能被单条请求 metadata 覆盖或伪造。
5. 任何尝试让 child 成为新 child 的 parent 都必须在新 session 持久化之前显式失败，不产生空会话、请求记录或后台 run。
6. 旧 child session 继续可读、可续聊；无需迁移。已有深层历史会话不自动删除。

## 成熟方案对齐

DeepSeek Harness 的官方 subagent 合同提供了三个直接适用的原则：

- delegation depth 是 durable session lineage；冷恢复不能把深度降回 0；
- `toolFilter` 让受限工具同时从 child prompt 消失并拒绝执行，而不是只写一句 prompt 提醒；
- 超过 `maxDepth` 要在 child run 发布前 loud reject，不能接受后静默降级。

参考：[DeepSeek Harness Subagent subsystem](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/subagent.md)。

OpenAI 对 Codex multi-agent 的公开模式把 primary agent 定义为委派和最终综合 owner，subagents 承担窄而独立的执行任务。NextClaw 采用同样的单层产品合同，但不依赖具体模型是否自觉遵守。参考：[OpenAI GPT-5.6 multi-agent guide](https://openai.com/index/builders-guide-to-gpt-5-6/)。

## 候选比较

### 方案 A：只增加 prompt 禁令

不采用。模型仍能看到并调用工具；prompt 遗漏、外部 runtime 或直接 API 调用都会绕过，不能保护持久化不变量。

### 方案 B：只在 `SessionManager` 拒绝

不采用。可以保护数据，但模型仍会反复选择不可用工具并得到错误，浪费轮次且用户会看到无意义失败。

### 方案 C：只从 child 工具目录移除

不采用。改善模型行为，但其它 kernel 调用者仍能直接创建孙会话，权限只存在于一个 consumer。

### 方案 D：工具目录过滤 + session owner 硬校验

采用。工具可见性和执行权限来自同一 canonical lineage 事实：正常模型路径不暴露能力，绕过模型路径也无法破坏不变量。

## 主链路与 owner

### 模型可见能力

```text
AgentRunRequest
  -> ToolProviderRunContextService 读取 canonical AgentRunSession
  -> SessionToolProvider 检查 session.metadata.parent_session_id
  -> 顶层：注册 sessions_spawn
  -> child：不注册 sessions_spawn
  -> Tooling context 使用过滤后的 tool catalog 给出对应指导
```

`SessionToolProvider` 只负责 capability projection，不成为层级事实 owner。

### 持久化硬边界

```text
createSession(parentSessionId)
  -> SessionManager 解析 parent record
  -> parent 不存在：显式失败
  -> parent 已有 parent_session_id：显式失败
  -> parent 是顶层：继续现有 child 创建与上下文继承
  -> importSessionSnapshot
```

`SessionManager.createSession` 是 session hierarchy invariant 的唯一执行 owner。所有 native、Codex、harness 或 UI materialization 入口只要要创建 NextClaw child session，就必须经过该边界。

## Prompt 与错误反馈

- 顶层会话仍看到“复杂任务可创建子代理”的指导。
- child 会话不再看到 `sessions_spawn` schema，并得到明确指导：当前会话是受委派执行者，应直接完成任务并把需要进一步委派的事项交回父会话。
- 直接创建嵌套 child 时返回稳定错误：`Child sessions cannot create additional sessions.`，并在错误中指出 parent session id。
- 不把拒绝降级成 standalone session，也不自动把孙任务转交给祖先；这些都会改变用户意图并制造隐藏路径。

## 场景矩阵

| 场景 | 工具可见性 | 创建结果 | 持久化结果 |
| --- | --- | --- | --- |
| 顶层首次运行 | 有 `sessions_spawn` | 可创建一层 child | 新 child 写入 parent id |
| 顶层刷新/恢复 | 有 `sessions_spawn` | 行为不变 | 行为不变 |
| child 首次运行 | 无 `sessions_spawn` | 模型不能选择 spawn | 无新 session |
| child 刷新/恢复 | 无 `sessions_spawn` | durable lineage 继续生效 | 无新 session |
| 直接 API/内部调用让 child 成为 parent | 不依赖工具目录 | 立即报错 | 不写 snapshot/request/run |
| 指定不存在的 parent | 不依赖工具目录 | 立即报错 | 不写 orphan child |
| 旧的一层 child | 无 `sessions_spawn` | 可继续对话和回报 | 不迁移 |
| 已存在的深层历史链 | 无 `sessions_spawn` | 不再继续向下创建 | 不自动删除历史资产 |

## 实现范围

- `SessionToolProvider`：从 canonical session metadata 派生 child 身份；child 不注册 `SessionSpawnTool`。
- `SessionManager.createSession`：在 snapshot import 之前验证 parent 存在且没有自己的 parent。
- tooling/session orchestration context：根据实际工具目录给顶层与 child 不冲突的指导。
- 定向测试：provider 工具可见性、manager 嵌套拒绝、prompt 反馈、正常一层 child 回归。
- 用户文档：说明 NextClaw child session 为单层委派，进一步拆分交回父会话。

## 抽象审计

- 保留：`parent_session_id` 作为唯一 durable lineage；`SessionToolProvider` 作为模型能力投影；`SessionManager` 作为创建 owner。
- 新增：只新增局部判定/校验函数，分别保护工具可见性和持久化不变量。
- 删除：child 运行时的 `sessions_spawn` 工具注册，以及无条件 spawn 指导。
- 延后：可配置 `maxDepth`、通用 delegation descriptor、provider capability registry、任意树形编排和历史深层会话清理。当前产品合同固定为一层，这些抽象没有真实消费者。

## 验证标准

1. 失败优先测试能在修前证明 child 工具目录包含 `sessions_spawn`，且 child 可创建 grandchild。
2. 修后顶层工具目录仍包含 `sessions_spawn`，child 工具目录不包含；其它 session 工具保持存在。
3. `SessionManager` 允许 root → child，拒绝 child → grandchild；拒绝后 session catalog/journal 中不存在目标 grandchild。
4. notify 与不 notify 两条 spawn 路径都受同一个 `SessionManager` 不变量保护，不产生 request 或 run。
5. child 刷新/恢复后仍由 canonical metadata 识别，单条 request metadata 不能绕过。
6. Native/Codex 等 runtime 共享的 kernel 工具投影测试通过；不对模型名写特判。
7. Kernel 定向测试、TypeScript、ESLint、governance 和 diff-only maintainability 检查通过。

## 非目标

- 不删除用户现有的 21 层历史会话链。
- 不限制 `sessions_request` 对已有 session 的沟通。
- 不改变子会话模型继承、上下文继承或完成通知语义。
- 不控制外部 runtime 在其私有内部、且不创建 NextClaw session 的隐藏 worker；本设计约束的是 NextClaw 可观察、可持久化的 child session 能力。
- 不提交、推送、发布、部署或重启用户当前实例。
