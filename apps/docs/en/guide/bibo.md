# Bibo hosted companion

[Bibo](https://bibo.bot/app/) is a separate web service powered by the NextClaw agent runtime. You can register with an email code and start with a concrete task without installing NextClaw.

The initial release supports text conversations and continuing the same conversation after you return. Each account has an isolated runtime. You can clear your Bibo conversation and workspace from the web app.

The initial limit is 12 requests per hour and 4,000 characters per request, with 30 model calls per account per day and 200 model calls across the service per day. Account authentication uses the NextClaw platform; Bibo provides a separate, capped model trial. Background scheduled work and proactive notifications are not available yet. Check important results before relying on them.

See [Bibo help](https://bibo.bot/app/help.html) for usage and data details. The local-first NextClaw workspace remains available through the [installation guide](/en/guide/install).
