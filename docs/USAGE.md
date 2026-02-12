# nextclaw Usage

This guide covers configuration, providers, channels, cron, heartbeat, and common workflows.

## Configuration

Default config path:

- `~/.nextclaw/config.json`

Override data directory:

- `NEXTCLAW_HOME=/path/to/dir`

### Minimal config

```json
{
  "providers": {
    "openrouter": { "apiKey": "sk-or-v1-xxx" }
  },
  "agents": {
    "defaults": { "model": "anthropic/claude-opus-4-5" }
  }
}
```

### MiniMax (China)

```json
{
  "providers": {
    "minimax": {
      "apiKey": "sk-api-xxx",
      "apiBase": "https://api.minimaxi.com/v1"
    }
  },
  "agents": {
    "defaults": { "model": "minimax/MiniMax-M2.1" }
  }
}
```

### Local models (vLLM or any OpenAI-compatible server)

```json
{
  "providers": {
    "vllm": {
      "apiKey": "dummy",
      "apiBase": "http://localhost:8000/v1"
    }
  },
  "agents": {
    "defaults": { "model": "meta-llama/Llama-3.1-8B-Instruct" }
  }
}
```

## Workspace

Default workspace path:

- `~/.nextclaw/workspace`

You can override this in config:

```json
{
  "agents": {
    "defaults": { "workspace": "~/my-nextclaw" }
  }
}
```

Created by `onboard`:

- `AGENTS.md`: system instructions for the agent
- `SOUL.md`: personality and values
- `USER.md`: user profile hints
- `memory/MEMORY.md`: long-term notes
- `skills/`: custom skills

Heartbeat:

- `HEARTBEAT.md` in the workspace is checked every 30 minutes when `gateway` runs.
- If the file contains actionable tasks, the agent will process it.

## Running

Initialize:

```bash
pnpm -C packages/nextclaw dev onboard
```

CLI (dev):

```bash
pnpm -C packages/nextclaw dev agent -m "Hello"
```

Gateway (for channels):

```bash
pnpm -C packages/nextclaw dev gateway
```

Status:

```bash
pnpm -C packages/nextclaw dev status
```

UI (gateway + config UI):

```bash
pnpm -C packages/nextclaw dev ui
```

All-in-one (gateway + UI backend + UI frontend):

```bash
pnpm -C packages/nextclaw dev start
```

Notes:

- If UI static assets are bundled, `start` serves them from the UI backend.
- In dev mode, it tries to start the UI frontend dev server automatically.

UI config (optional):

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

Background (nohup):

```bash
nohup pnpm -C packages/nextclaw dev gateway > ~/.nextclaw/logs/gateway.log 2>&1 &
```

## Channels

### allowFrom behavior

- Empty `allowFrom` means allow all senders.
- If set, only user IDs in the list are allowed.

### Discord

Config:

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

Notes:

- In the Discord Developer Portal, enable MESSAGE CONTENT intent.
- Invite the bot with permissions to read and send messages.

### Telegram

Config:

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

### Slack

Config (socket mode):

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

## Tools

Web search (Brave):

```json
{
  "tools": {
    "web": {
      "search": { "apiKey": "YOUR_BRAVE_KEY", "maxResults": 5 }
    }
  }
}
```

Exec tool:

```json
{
  "tools": {
    "exec": { "timeout": 60 },
    "restrictToWorkspace": false
  }
}
```

## Cron

List jobs:

```bash
pnpm -C packages/nextclaw dev cron list
```

Add a one-time job:

```bash
pnpm -C packages/nextclaw dev cron add \
  --name "reminder" \
  --message "Stand up and stretch" \
  --at "2026-02-12T09:00:00"
```

Add a recurring job:

```bash
pnpm -C packages/nextclaw dev cron add \
  --name "daily-summary" \
  --message "Summarize yesterday" \
  --cron "0 9 * * *"
```

## Troubleshooting

- 401 invalid api key: verify the provider key and the target apiBase.
- Unknown model: confirm the model name is supported by your provider.
- No channel replies: confirm `allowFrom` and gateway is running.
