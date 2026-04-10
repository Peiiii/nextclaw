# @nextclaw/channel-plugin-weixin

Weixin channel plugin for NextClaw.

Current scope:

- QR login through `nextclaw channels login --channel weixin`
- inbound long-poll via Weixin iLink `getupdates`
- outbound text reply after an inbound Weixin message, including `context_token` reuse
- Weixin typing indicator during agent processing, with `typing_ticket` keepalive and stop cleanup
- outbound text send API path for proactive send from the `message` tool
- multi-account routing through `accountId`

Validated on 2026-03-23:

- real QR login succeeded
- real inbound message pull succeeded
- real reply to an existing user conversation succeeded

Current boundary:

- cold-start proactive delivery without an existing conversation context is not yet confirmed as a user-visible Weixin delivery, even though the upstream API currently returns `200 {}`

Example:

```bash
nextclaw channels login --channel weixin
```
