# NextClaw Roadmap

This document describes NextClaw's current priorities and next-stage directions. All work serves the [Vision](/en/project/vision).

If you want the public-facing dashboard of shipping rhythm, code growth, release cadence, and recent product notes, start with [Project Pulse](/en/project/project-pulse).

## Current Stage Priorities

### 1. Self-Awareness

- the agent can query its own version, configuration, runtime state, health, capability boundaries, and documentation entry points
- this covers both static configuration and live runtime state
- it can answer questions like "What model am I using?" and "Am I healthy?"

### 2. Self-Governance

- the agent can perform key management actions through tools: config changes, channel control, cron management, plugin lifecycle, diagnostics, and restarts
- destructive operations still require confirmation
- users can accomplish through natural language what previously required UI or CLI

### 3. Plugin SDK and Development Workflow

- stabilize the plugin SDK and OpenClaw-compatible workflow
- clarify boundaries between core and plugins
- support install, enable, configure, and uninstall from the UI

### 4. Out-of-the-Box Experience

- show core capabilities and typical scenarios on first launch
- support prebuilt scenarios with one-click setup
- shorten the path from install to first real value

## Next Stage Directions

### Marketplace Ecosystem

- publishing and discovery for plugins and skills
- ratings, version management, and dependency resolution
- a loop of use -> build -> share -> discover

### Host System and Data Capabilities

- host tools for files, processes, and system monitoring
- internet access for search, scraping, API calls, and aggregation
- better ways to work with data scattered across apps and platforms

### Multi-Agent and Multi-Instance

- multi-agent: session isolation, bindings, routing, and runtime semantics
- multi-instance: deployment model, config boundaries, and best practices

## Ongoing Focus

- landing page and entry-point clarity
- UI and interaction consistency
- OpenClaw compatibility
- Cron / Automation
- observability and ops
- documentation and tutorial completeness

## Related Pages

- [Project Pulse](/en/project/project-pulse)
- [Release Notes](/en/project/release-notes)
- [Community](/en/project/community)
