# Advanced Configuration

Who this is for: users who already completed the beginner flow and need deeper customization.

## Config file and data directory

- Default config file: `~/.nextclaw/config.json`
- Default data directory: `~/.nextclaw`
- Override with `NEXTCLAW_HOME=/path/to/dir`

Minimal example:

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

## Secret refs (OpenClaw-style)

Supports `env` / `file` / `exec`. Recommended pattern is mapping sensitive paths via `secrets.refs`.

```json
{
  "providers": {
    "openai": { "apiKey": "" }
  },
  "secrets": {
    "providers": {
      "env-main": { "source": "env" }
    },
    "refs": {
      "providers.openai.apiKey": {
        "source": "env",
        "provider": "env-main",
        "id": "OPENAI_API_KEY"
      }
    }
  }
}
```

## Runtime hot-reload scope

When gateway is running, changes from UI or `nextclaw config set` hot-apply for:

- `providers.*`
- `channels.*`
- `agents.defaults.model`
- `agents.defaults.maxToolIterations`
- `agents.defaults.contextTokens`
- `agents.context.*`
- `tools.*`
- `plugins.*`

Still requires restart: UI bind port (`--port` / `--ui-port`).

## Context budget

- `agents.defaults.contextTokens`: model input budget (default `200000`)
- When over budget, tool outputs are trimmed first, then older history.

## Workspace templates

Initialize workspace:

```bash
nextclaw init
```

Common files: `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `memory/MEMORY.md`, and `skills/`.

## Multi-agent note (still evolving)

Multi-agent routing is still being refined. Enable it only when you clearly need identity/workflow isolation.

- Reference: [Multi-Agent Routing](/en/guide/multi-agent)

## Related docs

- [Commands](/en/guide/commands)
- [Troubleshooting](/en/guide/troubleshooting)
