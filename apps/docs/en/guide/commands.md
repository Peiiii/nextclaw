# Command Index

This page is the lookup-style reference for the public NextClaw CLI.  
Its goal is to cover the available command surface as completely as practical so users, operators, and AI assistants can search by topic and map product actions back to the CLI.

If you are just trying to install, start, or troubleshoot NextClaw for the first time, do not start here. Use:

- [Quick Start](/en/guide/getting-started)
- [Core Commands](/en/guide/core-commands)
- [Runtime & Hosting](/en/guide/runtime-hosting)

## Core runtime commands

| Command | Description |
|---------|-------------|
| `nextclaw start` | Start gateway + UI in the background |
| `nextclaw restart` | Restart the background service with optional start flags |
| `nextclaw stop` | Stop the background service |
| `nextclaw ui` | Start UI and gateway in the foreground |
| `nextclaw gateway` | Start gateway only (for channels) |
| `nextclaw serve` | Run gateway + UI in the foreground |
| `nextclaw --version` | Show the installed version |
| `nextclaw status` | Show runtime state (`--json`, `--verbose`, `--fix`) |
| `nextclaw doctor` | Run diagnostics (`--json`, `--verbose`, `--fix`) |
| `nextclaw usage` | Show the latest observed LLM usage snapshot (`--history`, `--stats`, `--limit <n>`, `--json`) |
| `nextclaw update` | Self-update the CLI |

## Host runtime and autostart commands

| Command | Description |
|---------|-------------|
| `nextclaw service install-systemd --user` | Install a user-level Linux `systemd` service |
| `sudo nextclaw service install-systemd --system` | Install a system-wide Linux `systemd` service |
| `nextclaw service uninstall-systemd --user` | Remove a user-level Linux `systemd` service |
| `sudo nextclaw service uninstall-systemd --system` | Remove a system-wide Linux `systemd` service |
| `nextclaw service install-launch-agent` | Install a managed macOS LaunchAgent |
| `nextclaw service uninstall-launch-agent` | Remove a managed macOS LaunchAgent |
| `nextclaw service install-task` | Install a managed Windows Scheduled Task |
| `nextclaw service uninstall-task` | Remove a managed Windows Scheduled Task |
| `nextclaw service autostart status` | Show host autostart status |
| `nextclaw service autostart doctor` | Diagnose host autostart setup |

Notes:

- `npm i -g nextclaw` installs the CLI only and does not auto-register host autostart
- Linux supports `--user` and `--system`
- `autostart status` and `autostart doctor` are read-only checks

Product explanation:

- [Background & Autostart](/en/guide/background-autostart)

## Workspace and init commands

| Command | Description |
|---------|-------------|
| `nextclaw init` | Initialize workspace and template files |
| `nextclaw init --force` | Re-run init and overwrite templates |

## Agent commands

| Command | Description |
|---------|-------------|
| `nextclaw agent -m "message"` | Send a one-off message to the agent |
| `nextclaw agent` | Interactive chat in the terminal |
| `nextclaw agent --session <id> --model <model>` | Bind a model/provider route to one session |
| `nextclaw agents list` | List built-in and created agents |
| `nextclaw agents runtimes` | List installed agent runtimes (`--json`, `--probe`) |
| `nextclaw agents new <agent-id>` | Create a new agent |
| `nextclaw agents update <agent-id>` | Update display metadata for an existing agent |
| `nextclaw agents remove <agent-id>` | Remove an extra agent |

## Platform login and remote access commands

| Command | Description |
|---------|-------------|
| `nextclaw login --api-base <url>` | Start browser sign-in for NextClaw Platform and save the local token |
| `nextclaw remote enable` | Enable service-managed remote access |
| `nextclaw remote disable` | Disable service-managed remote access |
| `nextclaw remote status` | Show remote runtime/config status |
| `nextclaw remote doctor` | Diagnose remote readiness |
| `nextclaw remote connect` | Foreground debug mode: register and keep the connector online |

Product explanation:

- [Remote Access](/en/guide/remote-access)

## Config commands

| Command | Description |
|---------|-------------|
| `nextclaw config get <path>` | Get a config value |
| `nextclaw config set <path> <value>` | Set a config value (`--json` parses structured input) |
| `nextclaw config unset <path>` | Remove a config value |

## Secrets commands

| Command | Description |
|---------|-------------|
| `nextclaw secrets audit` | Audit refs and resolution status (`--strict`, `--json`) |
| `nextclaw secrets configure --provider <alias> ...` | Create/update/remove a provider alias (`env/file/exec`) |
| `nextclaw secrets apply ...` | Apply refs/defaults/providers patch (`--file` or single `--path`) |
| `nextclaw secrets reload` | Trigger runtime secrets reload |

## Channel commands

| Command | Description |
|---------|-------------|
| `nextclaw channels status` | Show enabled channels and status |
| `nextclaw channels login` | Open QR login for supported channels |
| `nextclaw channels add --channel <id> ...` | Configure a channel through the setup adapter |

## Plugin commands

| Command | Description |
|---------|-------------|
| `nextclaw plugins list` | List discovered plugins |
| `nextclaw plugins info <id>` | Show plugin details |
| `nextclaw plugins install <path-or-spec>` | Install from local path/archive or npm spec |
| `nextclaw plugins uninstall <id>` | Uninstall a plugin (`--dry-run` supported) |
| `nextclaw plugins enable <id>` | Enable a plugin in config |
| `nextclaw plugins disable <id>` | Disable a plugin in config |
| `nextclaw plugins doctor` | Diagnose plugin loading issues |

## Skills and marketplace commands

| Command | Description |
|---------|-------------|
| `nextclaw skills installed` | List installed skills from the local runtime (`--json`, `--scope`, `--query`) |
| `nextclaw skills info <selector>` | Show installed skill details from the local runtime (`--json`) |
| `nextclaw skills install <slug>` | Compatibility shortcut that installs a marketplace skill into `<workspace>/skills/<slug>` |
| `nextclaw skills publish <dir>` | Upload/create a marketplace skill |
| `nextclaw skills update <dir>` | Update an existing marketplace skill |
| `nextclaw marketplace skills search` | Search marketplace skills |
| `nextclaw marketplace skills info <slug>` | Show marketplace skill details |
| `nextclaw marketplace skills recommend` | List recommended marketplace skills |
| `nextclaw marketplace skills install <slug>` | Install a marketplace skill through the explicit marketplace domain |

## Cron commands

| Command | Description |
|---------|-------------|
| `nextclaw cron list` | List all scheduled jobs, including disabled ones |
| `nextclaw cron add ...` | Add a cron job |
| `nextclaw cron remove <jobId>` | Remove a job |
| `nextclaw cron enable <jobId>` | Enable a disabled job |
| `nextclaw cron disable <jobId>` | Disable a job without deleting it |
| `nextclaw cron run <jobId>` | Run a job once (optionally with `--force`) |

## When this page is the right entry

- you already know the topic you need
- you want the official command name
- you want to map a product workflow page to a concrete CLI action
- you want AI to consult a broad command index instead of only the beginner flow

## Related Docs

- [Core Commands](/en/guide/core-commands)
- [Runtime & Hosting](/en/guide/runtime-hosting)
- [Background & Autostart](/en/guide/background-autostart)
- [Troubleshooting](/en/guide/troubleshooting)
