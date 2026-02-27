# Commands

## Core Commands

| Command | Description |
|---------|-------------|
| `nextclaw start` | Start gateway + UI in the background |
| `nextclaw restart` | Restart the background service |
| `nextclaw stop` | Stop the background service |
| `nextclaw ui` | Start UI and gateway in the foreground |
| `nextclaw gateway` | Start gateway only (for channels) |
| `nextclaw serve` | Run gateway + UI in the foreground |
| `nextclaw status` | Show runtime status (`--json`, `--verbose`, `--fix`) |
| `nextclaw doctor` | Run runtime diagnostics |
| `nextclaw update` | Self-update the CLI |

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
| `nextclaw cron list` | List scheduled jobs |
| `nextclaw cron add ...` | Add a cron job |
| `nextclaw cron remove <jobId>` | Remove a job |
| `nextclaw cron enable <jobId>` | Enable/disable a job |
| `nextclaw cron run <jobId>` | Run a job once |

## Self-Update

```bash
nextclaw update
```

If `NEXTCLAW_UPDATE_COMMAND` is set, the CLI executes that instead. Otherwise falls back to `npm i -g nextclaw`.
