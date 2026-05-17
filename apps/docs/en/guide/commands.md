# Command Index

This is a lookup reference, not the onboarding path.  
If you are installing and starting NextClaw for the first time, use [Quickstart](/en/guide/getting-started).

## Core runtime

| Command | Purpose |
|---------|---------|
| `nextclaw start` | Start the background service and UI |
| `nextclaw restart` | Restart the service |
| `nextclaw stop` | Stop the service |
| `nextclaw serve` | Run in the foreground for debugging |
| `nextclaw status` | Inspect runtime status |
| `nextclaw doctor` | Run diagnostics |
| `nextclaw update` | Update the runtime |
| `nextclaw usage` | View usage snapshots |

## Host management

| Command | Purpose |
|---------|---------|
| `nextclaw service install-systemd --user` | Install a Linux user-level systemd service |
| `sudo nextclaw service install-systemd --system` | Install a Linux system-level systemd service |
| `nextclaw service install-launch-agent` | Install a macOS LaunchAgent |
| `nextclaw service install-task` | Install a Windows scheduled task |
| `nextclaw service autostart status` | Inspect autostart state |
| `nextclaw service autostart doctor` | Diagnose autostart configuration |

## Remote access

| Command | Purpose |
|---------|---------|
| `nextclaw remote enable` | Enable remote access |
| `nextclaw remote disable` | Disable remote access |
| `nextclaw remote status` | Inspect remote access state |
| `nextclaw remote doctor` | Diagnose remote access |

## Configuration

| Command | Purpose |
|---------|---------|
| `nextclaw config get <path>` | Read configuration |
| `nextclaw config set <path> <value>` | Write configuration |
| `nextclaw config unset <path>` | Remove configuration |

## Secrets

| Command | Purpose |
|---------|---------|
| `nextclaw secrets audit` | Audit secret references |
| `nextclaw secrets configure` | Configure secret provider behavior |
| `nextclaw secrets reload` | Reload secrets |

## Channels

| Command | Purpose |
|---------|---------|
| `nextclaw channels status` | Inspect channel state |
| `nextclaw channels login` | Log in to supported QR-code channels |
| `nextclaw channels add` | Add channel configuration |

## Automation

| Command | Purpose |
|---------|---------|
| `nextclaw cron list` | List jobs |
| `nextclaw cron add` | Add a job |
| `nextclaw cron remove <jobId>` | Remove a job |
| `nextclaw cron enable <jobId>` | Enable a job |
| `nextclaw cron disable <jobId>` | Disable a job |
| `nextclaw cron run <jobId>` | Run a job immediately |

## Extensions and Skills

| Command | Purpose |
|---------|---------|
| `nextclaw plugins list` | List plugins |
| `nextclaw plugins install <spec>` | Install a plugin |
| `nextclaw plugins enable <id>` | Enable a plugin |
| `nextclaw skills installed` | List installed skills |
| `nextclaw marketplace skills search` | Search marketplace skills |
| `nextclaw marketplace skills install <slug>` | Install a marketplace skill |

## Agent

| Command | Purpose |
|---------|---------|
| `nextclaw agent` | Terminal chat |
| `nextclaw agent -m "message"` | Send a one-shot message |
| `nextclaw agents list` | List agents |
| `nextclaw agents runtimes` | List runtimes |

## Related docs

- [Core Commands](/en/guide/core-commands)
- [Troubleshooting](/en/guide/troubleshooting)
- [Runtime & Hosting](/en/guide/runtime-hosting)
