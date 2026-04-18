---
name: impeccable
description: Use when the user wants distinctive, production-grade frontend design, anti-generic AI aesthetics, UX critique, technical UI audits, or final polish through bundled Impeccable references and an optional upstream detector CLI.
---

# Impeccable

## Overview

Use this skill when the user wants stronger frontend design quality inside NextClaw.

This marketplace skill adapts the upstream `pbakaus/impeccable` project into a single installable NextClaw skill package with:

- one top-level workflow router,
- bundled local references for typography, color and contrast, layout, motion, interaction, responsive design, and UX writing,
- bundled workflow guides for shaping, crafting, critique, audit, polish, and design-system extraction,
- and an optional upstream `impeccable` detector CLI for deterministic anti-pattern scans.

Be explicit about the boundary:

- This skill owns design-context gating, workflow selection, expectation-setting, and detector readiness guidance.
- The bundled local references own the detailed design vocabulary.
- The optional upstream `impeccable` CLI owns deterministic anti-pattern detection.
- NextClaw, the current repository rules, and the active runtime own actual implementation and execution.

Do not present third-party detector output as built-in NextClaw capability.
Do not pretend the detector is ready when it is not.

## What This Skill Covers

- design context setup before UI work,
- feature shaping before code is written,
- distinctive frontend implementation guidance that avoids generic AI aesthetics,
- focused passes on typography, color, layout, motion, interaction, responsive behavior, and microcopy,
- design critique and technical UI audit,
- final polish before shipping,
- design-system extraction from repeated patterns,
- optional detector-assisted anti-pattern scans when the upstream CLI is available.

## What This Skill Does Not Cover

- inferring the real audience or brand tone purely from code,
- silently installing npm packages or downloading the detector runtime,
- claiming detector-based evidence when Node/npm or the CLI are unavailable,
- overriding a stricter local design system or project rulebook,
- turning every design request into the same maximalist or marketing-style aesthetic,
- pretending that an upstream multi-command ecosystem maps one-to-one onto NextClaw command surfaces.

## Install Boundary

Always distinguish these paths:

- NextClaw marketplace install:
  `nextclaw skills install impeccable`
- Installed NextClaw skill assets:
  `<workspace>/skills/impeccable/`
- Optional upstream detector runtime:
  `npm install -g impeccable`
- Upstream standalone bundles for other tools:
  `https://github.com/pbakaus/impeccable`

Installing the marketplace skill does not install the upstream detector automatically.

## Deterministic First-Use Workflow

When this skill triggers, follow this order.

### Step 0: Verify the bundled assets exist

Check:

```bash
test -f skills/impeccable/SKILL.md
test -f skills/impeccable/references/typography.md
test -f skills/impeccable/workflows/critique.md
```

If any of these checks fail, the skill is not correctly installed in the current workspace.

### Step 1: Classify the user's need

Choose the smallest matching workflow:

- design context setup,
- feature shaping,
- build or redesign,
- design critique,
- technical audit,
- final polish,
- design-system extraction,
- focused pass: typography, color, layout, motion, interaction, responsive behavior, or UX copy.

### Step 2: Gate on design context before real design work

Before doing meaningful design work, confirm these minimum inputs:

- target audience,
- primary use cases or jobs to be done,
- brand personality or interface tone.

Do not infer these from code alone.

If the user already supplied them in the current conversation, proceed.
If not, ask the smallest number of targeted questions needed to unblock the work.
If the user wants this context persisted for future sessions, ask before writing a local `.impeccable.md`.

### Step 3: Load only the matching local workflow

Prefer the smallest relevant asset instead of reading everything:

- feature shaping:
  [workflows/shape.md](workflows/shape.md)
- build or redesign:
  [workflows/craft.md](workflows/craft.md)
- design critique:
  [workflows/critique.md](workflows/critique.md)
- technical audit:
  [workflows/audit.md](workflows/audit.md)
- final polish:
  [workflows/polish.md](workflows/polish.md)
- design-system extraction:
  [workflows/extract.md](workflows/extract.md)

For focused passes, load only the relevant references:

- typography:
  [references/typography.md](references/typography.md)
- color and contrast:
  [references/color-and-contrast.md](references/color-and-contrast.md)
- layout and spacing:
  [references/spatial-design.md](references/spatial-design.md)
- motion:
  [references/motion-design.md](references/motion-design.md)
