# Bibo hosted companion

[Bibo](https://app.bibo.bot/) is a separate web service powered by the NextClaw agent runtime. You can register with an email code and start with a concrete task without installing NextClaw.

The hosted app displays answer text as each increment is generated; it does not replay a completed answer. Bibo uses direct answer generation by default. A reply enters your conversation history only after saving completes. You can stop a generation, and an interrupted or unsaved request leaves your original input ready to retry. The composer stays visible while long conversations scroll. Both in-progress and saved replies render Markdown headings, lists, quotes, code, tables and safe external links, and you can copy them. Refreshing resumes the last saved conversation.

Each account has an isolated runtime. You can clear your Bibo conversation and workspace from the web app. Hosted Bibo currently offers web text chat and conversation continuity; web search, email connections, background schedules and proactive notifications are not yet available.

The initial limit is 12 requests per hour and 4,000 characters per request, with 30 model calls per account per day and 200 model calls across the service per day. Account authentication uses the NextClaw platform; Bibo provides a separate, capped model trial. Background scheduled work and proactive notifications are not available yet. Check important results before relying on them.

See [Bibo help](https://app.bibo.bot/help.html) for usage and data details. The local-first NextClaw workspace remains available through the [installation guide](/en/guide/install).
