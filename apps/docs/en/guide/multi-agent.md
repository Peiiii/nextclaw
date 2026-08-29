# Agents and subtasks

An agent is a collaborator that can keep its own identity, home directory, memory, skills, and runtime. Use dedicated agents for stable categories of work, and subtasks when a larger job needs separate deliverables.

![The NextClaw agent management page](/product-screenshots/nextclaw-agents-page-en.png)

## What an agent can keep

- **Identity and role:** what it owns and how its output should be judged.
- **Home directory:** where it normally reads and writes files.
- **Memory:** durable information related to that agent's work.
- **Skills:** reusable instructions and tool methods.
- **Runtime and context:** Native, Codex, Claude Code, or another supported execution path.

## Create a dedicated agent when

- the same work repeats with stable directories and standards;
- projects need separate files, memory, or skills;
- coding, writing, or research requires another runtime;
- experiments should stay isolated from the default agent.

Do not create a large agent roster before the default agent completes a real task. Preserve only differences that have proven useful.

## Subtasks

A complex report can use one subtask to verify sources and another to prepare charts. Each subtask needs an input, deliverable, completion condition, and destination. The parent session still owns integration and final review.

Subtasks start running as soon as they are created, while the parent can continue with other work. When a subtask finishes, NextClaw returns its result to the parent so it can integrate the result or continue the remaining steps. The parent waits only when the task explicitly requires the child result before proceeding.

To prepare an idle child session for later work, explicitly choose create-only behavior. Omitting notification settings does not prevent a subtask from running; notifications only control whether completion wakes the parent.

NextClaw delegation is intentionally one level deep: a top-level session can create child sessions, but a child cannot create grandchildren. When a child discovers more work that should be split out, it returns that need to the parent, which remains the single owner for further delegation and final synthesis. This prevents recursive session creation, duplicated resource use, and unclear integration ownership.

Related: [Tasks and sessions](/en/guide/chat) and [Skills and MCP](/en/guide/skills-and-mcp).
