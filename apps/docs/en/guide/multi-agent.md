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

Related: [Tasks and sessions](/en/guide/chat) and [Skills and MCP](/en/guide/skills-and-mcp).
