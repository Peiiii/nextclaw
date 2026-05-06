# Multi-Agent Routing

Multi-agent routing is an advanced capability. Use it after NextClaw is already working and you want different tasks to use different agents or runtimes.

## When it helps

- different tasks need different models or runtimes
- a session should bind to a specific agent
- you are testing Claude Code, Codex, Hermes, or other runtime paths
- you want to keep experiments separate from the daily main entry point

## When it is unnecessary

First setup does not need multi-agent routing.  
Most daily single-user workflows do not need many agents at the beginning.

## Usage principles

- Keep one reliable main entry point.
- Add agents only for clear scenarios.
- Each agent should have a clear responsibility.
- Do not use routing as a workaround for messy configuration.

## Related docs

- [Chat & Sessions](/en/guide/chat)
- [Command Index](/en/guide/commands)
- [Claude Code / Codex / Hermes Integration](/en/guide/tutorials/claude-codex-hermes)
