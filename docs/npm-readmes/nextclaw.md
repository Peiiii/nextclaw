# nextclaw

Turn your computer into a powerful AI assistant that coordinates agents, skills, CLI tools, automations, and messaging apps.

## Install

```bash
npm i -g nextclaw
```

## Quick start

```bash
nextclaw start
```

Then open `http://127.0.0.1:55667`.

On a VPS, NextClaw serves plain HTTP on `55667`. Use `http://<server-ip>:55667` directly for a quick check, or put Nginx/Caddy in front for `80/443`. `https://` must be terminated by the reverse proxy, not by NextClaw itself.

## Common commands

```bash
nextclaw --version
nextclaw status
nextclaw stop
nextclaw update
```

## Docs

- Product docs: https://docs.nextclaw.io
- Repository: https://github.com/Peiiii/nextclaw
- Changelog: https://github.com/Peiiii/nextclaw/blob/master/packages/nextclaw/CHANGELOG.md
- Iteration logs: https://github.com/Peiiii/nextclaw/tree/master/docs/logs
