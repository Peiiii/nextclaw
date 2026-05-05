# What To Do After Setup

After you finish provider + default model configuration, do these 5 things to move from "it works" to "I use it every day".

If you just installed NextClaw and have not configured any provider yet, start here first:

- [First Step After Install: Choose Provider Path (Qwen Portal or API Key)](/en/guide/tutorials/provider-options)

## 1. Confirm runtime health

```bash
nextclaw status --json
nextclaw doctor --json
```

This quickly verifies process state, config loading, and runtime readiness.

## 2. Run one 10-minute real task

Send a request you actually do every day, for example:

- summarize today's priorities
- draft a short status update
- turn a requirement note into an actionable checklist

Keep it simple. The goal is habit, not complexity.

## 3. Connect one channel you already use

Start with the platform you check every day (Discord / Telegram / Slack).

- Channel overview: [Channels](/en/guide/channels)
- Walkthroughs: [Tutorials](/en/guide/tutorials)

## 4. Add one minimal automation

Create a low-risk, high-frequency task like "daily 9:30 reminder for priorities".

- Entry doc: [Cron](/en/guide/cron)

## 5. Copy one proven setup from the resource hub

If you are unsure what to build next, start from existing ecosystem projects and adapt.

- Resource page: [Resource Hub](/en/guide/resources)

## External Tutorials and Community Shares (To Be Added Later)

This page is intentionally minimal for now. OpenClaw docs/repository links are not pre-filled and will be added manually later.

## Recommended order (no overthinking)

1. Health check
2. One real task
3. One channel
4. One automation
5. One copied pattern from resources
