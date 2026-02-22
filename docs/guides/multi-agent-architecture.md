# Multi-Agent Architecture (Single Gateway)

This guide describes the OpenClaw-aligned multi-agent runtime model in NextClaw.

## 1) Single Gateway, multiple resident agents

One gateway process hosts all core capabilities:

- channel ingress
- routing (`bindings`)
- session isolation (`session.dmScope`)
- agent runtime pool (`agents.list`)
- tool execution and memory access

This avoids per-agent service sprawl and keeps observability/reload in one place.

## 2) Deterministic routing via `bindings`

Route rule shape:

`channel + accountId (+peer) -> agentId`

Example:

```json
{
  "bindings": [
    {
      "agentId": "engineer",
      "match": {
        "channel": "discord",
        "accountId": "zongzhihui",
        "peer": { "kind": "channel", "id": "dev-room" }
      }
    }
  ]
}
```

## 3) Session isolation with `session.dmScope`

Supported scopes:

- `main`
- `per-peer`
- `per-channel-peer`
- `per-account-channel-peer` (recommended for multi-account + multi-channel)

Example:

```json
{
  "session": {
    "dmScope": "per-account-channel-peer",
    "agentToAgent": { "maxPingPongTurns": 0 }
  }
}
```

## 4) Group mention gating (Discord / Telegram)

Both channels support platform-level group response controls:

- `accountId`
- `dmPolicy`
- `groupPolicy`
- `groupAllowFrom`
- `requireMention`
- `mentionPatterns`
- `groups` (per-group override)

Use these to keep group collaboration predictable and low-noise.

## 5) Where to configure

- UI: `Routing & Runtime` + Channel forms
- Config file: `~/.nextclaw/config.json`
- CLI:

```bash
nextclaw config set agents.list '[{"id":"main","default":true},{"id":"engineer"}]' --json
nextclaw config set session.dmScope '"per-account-channel-peer"' --json
```

## 6) Internal AI capability

Yes — NextClaw internal AI can manage this config surface through the built-in `gateway` tool (`config.get/config.schema/config.apply/config.patch`) when explicitly requested.

## 7) Product acceptance checklist

1. Prepare at least 2 agents (`main`, `engineer`) and set `bindings`.
2. Send real user messages and confirm route hits expected role.
3. Verify mention gating in Discord/Telegram (`@` required when configured).
4. Verify DM isolation across users/channels/accounts.
5. Set `maxPingPongTurns=0` and confirm auto ping-pong is blocked.

Pass criteria: stable routing, no context leakage, predictable group triggering, explainable failures.

## 8) Input budget alignment (OpenClaw-style)

NextClaw now includes a unified input-budget pruner before each provider call:

- `agents.defaults.contextTokens` (default `200000`)
- optional per-agent override: `agents.list[*].contextTokens`
- budget strategy:
  - reserve floor `20000`
  - soft threshold `4000`
  - trim order: tool result truncation → oldest-history drop → oversized system/user fallback trim

Example:

```json
{
  "agents": {
    "defaults": { "contextTokens": 200000 },
    "list": [{ "id": "engineer", "contextTokens": 160000 }]
  }
}
```
