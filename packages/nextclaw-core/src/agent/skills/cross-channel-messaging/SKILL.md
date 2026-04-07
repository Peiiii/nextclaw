---
name: cross-channel-messaging
description: Use when the user wants the AI to send, relay, or notify through another NextClaw session or chat channel, especially after work completes, including deciding between a normal reply and message, and resolving route/account details without guessing.
---

# Cross-Channel Messaging

This is a NextClaw built-in skill for the AI itself.

It does not introduce a new runtime abstraction. It teaches the AI how to use existing NextClaw messaging primitives in a predictable way.

Use this skill when the user wants any of these:

- send a result to another conversation,
- notify them through Weixin, Lark, Telegram, Signal, or another channel,
- proactively send a message after a task finishes,
- forward or relay content across sessions or channels.

Strong triggers include user wording such as:

- "notify me when done",
- "send this to my Weixin",
- "message me on Telegram",
- "forward the result to another chat",
- "after you finish, send me a note elsewhere".

Do not wait for the user to name this skill. If the task is about delivery, routing, relaying, notifying, or proactive messaging, load this skill.

## Core Rule

Do not invent a separate notification system.

Pick the smallest existing primitive that already matches the user intent:

1. Reply in the current conversation:
   Just reply normally when the user means the current session.
2. Send to another conversation or channel:
   Use `message` when the user wants a direct outbound send to a specific channel/chat/account route.
   If an existing session may already hold the route, use `sessions_list` narrowly to recover that route first, then call `message`.

## Tool Choice

### Normal reply

Use a normal assistant reply when:

- the user only means "tell me here",
- the target is clearly the current session,
- no cross-session or cross-channel delivery is needed.

### `message`

Use `message` when:

- the user explicitly wants a proactive send,
- the target is described as a channel route,
- you need to send to a specific `channel` + `to/chatId`,
- or the user asks for a channel action that belongs to the message tool.

For `action=send`, provide:

- `message` or `content`,
- `to` or `chatId`,
- `channel` when the destination channel is not the current one,
- `accountId` when the channel is multi-account and the account is known.

If you explicitly set `channel` to a different channel than the current session, `to/chatId` is mandatory.
Do not rely on current-session fallback for cross-channel delivery.

If `message` is used to deliver the user-visible result for the turn, do not also send a normal assistant reply.

## Route Resolution Order

Resolve the target in this order:

1. Explicit user input:
   `sessionKey`, `label`, `channel`, `to/chatId`, `accountId`, or a clearly named destination.
2. Current session route:
   Only when the user clearly means "here", "this chat", or the current conversation.
3. Existing known session:
   Use `sessions_list` to recover the saved route if the intended target already exists as a routable session.
4. Authoritative context already exposed to the AI:
   tool hints, existing session metadata, project docs, or a known local config file path/content.
5. Ask a narrow follow-up question.

Never guess `channel`, `chatId`, `sessionKey`, or `accountId`.

Current-session fallback only applies when the current session is already the intended delivery conversation.
It does not authorize cross-channel sends such as `channel=feishu` from a UI/CLI/Weixin session without an explicit Feishu target.

## Config And Local Files

Local config can be a useful source of truth, but only when it is already available to the AI in an explicit and auditable way.

Use config or local files when:

- the relevant path is already known,
- the current environment clearly exposes that file,
- and the file is meant to describe saved channel/account routing information.

Do not assume:

- that a hidden config file exists,
- that you know its path without evidence,
- or that a saved account in config automatically proves the destination is reachable right now.

Treat config as route data, not as delivery proof.

## Authoritative Route Sources

When this skill is active, prefer route sources in this order:

1. A route the user explicitly typed.
2. A route already exposed in system prompt/tool hints.
3. A saved session route that the environment already surfaced.
4. A local config file only when its path/content is already available in the current environment.

Do not ignore tool hints and then ask the user again for the same route data.

## Multi-Account Channels

For channels that may have multiple logged-in accounts:

