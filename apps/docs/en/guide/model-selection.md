# Set Up Providers

A provider tells NextClaw which model service to call. For the first setup, do not try to design the perfect stack. Choose the path most likely to work quickly.

## Recommended order

1. If you want the fastest path, start with [Pick a Provider Path](/en/guide/tutorials/provider-options).
2. If you already have an API key, configure that provider.
3. If you want a local model, use [Local Ollama + Qwen3](/en/guide/tutorials/local-ollama-qwen3).

## Minimum setup

- provider name
- API base or platform entry point
- authentication method
- default model

After saving, return to the UI and send one real message.

## When to add multiple models

Do not start by configuring every model you can find. Multiple models make sense when:

- one model is for fast drafts
- one model is for harder reasoning
- one model is local or offline
- different sessions need different bindings

## Common issue

### The model is configured but no reply arrives

Run:

```bash
nextclaw doctor
```

Then check:

- whether the API key is valid
- whether the model name exists for that provider
- whether the default model was saved

## Related docs

- [Configuration Manual](/en/guide/configuration)
- [Secrets Management](/en/guide/secrets)
- [Troubleshooting](/en/guide/troubleshooting)
