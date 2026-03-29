---
name: cross-channel-messaging
description: Use when the user wants the AI to send, relay, or notify through another NextClaw session or chat channel, especially after work completes, including choosing between normal replies, sessions_send, and message, and resolving route/account details without guessing.
---

# Cross-Channel Messaging

This is a NextClaw built-in skill for the AI itself.

It does not introduce a new runtime abstraction. It teaches the AI how to use existing NextClaw messaging primitives in a predictable way.

Use this skill when the user wants any of these:

- send a result to another conversation,
- notify them through Weixin, Lark, Telegram, Signal, or another channel,
- proactively send a message after a task finishes,
- forward or relay content across sessions or channels.

## Core Rule

Do not invent a separate notification system.

Pick the smallest existing primitive that already matches the user intent:

1. Reply in the current conversation:
   Just reply normally when the user means the current session.
2. Send to another existing session:
   Use `sessions_send(sessionKey|label, message)` when the target is an existing routable session.
3. Proactively send to an explicit channel route:
   Use `message` when the user wants a direct outbound send to a specific channel/chat/account route.

## Tool Choice

### Normal reply

Use a normal assistant reply when:

- the user only means "tell me here",
- the target is clearly the current session,
- no cross-session or cross-channel delivery is needed.

### `sessions_send`

Use `sessions_send` when:

- the target already exists as another session,
- you know a valid `sessionKey`,
- or a stable session `label` is already known.

Prefer `sessions_send` over `message` when an existing session already captures the route.

### `message`

Use `message` when:

- the user explicitly wants a proactive send,
- the target is described as a channel route rather than a known session,
- you need to send to a specific `channel` + `to/chatId`,
- or the user asks for a channel action that belongs to the message tool.

For `action=send`, provide:

- `message` or `content`,
- `to` or `chatId`,
- `channel` when the destination channel is not the current one,
- `accountId` when the channel is multi-account and the account is known.

If `message` is used to deliver the user-visible result for the turn, do not also send a normal assistant reply.

## Route Resolution Order

Resolve the target in this order:

1. Explicit user input:
   `sessionKey`, `label`, `channel`, `to/chatId`, `accountId`, or a clearly named destination.
2. Current session route:
   Only when the user clearly means "here", "this chat", or the current conversation.
3. Existing known session:
   Use `sessions_send` if the intended target already exists as a routable session.
4. Authoritative context already exposed to the AI:
   tool hints, existing session metadata, project docs, or a known local config file path/content.
5. Ask a narrow follow-up question.

Never guess `channel`, `chatId`, `sessionKey`, or `accountId`.

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

Do not turn this skill into a Weixin-only skill.

## Failure Handling

If delivery fails because route information is missing or ambiguous:

- surface the missing field clearly,
- ask only for the smallest missing piece,
- do not silently fall back to another channel,
- do not silently send back into the current session instead.

If the user asks for "notify me when done" but no target route is actually known, ask where to send it.

## Success Criteria

This skill is working correctly when:

- the AI chooses between normal reply, `sessions_send`, and `message` correctly,
- it reuses existing session routes when possible,
- it reads route/account information from explicit context when available,
- it asks for missing route data instead of guessing,
- and it keeps the solution lightweight by using existing NextClaw primitives only.
