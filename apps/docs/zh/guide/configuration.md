# 配置

## 配置文件

- **配置文件：** `~/.nextclaw/config.json`
- **数据目录：** 可用 `NEXTCLAW_HOME=/path/to/dir` 覆盖（配置路径变为 `$NEXTCLAW_HOME/config.json`）。

## 最小配置

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

如需确认模型 id 与格式，见：[模型选型指南](/zh/guide/model-selection)。

## Secrets（OpenClaw 风格）

NextClaw 已支持 `openclaw secrets` 风格的秘密引用，支持 `env` / `file` / `exec` 三类来源。

完整流程与实际场景示例见：[密钥管理](/zh/guide/secrets)。

推荐使用 `secrets.refs` 将“配置路径”映射到“secret ref”：

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

兼容说明：
- 也支持把 ref 直接写在敏感字段里，例如：
  `{ "providers": { "openai": { "apiKey": { "source": "env", "id": "OPENAI_API_KEY" } } } }`
- NextClaw 在加载配置时会自动将这种写法归一化到 `secrets.refs`。

## Provider 示例

### OpenRouter（推荐）

```json
{
  "providers": { "openrouter": { "apiKey": "sk-or-v1-xxx" } },
  "agents": { "defaults": { "model": "minimax/MiniMax-M2.5" } }
}
```

### MiniMax（中国大陆）

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

### 本地 vLLM（或任意 OpenAI 兼容服务）

如果你要按步骤跑通本地 Ollama + Qwen3，见：[本地 Ollama + Qwen3 教程（macOS）](/zh/guide/tutorials/local-ollama-qwen3)。

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

支持的 Provider 包括 OpenRouter、OpenAI、Anthropic、MiniMax、Moonshot、Gemini、DeepSeek、DashScope、Zhipu、Groq、vLLM、AiHubMix 等。

## 测试连接失败排查（UI 提示含透传信息）

当 UI 提示“连接测试失败”时，现在会直接带上 `status / method / endpoint / body` 关键信息，建议按下列方式判断：

- `404` + `POST /api/config/providers/<provider>/test`：
  多数是本地 `nextclaw start` 运行时版本过旧，缺少该接口；升级到最新版本后重试。
- `401` / `403`：
  通常是 `apiKey` 错误、过期，或 `extraHeaders` 配置不正确。
- `429`：
  提供商限流；稍后重试，或更换模型/提供商。
- `5xx`：
  提供商服务端异常，优先重试并查看网关日志。
- `Non-JSON response`：
  说明返回不是标准 JSON 错误体，UI 会附带原始片段帮助定位（例如 `404 Not Found` HTML/纯文本）。

## 运行时热更新（无需重启）

网关运行时，通过 UI 或 `nextclaw config set` 的以下配置可热应用：

- `providers.*`
- `channels.*`
- `agents.defaults.model`
- `agents.defaults.maxToolIterations`
- `agents.defaults.contextTokens`
- `agents.context.*`
- `tools.*`
- `plugins.*`

仍需重启的配置：

- UI 绑定端口（`--port` / `--ui-port`）
