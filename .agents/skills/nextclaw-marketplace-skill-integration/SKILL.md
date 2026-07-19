---
name: nextclaw-marketplace-skill-integration
description: Use when evaluating, adapting, or creating a new skill for the NextClaw skill marketplace, especially when wrapping upstream skills, external tools, or external runtimes into a complete user-facing skill experience.
---

# NextClaw Marketplace Skill Integration

## Overview

Use this skill when the task is about adding a skill to the NextClaw skill marketplace.

If the user says the product needs to support a skill, or asks to add a NextClaw built-in/user-facing skill, first distinguish product skills from repo-local agent governance skills. Product built-in skills live under `packages/nextclaw-core/src/features/agent/shared/skills/`; do not satisfy that request by adding `.agents/skills/*`, which only affects repository development agents.

Core product principle:

- The user installs a skill, not a pile of prerequisites.
- The installed skill should feel complete from the user's point of view.
- If external setup is required, the AI should absorb the complexity by explaining, guiding, checking readiness, and continuing only when the environment is actually ready.

This means a marketplace skill may depend on external tools, but the skill itself must provide a full onboarding, validation, usage, and troubleshooting loop.

## Responsibility Boundary

Use this three-layer split to keep marketplace skills decoupled:

- User goal layer
  The user only expresses the job to be done.
- Skill layer
  The skill explains capability boundaries, detects missing prerequisites, guides setup, runs readiness checks, chooses the right workflow, communicates risk, and tells the AI when to stop or ask for confirmation.
- Runtime layer
  The external tool, service, CLI, browser extension, local app, or API performs the real execution.

The skill is the orchestration and onboarding contract, not the runtime itself.

## What The Skill Owns

A NextClaw marketplace skill should own these responsibilities:

- user-facing explanation,
- prerequisite discovery,
- setup guidance,
- readiness verification,
- workflow selection,
- risk and permission disclosure,
- confirmation rules for destructive or write actions,
- bounded troubleshooting steps,
- and success criteria for the first real task.

From the user's point of view, this should feel complete.

## What The Skill Must Not Own

A NextClaw marketplace skill must not silently take over responsibilities that belong elsewhere:

- It must not pretend to be the external runtime.
- It must not hide missing prerequisites.
- It must not silently rewrite system behavior just to create fake "it works" moments.
- It must not embed ad hoc runtime patches for third-party incidents.
- It must not turn itself into a long-lived installer, daemon manager, or compatibility layer unless that is an explicit product surface owned by NextClaw itself.
- It must not blur read actions and write actions.
- It must not present third-party capability as native NextClaw capability without saying so clearly.

In short:

- The skill owns the user journey.
- The runtime owns execution.
- NextClaw owns marketplace packaging, trust labeling, and product expectations.

## When To Use

Trigger this skill when work includes any of these:

- Evaluating whether an upstream skill should be added to NextClaw marketplace.
- Wrapping an external tool, CLI, browser extension, local runtime, SaaS, or desktop app as a marketplace skill.
- Copying an existing skill from another ecosystem and deciding whether direct reuse is enough.
- Adapting an upstream skill so it matches NextClaw's user experience and trust bar.
- Designing the product rules for what kinds of skills may enter NextClaw marketplace.

Do not use this skill for ordinary local skill writing that is unrelated to NextClaw marketplace.

## Product Standard

The acceptance bar is user-facing completeness, not technical purity.

A skill can enter NextClaw marketplace if the answer to all of these is yes:

1. Can the AI explain what the skill is for in plain language?
2. Can the AI discover missing prerequisites and guide the user through them step by step?
3. Can readiness be checked with explicit commands, files, states, or observable signals?
4. Can the AI tell the user when the setup is not ready instead of pretending the skill is usable?
5. Can common failures be diagnosed with a bounded troubleshooting path?
6. Can risk boundaries be explained clearly, especially for write actions, account reuse, browser control, local execution, or destructive actions?

If the answer to any of these is no, the skill is not ready for marketplace in its current form.

When the skill adapts a named upstream repository or catalog, user-facing completeness also requires source fidelity:

- Pin the audited upstream revision and inventory the canonical items, including historical names when files or labels were later moved or anonymized.
- Record each item's signature behavior or visual content, whether its asset is directly usable or only a concept preview, and its license/provenance boundary.
- Do not silently remove portraits, characters, branded motifs, core commands, or other high-salience content and replace them with an “inspired” abstraction.
- If rights or packaging constraints prevent direct bundling, keep the original item discoverable through an explicit source-referenced/user-initiated path or report the limitation and obtain user approval for a substitute.
- Acceptance must compare the shipped catalog against this inventory and name every intentional omission.

## Integration Categories

Classify the candidate skill into exactly one of these:

- Native skill
  Uses NextClaw's existing abilities directly and needs no external runtime.
- Wrapped external tool skill
  Depends on an external tool or runtime, but the skill owns onboarding, readiness checks, troubleshooting, and usage guidance.
- Inherited upstream skill
  An existing skill from another ecosystem that can be copied directly or with minimal adaptation.

Default preference order:

1. Reuse an existing upstream skill if it already meets the NextClaw bar.
2. Adapt an upstream skill if the core content is good but user experience, diagnostics, or trust boundaries are missing.
3. Write a new skill only when reuse would produce a worse result.

## Packaging Rules

When packaging a marketplace skill for NextClaw, make sure the skill itself covers:

- What the skill can do.
- What it cannot do.
- What must exist before first use.
- How the AI checks whether the environment is ready.
- How the AI guides the user through missing setup.
- What the first successful verification task should be.
- What to do when setup fails.
- When the AI must ask for explicit confirmation before continuing.

Do not hide setup reality.

Bad pattern:

- The skill acts as if the capability is ready.
- The user hits a cryptic external error.
- The user concludes that NextClaw is unreliable.

Good pattern:

- The skill recognizes missing setup early.
- The AI explains the exact missing prerequisite.
- The AI guides the user through setup.
- The AI reruns a readiness check.
- Only then does the AI proceed to the real task.

## Trust And UX Guardrails

For any wrapped external tool skill, require these guardrails:

- Fail truthfully when prerequisites are missing.
- Prefer explicit readiness checks over assumption-based optimism.
- Keep destructive or write actions behind explicit user confirmation.
- Distinguish read actions from write actions in the skill wording.
- Say clearly when the skill relies on local machine state, logged-in browser state, external accounts, or third-party software.
- Do not present a third-party runtime as if it were built into NextClaw.

Decoupling check:

- If the external runtime disappeared tomorrow, would the marketplace skill still read like a clear user workflow contract?
- If not, the skill is too coupled to implementation detail and should be rewritten.

The goal is simple:

- Easy to start.
- Easy to diagnose.
- Hard to misunderstand.

## Decision Output

When using this skill, the result should state:

- which integration category the candidate belongs to,
- whether it is fit for NextClaw marketplace now,
- whether direct reuse, adaptation, or rewrite is the right path,
- what user-facing setup the skill must absorb,
- how readiness will be verified,
- and what trust risks must be made explicit.

## Example Judgment

For a tool like `opencli`, the right question is not:

- "Is it a pure SKILL.md-only capability?"

The right question is:

- "Can we package it as a marketplace skill whose AI flow fully absorbs setup, readiness checks, and troubleshooting, so a beginner can install the skill and be guided to success?"

If yes, it can be a marketplace skill.
If no, it is not yet a marketplace-ready skill for NextClaw.
