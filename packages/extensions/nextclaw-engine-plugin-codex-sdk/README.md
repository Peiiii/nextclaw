# @nextclaw/nextclaw-engine-codex-sdk

Independent NextClaw engine plugin that registers `codex-sdk` using OpenAI official `@openai/codex-sdk`.

## Build

```bash
pnpm -C packages/extensions/nextclaw-engine-plugin-codex-sdk build
```

## Usage (local path)

Add plugin load path to config:

```json
{
  "plugins": {
    "load": {
      "paths": [
        "/absolute/path/to/packages/extensions/nextclaw-engine-plugin-codex-sdk"
      ]
    }
  },
  "agents": {
    "defaults": {
      "engine": "codex-sdk",
      "model": "openai/gpt-5-codex",
      "engineConfig": {
        "apiBase": "https://your-relay.example.com/v1",
        "apiKey": "sk-xxx"
      }
    }
  }
}
```
