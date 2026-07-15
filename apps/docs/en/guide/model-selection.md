# Models and providers

NextClaw connects to hosted models, local models, and custom OpenAI-compatible endpoints. A model handles understanding and generation; the agent's files, browser, terminal, skills, and MCP connections determine how it can act.

![Model provider settings in NextClaw](/product-screenshots/nextclaw-providers-page-en.png)

## Pick the easiest path to verify

- Configure a hosted provider when you already have an API key.
- Enter a compatible base URL, credential, and model name for a model gateway.
- Use Ollama or vLLM when the model should run locally.
- Select the appropriate runtime for agents backed by Codex, Claude Code, or another supported path.

The interface includes OpenRouter, OpenAI, Anthropic, Gemini, DeepSeek, MiniMax, Moonshot, Qwen, Zhipu, AiHubMix, vLLM, and custom compatible providers. Actual model availability depends on the account, region, and service configuration.

## Verify more than a greeting

Run a short task that reads material and creates a file. Confirm authentication, streaming, tool calls, file previews, and visible errors all work.

Use multiple models only when cost, speed, privacy, or task type truly differs. A stable default agent plus a few dedicated agents is usually clearer than switching models before every message.

Content sent to a hosted model follows that provider's data policy. Local inference reduces model-data egress, but MCP, channels, and web tools can still send data elsewhere.

See [Choose a provider path](/en/guide/tutorials/provider-options) for setup details.
