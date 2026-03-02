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

Need help choosing model ids and format? See [Model Selection Guide](/en/guide/model-selection).

## Secrets (OpenClaw-style)

NextClaw supports `openclaw secrets`-style secret references with `env` / `file` / `exec` sources.

For full workflow and real-world examples, see [Secrets Management](/en/guide/secrets).

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

Need a full local walkthrough for Ollama + Qwen3? See [Local Ollama + Qwen3 Tutorial (macOS)](/en/guide/tutorials/local-ollama-qwen3).

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

## Troubleshooting Test Connection (UI now forwards details)

When UI shows "Connection test failed", it now includes `status / method / endpoint / body` for faster diagnosis:

- `404` + `POST /api/config/providers/<provider>/test`:
  usually means your local `nextclaw start` runtime is outdated and does not expose this endpoint. Upgrade and retry.
- `401` / `403`:
  usually invalid/expired `apiKey` or incorrect `extraHeaders`.
- `429`:
  provider rate-limited the request. Retry later or switch model/provider.
- `5xx`:
  upstream provider/server error. Retry and check gateway logs.
- `Non-JSON response`:
  the response body is not standard JSON; UI now includes a body snippet (for example plain `404 Not Found`) for debugging.

## Runtime Config (No Restart)

When the gateway is already running, config changes from the UI or `nextclaw config set` are hot-applied for:

- `providers.*`
- `channels.*`
- `agents.defaults.model`
- `agents.defaults.maxToolIterations`
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
