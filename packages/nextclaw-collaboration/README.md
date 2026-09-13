# @nextclaw/collaboration

Connect GitHub Issues, Linear and other event sources to persistent local agent tasks. One local process and one SQLite database; no hosted control plane. NextClaw uses this same public package.

Requires Node.js 22.13+, a local Codex installation, and an authenticated platform CLI (`gh` or the schpet `linear` CLI). Existing CLI credentials stay with that CLI. Codex must support `app-server`, turn client IDs and paginated turn history.

```sh
npm install -g @nextclaw/collaboration
nextclaw-collaboration connect github --adapter github --repository OWNER/REPO --workspace /absolute/project
nextclaw-collaboration connect linear --adapter linear --team TEAM --workspace /absolute/project
nextclaw-collaboration check
nextclaw-collaboration start
```

Create the `agent:mozhao` label in the platform. Add it to a new issue to invite the agent. The default allowlist contains only the logged-in account; use `--allow account1,account2` when connecting to authorize others. On GitHub these are logins; on Linear these are viewer/user UUIDs. `--executable` selects a platform CLI; `--codex` selects Codex. Existing issues can be invited explicitly with `follow CONNECTION SUBJECT` (GitHub issue number; Linear issue UUID).

The host checks every 30 seconds while this computer is awake and online. A status receipt shows the Codex task ID and when processing starts. Later messages continue that same task. The agent can handle irrelevant input quietly. Statuses are updated in place on GitHub/Linear; official discussions support a first receipt and explicit status replies.

Send a standalone `/agent pause`, `/agent resume`, `/agent cancel` or `/agent status` in the issue. Pause retains pending input and lets current work finish. Cancel requests interruption and pauses future work. Closing an issue pauses follow-up; reopening only clears a pause caused by closure. A user pause remains until resumed.

`status` and `show CONTEXT` inspect local state without invoking a model. `stop` preserves bindings and pending work; `restart` resumes them. `run` is the foreground entry for an existing OS service manager. `start` runs detached until shutdown; it does not install an OS startup service. Default state: `~/.nextclaw/collaboration`. Protect that directory: it contains agent private keys and task input. Completed input/result payloads older than 30 days are compacted on host startup; small identity and deduplication records remain. Do not delete state while its host is running.

## Agent identity and bounded execution

Platform accounts and agents are separate identities. Each agent signs its output with Ed25519; signatures bind the body, source, subject, operation, purpose and hop count. Share only `{id, publicKey}` and authorize the peer using `trust CONNECTION PUBLIC_IDENTITY_FILE ACCOUNT`. Add `--controls` only if that peer may pause/resume/cancel. Same-account trusted peers can converse; own output, status receipts, malformed signatures and untrusted agents cannot wake the agent. Default bounds: four agent hops, twelve runs per conversation per hour, two simultaneous local executions. Reaching a bound pauses the conversation visibly.

## Recovery

An uncertain Codex acceptance is looked up by persisted request ID, never blindly submitted again. `reconcile CONTEXT` queries again. `bind CONTEXT THREAD` repairs an idle binding explicitly. `retry-run RUN --confirm-safe` requires inspection of prior side effects. Ambiguous platform delivery is located by a verified signed operation; `resolve-output ID --confirm-not-delivered` retries only after the operator confirms absence (`--discard` discards obsolete output). No source can guarantee exactly-once external side effects after arbitrary failures.

`migrate-discussion --workspace /absolute/project` imports a stopped legacy NextClaw listener's cursor and Codex bindings. It refuses active/uncertain legacy work, preserves the old state and retires its configuration. Migrated NextClaw listener start/status/stop/restart commands route to the shared host.

## Add a platform or use another consumer

See [the public protocol and adapter walkthrough](protocol/README.md). Applications import from `@nextclaw/collaboration`; no internal subpaths are required. Built-in sources expose `SourceAdapter`; `CollaborationService` owns identity, routing, durable execution and output. `Consumer` separates Codex from ordinary commands and other runtimes.

Only messages from explicitly authorized accounts and trusted adapters are executable inputs. Remote issue text cannot change local authorization. Choose a project workspace with the same care as a local agent task.