- if one account is explicitly specified, pass `accountId`,
- if the environment clearly exposes a default account, that may be enough,
- if there are multiple plausible accounts and no clear default, ask.

Do not silently choose an arbitrary account.

## Weixin As An Example

Weixin is only one example of a channel handled through the same general rule set.

When the user asks for Weixin delivery:

- prefer an existing Weixin session if one already exists,
- otherwise use `message` with explicit route data,
- include `accountId` when multiple Weixin accounts may exist,
- do not claim that proactive delivery is guaranteed visible unless the environment already proves that.

### Weixin Route Lookup Checklist

Before asking the user for a Weixin `user_id`, check whether the environment already exposed any of these hints:

- `Known Weixin self-notify route: channel='weixin', accountId='...', to='...@im.wechat'`
- `Known Weixin proactive routes: ...`
- `Default Weixin accountId is '...'`
- any current session or existing session metadata that already contains a Weixin route

Rules:

- If `Known Weixin self-notify route` is present and there is no conflicting target, use it directly.
- If exactly one Weixin route is already exposed, do not ask again for `user_id`.
- If only `accountId` is known but `to/user_id` is still unknown, ask only for the missing Weixin `user_id`.
- If multiple Weixin routes are exposed, ask the user which one to use instead of guessing.
- If you need to check whether a matching Weixin session already exists, prefer `sessions_list({ channel: "weixin", to, accountId })` over a broad unfiltered session listing.

### Weixin User ID Safety

Weixin `user_id@im.wechat` is channel-specific route data.

- Do not call Feishu/Lark/Telegram contact lookup tools to guess a Weixin user id.
- Do not assume a user id from another channel can be reused on Weixin.
- Do not ask for a generic "user info" field when the only missing value is the Weixin `user_id`.
- Ask only for the exact missing field, for example: `Please provide the Weixin user id in the form <user_id@im.wechat>.`

Do not turn this skill into a Weixin-only skill.

## Feishu As Another Example

When the user asks for Feishu/Lark delivery:

- omitting `target` is only valid if the current session itself is already a Feishu conversation,
- for proactive sends from UI, CLI, or another channel, resolve an explicit Feishu route first,
- preferred explicit targets are `user:<open_id>` for direct messages and `chat:<chat_id>` for group chats,
- if a saved Feishu session already exists, prefer reusing that session route over guessing.

### Feishu Route Lookup Checklist

Before asking the user again, check whether the environment already exposed any of these:

- a current Feishu session,
- an existing Feishu session from `sessions_list`,
- saved session metadata such as `last_channel=feishu` and `last_to=ou_...`,
- a known default Feishu account when multi-account routing matters.

Rules:

- If the current session is Feishu, replying there may omit `target`.
- If the current session is not Feishu, do not call `message(channel=feishu)` without `to/chatId`.
- If an existing Feishu session already gives you the route, recover that route and send with `message`.
- If only the Feishu destination is missing, ask only for the missing `open_id` or `chat_id`.

## Failure Handling

If delivery fails because route information is missing or ambiguous:

- surface the missing field clearly,
- ask only for the smallest missing piece,
- do not silently fall back to another channel,
- do not silently send back into the current session instead.

If the user asks for "notify me when done" but no target route is actually known, ask where to send it.

## Common Failure Patterns To Avoid

- Seeing "Weixin" and then trying unrelated user lookup tools from another channel.
- Ignoring a known self-notify route that was already injected into context.
- Asking for both `accountId` and `user_id` when only one of them is actually missing.
- Falling back to a normal reply in the current chat when the user explicitly requested proactive delivery.
- Claiming proactive send is impossible before checking tool hints, current session metadata, and known routes.

## Success Criteria

This skill is working correctly when:

- the AI chooses between a normal reply and `message` correctly,
- it reuses existing session routes when possible,
- it reads route/account information from explicit context when available,
- it asks for missing route data instead of guessing,
- and it keeps the solution lightweight by using existing NextClaw primitives only.
