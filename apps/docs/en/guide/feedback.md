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

Maintainers can run `nextclaw feedback maintain skill-path` to locate the packaged maintenance skill, then use `maintain get/claim/comment/result` to read, claim and update reports. The private `@nextclaw/feedback-maintainer` application polls approved work with ordinary code and passes the local skill path to Codex. Codex performs the CLI operations itself; idle polling invokes no model, and a process exit does not prove a completed repair.

Administrators review reports under User Feedback in the existing Platform Admin, using their usual administrator login.

The review inbox defaults to pending reviews, with status filters, title/ID search and pagination. Select a report to read details, approve repair or request information, then continue to the next report. Release approval is separate in Awaiting Release. Filters survive page reloads.

AI classifies reports and proposes next steps. Severity takes precedence over account status. Automatic repair requires administrator approval; automatic release requires release approval as well. Additional reproduction information invalidates the previous approval and requires another review.

“Awaiting release” means a repair exists, not that your installation has updated. A released report identifies its version and NPM, Runtime or Desktop channel. Ask your AI to check the report before deciding to update. Submitting a report does not authorize an upgrade.

Reply to the original report if the problem persists. Use `nextclaw feedback withdraw <report-id>` to stop new processing; an existing release cannot be undone by withdrawing its report.

For local acceptance, all feedback commands accept `--endpoint http://127.0.0.1:3197`. Platform credentials are never sent to custom endpoints. The service must be deployed before the production entry point is enabled; a local acceptance build is not a live rollout.
