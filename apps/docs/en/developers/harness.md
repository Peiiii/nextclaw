# Harness API

`@nextclaw/harness` is the experimental in-process SDK for building Agent services and platforms on NextClaw. Create a Harness directly; it owns one Kernel without exposing the Kernel manager graph.

## Lifecycle

For the full local product, use `runNextclawTask(input, options)` from the same package's Node root. It includes the original tools, skills, context and extension loading. Service integrations can use `createNextclawApplication(options)` to obtain `{ harness, kernel }`: the factory prepares resources and management owners, the host wires its services, then `harness.start()` enables requests. Release the entire graph with `harness.dispose()`. Services manage `kernel.extensions.load(...)` in their own startup sequence.

`prepare()` opens resources and attaches product modules without admitting Agent requests. Regular SDK callers only need `start()`, which prepares automatically. Node factories are excluded from the workerd export; both environments use the same Harness-owned AgentKernel.

The following example composes a base Harness with a resource platform:

```ts
import { NextclawHarness } from '@nextclaw/harness';
import { NodePlatform } from '@nextclaw/kernel';

const harness = new NextclawHarness({ platform: new NodePlatform() });
await harness.start();
try {
  const result = await harness.runTask({ input: 'Inspect the workspace' });
  console.log(result.text);
} finally {
  await harness.dispose();
}
```

`start()` and `dispose()` are idempotent. `runTask()` requires a started Harness; a failed start rolls back resources already acquired. The Harness follows the same task, session, event, and lifecycle behavior as the NextClaw CLI and UI.

## Agent, session, and run handles

Use handles when the host needs to retain session identity, consume NCP events, or cancel an active run:

```ts
const agent = harness.agents.get('researcher');
const session = await agent.sessions.create({
  task: 'Review this repository',
  workspace: '/workspace',
});
const run = await session.run({ input: 'List the highest risks first' });

for await (const event of run.events()) {
  render(event);
}

const result = await run.result();
```

`harness.sessions` is the session owner; `agent.sessions` is an Agent-scoped view of the same sessions. `run.cancel()` uses the normal NCP cancellation path.

## Options and task input

`NextclawHarnessOptions.platform` accepts a resource platform. `NodePlatform` supports `homeDir`, `configPath`, `sessionTitleEnabled`, `sessionSearchEnabled`, and `productActivitySink`. It is currently exported from the `@nextclaw/kernel` root; do not import the local platform from a Worker entry.

Platform `start()` returns `AgentKernelResources`, and the Harness creates the shared engine. Resources include persistence, model access, and runtime facts, not an assembled manager graph. The SDK does not implicitly start the full local application services. Register file, command, and business tools through Contributions. Set Harness `allowSlashCommands: false` to disable slash commands.

`NextclawTaskInput` includes:

- `input`: non-empty text.
- `agentId`: optional agent selection.
- `sessionId`: optional session; omitted means a new `exec:<uuid>` session.
- `model`: model override for this task.
- `signal`: caller-owned `AbortSignal`.
- `onEvent`: observe NCP endpoint events.
- `onAssistantDelta`: observe assistant text deltas.

## Results and errors

Results use the `nextclaw.task/v1` envelope:

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

The public error codes are `invalid_input`, `cancelled`, `lifecycle`, and `runtime_failure`. Use `NextclawHarnessError.code` to choose recovery behavior instead of parsing internal error text.

## One-shot task

```ts
import { NextclawHarness } from '@nextclaw/harness';
import { NodePlatform } from '@nextclaw/kernel';

const harness = new NextclawHarness({ platform: new NodePlatform() });
try {
  await harness.start();
  const result = await harness.runTask({
    input: 'Give me a verification checklist',
    onAssistantDelta: (delta) => process.stderr.write(delta),
  });
  console.log(result.text);
} finally { await harness.dispose(); }
```

Use `try/finally` to release a one-shot instance. Reuse the Harness for consecutive tasks, passing the same `sessionId` when they should share context. Disposal does not delete persisted sessions; a new NodePlatform can resume the same data.

To add tools, context, models, runtimes, or MCP servers, continue with [Platform capabilities](./platform-capabilities).
