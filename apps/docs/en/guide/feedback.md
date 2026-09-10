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

## Processing, approval, and direct discussions

Administrators keep using their existing Platform Admin login. The Feedback and Discussions area has two focused views:

- Feedback Queue classifies reports, requests details, approves repair, and separately approves release. Reporter, administrator, and processing-client posts show their server-verified identities.
- Direct Discussions lets an administrator create a private thread without a prior report or CLI command. A subscribed local participant receives the opening post and later administrator messages.

Configure the generic discussion listener once. Codex Desktop is the recommended preset:

```bash
nextclaw discussion listen configure --workspace /path/to/project --token-file /path/to/token --preset codex-desktop
nextclaw discussion listen start
nextclaw discussion listen status
```

The listener is an ordinary code process that reads cursor events addressed to the `participant` role. Idle scans make no model calls. A new thread creates a Codex task, and later messages for that thread resume the same task. The workspace and Codex task mapping belong only to the Codex consumer preset and are absent from the discussion protocol.

Connect any other Agent, queue, script, or ordinary program with a trusted argument array:

```bash
nextclaw discussion listen configure --token-file /path/to/token -- /path/to/consumer --fixed-arg
nextclaw discussion listen restart
```

The listener neither identifies the consumer type nor invokes a shell. It supplies the thread ID, event ID, title, space, cursor, endpoint, and packaged skill path through stdin and `NEXTCLAW_DISCUSSION_*` variables. The consumer decides how to create or resume context and uses `nextclaw discussion get/post` to read and write. Stop it with `nextclaw discussion listen stop`.

The packaged `discussion-participant` skill is the AI capability index. An event supplies the skill path for on-demand reading instead of adding an entry to every screen. The AI first acknowledges receipt in the original thread and can post useful progress during longer work. A `direct` thread uses only discussion commands. A `support` thread follows the skill into `nextclaw feedback workflow get/claim/comment/result`, where the feedback application enforces approval, claim, status, and release rules.

Submitting feedback initially addresses an event only to administrators. The service creates a participant event after an administrator approves the current input version. New reporter evidence invalidates the old approval and returns to administrators first; the participant is triggered again only after reapproval. Role routing is fixed when the server writes the event, so the generic listener never reads or interprets feedback state.

Awaiting release means a repair artifact exists; it does not mean the installation was updated. A released report identifies the version and NPM, Runtime, or Desktop channel. Release needs separate approval and verifiable release proof. Reply to the original report if the problem persists, or use `nextclaw feedback withdraw <report-id>` to stop new processing.

For local acceptance, pass `--endpoint http://127.0.0.1:3197`. Platform credentials are never sent to custom endpoints, and the participant credential is only sent to the explicitly configured discussion service.
