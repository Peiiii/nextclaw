# nextclaw Skills

This directory contains built-in skills that extend nextclaw's capabilities.

## Skill Format

Each skill is a directory containing a `SKILL.md` file with:
- YAML frontmatter (name, description, metadata)
- Markdown instructions for the agent

## Attribution

These skills are adapted from [OpenClaw](https://github.com/openclaw/openclaw)'s skill system.
The skill format and metadata structure follow OpenClaw's conventions to maintain compatibility.

## Available Skills

| Skill | Description |
|-------|-------------|
| `agent-browser` | Operate real browser pages through an external Agent Browser CLI, including readiness checks and first-use setup |
| `github` | Interact with GitHub using the `gh` CLI |
| `weather` | Get weather info using wttr.in and Open-Meteo |
| `summarize` | Summarize URLs, files, and YouTube videos |
| `tmux` | Remote-control tmux sessions |
| `skill-creator` | Create new skills |
| `nextclaw-autostart` | Guide NextClaw host autostart setup, reboot recovery, and service registration diagnostics |
| `project-observation-setup` | Establish or maintain the project-owned observation contract in `.nextclaw/project.yaml` and root `AGENTS.md` |
| `nextclaw-skill-resource-hub` | Curate NextClaw, OpenClaw, and community skill resources |
| `visualize-output` | Present answers and results with focused Markdown, diagrams, images, or inline HTML |
| `nextclaw-app-creator` | Create complete schema v2 Mini Apps by choosing component composition first, then Portable WASI or native-process for any Service |
| `nextclaw-app-publisher` | Validate, package, and submit universal or targeted schema v2 Mini Apps to the NextClaw App Marketplace |
| `panel-app-creator` | Create a static Panel UI component inside a Mini App package or as an explicitly loose local Panel |
| `service-app-creator` | Create Service Actions by routing between Portable WASI Components and native-process MCP services |
| `cross-channel-messaging` | Choose between a current reply, durable inbox delivery, and an explicit cross-channel send |
| `qq-group-speaker-distinction` | Keep one QQ group session while preserving per-message speaker identity |
| `qq-url-guard` | Avoid QQ outbound URL-like text blocks (e.g. xx.xx / USER.md / markdown links) |
