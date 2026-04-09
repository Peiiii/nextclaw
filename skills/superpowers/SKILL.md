---
name: superpowers
description: Use when the user wants a disciplined software development workflow with design-first planning, implementation plans, TDD, systematic debugging, code review, or verification-before-completion, adapted from obra/superpowers.
---

# Superpowers

## Overview

Use this skill when the user wants a stronger engineering workflow inside NextClaw.

This marketplace skill adapts the upstream `obra/superpowers` project into a single installable NextClaw skill. Because NextClaw marketplace installs one skill directory at a time, this package provides:

- one top-level workflow router,
- bundled local reference files for the most useful upstream superpowers skills,
- and clear rules for when to load which reference.

Be explicit about the boundary:

- This skill owns workflow selection, expectation-setting, and reference routing.
- The bundled reference files own the detailed superpowers methodology.
- NextClaw, the current project rules, and the actual tool runtime own execution.

Do not present bundled superpowers guidance as a higher-priority authority than the user's instructions, the current project's `AGENTS.md`, or the host platform's rules.

## What This Skill Covers

- design-first brainstorming before implementation,
- implementation plan writing for multi-step work,
- test-driven development for feature and bugfix work,
- root-cause-first debugging,
- pre-merge or post-task code review prompts,
- evidence-before-claims verification,
- optional subagent-driven execution when the environment actually supports it.

## What This Skill Does Not Cover

- overriding user instructions or project rulebooks,
- pretending NextClaw natively supports the upstream superpowers multi-directory auto-discovery model,
- forcing subagent workflows when the current runtime does not support them,
- claiming a workflow step happened when the needed evidence was not actually collected,
- replacing domain-specific project skills that are more specific than this general workflow skill.

## Install Boundary

Always distinguish these paths:

- NextClaw marketplace install:
  `nextclaw skills install superpowers`
- Installed NextClaw skill assets:
  `<workspace>/skills/superpowers/`
- Upstream standalone installation outside NextClaw:
  clone `https://github.com/obra/superpowers` and follow the upstream install docs

For NextClaw users, prefer the marketplace-installed assets already bundled under `skills/superpowers/`.

Do not ask the user to install the upstream repo separately unless they explicitly want the original Codex or Claude plugin setup outside NextClaw.

## Deterministic First-Use Workflow

When this skill triggers, follow this order.

### Step 0: Verify bundled references exist

Check:

```bash
test -f skills/superpowers/references/brainstorming.md
test -f skills/superpowers/references/systematic-debugging.md
```

If either file is missing, the skill is not correctly installed in the current workspace.

### Step 1: Classify the user's need

Choose the smallest matching workflow:

- feature or behavior design,
- implementation planning,
- implementation or bugfix execution,
- debugging an existing problem,
- review before merge or handoff,
- verification before claiming completion,
- plan execution with parallel agents.

### Step 2: Load only the matching reference

Read only the smallest relevant reference instead of loading everything at once:

- design or requirements refinement:
  [references/brainstorming.md](references/brainstorming.md)
- implementation plan writing:
  [references/writing-plans.md](references/writing-plans.md)
- implementation or bugfix execution:
  [references/test-driven-development.md](references/test-driven-development.md)
- debugging and root-cause analysis:
  [references/systematic-debugging.md](references/systematic-debugging.md)
- pre-merge or task-level review:
  [references/requesting-code-review.md](references/requesting-code-review.md)
- before saying work is done:
  [references/verification-before-completion.md](references/verification-before-completion.md)
- executing an approved plan with agent delegation:
  [references/subagent-driven-development.md](references/subagent-driven-development.md)

Do not bulk-read all references unless the task truly spans multiple workflow stages.

### Step 3: Reconcile with host rules before acting

Before following any bundled superpowers guidance, reconcile it with:

- the user's explicit request,
- the current repository's `AGENTS.md`,
- the host runtime's tool and permission model,
- and any more specific installed skill that directly matches the task.

If there is a conflict, follow the higher-priority local rule and use the bundled superpowers material as methodology, not authority.

### Step 4: Execute with honest boundaries

- Prefer the project's existing validation and review commands when they already exist.
- If the current repository has stricter branching, testing, review, or release rules, follow those.
- If the environment lacks multi-agent support, skip the subagent path and continue with the non-delegated workflow.
- If the task is trivial, keep the workflow compact rather than theatrical, but still choose an explicit workflow.

## Workflow Routing Guidance

### New feature, refactor, or behavior change

Start with:

- [references/brainstorming.md](references/brainstorming.md)

If the work becomes multi-step or cross-module, continue with:

- [references/writing-plans.md](references/writing-plans.md)

During implementation, use:

- [references/test-driven-development.md](references/test-driven-development.md)

Before declaring success, use:

- [references/verification-before-completion.md](references/verification-before-completion.md)

### Bug, failing test, or unexpected behavior

Start with:

- [references/systematic-debugging.md](references/systematic-debugging.md)

Once root cause is understood and a fix is ready, use:

- [references/test-driven-development.md](references/test-driven-development.md)

Before closing the task, use:

- [references/verification-before-completion.md](references/verification-before-completion.md)

### Review or handoff checkpoint

Use:

- [references/requesting-code-review.md](references/requesting-code-review.md)

If the work was executed from a formal plan and the runtime supports delegation, optionally use:

- [references/subagent-driven-development.md](references/subagent-driven-development.md)

## Safe Usage Rules

- Treat the bundled references as workflow assets, not as license to ignore local project rules.
- Prefer the smallest process that still makes the work explicit and honest.
- Do not claim TDD happened unless a failing test was observed first.
- Do not claim a bug is fixed unless the original failure mode was re-verified.
- Do not claim completion without fresh verification evidence.
- Do not require subagent usage when the current runtime, product tier, or user request does not support it.

## Troubleshooting

### Reference files missing

- Re-check the skill installation.
- Confirm `skills/superpowers/` exists in the active workspace.
- Reinstall the marketplace skill if needed instead of inventing fallback paths.

### The current project already has stricter workflow rules

- Follow the stricter local rule.
- Use superpowers references only for the missing part of the workflow.

### The task needs the upstream standalone ecosystem

- Be explicit that the marketplace skill is a NextClaw adaptation, not the original multi-plugin install.
- Point the user to the upstream repository and install docs only if they want that exact standalone setup.

### The user wants speed over process

- Compress the workflow, but still keep the key gates:
  - clarify intent for creative work,
  - find root cause before fixing bugs,
  - verify before claiming completion.

## Success Criteria

This skill is working correctly when:

- the user gets an explicit workflow instead of ad-hoc thrashing,
- the smallest relevant superpowers reference is loaded for the task,
- local project rules remain the source of truth,
- debugging starts with root-cause investigation,
- implementation uses test-first discipline when appropriate,
- and completion claims are backed by fresh verification evidence.

## Attribution

This skill adapts the upstream `obra/superpowers` project for the NextClaw marketplace.

Upstream source mapping is documented in [references/SOURCES.md](references/SOURCES.md).
