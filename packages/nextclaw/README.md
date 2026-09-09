# nextclaw

NextClaw aims to be your proactive, continuously improving, long-term AI partner. Today, it brings conversations, agents, skills, CLI tools, automations, and messaging apps together to help you discuss questions and complete work.

The [1.0 roadmap](https://docs.nextclaw.io/en/project/roadmap) covers user understanding, proactive analysis and conversation, self-improvement, and reliable long-term use. These are planned outcomes; full acceptance testing is not complete, and no release date is set.

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
