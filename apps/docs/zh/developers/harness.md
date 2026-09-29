# Harness API

`@nextclaw/harness` 是用于构建 Agent 服务和平台的 experimental 进程内 SDK。开发者直接创建 Harness；Harness 内部拥有一个 Kernel，但不会暴露 Kernel 的 manager graph。

## 生命周期

需要完整本地产品能力时，从同一个包的 Node 根入口使用 `runNextclawTask(input, options)`；它包含原工具、技能、上下文和扩展加载。服务集成可用 `createNextclawApplication(options)` 获得 `{ harness, kernel }`：工厂完成 `prepare()` 后即可连接原管理入口，再调用 `harness.start()` 接纳消息，关闭时调用 `harness.dispose()`。服务可按自身启动顺序调用 `kernel.extensions.load(...)`。

`prepare()` 仅打开资源和装配产品模块，不启动 Agent 请求。普通 SDK 使用者只需调用 `start()`，它会自动 prepare。Node 专属工厂不进入 workerd 导出；两种环境都由 Harness 创建同一个 AgentKernel。

下面展示按平台自行组合工具的基础用法：

```ts
import { NextclawHarness } from '@nextclaw/harness';
import { NodePlatform } from '@nextclaw/kernel';

const harness = new NextclawHarness({ platform: new NodePlatform() });
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

`NextclawHarnessOptions.platform` 接受资源平台。`NodePlatform` 的选项包括 `homeDir`、`configPath`、`sessionTitleEnabled`、`sessionSearchEnabled` 和 `productActivitySink`。Node 平台目前由 `@nextclaw/kernel` 根入口提供；不从 Worker 入口导入本地平台。

平台 `start()` 返回 `AgentKernelResources`，由 Harness 创建共享引擎。资源包含持久存储、模型和运行环境事实，不包含已组装的 manager graph。SDK 默认不启动完整本地应用的后台服务；文件、命令行和业务工具通过 Contribution 明确注册。可设置 Harness 的 `allowSlashCommands: false` 禁止斜杠命令。

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
import { NextclawHarness } from '@nextclaw/harness';
import { NodePlatform } from '@nextclaw/kernel';

const harness = new NextclawHarness({ platform: new NodePlatform() });
try {
  await harness.start();
  const result = await harness.runTask({
    input: '给我一份检查清单',
    onAssistantDelta: (delta) => process.stderr.write(delta),
  });
  console.log(result.text);
} finally { await harness.dispose(); }
```

使用 `try/finally` 释放一次性任务实例。连续任务应复用 Harness，并为需要连续上下文的任务传入同一个 `sessionId`。关闭实例不删除磁盘会话，新的 NodePlatform 可恢复同一份数据。

需要接入工具、上下文、模型、Runtime 或 MCP Server 时，继续阅读[平台扩展能力](./platform-capabilities)。
