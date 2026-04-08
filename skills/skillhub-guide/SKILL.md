---
name: skillhub-guide
description: Use when the user wants to discover, install, or use Tencent Skillhub from NextClaw, especially for CLI-only install, readiness checks, and safe skill installation guidance.
---

# Skillhub Guide

## Overview

Use this skill when the user wants to work with Tencent Skillhub from inside NextClaw.

This skill is intentionally explicit about boundaries:

- This marketplace skill owns explanation, onboarding, readiness checks, and troubleshooting guidance.
- The upstream `skillhub` CLI owns actual search and install behavior.
- NextClaw marketplace and Tencent Skillhub are different ecosystems and should not be described as the same thing.

From the user's point of view, the flow should feel complete:

- understand what Skillhub is,
- install the CLI with the least surprising path,
- verify that the CLI is actually ready,
- discover available Skillhub skills,
- then install a specific Skillhub skill into the intended workspace.

Do not pretend Skillhub is ready when it is not.

## Platform Notes

NextClaw itself is cross-platform, so this skill must not assume the user is on macOS or Linux.

Current upstream Skillhub installation guidance is shell-based and routes through a `bash` installer.
That means:

- on macOS and Linux, the documented command can be used directly;
- on Windows, do not present the `bash` installer as a native PowerShell command;
- if the user is on Windows, explain that they currently need a Bash-compatible environment such as Git Bash or WSL unless Tencent publishes a native Windows installer.

Use platform-appropriate readiness checks:

```powershell
Get-Command skillhub
skillhub --help
```

```cmd
where skillhub
skillhub --help
```

```bash
command -v skillhub
skillhub --help
```

## What Skillhub Is

Skillhub is a Tencent-provided skill distribution channel for AI agents.

Useful mental model:

- NextClaw marketplace: installs NextClaw marketplace skills.
- Skillhub: installs Tencent Skillhub skills through the local `skillhub` CLI.
- This skill: helps the AI guide the user through Skillhub setup and usage inside NextClaw.

## Default Recommendation

Default to the CLI-only install path unless the user explicitly wants the upstream full install behavior.

Why:

- CLI-only is more predictable.
- It avoids silently pulling in extra upstream skill assets.
- It lets the user search and install specific Skillhub skills intentionally.

Preferred install command:

```bash
curl -fsSL https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/install/install.sh | bash -s -- --cli-only
```

Optional upstream full install:

```bash
curl -fsSL https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/install/install.sh | bash
```

Use the full install path only when the user explicitly wants Skillhub's upstream default integration behavior.

## First-Use Workflow

When the user asks to use Skillhub, follow this order.

### 1. Classify the goal

Classify the request into one of these:

- learn what Skillhub is,
- install the Skillhub CLI,
- search for available Skillhub skills,
- install a specific Skillhub skill,
- troubleshoot an existing Skillhub setup.

If the user only wants to browse skills, do not jump straight into installation.

### 2. Check whether `skillhub` already exists

Run:

```bash
command -v skillhub
```

On Windows, use:

```powershell
Get-Command skillhub
```

If missing, recommend the CLI-only install command by default.

After install, do not assume success until a real command works.

### 3. Verify readiness

Run at least one of these:

```bash
skillhub --help
skillhub search test
```

Interpretation:

- `--help` succeeds: the CLI is installed and callable.
- `search` returns normal output or a normal empty result: the CLI can reach its search flow.
- command not found, permission failure, or shell parse failure: setup is not ready yet.

### 4. Prefer direct CLI verification over host-agent assumptions

Inside NextClaw, keep behavior explicit:

- if the user wants guaranteed usage right now, prefer direct CLI commands first;
- do not promise implicit host-agent discovery unless it has been directly observed.

Treat `skillhub` CLI readiness as the source of truth instead of inventing a restart step.

### 5. Discover available skills

Use:

```bash
skillhub search <keyword>
```

Examples:

```bash
skillhub search code-review
skillhub search seo
skillhub search feishu
```

If the user does not know the exact skill name, search first and present the likely matches before offering installation.

### 6. Install a specific Skillhub skill

Use:

```bash
skillhub install <skill-name>
```

Tencent's install doc says the skill is installed into the current workspace.

Because this is a write action, confirm the intended workspace first if there is any ambiguity.
Do not install into an accidental directory.

### 7. Verify post-install result

After installation, ask the user to test one real task that should invoke the newly installed Skillhub skill.

Success means:

- `skillhub` commands run successfully,
- the target skill installs without error,
- the user can invoke the resulting capability in the intended workspace or host agent flow.

## Safe Execution Rules

- Prefer CLI-only install unless the user asks for upstream full install.
- On Windows, explicitly say that the current upstream installer is Bash-based.
- Search before install when the exact skill name is uncertain.
- Treat `skillhub install <skill-name>` as a write action to the current workspace.
- If the current workspace is unclear, stop and clarify the target directory before installing.
- Do not describe Skillhub as built into NextClaw.
- Do not claim automatic agent-side detection unless the user has directly observed it.

## Troubleshooting

### `skillhub` command not found

- The CLI is not installed or not on `PATH`.
- Re-run the CLI-only install command.
- On Windows, confirm the user is running it from Git Bash or WSL if they are following the current upstream installer.
- Open a new shell if the current shell has not picked up the updated `PATH` yet.

### `skillhub --help` works but agent does not seem to notice Skillhub

- Do not invent a host-app restart requirement.
- Use direct CLI commands in the meantime instead of waiting on implicit discovery.

### Search or install fails

- Check network connectivity.
- Retry the same command once.
- If it still fails, keep the failure visible instead of pretending the skill was installed.

### User is unsure what to install

- Start with `skillhub search <keyword>`.
- Present the likely matches and ask which one they want.

## Success Criteria

This skill is working correctly when:

- the user understands what Skillhub is and is not,
- the user receives the CLI-only install path by default,
- readiness is verified with an observable command,
- skill discovery happens through `skillhub search`,
- installation happens intentionally through `skillhub install`,
- and ambiguous workspace writes are not performed silently.

## Resources

- Tencent Skillhub install doc:
  https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/install/skillhub.md
- Quick readiness check script in this skill:
  `bash skills/skillhub-guide/scripts/check-skillhub.sh`
- Windows PowerShell readiness check in this skill:
  `powershell -ExecutionPolicy Bypass -File skills/skillhub-guide/scripts/check-skillhub.ps1`
