# NextClaw User Guide

This guide covers installation, configuration, channels, tools, automation, and troubleshooting for NextClaw.

---

## AI Self-Management Contract

When NextClaw AI needs to operate the product itself (status/doctor/channels/config/cron), follow these rules:

1. **Read this guide first** (`USAGE.md`) before executing management commands.
2. **Prefer machine-readable output** (`--json`) whenever available.
3. **Close the loop after changes** with `nextclaw status --json` (and `nextclaw doctor --json` when needed).
4. **Be explicit about restart semantics** (hot-apply, auto-restart, or manual restart required).
5. **Never invent commands**; use documented commands or `nextclaw --help` / `nextclaw <subcommand> --help`.

---

## Table of contents

- [AI Self-Management Contract](#ai-self-management-contract)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Input context budget](#input-context-budget)
- [Multi-agent routing & session isolation](#multi-agent-routing--session-isolation-openclaw-aligned)
- [Workspace](#workspace)
- [Commands](#commands)
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

### Runtime config apply behavior (no restart)

When the gateway is already running, config changes from the UI or `nextclaw config set` are hot-applied for these paths:

- `providers.*`
- `channels.*`
- `agents.defaults.model`
- `agents.defaults.maxToolIterations`
- `agents.defaults.maxTokens`
- `agents.defaults.contextTokens`
- `agents.context.*`
- `tools.*`

Restart is still required for:

- UI bind port (`--port` / `--ui-port`)
- `plugins.*`

To confirm hot reload succeeded, check gateway console logs or `${NEXTCLAW_HOME:-~/.nextclaw}/logs/service.log` for messages like `Config reload: ... applied.`

### Multi-agent routing & session isolation (OpenClaw-aligned)

You can now configure OpenClaw-style multi-agent runtime behavior directly in the UI (**Routing & Runtime**) or in `config.json`:

- `agents.list`: run multiple resident agent roles in one gateway process
- `bindings`: route inbound messages by `channel + accountId (+peer)` to a target `agentId`
- `session.dmScope`: DM isolation strategy (`main` / `per-peer` / `per-channel-peer` / `per-account-channel-peer`)
- `session.agentToAgent.maxPingPongTurns`: cap cross-agent ping-pong loops (`0` means block auto ping-pong)

See full architecture details in [Multi-Agent Architecture](guides/multi-agent-architecture.md).

Example:

```json
{
  "agents": {
    "defaults": { "model": "openai/gpt-5.2-codex" },
    "list": [
      { "id": "main", "default": true },
      {
        "id": "engineer",
        "workspace": "~/workspace-engineer",
        "model": "openai/gpt-5.2-codex",
        "maxTokens": 12000,
        "contextTokens": 200000,
        "maxToolIterations": 24
      }
    ]
  },
  "bindings": [
    {
      "agentId": "engineer",
      "match": {
        "channel": "discord",
        "accountId": "zongzhihui",
        "peer": { "kind": "channel", "id": "dev-room" }
      }
    }
  ],
  "session": {
    "dmScope": "per-account-channel-peer",
    "agentToAgent": { "maxPingPongTurns": 0 }
  }
}
```

CLI equivalents:

```bash
nextclaw config set agents.list '[{"id":"main","default":true},{"id":"engineer"}]' --json
nextclaw config set bindings '[{"agentId":"engineer","match":{"channel":"discord","accountId":"zongzhihui"}}]' --json
nextclaw config set session.dmScope '"per-account-channel-peer"' --json
nextclaw config set session.agentToAgent.maxPingPongTurns 0 --json
```

### Multi-agent collaboration playbook (recommended)

Use this baseline for predictable team-style collaboration:

1. Keep `main` as the default fallback role.
2. Add specialist agents in `agents.list` (for example `engineer`, `ops`, `support`).
3. Route stable traffic classes with `bindings` (channel/account/peer based).
4. Use `session.dmScope="per-account-channel-peer"` for multi-account + multi-channel isolation.
5. Set `session.agentToAgent.maxPingPongTurns=0` first, then increase only when you explicitly want cross-agent relay.

Suggested role split:

- `main`: default reception, broad Q&A, fallback when no binding matches.
- `engineer`: technical channels / dev rooms.
- `ops`: deployment/monitoring channels.
- `support`: customer-facing groups.

### Binding match semantics (deterministic)

`bindings` are processed in array order, and the **first matching rule wins**.

- `match.channel` is required for a valid match.
- `match.accountId`:
  - omitted/empty => matches only account `default`
  - `"*"` => matches all accounts
  - specific value => matches that normalized account id
- `match.peer` omitted => matches all peers under the selected channel/account scope.
- if no binding matches, routing falls back to the default agent (`agents.list[].default`, otherwise first agent, otherwise `main`).

Example with explicit precedence (more specific rule first):

```json
{
  "bindings": [
    {
      "agentId": "engineer",
      "match": {
        "channel": "discord",
        "accountId": "zongzhihui",
        "peer": { "kind": "channel", "id": "dev-room" }
      }
    },
    {
      "agentId": "support",
      "match": {
        "channel": "discord",
        "accountId": "*"
      }
    }
  ]
}
```

### Collaboration recipes

Recipe A — default + specialist routing:

```bash
nextclaw config set agents.list '[{"id":"main","default":true},{"id":"engineer"}]' --json
nextclaw config set bindings '[{"agentId":"engineer","match":{"channel":"discord","accountId":"zongzhihui","peer":{"kind":"channel","id":"dev-room"}}}]' --json
```

Recipe B — multi-account safe isolation:

```bash
nextclaw config set session.dmScope '"per-account-channel-peer"' --json
```

Recipe C — reduce noisy group triggering:

```bash
nextclaw config set channels.discord.requireMention true --json
nextclaw config set channels.discord.groupPolicy '"allowlist"' --json
nextclaw config set channels.discord.groupAllowFrom '["dev-room"]' --json
```

### Multi-agent acceptance checklist

1. Prepare at least two agents (`main` + one specialist).
2. Add at least one binding and verify inbound messages hit the expected role.
3. Verify DM isolation across user/channel/account boundaries under the selected `dmScope`.
4. If Discord/Telegram group collaboration is enabled, verify mention gating (`requireMention` / `mentionPatterns`) behavior.
5. Verify auto ping-pong policy with `session.agentToAgent.maxPingPongTurns` (set `0` to block).

Pass criteria: stable routing, no cross-session context leakage, predictable group triggering, explainable fallback behavior.

### Multi-agent troubleshooting quick map

- Routed to wrong agent:
  - check binding order (specific rules must be before broad rules)
  - confirm `match.accountId` and `match.peer` actually match inbound metadata
- Always falls back to `main`:
  - verify `bindings` is not empty and `match.channel` is correct
  - verify target `agentId` exists in `agents.list`
- Group messages not triggering:
  - check `groupPolicy`, `groupAllowFrom`, and `requireMention`
  - confirm message text matches configured `mentionPatterns` if enabled
- DM context looks mixed:
  - switch to `session.dmScope="per-account-channel-peer"`
  - re-test across two users/channels/accounts and compare outcomes

### Input context budget

NextClaw now applies a token-budget input pruner before each model call.

- `agents.defaults.contextTokens`: model input context budget (default `200000`)
- reserve floor: `20000` tokens
- soft threshold: `4000` tokens
- when over budget: trim tool results first, then drop oldest history, then trim oversized prompt/user tail as final fallback

CLI examples:

```bash
nextclaw config set agents.defaults.contextTokens 200000 --json
nextclaw config set agents.list '[{"id":"engineer","contextTokens":160000}]' --json
```

For internal AI operations (same as other built-in capabilities):

- Yes, the runtime registers the `gateway` tool (`config.get` / `config.schema` / `config.apply` / `config.patch`).
- The AI can use it to manage the same config surface when you explicitly ask.
- As with all config mutations, it follows the explicit-request rule (no silent self-mutation).

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
| `USAGE.md`      | CLI operation guide for users and AI |
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
| `nextclaw restart` | Restart the background service with optional start flags |
| `nextclaw stop` | Stop the background service |
| `nextclaw ui` | Start UI and gateway in the foreground |
| `nextclaw gateway` | Start gateway only (for channels) |
| `nextclaw serve` | Run gateway + UI in the foreground (no background) |
| `nextclaw agent -m "message"` | Send a one-off message to the agent |
| `nextclaw agent` | Interactive chat in the terminal |
| `nextclaw agent --session <id> --model <model>` | Use a session-specific model/provider route (sticky for that session) |
| `nextclaw status` | Show runtime process/health/config status (`--json`, `--verbose`, `--fix`) |
| `nextclaw init` | Initialize workspace and template files |
| `nextclaw init --force` | Re-run init and overwrite templates |
| `nextclaw update` | Self-update the CLI |
| `nextclaw plugins list` | List discovered OpenClaw-compatible plugins |
| `nextclaw plugins info <id>` | Show plugin details |
| `nextclaw plugins install <path-or-spec>` | Install plugin from local path/archive or npm spec |
| `nextclaw plugins uninstall <id>` | Uninstall plugin (with optional `--dry-run`) |
| `nextclaw plugins enable <id>` | Enable plugin in config |
| `nextclaw plugins disable <id>` | Disable plugin in config |
| `nextclaw plugins doctor` | Diagnose plugin loading issues |
| `nextclaw channels status` | Show enabled channels and status |
| `nextclaw doctor` | Run runtime diagnostics (`--json`, `--verbose`, `--fix`) |
| `nextclaw channels login` | Open QR login for supported channels |
| `nextclaw channels add --channel <id> ...` | Configure plugin channel via setup adapter |
| `nextclaw cron list` | List scheduled jobs |
| `nextclaw cron add ...` | Add a cron job (see [Cron](#cron--heartbeat)) |
| `nextclaw cron remove <jobId>` | Remove a job |
| `nextclaw cron enable <jobId>` | Enable a job (use `--disable` to disable) |
| `nextclaw cron run <jobId>` | Run a job once (optionally with `--force` if disabled) |
| `nextclaw skills install <slug>` | Install a skill from ClawHub |
| `nextclaw clawhub install <slug>` | Same as `skills install` |
| `nextclaw config get <path>` | Get config value by path (use `--json` for structured output) |
| `nextclaw config set <path> <value>` | Set config value by path (use `--json` to parse value as JSON) |
| `nextclaw config unset <path>` | Remove config value by path |

Gateway options (when running `nextclaw gateway` or `nextclaw start`):

- `--ui` — enable the UI server with the gateway
- `--ui-port <port>` — UI port (default 18791 for start)
- `--ui-open` — open the browser when the UI starts

If service is already running, new UI port flags do not hot-apply; use `nextclaw restart ...` to apply them.

Status/diagnostics tips:

- `nextclaw status` shows runtime truth (process + health + config summary).
- `nextclaw status --json` outputs machine-readable status and sets exit code (`0` healthy, `1` degraded, `2` stopped).
- `nextclaw status --fix` safely clears stale service state if PID is dead.
- `nextclaw doctor` runs additional checks (state coherence, health, port availability, provider readiness).

OpenClaw-compatible plugin discovery paths:

- `${NEXTCLAW_HOME:-~/.nextclaw}/extensions`
- `<workspace>/.nextclaw/extensions`
- `plugins.load.paths` entries in config

Legacy OpenClaw directories are not scanned by default (`~/.openclaw/extensions`, `<workspace>/.openclaw/extensions`).

Silent reply behavior:

- If the model contains `<noreply/>`, NextClaw does not send any channel reply.
- If the final normalized reply is empty/whitespace, NextClaw also keeps silent (no fallback text).
- This matches OpenClaw's core no-reply expectation while keeping logic minimal.

---

## Self-update

Use the built-in updater:

```bash
nextclaw update
```

Behavior:

- If `NEXTCLAW_UPDATE_COMMAND` is set, the CLI executes it (useful for custom update flows).
- Otherwise it falls back to `npm i -g nextclaw`.
- `nextclaw update` now prints version progress explicitly: `Current version: x.y.z`, then either `Version updated: x.y.z -> a.b.c` or `Version unchanged: x.y.z`.
- If the background service is running, restart it after the update to apply changes.
- When update is triggered from the running gateway (agent `update.run`), NextClaw arms a self-relaunch helper before exiting, so the service comes back automatically (like an OS reboot flow).
- After restart, NextClaw automatically pings the last active session with restart/update status (including note when provided).

If the gateway is running, you can also ask the agent to update; the agent will call the gateway update tool only when you explicitly request it, and restart/relaunch will be scheduled afterward.

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
      "allowBots": false,
      "allowFrom": [],
      "accountId": "zongzhihui",
      "dmPolicy": "open",
      "groupPolicy": "allowlist",
      "groupAllowFrom": ["dev-room"],
      "requireMention": true,
      "mentionPatterns": ["@工程师", "@engineer"],
      "groups": {
        "dev-room": {
          "requireMention": true,
          "mentionPatterns": ["@engineer"]
        }
      }
    }
  }
}
```

- `allowBots` (default `false`): whether to accept bot-authored messages. Keep it `false` unless you explicitly need bot-to-bot flows.

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
      "allowFrom": ["YOUR_USER_ID"],
      "accountId": "zongzhihui",
      "dmPolicy": "open",
      "groupPolicy": "allowlist",
      "groupAllowFrom": ["GROUP_ID"],
      "requireMention": true,
      "mentionPatterns": ["@工程师", "@engineer"],
      "groups": {
        "GROUP_ID": {
          "requireMention": true,
          "mentionPatterns": ["@engineer"]
        }
      }
    }
  }
}
```

Optional: set `"proxy": "http://localhost:7890"` (or your proxy URL) for network access.

Telegram Bot API behavior note:

- In **groups**, bots generally do **not** receive messages from other bots.
- For bot-to-bot scenarios, prefer **Telegram channels**. NextClaw now processes `channel_post` updates as inbound messages.

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
      "allowBots": false,
      "dm": { "enabled": true, "allowFrom": [] }
    }
  }
}
```

- `dm.enabled`: allow DMs to the bot.
- `dm.allowFrom`: restrict DMs to these user IDs; empty means allow all.
- `allowBots` (default `false`): whether bot-authored Slack messages can trigger replies.

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

### WeCom (Enterprise WeChat)

Create an internal app in the [WeCom admin console](https://work.weixin.qq.com/), then collect:

- `corpId` (Enterprise ID)
- `agentId` (application Agent ID)
- `secret` (application secret)
- `token` (callback token)

Set the callback URL to `http://<your-host>:<callbackPort><callbackPath>` and keep callback mode in plaintext (the runtime currently skips encrypted callback payloads).

```json
{
  "channels": {
    "wecom": {
      "enabled": true,
      "corpId": "YOUR_CORP_ID",
      "agentId": "1000002",
      "secret": "YOUR_APP_SECRET",
      "token": "YOUR_CALLBACK_TOKEN",
      "callbackPort": 18890,
      "callbackPath": "/wecom/callback",
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

After changing channel config, NextClaw hot-reloads channel runtime automatically when the gateway is running.

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
    "host": "0.0.0.0",
    "port": 18791,
    "open": false
  }
}
```

- `enabled`: whether the UI server is started with the gateway (e.g. when using `nextclaw start`).
- `host` / `port`: bind address and port; `ui.host` is read-only in practice (CLI start paths always enforce `0.0.0.0`).
- `open`: open the default browser when the UI starts.

Default URL when using `nextclaw start`: **http://127.0.0.1:18791**.

NextClaw binds UI to `0.0.0.0` by default and attempts to detect/print a public IP-based URL at startup.

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
