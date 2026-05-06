# NextClaw Vision

NextClaw's long-term vision is to become the personal operating layer for the AI era.

It is not a traditional operating system kernel. It is the default entry point through which users interact with software, the internet, systems, services, and cloud computing.

This is the public documentation version of the vision and should stay aligned with the canonical repository document at `docs/VISION.md`.

## What It Is Really Trying to Build

NextClaw is not trying to become "an AI product with many features." It aims to become a native AI entry point that is unified, natural, powerful, and trustworthy enough to be used every day.

In the ideal state, users do not first think, "Which app, website, or service should I open?" They start with NextClaw, express the goal, and let NextClaw understand the intent, call tools, connect services, orchestrate the workflow, and deliver the result.

If traditional operating systems defined how people use computers, NextClaw wants to help define how people use the digital world in the AI era.

## How to Read This Vision

"Personal operating layer" is the top-level goal, but it is not an empty slogan. To make it real, NextClaw needs several threads to hold at the same time.

### 1. Unified Entry Point

NextClaw should become a unified entry point, not just one more parallel tool.

- users should increasingly start with NextClaw when they want to get something done
- software, services, channels, devices, and cloud resources should be brought together through NextClaw
- it should grow into a default workspace for workflows, conversations, and information flows

### 2. Capability Orchestration

NextClaw does not create value by rebuilding every tool itself. It creates value by connecting, coordinating, and composing the software, systems, services, and compute that already exist.

- translating user intent into executable workflows
- calling tools, connecting services, and organizing multi-step tasks
- converging multiple models, channels, plugins, and runtime environments into one understandable experience

The direction is "unified entry point plus orchestration," not "feature landfill."

### 3. Self-Awareness and Self-Governance

We can fold the old "self-knowledge" idea into a broader notion of self-awareness, then pair it with self-governance.

- knowing who it is: identity, version, rules, capability boundaries, and tool boundaries
- knowing its own system state: configuration, runtime state, health, and service connections
- knowing who it is working for: the user, preferences, and recurring patterns
- knowing what context it is in: session, project, channel, device, and runtime environment
- knowing what it has done, how things went, and where errors came from
- being able to perform key management actions through tools, such as config changes, channel control, task management, extension management, diagnostics, and recovery

The goal is not to mythologize the agent. The goal is to let users understand and control NextClaw itself through natural language and a unified control surface.

### 4. Self-Evolution

NextClaw cannot remain a static entry point. It should develop a governable, accumulative, reusable ability to improve over time.

- learning from mistakes instead of repeating them
- reflecting on user feedback, task outcomes, and failure replays
- improving execution strategies, tool discipline, context organization, and memory structures
- turning repeated experience into longer-lived user preferences, project knowledge, procedural memory, and skill memory
- becoming more like "this user's own operating layer" as usage grows

### 5. Plugin-Based Extensibility and Ecosystem Growth

A personal operating layer cannot grow by inflating the core forever. It needs a stable core plus an expansion ecosystem.

- the core runtime, plugin SDK, and channel protocols should converge toward stable boundaries
- long-term capability expansion should increasingly come through plugins, skills, and the marketplace
- users and developers should be able to form a loop of use -> build -> share -> discover

### 6. Digital World Infrastructure

NextClaw is not just a chatbot. It aims to become a general operating infrastructure for users in the digital world.

- understanding and using the host system, local services, filesystems, and hardware resources
- connecting to internet data sources, APIs, and cloud computing resources
- giving users a more unified way to work with data scattered across many systems

### 7. Out-of-the-Box Experience

If NextClaw is meant to become a personal operating layer, it cannot work only for advanced users. It must also be easy to activate for new users.

- users should quickly understand what it can do on first launch
- important scenarios should support one-click setup and activation
- the path from learning to installing to first successful use should be short and smooth

## The Product Level We Aim For

The goal is a product important enough to become:

- the user's first entry point
- a unified layer above software, services, platforms, and compute
- a place where users express intent more and switch tools less
- a continuous workspace that does not feel like amnesia every turn
- a trustworthy default working surface
- an operating layer that becomes more useful over time

## What This Does Not Mean

This vision does not mean:

- stuffing every possible capability into a monolithic product
- rebuilding everything ourselves
- piling on isolated features just to appear powerful
- shipping a chat shell that cannot actually orchestrate the real world
- turning "self-awareness" into mystical language without real system capabilities behind it
- turning "self-evolution" into an uncontrollable black-box self-modifying system

## Relationship with NCP

`NextClaw` is the productized operating layer facing end users. `NCP` is the protocol, runtime, and building-block foundation beneath it.

You can think of NCP as the infrastructure base, and NextClaw as the productized entry point for real users.
