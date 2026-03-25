# @nextclaw/nextclaw-engine-claude-agent-sdk

Independent NextClaw engine plugin that registers `claude-agent-sdk` using Anthropic official `@anthropic-ai/claude-agent-sdk`.

## Build

```bash
pnpm -C packages/extensions/nextclaw-engine-plugin-claude-agent-sdk build
```

## Usage (local path)

Add plugin load path to config:

```json
{
  "plugins": {
    "load": {
      "paths": [
        "/absolute/path/to/packages/extensions/nextclaw-engine-plugin-claude-agent-sdk"
      ]
    }
  },
  "agents": {
    "defaults": {
      "engine": "claude-agent-sdk",
      "model": "claude-sonnet-4-6",
      "engineConfig": {
        "apiKey": "sk-ant-xxx"
      }
    }
  }
}
```

`engineConfig.requestTimeoutMs` is optional and disabled by default.
Set it explicitly only when you want a hard timeout for each Claude request.
