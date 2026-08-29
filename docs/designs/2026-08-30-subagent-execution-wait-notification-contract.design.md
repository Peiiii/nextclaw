# 子代理运行、等待与通知合同修复设计

## 背景与问题

原始 `spawn(task)` 的用户合同是：立即启动后台子代理、立刻返回运行中句柄，子代理完成后再把结果回投给父会话。后续会话模型演进先增加了“只创建 Session”，又删除旧 `spawn` 并把能力统一到 `sessions_spawn`，最终在拍平 `request.notify` 参数时形成了当前错误合同：`notify` 是否存在同时决定任务是否启动，`notify="final_reply"` 又会让父 Agent 的工具调用同步等待。

这违反三个应独立成立的不变量：

1. 调用 `sessions_spawn` 并提供任务时，默认必须立即启动任务。
2. 父 Agent 是否等待是调度策略，不能由通知策略决定。
3. `notify` 只决定子任务完成后是否唤醒父会话，不能决定任务是否运行。

历史设计来源：

- [`2026-04-03-cross-session-request-and-child-session-design.md`](../plans/2026-04-03-cross-session-request-and-child-session-design.md) 首次把 Session 容器与 SessionRequest 拆开。
- [`2026-04-09-sessions-spawn-unification-plan.md`](../plans/2026-04-09-sessions-spawn-unification-plan.md) 删除旧 `spawn`，把创建与可选首轮请求统一进 `sessions_spawn`。
- [`v0.19.11-sessions-spawn-notify-contract`](../logs/v0.19.11-sessions-spawn-notify-contract/README.md) 为规避嵌套参数生成失败，把 `request.notify` 拍平成顶层 `notify`，但保留了“缺少该字段就不启动”的控制流。

## 用户任务与成功信号

顶层 Agent 把一个真实子任务交给子 Agent 后，子任务立即运行，父 Agent 可以继续当前工作；子任务完成时，父会话收到隐藏的结构化完成通知并继续整合结果。用户可以显式要求同步等待，也可以显式只创建空会话，但这两种行为都不能由 `notify` 缺失隐式触发。

成功信号：

- 默认 `sessions_spawn({ task, scope: "child" })` 立即返回 `running`，并真实启动 child run。
- 父 run 不等待 child final reply 即可完成当前输出。
- child 完成后，原工具结果更新为终态，并向父会话排入一条隐藏完成通知，触发后续 run。
- `wait="final_reply"` 才同步等待 child final reply。
- `start=false` 才只创建会话；`wait="final_reply"` / `notify="final_reply"` 这类主动策略与仅创建冲突并 fail fast，模型自动补齐的中性 `none` 可安全接受。

## 统一合同

### `sessions_spawn`

```ts
sessions_spawn({
  task: string,
  scope?: "standalone" | "child",
  start?: boolean,
  wait?: "none" | "final_reply",
  notify?: "none" | "final_reply",
  // 其它既有创建参数保持不变
})
```

默认值：

- `start = true`
- `wait = "none"`
- `notify = "final_reply"`

`start=false` 是唯一的仅创建路径。此时请求 `wait="final_reply"` 或 `notify="final_reply"` 属于矛盾输入，直接报错；`none` 是无行为的中性值，允许模型参数生成器自动补齐。

### `sessions_request`

`sessions_request` 始终会向既有会话发起请求，不需要 `start`。它与 spawn 共用：

- `wait?: "none" | "final_reply"`，默认 `none`
- `notify?: "none" | "final_reply"`，默认 `final_reply`

### 状态矩阵

| start | wait | notify | 子任务 | 当前工具调用 | 完成投递 |
| --- | --- | --- | --- | --- | --- |
| `true` | `none` | `final_reply` | 立即后台运行 | 立即返回 `running` | 更新工具结果，并排入隐藏父会话通知 |
| `true` | `none` | `none` | 立即后台运行 | 立即返回 `running` | 只更新工具结果，不唤醒父会话 |
| `true` | `final_reply` | 任一 | 立即运行 | 等待终态后返回 | 结果通过当前工具调用交付，不重复唤醒 |
| `false` | 未传 | 未传 | 不运行 | 返回新建 Session | 无 |

## Owner 与主链路

- `SessionSpawnTool` 拥有 spawn 参数解析、默认值和 `start=false` 的 fail-fast 合同。
- `SessionRequestManager` 继续作为请求状态与生命周期唯一 owner，并新增独立的 `wait` 分支；它不再从 `notify` 推断是否等待。
- agent-runtime session-request dispatcher 继续拥有跨 session ingress 边界，并负责把 kernel 已确认的终态结果转成隐藏父会话完成通知。
- 原工具调用终态更新与父会话完成通知都消费同一份已落 journal 的终态结果；两者必须独立投递，任何一方挂起或失败都不能阻塞另一方。

最小主链路：

```text
sessions_spawn
-> create child Session
-> SessionRequestManager 创建 running request
-> 立即返回 running result
-> child runtime 完成
-> 写 session.request.completed/failed
-> 独立更新原 spawn tool result
-> notify=final_reply 时独立通过 ingress 向父会话排入隐藏完成通知
-> 父会话在当前 run 结束后继续处理结果
```

## 失败与恢复

- child 失败仍形成 `failed` 终态、更新原工具结果，并在 `notify=final_reply` 时通知父会话，由父 Agent 决定恢复动作。
- 父会话通知入队失败不能篡改已经成立的 child request 终态；记录明确错误，保留 journal 和工具结果作为可恢复事实。
- 父 run 尚未结束时，通知通过现有 session run queue 排队，不轮询 idle，不创建第二套调度器。
- 已有历史消息和 request journal 不迁移；新增 `wait` 对旧记录按缺失即 `none` 解释。

## 抽象审计

- 保留：现有 `SessionRequestManager`、SessionRequest journal、agent-run ingress 和 tool-result update 主链。
- 新增：一个 `wait` 字段和现有 dispatcher 边界上的 source completion notifier；它们分别保护“等待独立于通知”和“通知不阻塞当前 run”两个真实不变量。
- 删除：`notify` 存在性决定是否启动、`notify="final_reply"` 决定同步等待的两个隐式分支。
- 延后：通用 Observation/Reactive Runtime、任意订阅 DSL、多级子代理和跨进程可靠通知协议；本次没有这些真实消费者。
- 不新增 manager、service、registry 或兼容 wrapper。

命中的架构原则是 `single-complete-owner`、`minimal-responsibility-surface`、`equivalence-by-construction` 与 `simple-structure-first`。能力缺口判定为跨工具入口和运行生命周期的“能力面缺失”，但现有 session/request/event 模型足以表达正确状态，不升级为系统模型重构。

## 验证标准

1. 工具 schema 与 manager 定向测试覆盖全部状态矩阵、失败通知和字段默认值。
2. 受影响 package 的 TypeScript 检查通过。
3. diff-only maintainability review 无未关闭 finding。
4. 使用隔离 `NEXTCLAW_HOME` 和端口启动本地真实 NextClaw，通过真实模型发送真实用户任务；journal 证明父 run 先完成、child 后完成、工具结果回写、隐藏通知再触发父 follow-up。
5. 空会话通过显式 `start=false` 创建，并证明没有 child request/run。

## 非目标

- 不改变一层 child session 限制。
- 不增加孙会话。
- 不改 UI 子会话工作台交互。
- 不迁移已有历史 request 记录。
- 不发布或部署；本任务只提交经验证的修复。
