# Configuration Manual

This manual explains the configuration surfaces in NextClaw. It is not the first page for new users; if you have not run NextClaw yet, start with [Quickstart](/en/guide/getting-started).

## Configuration areas

### Model providers

Providers decide which model service NextClaw calls. This includes provider identity, API base, authentication, and default model.

Related guides:

- [Set Up Providers](/en/guide/model-selection)
- [Pick a Provider Path](/en/guide/tutorials/provider-options)

### Channels

Channels decide where users enter NextClaw, such as the local UI, a messaging platform, or another entry point.

Related guide:

- [Connect Channels](/en/guide/channels)

### Secrets

Secrets store API keys, tokens, and other sensitive values. Keep them managed centrally instead of scattering them through plain text docs or chat history.

Related manual:

- [Secrets Management](/en/guide/secrets)

### Automations

Automations decide which tasks can run on a schedule and whether they should bind to session context.

Related guide:

- [Run Automations](/en/guide/cron)

### Appearance

Open **Settings → Appearance** to choose the interface theme, language, message layout, and SideDock visibility. Theme choices apply immediately and are kept on the current device across reloads.

The `Island` theme combines a warm paper canvas, a gently swaying tropical tree, and quieter interface chrome for a calmer, more atmospheric workspace. The tree stays still when reduced motion is enabled. It changes presentation only; tasks, sessions, and tool behavior stay the same.

### Privacy and anonymous analytics

NextClaw sends anonymous usage analytics by default to estimate active installations and successful activity for the current day, calendar week, and calendar month. Each window uses an unrelated random one-time receipt. Accounts, login tokens, persistent installation identifiers, messages, replies, tool data, files, URLs, IP addresses, User-Agent, and diagnostic logs are never sent.

You can turn this off at any time under **Settings → Privacy & Analytics**. NextClaw then stops delivery and removes pending local receipts. Existing server data is anonymous aggregate data and cannot be traced back to an installation for deletion. Counts are estimates of active installations rather than exact people; WAU and MAU use calendar-week and calendar-month windows, not rolling 7/30-day windows.

## Check configuration changes

```bash
nextclaw status
nextclaw doctor
```

If a change does not take effect, see [Troubleshooting](/en/guide/troubleshooting).

## When to use commands for configuration

Most users should prefer the UI.  
Use `nextclaw config` when you need scripting, remote maintenance, or exact path-level edits.

For all commands, see [Command Index](/en/guide/commands).
