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
| `nextclaw-app-creator` | Create complete NextClaw lightweight apps by choosing Panel-only, Service-only, or Panel + Service |
| `nextclaw-app-publisher` | Validate, package, and submit Panel/Service Mini Apps to the NextClaw App Marketplace for review |
| `panel-app-creator` | Create the Panel App UI part of a NextClaw lightweight app |
| `service-app-creator` | Create the Service App backend action part of a NextClaw lightweight app |
| `cross-channel-messaging` | Choose between a current reply, durable inbox delivery, and an explicit cross-channel send |
| `qq-group-speaker-distinction` | Keep one QQ group session while preserving per-message speaker identity |
| `qq-url-guard` | Avoid QQ outbound URL-like text blocks (e.g. xx.xx / USER.md / markdown links) |
