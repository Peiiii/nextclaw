# Secrets Management

Secrets management stores API keys, tokens, and other sensitive values. The goal is to avoid scattered plaintext and make rotation and diagnostics easier.

## What belongs in secrets

- model provider API keys
- channel tokens
- platform credentials
- sensitive values reused across configuration

## Basic rules

- Do not put secrets in public docs, chat history, or screenshots.
- A secret should serve only the capability it needs to serve.
- When a secret is revoked, the impact should be understandable.
- Use diagnostics to check whether references still resolve.

## Useful checks

```bash
nextclaw secrets audit
nextclaw doctor
```

## Relationship with configuration

Configuration says which secret to use.  
Secrets management says where the secret comes from and how it resolves.

## Related docs

- [Configuration Manual](/en/guide/configuration)
- [Set Up Providers](/en/guide/model-selection)
- [Command Index](/en/guide/commands)
