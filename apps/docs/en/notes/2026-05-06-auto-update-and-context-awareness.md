---
title: 2026-05-06 · Auto Updates and Long-Context Awareness
description: NextClaw now supports auto updates, context window usage, and automatic long-session compaction so daily use feels easier and long tasks stay more continuous.
---

# 2026-05-06 · Auto Updates and Long-Context Awareness

Published: May 6, 2026  
Tags: `release` `updates` `context` `chat`

NextClaw recently gained a few capabilities that matter most during everyday, long-running use: auto updates, context window usage, and automatic long-session compaction.

These are not flashy chat tricks. They make NextClaw feel more like a personal operating layer you can keep using across longer tasks.

## What you will notice

- NextClaw can follow new releases more smoothly, reducing manual update and reinstall work.
- The chat input area now shows how much of the current context window the session is expected to use.
- Hovering over the context ring shows details such as expected usage, total window, and remaining space.
- When a long session approaches the context limit, NextClaw can automatically compact earlier context.
- Compaction appears in the message timeline at the right position instead of deleting old messages.
- Original history is still preserved; compaction only changes how future model input is assembled.

## Why this matters

NextClaw is not meant to be useful for only one turn at a time. Long conversations, follow-up questions, multi-step tasks, and project work all run into the same pressure: context grows, and users need to understand how the system is managing it.

This update makes context management visible, explainable, and continuous. You can see current window usage, and you can see when NextClaw compresses earlier history into a summary so later model requests can keep moving with the important background intact.

Auto updates address a different long-term usability problem: NextClaw should bring improvements to users with less maintenance work between releases.

## How to try it

Update to a NextClaw version that includes this release, then open any chat session. The context window ring appears near the chat input area.

If you configure an agent with a smaller context window, or keep working in the same session for a longer task, you are more likely to see an automatic compaction marker appear inside the message timeline.

## Links

- [Chat Guide](/en/guide/chat)
- [Configuration Guide](/en/guide/configuration)
- [Advanced Usage](/en/guide/advanced)
