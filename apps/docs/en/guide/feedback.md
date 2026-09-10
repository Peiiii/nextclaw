# Report problems and track fixes

Ask “What happened to my last report?” to have the AI retrieve its current status and maintainer replies. It can also add details or withdraw a report. No AI polling job is created by default. Maintainer-side code checks for approved work and invokes no model when idle. Results are written to the original report; proactive conversation notifications are not enabled by submission. A ready repair still awaits publication and does not upgrade your installation.

Ask your NextClaw AI to report a problem, or use the feedback portal's report page. A GitHub account is never required. New reports are private to you and maintainers.

```bash
nextclaw feedback submit --title "Tool failed" --description "Steps, actual result, expected result" --affected-version "affected-version"
nextclaw feedback list
nextclaw feedback get <report-id>
nextclaw feedback reply <report-id> "Additional reproduction details"
```

The CLI returns JSON and saves a private receipt before sending. If submission fails, retry with the original arguments and `--request-id <saved-id>` to continue the same report. Do not include passwords, keys, full conversations or unrelated personal information.

## Receipts and accounts

Anonymous access uses a private receipt. Browser receipts stay in that browser; CLI receipts stay in the NextClaw data directory. Back up and transfer receipts using the page's download/restore controls or:

```bash
nextclaw feedback export <report-id> receipt.json
nextclaw feedback import receipt.json
```

Anyone holding a receipt can access that report. Keep it private. The signed-in CLI sends its existing NextClaw identity for server verification. Expired credentials do not prevent anonymous submission. After signing in, use `nextclaw feedback link <report-id>` to link a receipt, and `nextclaw feedback sync` to retrieve account reports. The standalone page uses anonymous receipts. Import a browser receipt into the CLI to link it to an existing NextClaw login; no separate external login is needed.

## Progress and releases

Maintainers prepare a mode-`0600` token file and a repair workspace, then configure and start the recommended Codex Desktop consumer:

```bash
nextclaw feedback maintain configure --workspace /path/to/project --token-file /path/to/token --preset codex-desktop
nextclaw feedback maintain start
nextclaw feedback maintain status
```

Ordinary polling code invokes a consumer only after administrator approval; idle scans make no model calls. The Codex Desktop preset runs in the configured workspace, creates a task named `反馈：[project directory] <report title>` under **Tasks**, and resumes the same task for later user messages on that report. This makes tasks searchable by project. Codex's current public App Server protocol has no Desktop project-assignment parameter, so NextClaw does not alter Codex's private state to fabricate one. Use the generic command trigger with a capable host API when native project grouping is required. Codex reads the packaged skill and uses `maintain get/claim/comment/result` itself to read, claim, and update the original report. Process completion is not business completion; the platform state remains authoritative.

The listener does not know whether its consumer is an AI. To connect another Agent, queue, or ordinary program, provide a trusted argument array after `--`. The listener sends the feedback ID, event ID, title, revision, endpoint, and skill path through stdin and `NEXTCLAW_FEEDBACK_*` variables without invoking a shell:

```bash
nextclaw feedback maintain configure --token-file /path/to/token -- /path/to/consumer --fixed-arg
nextclaw feedback maintain restart
```

The generic listener neither stores nor passes a working directory. Put any directory required by a consumer in that command's own arguments or script.

Use `nextclaw feedback maintain stop` to stop listening. Initial repair always requires administrator approval. A later user message can resume an engaged task, but it invalidates the previous approval; repair still waits for reapproval.

Administrators review reports under User Feedback in the existing Platform Admin, using their usual administrator login.

The review inbox defaults to pending reviews, with status filters, title/ID search and pagination. Select a report to read details, approve repair or request information, then continue to the next report. Release approval is separate in Awaiting Release. Filters survive page reloads.

AI classifies reports and proposes next steps. Severity takes precedence over account status. Automatic repair requires administrator approval; automatic release requires release approval as well. Additional reproduction information invalidates the previous approval and requires another review.

“Awaiting release” means a repair exists, not that your installation has updated. A released report identifies its version and NPM, Runtime or Desktop channel. Ask your AI to check the report before deciding to update. Submitting a report does not authorize an upgrade.

Reply to the original report if the problem persists. Use `nextclaw feedback withdraw <report-id>` to stop new processing; an existing release cannot be undone by withdrawing its report.

For local acceptance, all feedback commands accept `--endpoint http://127.0.0.1:3197`. Platform credentials are never sent to custom endpoints. The service must be deployed before the production entry point is enabled; a local acceptance build is not a live rollout.
