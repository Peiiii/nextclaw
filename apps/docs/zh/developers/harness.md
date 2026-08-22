# Harness API

`@nextclaw/harness` 是用于构建 Agent 服务和平台的 experimental 进程内 SDK。开发者直接创建 Harness；Harness 内部拥有一个 Kernel，但不会暴露 Kernel 的 manager graph。

## 生命周期

```ts
import { NextclawHarness } from '@nextclaw/harness';

const harness = new NextclawHarness();
await harness.start();
try {
  const result = await harness.runTask({ input: '检查工作区状态' });
  console.log(result.text);
} finally {
  await harness.dispose();
}
```

`start()` 和 `dispose()` 都是幂等的。`runTask()` 必须在 start 后调用；启动失败会回滚已经取得的资源。Harness 与 NextClaw CLI/UI 使用一致的任务、session、事件和生命周期语义。

## Agent、Session 与 Run

需要保存 session identity、消费 NCP event 或取消运行时，使用 handle API：

```ts
const agent = harness.agents.get('researcher');
const session = await agent.sessions.create({
  task: '检查这个仓库',
  workspace: '/workspace',
});
const run = await session.run({ input: '先列出最重要的风险' });

for await (const event of run.events()) {
  render(event);
}

const result = await run.result();
```

`harness.sessions` 是 session owner；`agent.sessions` 是同一批 session 的 Agent-scoped view。`run.cancel()` 会进入标准 NCP 取消链路。

## Options 与任务输入

`NextclawHarnessOptions` 用于传递 kernel 的 `homeDir`、`configPath`、`builtInAppsDirectory`、`productVersion` 和 activity sink。

`NextclawTaskInput` 包含：

- `input`：非空文本。
- `agentId`：可选 Agent。
- `sessionId`：可选 session；省略时创建新的 `exec:<uuid>`。
- `model`：本次任务的模型覆盖。
- `signal`：调用方的 `AbortSignal`。
- `onEvent`：观察 NCP endpoint event。
- `onAssistantDelta`：观察 assistant 文本增量。

## 结果与错误

结果是 `nextclaw.task/v1` envelope：

```ts
type NextclawTaskResult = {
  schemaVersion: 'nextclaw.task/v1';
  status: 'completed';
  kind: 'agent' | 'command';
  agentId: string;
  sessionId: string;
  runId: string | null;
  text: string;
  completedMessage: NcpMessage | null;
};
```

公共错误分类为 `invalid_input`、`cancelled`、`lifecycle` 和 `runtime_failure`。调用方应根据 `NextclawHarnessError.code` 判断恢复动作，不需要解析内部错误文案。

## 一次性任务

```ts
import { runNextclawTask } from '@nextclaw/harness';

const result = await runNextclawTask({
  input: '生成检查摘要',
  onAssistantDelta: (delta) => process.stderr.write(delta),
});
```

one-shot helper 在 Harness 启动后会在任务成功、运行失败或取消时执行 `dispose()`。输入校验会在创建 Harness 前完成。需要连续运行多次任务时，请显式创建 Harness，并在每次任务结束后保留或传入明确的 `sessionId`。

需要接入工具、上下文、模型、Runtime 或 MCP Server 时，继续阅读[平台扩展能力](./platform-capabilities)。
