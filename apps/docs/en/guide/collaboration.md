# Collaborate with local agents from issues

GitHub and Linear issues can wake local Codex tasks. An invitation creates a binding; later comments continue the same task. A receipt in the issue shows when execution starts and which Codex task handles it. Existing local CLI authentication is reused.

Requires Node.js 22.13+, local Codex, and an authenticated GitHub CLI or schpet Linear CLI with project access.

```sh
nextclaw collaboration connect github --adapter github --repository OWNER/REPO --workspace /absolute/project
nextclaw collaboration connect linear --adapter linear --team TEAM --workspace /absolute/project
nextclaw collaboration check
nextclaw collaboration start
```

Connect only the platforms you use. Standalone installation: `npm install -g @nextclaw/collaboration`; replace `nextclaw collaboration` with `nextclaw-collaboration`. Use `--executable` if the platform CLI is outside PATH. The default allowlist contains the current account; `--allow` accepts GitHub logins or Linear user UUIDs. Account changes stop consumption instead of silently changing identity.

## Three priority acceptance journeys

1. **Create and wake:** create an issue asking the agent to remember BLUE-47, then add `agent:mozhao` (create this label once). With the computer awake and the host running, collection normally starts within a 30-second poll interval. Observe the received/started receipt, Codex task ID and final reply. Network delays and queueing may extend this; inspect local `status`.
2. **Continue:** ask for the code in the same issue. Expect BLUE-47 and the same task ID. Repeat on either platform. Irrelevant input may complete quietly with a status update.
3. **Control:** post `/agent pause` alone. After the pause receipt, post a question; it stays pending. Post `/agent resume` alone to continue it in the same task. `/agent cancel` requests interruption and pauses future work; `/agent status` reports status.

An invitation is needed only once. Use `follow CONNECTION SUBJECT` for older issues (GitHub issue number; Linear UUID). Closing pauses follow-up; reopening does not override a manual pause.

## Operation and recovery

Use `status`, `show CONTEXT`, `stop` and `restart` without model calls. `start` launches a detached process, not an OS startup service; an existing service manager can run `run`. Offline or sleeping computers cannot process events. Restart resumes from saved state in `~/.nextclaw/collaboration`. Protect this directory: it includes agent keys and input. Startup compacts completed payloads older than 30 days while retaining small binding/deduplication records.

Unknown execution acceptance is queried with `reconcile CONTEXT`, never blindly resubmitted. Inspect external side effects before `retry-run --confirm-safe`; inspect the platform before `resolve-output`. `migrate-discussion --workspace /absolute/project` imports a stopped legacy official listener's original cursor and Codex bindings.

Signed agent identities are independent of platform accounts. `trust CONNECTION PUBLIC_IDENTITY_FILE --account ACCOUNT` allows a peer to communicate even through the same account. Add `--controls` only for control authority. Self-output, statuses and unverified agents cannot wake the host. Defaults cap agent hops at four, runs per conversation per hour at twelve, and simultaneous executions at two.

Custom platforms implement the public `SourceAdapter`; ordinary commands can implement a Consumer. See the [SDK protocol and non-issue example](https://github.com/Peiiii/nextclaw/tree/master/packages/nextclaw-collaboration/protocol). Optional authenticated normalized-event ingress is available; ordinary polling needs no webhook server or hosted control plane.
