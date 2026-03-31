---
name: find-skills
description: Use when the user wants to discover, evaluate, and install external agent skills from the open skills ecosystem, especially through the Vercel Skills CLI.
---

# Find Skills

## Overview

Use this skill when the user is asking for a capability that might already exist as an installable skill in the open agent skills ecosystem.

This skill wraps the upstream Vercel-style Skills CLI workflow for NextClaw users.

Be explicit about the boundary:

- This marketplace skill helps the AI search, evaluate, and explain external skills.
- The upstream Skills CLI (`npx skills`) owns actual discovery and installation in its supported agent ecosystems.
- NextClaw marketplace is a separate channel and should be checked first when the user specifically wants a NextClaw-native skill.

Do not blur those ecosystems together.

## Platform Notes

This discovery flow should be presented as cross-platform.

- `npx skills ...` is a Node/npm-based workflow and is generally suitable for macOS, Linux, and Windows.
- On Windows, avoid assuming symlink-friendly behavior.
- If installation method matters on Windows, prefer the upstream `--copy` option instead of implying symlinks will always work.

Example Windows-friendly pattern:

```bash
npx skills add vercel-labs/agent-skills --skill frontend-design --copy -y
```

## When To Use This Skill

Use this skill when the user:

- asks "is there a skill for X",
- wants to extend agent capabilities beyond what is already installed,
- asks for a domain workflow that is commonly packaged as a reusable skill,
- wants help exploring `skills.sh`,
- or wants to install a skill from the open agent skills ecosystem.

Do not use this skill when the user already knows the exact NextClaw marketplace skill they want and only needs `nextclaw skills install`.

## What The Skills CLI Is

The upstream Skills CLI is a package manager for the open agent skills ecosystem.

Useful commands:

```bash
npx skills find [query]
npx skills add <package>
npx skills check
npx skills update
```

Browse skills at:

```text
https://skills.sh/
```

## Decision Order

When the user asks for a skill, follow this order:

1. Check whether the user wants a NextClaw-native marketplace skill or a broader external skill.
2. If a NextClaw-native match is likely, prefer NextClaw marketplace first.
3. If the user wants the broader open ecosystem, use the Skills CLI flow below.

Do not send the user to an external ecosystem when a NextClaw-native option already solves the problem cleanly.

## External Skill Discovery Flow

### 1. Understand the need

Identify:

- the domain,
- the concrete task,
- and whether it sounds like a reusable skill rather than a one-off request.

Examples:

- "How do I review PRs better?" -> code review skill
- "How do I speed up React apps?" -> React or performance skill
- "Is there a skill for changelogs?" -> docs or release skill

### 2. Check the directory or leaderboard first

Before searching randomly, look at:

```text
https://skills.sh/
```

Prefer established sources when possible.

Examples of higher-trust sources include:

- `vercel-labs`
- `anthropics`
- `microsoft`

### 3. Search with specific terms

Run:

```bash
npx skills find [query]
```

Examples:

```bash
npx skills find react performance
npx skills find pr review
npx skills find changelog
```

Prefer specific multi-word searches over vague single words.

### 4. Verify quality before recommending

Do not recommend a skill from search results alone.

Always verify:

- install count if the directory shows it,
- source reputation,
- repository quality and maintenance signals,
- and whether the skill description actually matches the user's task.

Be cautious with low-signal or unknown sources.

### 5. Present the best option clearly

When you find a good match, present:

- the skill name,
- what it helps with,
- who publishes it,
- the install command,
- and the link for the user to inspect it.

### 6. Offer installation

If the user wants to proceed, use an explicit install command such as:

```bash
npx skills add <owner/repo@skill> -g -y
```

Use the exact upstream command shape that matches the selected skill source.
On Windows, consider `--copy` when symlink behavior is undesirable or unsupported.

## Important Boundary For NextClaw Users

Do not imply that `npx skills add` installs a NextClaw marketplace skill.

Treat these as separate paths:

- NextClaw marketplace install:
  `nextclaw skills install <slug>`
- Open skills ecosystem install:
  `npx skills add <package-or-source>`

If the user wants the capability specifically inside NextClaw and there is no NextClaw-native packaging path yet, say that clearly.

## Search Tips

- Use specific keywords such as `react testing` instead of `testing`.
- Try alternative terms if the first search is weak.
- Prefer official or widely used publishers when possible.
- If the user only has a vague idea, start by narrowing the domain before recommending any install.

## When No Good Skill Exists

If no relevant external skill is found:

- say so clearly,
- offer to handle the task directly,
- and, if useful, suggest creating a custom skill instead of forcing a weak recommendation.

## Success Criteria

This skill is working correctly when:

- the user learns whether they need NextClaw marketplace or the broader open skills ecosystem,
- search happens with explicit queries,
- quality is checked before recommendation,
- install commands are shown accurately,
- and ecosystem boundaries stay truthful.

## Resources

- Vercel skills repo:
  https://github.com/vercel-labs/skills
- Skills CLI site:
  https://skills.sh/
