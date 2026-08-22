# Harness API

`@nextclaw/harness` is the experimental in-process SDK for building Agent services and platforms on NextClaw. Create a Harness directly; it owns one Kernel without exposing the Kernel manager graph.

## Lifecycle

```ts
import { NextclawHarness } from '@nextclaw/harness';

const harness = new NextclawHarness();
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

`NextclawHarnessOptions` passes kernel options such as `homeDir`, `configPath`, `builtInAppsDirectory`, `productVersion`, and an activity sink.

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
import { runNextclawTask } from '@nextclaw/harness';

const result = await runNextclawTask({
  input: 'Create a verification summary',
  onAssistantDelta: (delta) => process.stderr.write(delta),
});
```

After the Harness has started, the one-shot helper calls `dispose()` when the task succeeds, fails at runtime, or is cancelled. Input validation happens before a Harness is created. For multiple tasks in one process, create a Harness explicitly and retain or pass an explicit `sessionId` for each task that should continue context.

To add tools, context, models, runtimes, or MCP servers, continue with [Platform capabilities](./platform-capabilities).
