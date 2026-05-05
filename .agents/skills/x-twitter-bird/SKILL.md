---
name: x-twitter-bird
description: Use when the user wants to read bookmarks, likes, threads, search X/Twitter, or draft/post/reply through bird CLI with reusable local credentials stored on this machine.
---

# X / Twitter via bird

Use this skill when the user wants X/Twitter operations in this repo workflow.

What this skill owns:

- Store and reuse local X credentials for `bird`
- Read bookmarks / likes / tweets / threads / search results
- Draft or send posts and replies when the user explicitly asks

## Primary contract

- Credentials live in a user-local file, not in the repo:
  - default path: `~/.nextclaw/secrets/x-bird.json`
- All X operations go through `scripts/x-bird.mjs`
- The script passes `--auth-token` and `--ct0` explicitly to `bird`
- Do not rely on `bird` auto-reading env vars; the installed `bird 0.9.0` in this environment hard-fails unless the CLI args are present

## Setup

Store credentials once:

```bash
node .agents/skills/x-twitter-bird/scripts/x-bird.mjs auth set --auth-token '<token>' --ct0 '<token>'
```

Check the current account:

```bash
node .agents/skills/x-twitter-bird/scripts/x-bird.mjs whoami --plain
```

## Common commands

Read bookmarks:

```bash
node .agents/skills/x-twitter-bird/scripts/x-bird.mjs bookmarks -n 20 --json
```

Read likes:

```bash
node .agents/skills/x-twitter-bird/scripts/x-bird.mjs likes -n 20 --json
```

Search:

```bash
node .agents/skills/x-twitter-bird/scripts/x-bird.mjs search 'DeepSeek V4 reasoning_content' -n 10 --json
```

Read a tweet or thread:

```bash
node .agents/skills/x-twitter-bird/scripts/x-bird.mjs read <tweet-id-or-url> --json
node .agents/skills/x-twitter-bird/scripts/x-bird.mjs thread <tweet-id-or-url> --json
```

Post only after the user explicitly asks:

```bash
node .agents/skills/x-twitter-bird/scripts/x-bird.mjs tweet 'text here'
node .agents/skills/x-twitter-bird/scripts/x-bird.mjs reply <tweet-id-or-url> 'text here'
```

## Rules

- Treat `auth_token` and `ct0` as full login credentials
- Never write them into repo files, docs, tests, or iteration logs
- Before posting, confirm the exact text or use the user-provided text verbatim
- Prefer `--json` for read/search workflows so downstream analysis stays structured
- If the user asks for only reading, do not post, like, follow, or unbookmark anything
