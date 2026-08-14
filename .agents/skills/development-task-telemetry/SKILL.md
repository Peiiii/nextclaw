---
name: development-task-telemetry
description: Use when a development task needs visible phase tracing, task-level or phase-level Token measurement, model/effort comparison, or a deterministic usage report from Codex rollout logs.
---

# Development Task Telemetry

## 定位

作为开发生命周期的可选只读 observer，声明可移植的任务/阶段边界。只观察 lifecycle 已决定的状态，不改变阶段、返工、完成门或模型路由，不自报 Token 数值。

## 激活

- 根任务加载本 Skill 后，以 `task=start` 激活；子 Agent 只有拿到父任务传入的 task-id 和当前 phase 后才能用 `task=join` 激活。
- marker 必须附着在原本就要发送的进度或最终消息第一物理行，位于 `[我严格遵守规则]`、`[深思模式]` 等前缀之后；除用户显式要求收尾汇报外，禁止为 marker 新增消息、模型调用或工具调用。
- 只在真实 task / phase 转换时输出；同一阶段的普通进度不重复输出。
- 加载失败时说明 `telemetry unavailable` 并继续开发，不得阻塞任务。

## 固定合同

根任务开始：

```text
[nextclaw.dev/v1 task=start id=<task-id> phase=<phase>]
```

子 Agent 加入：

```text
[nextclaw.dev/v1 task=join id=<task-id> phase=<phase>]
```

当前线程切换阶段：

```text
[nextclaw.dev/v1 phase=<phase>]
```

子 Agent 离开：

```text
[nextclaw.dev/v1 task=leave id=<task-id> status=<status>]
```

根任务结束：

```text
[nextclaw.dev/v1 task=end id=<task-id> status=<status>]
```

字段顺序和拼写固定。`phase` 只允许 `task-understanding`、`design`、`implementation`、`validation`、`review`、`delivery`、`retrospective`；`status` 只允许 `completed`、`blocked`、`cancelled`、`failed`。

根任务生成一次 `dt-` 加 8 位小写十六进制 task-id，并在 reopen 时复用。子 Agent 原样复用父任务 ID，禁止自行生成。

每条 assistant 消息首行最多一个 marker。不要在首行示例、引用、用户内容、工具输出或总结中伪造 marker。

## AI 查询与汇报

用户说“查看统计”“这个任务用了多少 Token”或给出 task/thread/session ID 时，AI 是查询入口：自己定位并运行脚本，禁止把命令交给用户执行。定位顺序是显式 task-id、当前上下文最近的 marker、用户给出的 thread/session ID；仍有多个候选时先列出简短候选，不猜测归属。

```text
node .agents/skills/development-task-telemetry/scripts/report-task-phase-usage.mjs --sessions-root ~/.codex/sessions [--thread <thread-id>] [--task <task-id>] [--format json]
```

AI 默认用文本结果回答；需要比较、自动化或进一步计算时用 JSON。回答优先给总 Token、阶段占比、模型/effort、调用与工具轮次、耗时、覆盖率和警告。没有 marker 时只报告可观察总量并说明不能可靠分阶段，不让用户补跑命令，不用自然语言猜测缺失数据。

默认仍按需查询，不在每个任务结束时运行报告。用户显式要求“完成后汇报”时，根 AI 在最后一条完成进度首行输出 `task=end`，等该 frame 写入 rollout 后运行脚本，并在最终答复附一段简报；报告边界截止 `task=end`，统计工具和最终简报属于 observer 开销，不递归计入任务。跨线程和子 Agent 复用同一 task-id，由根 AI 汇总一次，子 Agent 不单独刷屏。
