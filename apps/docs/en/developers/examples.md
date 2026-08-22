# Examples

These examples use only the current experimental public contract.

## Node.js one-shot task

```ts
import { runNextclawTask } from '@nextclaw/harness';

const result = await runNextclawTask({ input: 'Inspect the repository and summarize risks' });
console.log(result.text);
```

## Long-lived Harness

A single Harness can run multiple tasks. Omitting `sessionId` creates a new `exec:<uuid>` session each time; pass the same explicit session id when the tasks should share context.

```ts
import { NextclawHarness } from '@nextclaw/harness';

const harness = new NextclawHarness();
await harness.start();
try {
  const first = await harness.runTask({ input: 'Build a project summary', sessionId: 'project-review' });
  const second = await harness.runTask({ input: 'List risks based on that summary', sessionId: 'project-review' });
  console.log(first.text, second.text);
} finally {
  await harness.dispose();
}
```

## CI and JSONL

```bash
set -o pipefail
nextclaw exec --format jsonl --timeout 60000 "Run checks and explain the result" \
  > agent-events.jsonl
```

CI can consume `agent-events.jsonl` line by line and use the process exit code to distinguish success, invalid input, cancellation, and runtime failure. Pipe context through stdin when it should be appended to the prompt.
