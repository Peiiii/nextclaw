# NextClaw Vision

NextClaw aims to build an AI Agent platform that is **self-aware, self-governing, infinitely extensible, and purpose-built for digital omnipotence**.

The following four pillars define the product's long-term direction and fundamental beliefs. They are not a feature checklist for any single release, but the North Star that guides every iteration.

---

## Pillar I: Self-Aware & Self-Governing — An AI "Omniscient and Omnipotent" Over Its Own System

The agent possesses complete awareness of and control over its own system — truly omniscient and omnipotent within its domain.

**Self-Awareness (Omniscient)**

- The agent knows everything about itself: identity (NextClaw), version, full configuration (providers, models, channels, cron, plugins), runtime state, health, capability boundaries, and relevant documentation.
- It can answer any question about itself in conversation — "What channels do I have?", "What model am I using?", "Am I healthy?", "What capabilities do I support?"
- Covers both static information (config, version) and dynamic information (runtime state, real-time health, session context).

**Self-Governance (Omnipotent)**

- The agent can perform any management action on its system via tools: modify configuration, enable/disable channels, add/remove cron jobs, install/uninstall plugins, trigger diagnostics and restarts, etc.
- Destructive or irreversible operations require explicit confirmation to ensure safety and control.
- The built-in chat interface becomes a first-class surface for this self-governing system — users can accomplish through natural language everything that previously required UI or CLI.

**Goal**: Make the agent a complete proxy for its own system. Users need only converse to understand and control every aspect of NextClaw.

---

## Pillar II: Plugin-Based Extensibility & Ecosystem Growth

Once the system core stabilizes, plugins and skills enable unlimited functional expansion and organic community growth.

**Stable Core**

- The core runtime, plugin SDK, and channel protocols converge toward stability with backward compatibility.
- Clear boundary between core and plugins: the core handles scheduling, security, and lifecycle management; feature expansion is delegated to plugins.

**Open Plugin/Skill System**

- OpenClaw-compatible plugin and skill development workflow.
- One-click install, enable, configure, and uninstall plugins from the UI.
- Developers can build plugins using NextClaw itself, lowering the barrier to creation.

**Marketplace Ecosystem**

- High-quality user-developed plugins and skills can be published to the Marketplace pool.
- A closed loop of "use → build → share → discover" drives organic community growth and a thriving ecosystem.
- Supporting infrastructure for ratings, version management, and dependency resolution.

---

## Pillar III: Infrastructure for Digital Omnipotence

NextClaw is not just a chatbot — it aspires to be the infrastructure for users to be "omnipotent" in the digital world, across three dimensions:

**a. Full Management and Utilization of the Host System**

- The agent deeply understands and leverages the host system it runs on (OS, filesystem, local services, hardware resources, etc.).
- Management operations on the host via tool calls: file management, process management, system monitoring, local application integration, etc.
- Making AI the intelligent hub through which users control their local environment.

**b. Convenient Access to Internet Data and Cloud Computing**

- Seamless access to internet data sources: search, scraping, API calls, information aggregation.
- Orchestration and utilization of cloud computing resources: cloud storage, serverless functions, remote services, etc.
- Users reach the internet's data and compute through natural language, without manually operating complex tools.

**c. Comprehensive Management of User Data**

- Management of local user data: files, notes, configurations, personal knowledge bases.
- Connection and integration of data scattered across users' apps and platforms (email, calendar, social media, notes, cloud drives, etc.).
- Providing a unified data view and operational capability while respecting privacy and security.

---

## Pillar IV: Out-of-the-Box Experience

Remove every barrier to adoption — users know what they can do immediately after installation and can start with a single click.

**Instantly Visible Capabilities**

- On first launch, showcase NextClaw's core capabilities and typical scenarios (scheduled reminders, intelligent Q&A, multi-channel integration, data management, etc.).
- A "capability gallery" or guided wizard lets users intuitively grasp the product's value.

**One-Click Activation**

- Key scenarios support one-click configuration and launch — no manual form-filling required.
- Pre-built scenario templates (e.g., WeChat assistant, scheduled tasks, email digest) — select and go.

**Zero-Friction Onboarding**

- The path from installation to first working scenario should be as short and simple as possible.
- Landing page, in-app guidance, and documentation form a closed loop: learn → install → experience → go deeper.
