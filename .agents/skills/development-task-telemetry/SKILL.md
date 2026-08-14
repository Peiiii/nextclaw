---
name: development-task-telemetry
description: Use when a development task needs visible phase tracing, task-level or phase-level Token measurement, model/effort comparison, or a deterministic usage report from Codex rollout logs.
---

# Development Task Telemetry

## 定位

作为开发生命周期的可选只读 observer，声明可移植的任务/阶段边界。只观察 lifecycle 已决定的状态，不改变阶段、返工、完成门或模型路由，不自报 Token 数值。

## 激活

- 根任务加载本 Skill 后，以 `task=start` 激活；子 Agent 只有拿到父任务传入的 task-id 和当前 phase 后才能用 `task=join` 激活。
- marker 必须附着在原本就要发送的进度或最终消息第一物理行，位于 `[我严格遵守规则]`、`[深思模式]` 等前缀之后；禁止为 marker 新增消息、模型调用或工具调用。
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

## 报告

只有用户要求统计或实验需要时运行脚本，不在每个任务结束时自动统计：

```text
node .agents/skills/development-task-telemetry/scripts/report-task-phase-usage.mjs --rollout <rollout.jsonl> --task <task-id>
```

跨线程任务重复传入 `--rollout`；需要发现多个日志时使用 `--sessions-root`，用 `--format json` 获取机器可读结果。报告中的 Token、模型、effort、工具轮次和时间只来自原始 rollout；缺失或冲突数据保持 unavailable / unattributed，不用自然语言猜测补齐。
