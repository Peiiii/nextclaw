# Multi-Agent Routing

You can configure OpenClaw-style multi-agent runtime behavior in the UI (**Routing & Runtime**) or in `config.json`.

## Key Settings

- `agents.list`: run multiple resident agent roles in one gateway process
- `bindings`: route inbound messages by `channel + accountId (+peer)` to a target `agentId`
- `session.dmScope`: DM isolation strategy

## Example Config

```json
{
  "agents": {
    "defaults": { "model": "openai/gpt-5.2-codex" },
    "list": [
      { "id": "main", "default": true },
      { "id": "engineer", "workspace": "~/workspace-engineer", "model": "openai/gpt-5.2-codex" }
    ]
  },
  "bindings": [
    {
      "agentId": "engineer",
      "match": {
        "channel": "discord",
        "accountId": "default",
        "peer": { "kind": "channel", "id": "dev-room" }
      }
    }
  ],
  "session": {
    "dmScope": "per-account-channel-peer"
  }
}
```

## DM Scope Values

> ⚠️ `session.dmScope` accepts **only** these 4 values:

| Value | Isolation |
|-------|-----------|
| `main` | All DMs share one session |
| `per-peer` | One session per peer |
| `per-channel-peer` | One session per channel + peer |
| `per-account-channel-peer` | Full isolation per account + channel + peer |

## Binding Match Semantics

`bindings` are processed in array order — **first matching rule wins**.

- `match.channel` is required
- `match.accountId`: omit = match `default` only, `"*"` = match all
- `match.peer`: omit = match all peers
- No match = falls back to default agent

## Recommended Setup

1. Keep `main` as the default fallback role
2. Add specialist agents (`engineer`, `ops`, `support`)
3. Route with `bindings` (channel/account/peer based)
4. Use `dmScope="per-account-channel-peer"` for multi-account isolation