- interaction:
  [references/interaction-design.md](references/interaction-design.md)
- responsive behavior:
  [references/responsive-design.md](references/responsive-design.md)
- UX writing:
  [references/ux-writing.md](references/ux-writing.md)

For critique scoring or persona framing, also load:

- [references/critique-cognitive-load.md](references/critique-cognitive-load.md)
- [references/critique-heuristics-scoring.md](references/critique-heuristics-scoring.md)
- [references/critique-personas.md](references/critique-personas.md)

### Step 4: Treat the detector CLI as optional runtime, not a default assumption

Only use the upstream detector when the user wants automated anti-pattern evidence, or when audit or critique would materially benefit from it.

First verify runtime prerequisites:

```bash
command -v node
node --version
command -v npm
command -v npx
command -v impeccable
```

If `impeccable` is already installed, verify it with:

```bash
impeccable --help
```

If the CLI is missing:

- explain that the bundled NextClaw skill is ready, but the optional detector runtime is not,
- keep going with the bundled references when the user only needs design guidance,
- ask before any install or download step because `npm install -g impeccable` or `npx impeccable ...` changes local machine state.

If the detector is available, prefer a read-only smoke before a large scan:

```bash
impeccable detect --fast --json <target>
```

Use `--fast` for large directories. Narrow scope before scanning very large repos.

## Workflow Routing Guidance

### New feature or major redesign

Start with:

- [workflows/shape.md](workflows/shape.md)

Then continue with:

- [workflows/craft.md](workflows/craft.md)

Load the minimum supporting references based on the brief.

### Existing UI needs feedback

Use:

- [workflows/critique.md](workflows/critique.md)

If the issue sounds implementation-heavy rather than experiential, prefer:

- [workflows/audit.md](workflows/audit.md)

### Existing UI is close but not finished

Use:

- [workflows/polish.md](workflows/polish.md)

### Existing product has repeated patterns that should become a design system

Use:

- [workflows/extract.md](workflows/extract.md)

### Focused fixes without a full redesign

Choose the smallest relevant reference and stay scoped:

- typography issue only:
  [references/typography.md](references/typography.md)
- color or contrast issue only:
  [references/color-and-contrast.md](references/color-and-contrast.md)
- spacing or layout issue only:
  [references/spatial-design.md](references/spatial-design.md)
- motion or transition issue only:
  [references/motion-design.md](references/motion-design.md)
- form, state, or affordance issue only:
  [references/interaction-design.md](references/interaction-design.md)
- mobile or responsive issue only:
  [references/responsive-design.md](references/responsive-design.md)
- unclear labels, errors, or empty states:
  [references/ux-writing.md](references/ux-writing.md)

## Safe Usage Rules

- Do not start real design work until the minimum design context is known.
- Prefer shaping before large greenfield frontend work.
- Preserve the existing design system when the user is working within an established product.
- Prefer read-only critique or audit before sweeping rewrites when the problem is still unclear.
- Ask before writing `.impeccable.md` or installing/downloading the detector runtime.
- Treat detector findings as evidence, not unquestionable truth; false positives must be called out.
- Be honest when the result still feels generic or AI-generated.
- Keep recommendations grounded in the user's product, not a stock aesthetic template.

## Troubleshooting

### Design context is missing

- Stop guessing.
- Ask the smallest targeted question set needed to recover the audience, use case, and tone.

### The user wants critique or audit, but the detector CLI is unavailable

- Continue with the bundled critique or audit workflow.
- Be explicit that the result is expert review without detector evidence.
- Offer the optional detector install path only if the user wants it.

### The current repo already has a stricter design system

- Follow the stricter local system.
- Use Impeccable as a quality and taste layer, not as authority to override established product rules.

### Detector output conflicts with good product judgment

- Say so plainly.
- Keep the detector result as a signal, but prioritize verified user impact and visual judgment.

## Success Criteria

This skill is working correctly when:

- design work starts from explicit audience, use case, and tone rather than guesswork,
- the smallest relevant workflow or reference is loaded,
- the resulting interface avoids obvious generic AI aesthetics,
- critique and audit outputs are specific, prioritized, and actionable,
- optional detector scans are only used when their runtime is actually ready,
- and the skill raises the design bar without hiding setup reality.

## Attribution

This skill adapts the upstream `pbakaus/impeccable` project for the NextClaw marketplace.

Source mapping is documented in [references/SOURCES.md](references/SOURCES.md).
