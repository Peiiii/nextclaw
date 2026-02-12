<div align="center">

# nextclaw

**A lighter, easier-to-use OpenClaw — one command, built-in UI.**

[![npm](https://img.shields.io/npm/v/nextclaw)](https://www.npmjs.com/package/nextclaw)
[![Node](https://img.shields.io/badge/node-%3E%3D18-blue)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

[![Star History Chart](https://api.star-history.com/svg?repos=Peiiii/nextclaw&type=Date)](https://star-history.com/#Peiiii/nextclaw&Date)

[Quick Start](#quick-start) · [Features](#features) · [Channels](#channels) · [Docs](docs/USAGE.md)

</div>

---

## Features

| Feature | Description |
|---------|-------------|
| **One-command start** | `nextclaw start` — background service + config UI |
| **Built-in config UI** | No extra setup after `npm i -g nextclaw` |
| **Multi-provider** | First-class OpenAI-compatible routing across OpenRouter, OpenAI, MiniMax, Moonshot, Gemini, DeepSeek, DashScope, Zhipu, Groq, vLLM, and more |
| **Channels** | Telegram, Discord, WhatsApp, Feishu, DingTalk, Slack, Email, QQ, Mochat |
| **Automation** | Cron + Heartbeat for scheduled tasks |
| **Local tools** | Web search, command execution |

---

## Quick Start

```bash
npm i -g nextclaw
nextclaw start
```

Open **http://127.0.0.1:18791** → configure provider & model in the UI. Config: `~/.nextclaw/config.json`.

```bash
nextclaw stop   # stop service
```

---

## Provider examples

<details>
<summary>OpenRouter (recommended)</summary>

```json
{
  "providers": { "openrouter": { "apiKey": "sk-or-v1-xxx" } },
  "agents": { "defaults": { "model": "anthropic/claude-opus-4-5" } }
}
```

</details>

<details>
<summary>MiniMax (Mainland China)</summary>

```json
{
  "providers": {
    "minimax": { "apiKey": "sk-api-xxx", "apiBase": "https://api.minimaxi.com/v1" }
  },
  "agents": { "defaults": { "model": "minimax/MiniMax-M2.1" } }
}
```

</details>

<details>
<summary>Local vLLM</summary>

```json
{
  "providers": {
    "vllm": { "apiKey": "dummy", "apiBase": "http://localhost:8000/v1" }
  },
  "agents": { "defaults": { "model": "meta-llama/Llama-3.1-8B-Instruct" } }
}
```

</details>

---

## Commands

| Command | Description |
|---------|-------------|
| `nextclaw start` | Start background service (gateway + UI) |
| `nextclaw stop` | Stop background service |
| `nextclaw ui` | Start UI backend + gateway (foreground) |
| `nextclaw gateway` | Start gateway only (for channels) |
| `nextclaw agent -m "hello"` | Chat in CLI |
| `nextclaw status` | Show config + provider status |
| `nextclaw channels status` | Show enabled channels |
| `nextclaw channels login` | QR login for supported channels |

---

## Channels

| Channel | Setup |
|---------|-------|
| Telegram | Easy (bot token) |
| Discord | Easy (bot token + intents) |
| WhatsApp | Medium (QR login) |
| Feishu | Medium (app credentials) |
| Mochat | Medium (claw token + websocket) |
| DingTalk | Medium (app credentials) |
| Slack | Medium (bot + app tokens) |
| Email | Medium (IMAP/SMTP) |
| QQ | Easy (app credentials) |

---

## Docs

- [Configuration, providers, channels, cron](docs/USAGE.md)

## From source

```bash
git clone https://github.com/Peiiii/nextclaw.git
cd nextclaw
pnpm install
pnpm -C packages/nextclaw dev serve --frontend
```

---

<div align="center">

**License** [MIT](LICENSE)

</div>
