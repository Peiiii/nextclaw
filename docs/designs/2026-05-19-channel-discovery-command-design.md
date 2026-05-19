# Channel Discovery Command Design

## Problem

Cross-channel messaging currently depends on the model knowing the exact channel id before it calls `message`. After channel behavior moved into extensions, the model can see a user phrase such as "微信" and still guess `wechat`, while the runtime channel id is `weixin`.

That guess creates a dangerous failure mode: `message` can report success even though the outbound bus cannot deliver to an unknown channel.

## Root Cause

- Valid channel ids are runtime data, but there was no stable, structured discovery command for the AI to call.
- The `message` tool accepted arbitrary `channel` strings and only validated target shape, not whether the channel exists.
- Downstream delivery failure for an unknown channel was not reflected back into the tool result.

## Design

Make channel discovery an explicit CLI contract:

```bash
nextclaw channels list --json
```

The command returns the authoritative local channel list for agent use. The AI-facing cross-channel messaging skill tells the model to call this command before using `message` whenever the exact channel id or outbound capability is not already explicit.

The `message` tool then fail-fast validates explicit channel ids against the runtime extension registry. If the model calls `message` with `channel: "wechat"` while only `weixin` exists, the tool returns an error and does not publish outbound.

## Command Contract

`nextclaw channels list --json` returns:

```json
{
  "channels": [
    {
      "id": "weixin",
      "label": "Weixin",
      "pluginId": "nextclaw-channel-extension-weixin",
      "enabled": true,
      "outbound": { "text": true },
      "auth": { "login": true },
      "defaultAccountId": "..."
    }
  ]
}
```

`defaultAccountId` is included only when config exposes it. Secret tokens and credentials are never printed.

## Non-Goals

- Do not add `wechat -> weixin` aliases.
- Do not normalize natural language channel names in the delivery layer.
- Do not reintroduce prompt-only `messageToolHints` as the primary channel discovery path.

## Owner Boundaries

- `ChannelCommands` owns the CLI list command because it already owns channel status/login/setup commands and can load plugin channel bindings.
- `MessageTool` owns parameter validation because it is the first executable boundary that can prevent a bad tool call from becoming a false success.
- `NextclawNcpToolRegistry` owns wiring available extension channel ids into `MessageTool` because it already prepares tools for each run and can see the current extension registry.
- `cross-channel-messaging` owns AI procedure: discover channels with the command, then call `message` with exact ids.

## Validation

- Unit test `channels list --json` output.
- Unit test `message` rejects unknown explicit channels and skips publish.
- Run TypeScript checks for touched packages.
- Run targeted command smoke for `nextclaw channels list --json`.
- Run governance and maintainability closure.
