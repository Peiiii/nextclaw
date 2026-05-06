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
