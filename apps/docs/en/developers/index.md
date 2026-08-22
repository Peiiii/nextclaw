# NextClaw Harness SDK

NextClaw provides two headless entry points. They share task, session, event, and result semantics, so scripts, CI jobs, and Node.js programs can choose an entry point without changing core behavior.

| Entry point | Use it for | What it provides |
| --- | --- | --- |
| [In-process Harness](./harness) | Node.js applications, services, and long-lived processes | Compose Agents, manage sessions and runs, and own lifecycle in process |
| [`nextclaw exec`](./exec) | Shell, CI, scheduled jobs, and pipelines | One task with clean stdout and text/JSON/JSONL output |
| [Platform capabilities](./platform-capabilities) | Agent platforms that bring their own integrations | Observe events, extend ingress, and register tools, context, models, runtimes, and MCP |

## Which should I use?

- For one task and one result, use `nextclaw exec` or `runNextclawTask()`.
- For multiple tasks in one process, event callbacks, or explicit session control, use the Harness.
- To resume a session, pass `sessionId` or `--session` explicitly. Without it, a new `exec:<uuid>` session is created.

## Quick start

The CLI is included with NextClaw:

```bash
nextclaw exec "Summarize the current workspace"
```

Install the dedicated Harness entry package for Node.js applications:

```bash
pnpm add @nextclaw/harness
```

```ts
import { runNextclawTask } from '@nextclaw/harness';

const result = await runNextclawTask({ input: 'Summarize the current workspace' });
console.log(result.text);
```

## Experimental boundary

The current public surface covers Harness lifecycle, Agent and session handles, live runs, the Kernel-owned event bus and ingress, and lifecycle-scoped contributions for tools, context, models, runtimes, and MCP. App Server, structured output, approval handlers, storage adapters, sandbox adapters, skills, channels, and apps are not public Harness APIs yet.

Continue with the [Harness API](./harness), [Platform capabilities](./platform-capabilities), [`nextclaw exec`](./exec), and [Examples](./examples).
