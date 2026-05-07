---
name: qq-group-speaker-distinction
description: Use when integrating QQ group chat where users want one shared group session, but the assistant must still distinguish who said each message.
---

# QQ Group Speaker Distinction

Use this skill when the user says "do not isolate by user in group chat" but still needs speaker separation.

## Core Rule

- Keep one session key per group: `qq:group:{group_id}`.
- Attach speaker identity on each inbound message before it enters model context.
- Speaker identity must include stable `user_id`; nickname is only a display field.

## Minimal Implementation

```ts
const sessionKey = `qq:group:${groupId}`;
const speakerTag = `[speaker:user_id=${userId};name=${displayName ?? "unknown"}]`;
const modelInput = `${speakerTag} ${rawText}`;
```

Add one system instruction for QQ group sessions:
- "Use `[speaker:...]` to distinguish participants. Do not merge different speakers."

## Anti-Patterns

- Using `qq:group:{group_id}:user:{user_id}` when shared group context is required.
- Passing only nickname without stable `user_id`.
- Stripping speaker tags before session append or model input.

## Validation Checklist

1. Log `group_id`, `user_id`, final `session_key`, and final model input.
2. Send two messages from different users in the same group.
3. Confirm both messages hit the same `session_key`.
4. Confirm each model input line has the correct `speaker:user_id=...` tag.

## Best-Practice Memory Split

- Conversation context: keyed by `group_id` only.
- Optional profile memory: keyed by `group_id + user_id` for preference lookup only.
