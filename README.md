# nextbot

nextbot is a lightweight personal AI assistant with a simple CLI, multi-provider LLM routing,
chat app integrations, and scheduled automation. It is built with TypeScript/Node and is
intended to be easy to deploy, read, and extend.

## Features

- Minimal CLI for direct chat and long-running gateway mode
- Multi-provider LLM support via OpenAI-compatible APIs
- Channels: Telegram, Discord, WhatsApp, Feishu, Mochat, DingTalk, Slack, Email, QQ
- Cron and heartbeat tasks for scheduled and periodic automation
- Workspace memory and skills directory
- Tools: web search (Brave) and local command execution

## Install (from source)

Requirements: Node.js >= 18, pnpm

```bash
git clone https://github.com/Peiiii/nextbot.git
cd nextbot
pnpm install
```

Optional build:

```bash
pnpm -C packages/nextbot build
```

## Quick Start

1) Initialize config and workspace

```bash
pnpm -C packages/nextbot dev onboard
```

2) Configure `~/.nextbot/config.json`

OpenRouter example (recommended for global users):

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

MiniMax (China) example:

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

3) Chat

```bash
pnpm -C packages/nextbot dev agent -m "Hello from nextbot"
```

If you installed the CLI globally (or are running the built dist), you can use:

```bash
nextbot agent -m "Hello from nextbot"
```

## Local Models (vLLM)

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

```bash
pnpm -C packages/nextbot dev agent -m "Hello from my local model"
```

## Chat Apps

Run in gateway mode to enable channels:

```bash
pnpm -C packages/nextbot dev gateway
```

See `docs/USAGE.md` for detailed channel setup and permissions.

## Docs

- `docs/USAGE.md`: configuration, providers, channels, cron, and troubleshooting
- `docs/logs/`: development notes

## License

MIT
