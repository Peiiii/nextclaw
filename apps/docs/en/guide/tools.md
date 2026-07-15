# Tools and actions

Tools let an agent take action. They can read or modify files, run terminal commands, search content, visit websites, send messages, create subtasks, use memory, schedule jobs, or generate images.

## Common tool categories

- **Files:** read, search, create, and modify local files.
- **Terminal:** run project commands, scripts, tests, and local programs.
- **Web:** search, open pages, extract information, and perform browser actions.
- **Messaging:** send and receive content through configured channels.
- **Agents and sessions:** delegate subtasks and consume their deliverables.
- **Images and display:** generate images and open artifacts in the workspace.
- **Schedules:** save prompts and timing for recurring work.

## Tools, skills, and MCP

- A **tool** is an action the agent can invoke now.
- A **skill** explains how to complete a category of work and can coordinate multiple tools.
- **MCP** connects tools and resources supplied by an external service.

A skill may not add a new low-level tool, and an MCP connection does not automatically teach the agent the best workflow. Many useful tasks combine both.

## Review impact before action

Reading is usually safer than writing, and a preview is safer than a bulk operation. For deletion, overwrite, messaging, publishing, production data, account permissions, or costs, ask for the exact target and impact first, then verify the real result.

If an action is missing, start with [Skills and MCP](/en/guide/skills-and-mcp).
