---
"nextclaw": minor
"@nextclaw/kernel": minor
"@nextclaw/service": minor
"@nextclaw/core": minor
---

Continue all eligible active conversations automatically after a controlled NextClaw restart without restoring or replaying in-flight tool execution, and standardize agent self-updates on the ordinary `nextclaw update` plus `nextclaw restart` CLI flow.

Remove the agent-only `gateway update.run` action; configuration actions remain unchanged. Recovery applies to supported managed/foreground hosts, not desktop/supervisor restarts or legacy direct stop/start transitions.

<!-- release-note-blog: docs/blog-drafts/2026-09-11-self-management-restart-continuity.blog-draft.md -->
