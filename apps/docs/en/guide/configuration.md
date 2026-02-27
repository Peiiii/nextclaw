# Configuration

## Config File

- **Config file:** `~/.nextclaw/config.json`
- **Data directory:** Override with `NEXTCLAW_HOME=/path/to/dir` (config path becomes `$NEXTCLAW_HOME/config.json`).

## Minimal Config

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

## Secrets (OpenClaw-style)

NextClaw supports `openclaw secrets`-style secret references with `env` / `file` / `exec` sources.

Use `secrets.refs` to map config paths to secret refs:

```json
{
  "providers": {
    "openai": { "apiKey": "" }
  },
  "secrets": {
    "providers": {
      "env-main": { "source": "env" },
      "file-main": { "source": "file", "path": "~/.nextclaw/secrets.json" },
      "exec-main": {
        "source": "exec",
        "command": "node",
        "args": ["scripts/secret-snapshot.mjs"],
        "timeoutMs": 5000
      }
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

Compatibility note:
- Inline refs are also accepted on sensitive fields, for example:
  `{ "providers": { "openai": { "apiKey": { "source": "env", "id": "OPENAI_API_KEY" } } } }`
- NextClaw normalizes inline refs into `secrets.refs` when loading config.

## Provider Examples

### OpenRouter (recommended)

```json
{
  "providers": { "openrouter": { "apiKey": "sk-or-v1-xxx" } },
  "agents": { "defaults": { "model": "minimax/MiniMax-M2.5" } }
}
```

### MiniMax (Mainland China)

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

### Local vLLM (or any OpenAI-compatible server)

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

Supported providers include OpenRouter, OpenAI, Anthropic, MiniMax, Moonshot, Gemini, DeepSeek, DashScope, Zhipu, Groq, vLLM, and AiHubMix.

## Runtime Config (No Restart)

When the gateway is already running, config changes from the UI or `nextclaw config set` are hot-applied for:

- `providers.*`
- `channels.*`
- `agents.defaults.model`
- `agents.defaults.maxToolIterations`
- `agents.defaults.maxTokens`
- `agents.defaults.contextTokens`
- `agents.context.*`
- `tools.*`
- `plugins.*`

Restart is still required for:
- UI bind port (`--port` / `--ui-port`)

## Input Context Budget

NextClaw applies a token-budget input pruner before each model call.

- `agents.defaults.contextTokens`: model input context budget (default `200000`)
- reserve floor: `20000` tokens
- soft threshold: `4000` tokens
- when over budget: trim tool results first, then drop oldest history, then trim oversized prompt/user tail

```bash
nextclaw config set agents.defaults.contextTokens 200000 --json
nextclaw config set agents.list '[{"id":"engineer","contextTokens":160000}]' --json
```

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

Created under the workspace:

| File / folder   | Purpose                          |
|-----------------|----------------------------------|
| `AGENTS.md`     | System instructions for the agent |
| `SOUL.md`       | Personality and values            |
| `USER.md`       | User profile hints                |
| `IDENTITY.md`   | Identity context                  |
| `TOOLS.md`      | Tool usage guidelines             |
| `USAGE.md`      | CLI operation guide               |
| `HEARTBEAT.md`  | Tasks checked periodically        |
| `memory/MEMORY.md` | Long-term notes                |
| `skills/`       | Custom skills                     |
