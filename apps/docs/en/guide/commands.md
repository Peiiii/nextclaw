# Commands

## Core Commands

| Command | Description |
|---------|-------------|
| `nextclaw start` | Start gateway + UI in the background |
| `nextclaw restart` | Restart the background service |
| `nextclaw stop` | Stop the background service |
| `nextclaw service install-systemd --user` | Install a user-level Linux `systemd` service |
| `sudo nextclaw service install-systemd --system` | Install a system-wide Linux `systemd` service |
| `nextclaw service uninstall-systemd --user` | Remove a user-level Linux `systemd` service |
| `sudo nextclaw service uninstall-systemd --system` | Remove a system-wide Linux `systemd` service |
| `nextclaw service install-launch-agent` | Install a macOS LaunchAgent |
| `nextclaw service uninstall-launch-agent` | Remove a macOS LaunchAgent |
| `nextclaw service install-task` | Install a Windows Scheduled Task |
| `nextclaw service uninstall-task` | Remove a Windows Scheduled Task |
| `nextclaw service autostart status` | Show host autostart status |
| `nextclaw service autostart doctor` | Diagnose host autostart setup |
| `nextclaw ui` | Start UI and gateway in the foreground |
| `nextclaw gateway` | Start gateway only (for channels) |
| `nextclaw serve` | Run gateway + UI in the foreground |
| `nextclaw --version` | Show the installed NextClaw version |
| `nextclaw status` | Show runtime status (`--json`, `--verbose`, `--fix`) |
| `nextclaw doctor` | Run runtime diagnostics |
| `nextclaw update` | Self-update the CLI |

`npm i -g nextclaw` only installs the CLI. It does not register a host autostart owner by itself.

For npm/CLI installs, the host-native autostart owner is platform-specific:

- Linux: `systemd` (`--user` or `--system`)
- macOS: LaunchAgent
- Windows: Scheduled Task

`nextclaw service autostart status` and `nextclaw service autostart doctor` are read-only. Add `--user` or `--system` only when you need to disambiguate Linux `systemd` scope.

If you expose NextClaw behind Nginx/Caddy/Traefik on a Linux server, use `sudo nextclaw service install-systemd --system` instead of relying on a one-time `nextclaw start`. Otherwise a reboot or exited process can surface as `502 Bad Gateway` at the reverse proxy.

## Agent Commands

| Command | Description |
|---------|-------------|
| `nextclaw agent -m "message"` | Send a one-off message |
| `nextclaw agent` | Interactive chat in the terminal |
| `nextclaw agent --session <id>` | Use a specific session |

## Config Commands

| Command | Description |
|---------|-------------|
| `nextclaw config get <path>` | Get config value |
| `nextclaw config set <path> <value>` | Set config value (`--json`) |
| `nextclaw config unset <path>` | Remove config value |
| `nextclaw init` | Initialize workspace templates |

## Secrets Commands

| Command | Description |
|---------|-------------|
| `nextclaw secrets audit` | Audit configured refs and resolution status (`--strict`, `--json`) |
| `nextclaw secrets configure --provider <alias> ...` | Create/update/remove a provider alias (`env/file/exec`) |
| `nextclaw secrets apply ...` | Apply refs/defaults/providers patch (`--file` or single `--path`) |
| `nextclaw secrets reload` | Trigger runtime secrets reload |

See [Secrets Management](/en/guide/secrets) for step-by-step usage and migration examples.

## Channel Commands

| Command | Description |
|---------|-------------|
| `nextclaw channels status` | Show enabled channels |
| `nextclaw channels login` | Open QR login for supported channels |
| `nextclaw channels add --channel <id>` | Configure a channel |

## Plugin Commands

| Command | Description |
|---------|-------------|
| `nextclaw plugins list` | List discovered plugins |
| `nextclaw plugins install <spec>` | Install plugin |
| `nextclaw plugins uninstall <id>` | Uninstall plugin |
| `nextclaw plugins enable <id>` | Enable plugin |
| `nextclaw plugins disable <id>` | Disable plugin |
| `nextclaw plugins doctor` | Diagnose plugin issues |

## Cron Commands

| Command | Description |
|---------|-------------|
| `nextclaw cron list` | List all scheduled jobs, including disabled ones |
| `nextclaw cron add ...` | Add a cron job |
| `nextclaw cron remove <jobId>` | Remove a job |
| `nextclaw cron enable <jobId>` | Enable a disabled job |
| `nextclaw cron disable <jobId>` | Disable a job without deleting it |
| `nextclaw cron run <jobId>` | Run a job once |

## Self-Update

```bash
nextclaw update
```

If `NEXTCLAW_UPDATE_COMMAND` is set, the CLI executes that instead. Otherwise falls back to `npm i -g nextclaw`.
