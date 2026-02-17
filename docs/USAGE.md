# nextclaw User Guide

This guide covers installation, configuration, channels, tools, automation, and troubleshooting for nextclaw.

---

## Table of contents

- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Workspace](#workspace)
- [Commands](#commands)
- [Plugins (OpenClaw compatibility)](#plugins-openclaw-compatibility)
- [Channels](#channels)
- [Tools](#tools)
- [Cron & Heartbeat](#cron--heartbeat)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

1. Install:

   ```bash
   npm i -g nextclaw
   ```

2. Start the service (gateway + config UI in the background):

   ```bash
   nextclaw start
   ```

3. Open **http://127.0.0.1:18791** in your browser. Set a provider (e.g. OpenRouter) and model in the UI.

4. Optionally run `nextclaw init` to create a workspace with agent templates, or chat from the CLI:

   ```bash
   nextclaw agent -m "Hello!"
   ```

5. Stop the service when done:

   ```bash
   nextclaw stop
   ```

---

## Configuration

- **Config file:** `~/.nextclaw/config.json`
- **Data directory:** Override with `NEXTCLAW_HOME=/path/to/dir` (config path becomes `$NEXTCLAW_HOME/config.json`).

### Minimal config

```json
{
  "providers": {
    "openrouter": { "apiKey": "sk-or-v1-xxx" }
  },
  "agents": {
    "defaults": { "model": "minimax/MiniMax-M2.5" }
  }
}
```

### Provider examples

**OpenRouter (recommended)**

```json
{
  "providers": { "openrouter": { "apiKey": "sk-or-v1-xxx" } },
  "agents": { "defaults": { "model": "minimax/MiniMax-M2.5" } }
}
```

**MiniMax (Mainland China)**

```json
{
  "providers": {
    "minimax": {
      "apiKey": "sk-api-xxx",
      "apiBase": "https://api.minimaxi.com/v1"
    }
  },
  "agents": { "defaults": { "model": "minimax/MiniMax-M2.5" } }
}
```

**Local vLLM (or any OpenAI-compatible server)**

```json
{
  "providers": {
    "vllm": {
      "apiKey": "dummy",
      "apiBase": "http://localhost:8000/v1"
    }
  },
  "agents": { "defaults": { "model": "meta-llama/Llama-3.1-8B-Instruct" } }
}
```

Supported providers include OpenRouter, OpenAI, Anthropic, MiniMax, Moonshot, Gemini, DeepSeek, DashScope, Zhipu, Groq, vLLM, and AiHubMix. You can configure them in the UI or by editing `config.json`.

---

## Workspace

- **Default path:** `~/.nextclaw/workspace`
- Override in config:

  ```json
  {
    "agents": { "defaults": { "workspace": "~/my-nextclaw" } }
  }
  ```

Initialize the workspace (creates template files if missing):

```bash
nextclaw init
```

Use `nextclaw init --force` to overwrite existing template files.

Created under the workspace:

| File / folder   | Purpose                          |
|-----------------|----------------------------------|
| `AGENTS.md`     | System instructions for the agent |
| `SOUL.md`       | Personality and values            |
| `USER.md`       | User profile hints                |
| `IDENTITY.md`   | Identity context                  |
| `TOOLS.md`      | Tool usage guidelines             |
| `BOOT.md` / `BOOTSTRAP.md` | Boot context               |
| `HEARTBEAT.md`  | Tasks checked periodically        |
| `memory/MEMORY.md` | Long-term notes                |
| `skills/`       | Custom skills                     |

**Heartbeat:** When the gateway is running, `HEARTBEAT.md` in the workspace is checked every 30 minutes. If it contains actionable tasks, the agent will process them.

---

## Commands

| Command | Description |
|---------|-------------|
| `nextclaw start` | Start gateway + UI in the background |
| `nextclaw stop` | Stop the background service |
| `nextclaw ui` | Start UI and gateway in the foreground |
| `nextclaw gateway` | Start gateway only (for channels) |
| `nextclaw serve` | Run gateway + UI in the foreground (no background) |
| `nextclaw agent -m "message"` | Send a one-off message to the agent |
| `nextclaw agent` | Interactive chat in the terminal |
| `nextclaw status` | Show config path and provider status |
| `nextclaw init` | Initialize workspace and template files |
| `nextclaw init --force` | Re-run init and overwrite templates |
| `nextclaw update` | Self-update the CLI |
| `nextclaw channels status` | Show enabled channels and status |
| `nextclaw channels login` | Open QR login for supported channels |
| `nextclaw channels add --channel <id> [--code/--token/...]` | Run plugin channel setup (OpenClaw-compatible) and write config |
| `nextclaw cron list` | List scheduled jobs |
| `nextclaw cron add ...` | Add a cron job (see [Cron](#cron--heartbeat)) |
| `nextclaw cron remove <jobId>` | Remove a job |
| `nextclaw cron enable <jobId>` | Enable a job (use `--disable` to disable) |
| `nextclaw cron run <jobId>` | Run a job once (optionally with `--force` if disabled) |
| `nextclaw skills install <slug>` | Install a skill from ClawHub |
| `nextclaw clawhub install <slug>` | Same as `skills install` |
| `nextclaw plugins list` | List discovered OpenClaw-compatible plugins |
| `nextclaw plugins info <id>` | Show details of a plugin |
| `nextclaw config get <path>` | Get config value by path (use `--json` for structured output) |
| `nextclaw config set <path> <value>` | Set config value by path (use `--json` to parse value as JSON) |
| `nextclaw config unset <path>` | Remove config value by path |
| `nextclaw plugins install <path-or-spec>` | Install from local path, archive, or npm package |
| `nextclaw plugins enable <id>` | Enable a plugin in config |
| `nextclaw plugins disable <id>` | Disable a plugin in config |
| `nextclaw plugins uninstall <id>` | Remove plugin config/install record (supports `--dry-run`, `--force`, `--keep-files`) |
| `nextclaw plugins doctor` | Diagnose plugin load conflicts/errors |

Gateway options (when running `nextclaw gateway` or `nextclaw start`):

- `--ui` — enable the UI server with the gateway
- `--ui-port <port>` — UI port (default 18791 for start)
- `--ui-open` — open the browser when the UI starts

---

## Plugins (OpenClaw compatibility)

nextclaw supports OpenClaw-compatible plugins while keeping compatibility logic isolated in `@nextclaw/openclaw-compat`.

Typical flow:

```bash
# 1) Inspect discovered plugins
nextclaw plugins list

# 2) Install (path/archive/npm)
nextclaw plugins install ./my-plugin
nextclaw plugins install ./my-plugin.tgz
nextclaw plugins install @scope/openclaw-plugin

# 3) Inspect and toggle
nextclaw plugins info my-plugin
nextclaw config get plugins.entries.my-plugin.config --json
nextclaw plugins disable my-plugin
nextclaw plugins enable my-plugin

# 4) Uninstall
nextclaw plugins uninstall my-plugin --dry-run
nextclaw plugins uninstall my-plugin --force
```

Notes:

- Plugin config is merged under `plugins.entries.<id>.config`.
- `plugins uninstall --keep-config` is accepted as a backward-compatible alias of `--keep-files`.
- If a plugin tool/channel/provider conflicts with a built-in capability, nextclaw rejects the conflicting registration and reports diagnostics.

---

## Self-update

Use the built-in updater:

```bash
nextclaw update
```

Behavior:

- If `NEXTCLAW_UPDATE_COMMAND` is set, the CLI executes it (useful for custom update flows).
- Otherwise it falls back to `npm i -g nextclaw`.
- If the background service is running, restart it after the update to apply changes.

If the gateway is running, you can also ask the agent to update; the agent will call the gateway update tool only when you explicitly request it, and a restart will be scheduled afterward.

---

## Channels

All message channels use a common **allowFrom** rule:

- **Empty `allowFrom`** (`[]`): allow all senders.
- **Non-empty `allowFrom`**: only messages from the listed user IDs are accepted.

Configure channels in the UI at http://127.0.0.1:18791 or in `~/.nextclaw/config.json` under `channels`.

### Discord

1. Create a bot in the [Discord Developer Portal](https://discord.com/developers/applications) and get the bot token.
2. Enable **MESSAGE CONTENT INTENT** for the bot.
3. Invite the bot to your server with permissions to read and send messages.

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "YOUR_BOT_TOKEN",
      "allowFrom": []
    }
  }
}
```

### Telegram

1. Create a bot via [@BotFather](https://t.me/BotFather) and get the token.
2. Get your user ID (e.g. from [@userinfobot](https://t.me/userinfobot)).
3. Add your user ID to `allowFrom` to restrict who can use the bot.

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "token": "YOUR_BOT_TOKEN",
      "allowFrom": ["YOUR_USER_ID"]
    }
  }
}
```

Optional: set `"proxy": "http://localhost:7890"` (or your proxy URL) for network access.

### Slack

Socket mode is the typical setup. You need a **Bot Token** and an **App-Level Token** (with `connections:write`).

```json
{
  "channels": {
    "slack": {
      "enabled": true,
      "mode": "socket",
      "botToken": "xoxb-...",
      "appToken": "xapp-...",
      "dm": { "enabled": true, "allowFrom": [] }
    }
  }
}
```

- `dm.enabled`: allow DMs to the bot.
- `dm.allowFrom`: restrict DMs to these user IDs; empty means allow all.

### Feishu (Lark)

Create an app in the [Feishu open platform](https://open.feishu.com/), obtain App ID, App Secret, and (if using encryption) Encrypt Key and Verification Token.

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "YOUR_APP_ID",
      "appSecret": "YOUR_APP_SECRET",
      "encryptKey": "",
      "verificationToken": "",
      "allowFrom": []
    }
  }
}
```

### DingTalk

Create an app in the [DingTalk open platform](https://open.dingtalk.com/) and get Client ID and Client Secret.

```json
{
  "channels": {
    "dingtalk": {
      "enabled": true,
      "clientId": "YOUR_CLIENT_ID",
      "clientSecret": "YOUR_CLIENT_SECRET",
      "allowFrom": []
    }
  }
}
```

### WhatsApp

WhatsApp typically requires a bridge (e.g. a companion service). Configure the bridge URL and optional allowlist:

```json
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "bridgeUrl": "ws://localhost:3001",
      "allowFrom": []
    }
  }
}
```

Use `nextclaw channels login` when the bridge supports QR-based linking.

### Email

Configure IMAP (inbox) and SMTP (sending). The agent can read and reply to emails.

```json
{
  "channels": {
    "email": {
      "enabled": true,
      "consentGranted": true,
      "imapHost": "imap.example.com",
      "imapPort": 993,
      "imapUsername": "you@example.com",
      "imapPassword": "YOUR_PASSWORD",
      "imapMailbox": "INBOX",
      "imapUseSsl": true,
      "smtpHost": "smtp.example.com",
      "smtpPort": 587,
      "smtpUsername": "you@example.com",
      "smtpPassword": "YOUR_PASSWORD",
      "smtpUseTls": true,
      "fromAddress": "you@example.com",
      "autoReplyEnabled": true,
      "pollIntervalSeconds": 30,
      "allowFrom": []
    }
  }
}
```

Set `consentGranted` to `true` after you understand that the agent will read and send mail. Use `allowFrom` to restrict to certain sender addresses if desired.

### QQ

Use the QQ open platform app credentials.

```json
{
  "channels": {
    "qq": {
      "enabled": true,
      "appId": "YOUR_APP_ID",
      "secret": "YOUR_SECRET",
      "markdownSupport": false,
      "allowFrom": []
    }
  }
}
```

### Mochat

Mochat uses a claw token and optional socket URL. Configure base URL, socket, and (optionally) sessions/panels and group rules.

```json
{
  "channels": {
    "mochat": {
      "enabled": true,
      "baseUrl": "https://mochat.io",
      "socketUrl": "",
      "clawToken": "YOUR_CLAW_TOKEN",
      "agentUserId": "",
      "sessions": [],
      "panels": [],
      "allowFrom": []
    }
  }
}
```

After changing channel config, restart the gateway (e.g. `nextclaw stop` then `nextclaw start`) or use the UI if it supports reload.

---

## Tools

### Web search (Brave)

Add a Brave Search API key to enable web search for the agent:

```json
{
  "tools": {
    "web": {
      "search": { "apiKey": "YOUR_BRAVE_KEY", "maxResults": 5 }
    }
  }
}
```

### Command execution (exec)

Allow the agent to run shell commands:

```json
{
  "tools": {
    "exec": { "timeout": 60 }
  },
  "restrictToWorkspace": false
}
```

- `timeout`: max seconds per command.
- `restrictToWorkspace`: if `true`, commands are restricted to the agent workspace directory; if `false`, the agent can run commands in other paths (use with care).

---

## Cron & Heartbeat

### Cron

Schedule one-off or recurring tasks. The agent receives the message at the scheduled time.

List jobs:

```bash
nextclaw cron list
```

Add a one-time job (run at a specific time, ISO format):

```bash
nextclaw cron add -n "reminder" -m "Stand up and stretch" --at "2026-02-15T09:00:00"
```

Add a recurring job (cron expression):

```bash
nextclaw cron add -n "daily-summary" -m "Summarize yesterday" -c "0 9 * * *"
```

Add a job that runs every N seconds:

```bash
nextclaw cron add -n "ping" -m "Ping" -e 3600
```

Optional: deliver the agent’s reply to a channel:

```bash
nextclaw cron add -n "daily" -m "Daily briefing" -c "0 9 * * *" --deliver --to <recipient> --channel <channel>
```

Remove, enable, or disable a job:

```bash
nextclaw cron remove <jobId>
nextclaw cron enable <jobId>
nextclaw cron enable <jobId> --disable
```

Run a job once (e.g. for testing):

```bash
nextclaw cron run <jobId>
```

### Heartbeat

When the gateway is running, it checks the workspace file `HEARTBEAT.md` periodically (e.g. every 30 minutes). If the file contains actionable tasks, the agent processes them. Edit `HEARTBEAT.md` in your workspace to add or change tasks.

---

## UI (optional)

You can tune the UI server in config:

```json
{
  "ui": {
    "enabled": true,
    "host": "127.0.0.1",
    "port": 18791,
    "open": false
  }
}
```

- `enabled`: whether the UI server is started with the gateway (e.g. when using `nextclaw start`).
- `host` / `port`: bind address and port.
- `open`: open the default browser when the UI starts.

Default URL when using `nextclaw start`: **http://127.0.0.1:18791**.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| **401 / invalid API key** | Verify the provider `apiKey` and `apiBase` in config or UI. Ensure no extra spaces or wrong key. |
| **Unknown model** | Confirm the model ID is supported by your provider (e.g. OpenRouter model list). |
| **No replies on a channel** | Ensure the channel is `enabled`, `allowFrom` includes your user ID if set, and the gateway is running (`nextclaw start` or `nextclaw gateway`). Run `nextclaw channels status` to see channel status. |
| **Port already in use** | Change `ui.port` in config or use `--ui-port` when starting. Default UI port is 18791, gateway 18790. |
| **Config not loading** | Ensure `NEXTCLAW_HOME` (if set) points to the directory that contains `config.json`. Run `nextclaw status` to see which config file is used. |
| **Agent not responding in CLI** | Run `nextclaw init` if you have not yet; ensure a provider and model are set and the provider key is valid. |

---
