# Claude Code / Codex / Hermes Integration

These integrations are for users who already understand the basic NextClaw runtime. They are not the shortest first-run path.

## When to use this

- you already have Claude Code, Codex, or Hermes running
- you want to connect an external agent runtime to NextClaw
- you need session or task routing across runtimes

## Before connecting

- NextClaw itself works
- the external runtime works by itself
- you know which task should use which runtime

## Basic steps

1. Verify the external runtime independently.
2. Add the corresponding integration configuration in NextClaw.
3. Save and restart or reload the required service.
4. Create a test session.
5. Verify routing with a low-risk task.

## Usage principle

Keep one reliable main entry point first, then add other runtimes.  
Do not use multiple runtimes to compensate for basic setup that has not worked yet.

## Related docs

- [Multi-Agent Routing](/en/guide/multi-agent)
- [Chat & Sessions](/en/guide/chat)
- [Command Index](/en/guide/commands)
