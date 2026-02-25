# NextClaw Roadmap

This document describes NextClaw’s direction and current priorities for users and contributors. Iteration history: [docs/logs](logs/README.md).

---

## Current priorities (by order)

### 1. Full i18n / multi-language support

- i18n coverage for UI, CLI, and docs (e.g. English, Chinese).
- Language switching and persistence; consistent localization for copy, dates, and numbers.

### 2. Landing page improvements

- Clearer product overview and value proposition.
- Curated key links: quick start, docs, GitHub, configuration, example scenarios — to reduce onboarding and navigation friction.

### 3. In-app chat (core product feature)

- Support direct conversation with the AI in the UI; config UI remains, chat becomes a first-class surface alongside channels and CLI.
- Enables try-before-connect and quick testing without leaving the browser.

### 4. UI and experience

- Ongoing config UI improvements per [nextclaw-ui-design-brief](nextclaw-ui-design-brief.md): layout, interactions, feedback.
- Information architecture and flows for Sessions, Routing & Runtime, Cron, Marketplace, etc.
- Consistent, friendly experience for loading, saving, and error states.

### 5. Multi-agent and multi-instance

- Multi-agent: session isolation, bindings, routing and runtime behavior with clear verification.
- Multi-instance: deployment model, config boundaries, and best practices for single- and multi-machine setups.
- Documentation and automated checks (including smoke tests) to ensure expected behavior.

### 6. Ecosystem: skills & plugins + quick onboarding

- Skills and plugins: OpenClaw-compatible plugin/skill flow; install, enable, and configure from the UI.
- “Quick start” path in docs: from install to first chat, first cron job, first multi-channel setup so every user can quickly get value from classic NextClaw scenarios.
- Discoverable, reusable examples and templates (reminders, queries, multi-channel, etc.).

### 7. Documentation: tutorials and examples

- Getting started: step-by-step guides for install, config, first bot, first cron, etc.
- Use cases: example scenarios (reminders, Q&A, cross-channel, multi-model) with config and setup notes.
- Tie into landing page and in-app help so users follow: intro → tutorial → examples.

---

## Ongoing focus

- **OpenClaw compatibility**: Track plugin SDK and channel protocols; fix compatibility issues.
- **Cron / Heartbeat**: Harden automation and docs.
- **Marketplace**: Install/uninstall, state sync, and Worker experience.
- **Observability and ops**: `doctor`, `status`, config hot-reload, and deployment docs.

---

## How to contribute

- Feature ideas and bugs: GitHub Issues.
- Releases and changes: per-package `CHANGELOG.md` and [docs/logs](logs/README.md).
