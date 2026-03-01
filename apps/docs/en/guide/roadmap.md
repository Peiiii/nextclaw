# NextClaw Roadmap

This document describes NextClaw's current priorities and execution plan. All work serves the four core pillars defined in the [Product Vision](./vision.md). Iteration history: [docs/logs](https://github.com/Peiiii/nextclaw/blob/master/docs/logs/README.md).

---

## Current Stage Priorities

### 1. Self-Awareness (The Agent Knows Itself)

> Serves: Self-Aware & Self-Governing

- The agent can query its own version, configuration, runtime state, health, capability boundaries, and documentation.
- Covers static information (config, version) and dynamic information (runtime state, session context).
- Answers questions like "What channels do I have?", "What model am I using?", "Am I healthy?" in conversation.

### 2. Self-Governance (The Agent Manages Itself)

> Serves: Self-Aware & Self-Governing

- The agent can perform management actions via tools: modify config, enable/disable channels, add/remove cron jobs, install/uninstall plugins, trigger diagnostics/restarts, etc.
- Destructive operations require confirmation.
- Users accomplish through natural language what previously required UI or CLI.

### 3. Plugin SDK and Development Workflow

> Serves: Plugin-Based Extensibility & Ecosystem Growth

- Stabilize the plugin SDK and OpenClaw-compatible development workflow.
- Define clear boundaries between core and plugins; converge core APIs.
- Support install, enable, configure, and uninstall plugins from the UI.

### 4. Out-of-the-Box Experience

> Serves: Out-of-the-Box Experience

- Showcase core capabilities and typical scenarios on first launch.
- Pre-built scenario templates with one-click activation.
- Optimize the path from installation to first working scenario.

---

## Next Stage Directions

### Marketplace Ecosystem

> Serves: Plugin-Based Extensibility & Ecosystem Growth

- Plugin/skill publishing and discovery workflow.
- Infrastructure for ratings, version management, and dependency resolution.
- Close the loop: use → build → share → discover.

### Host System and Data Capabilities

> Serves: Infrastructure for Digital Omnipotence

- Expand tool system: file management, process management, system monitoring, and other host operations.
- Internet data access: search, scraping, API calls, information aggregation.
- User data integration: connect data scattered across apps and platforms.

### Multi-Agent and Multi-Instance

- Multi-agent: session isolation, bindings, routing and runtime semantics.
- Multi-instance: deployment model, config boundaries, and best practices.

---

## Ongoing Focus

- **Landing page**: Product value proposition and key entry point optimization.
- **UI and interaction**: Config UI, information architecture, consistent experience.
- **OpenClaw compatibility**: Track plugin SDK and channel protocols.
- **Cron / Heartbeat**: Harden automation and docs.
- **Observability and ops**: `doctor`, `status`, config hot-reload, deployment docs.
- **Documentation and tutorials**: Complete path for install, config, first bot, first cron.

---

## How to Contribute

- Feature ideas and bugs: GitHub Issues.
- Releases and changes: per-package `CHANGELOG.md` and [docs/logs](https://github.com/Peiiii/nextclaw/blob/master/docs/logs/README.md).
