# Chat & Sessions

Chat is the interaction surface between you and NextClaw. A session keeps context so multi-step work does not need to be re-explained every turn.

## Concepts users need

- Chat: one or more message turns.
- Session: the work unit that holds context, model binding, and history.
- Model binding: a session can use a specific model.
- Automation session: a scheduled job can continue an existing session or use its own context.

## First use

1. Open or create a session in the UI.
2. Ask for a real task.
3. Continue for two or three turns to confirm context is preserved.
4. If the task should continue over time, consider automation or channels.

## When to use multiple sessions

- keep different projects separate
- separate different model strategies
- keep temporary testing away from long-running work

## Related docs

- [First Useful Workflow](/en/guide/after-setup)
- [Run Automations](/en/guide/cron)
- [Multi-Agent Routing](/en/guide/multi-agent)
