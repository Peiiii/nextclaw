# `nextclaw exec`

`nextclaw exec` is a one-shot headless runner for shell scripts, CI, and scheduled jobs. It shares the kernel/NCP run chain with the Harness and never enters interactive mode.

## Command

```bash
nextclaw exec [prompt...] \
  [--agent <id>] \
  [--session <id>] \
  [--model <model>] \
  [--format text|json|jsonl] \
  [--timeout <ms>]
```

- `--agent`: choose an agent.
- `--session`: resume a specific session; otherwise a new `exec:<uuid>` session is created.
- `--model`: model override for this task.
- `--format`: `text` by default; `json` and `jsonl` are also available.
- `--timeout`: cancel after the given number of milliseconds.

## Input

Prompt arguments are used as the prompt. If piped stdin is also present, it is appended as context for the same task. With no prompt, piped stdin is used. If both are empty, the command returns an input error instead of entering interactive mode.

```bash
nextclaw exec "Summarize this directory"
cat context.txt | nextclaw exec "Analyze this context"
```

## Output

In `text` mode, stdout contains only the final text. In `json` mode, one final envelope is written:

```json
{
  "schemaVersion": "nextclaw.exec/v1",
  "status": "completed",
  "result": {
    "schemaVersion": "nextclaw.task/v1",
    "status": "completed",
    "kind": "agent",
    "agentId": "main",
    "sessionId": "exec:2c8f...",
    "runId": "run-...",
    "text": "Task completed",
    "completedMessage": {
      "id": "assistant-123",
      "sessionId": "exec:2c8f...",
      "role": "assistant",
      "status": "final",
      "parts": [{ "type": "text", "text": "Task completed" }],
      "timestamp": "2026-08-22T10:00:00.000Z"
    }
  }
}
```

`jsonl` writes one event envelope for each NCP event and a final result envelope. Event payloads follow the NCP event contract; the CLI does not invent event fields:

```text
{"schemaVersion":"nextclaw.exec/v1","type":"event","event":{"type":"run.finished","payload":{"sessionId":"exec:2c8f...","runId":"run-123"}}}
{"schemaVersion":"nextclaw.exec/v1","type":"result","status":"completed","result":{"schemaVersion":"nextclaw.task/v1","status":"completed","kind":"agent","agentId":"main","sessionId":"exec:2c8f...","runId":"run-123","text":"Task completed","completedMessage":{"id":"assistant-123","sessionId":"exec:2c8f...","role":"assistant","status":"final","parts":[{"type":"text","text":"Task completed"}],"timestamp":"2026-08-22T10:00:00.000Z"}}}
```

Machine stdout contains contract data only; diagnostics and ordinary logs go to stderr. In `text` mode, failures write error text to stderr. In `json` and `jsonl` modes, failures write a versioned error envelope to stdout.

## Exit codes and cancellation

| Exit code | Meaning |
| --- | --- |
| `0` | Task completed |
| `2` | Invalid argument or input |
| `130` | SIGINT, timeout, or caller cancellation |
| `1` | Lifecycle, configuration, provider, runtime, or unknown failure |

Timeout and SIGINT enter the same cancellation path. Resume an existing conversation only with an explicit `--session`; terminal history is never used to infer a session.
