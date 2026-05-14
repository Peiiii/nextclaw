---
name: nextclaw-autostart
description: Use when the user asks about NextClaw autostart, auto-start on login or reboot, daemon/service registration, LaunchAgent, systemd, Windows Scheduled Task, service autostart, nextclaw start not surviving OS restart, or NPM install startup experience. 适用于开机自启动、系统重启后自动恢复、后台服务注册与自启动排查。
description_zh: 用于处理 NextClaw 开机自启动、登录或重启后自动恢复、后台服务注册、LaunchAgent、systemd、Windows 计划任务、service autostart，以及 NPM 安装后启动体验相关问题。
---

# NextClaw Autostart

This built-in skill helps the AI guide users through NextClaw autostart and reboot recovery without turning service registration into a hidden side effect.

## Core Position

- `npm i -g nextclaw` installs the CLI only. It should not silently register a host autostart service.
- `nextclaw start` starts the current background service. Without host autostart registration, the service usually needs to be started again after an OS reboot.
- Autostart must be explicit, inspectable, diagnosable, and removable.
- Prefer a product-level guided setup flow over asking normal users to understand launchd, systemd, or Task Scheduler first.
- Do not confuse three separate meanings:
  - login/boot autostart,
  - crash supervision,
  - update/restart relaunch.

## Existing Commands

- macOS login autostart: `nextclaw service install-launch-agent`
- Linux user-level login autostart: `nextclaw service install-systemd --user`
- Linux system-level boot autostart: `sudo nextclaw service install-systemd --system`
- Windows login autostart: `nextclaw service install-task`
- Status: `nextclaw service autostart status`
- Diagnostics: `nextclaw service autostart doctor`
- macOS uninstall: `nextclaw service uninstall-launch-agent`
- Linux user-level uninstall: `nextclaw service uninstall-systemd --user`
- Linux system-level uninstall: `sudo nextclaw service uninstall-systemd --system`
- Windows uninstall: `nextclaw service uninstall-task`

## Workflow

1. Determine whether the user is asking for current behavior, product design, setup help, or troubleshooting.
2. For current behavior, clearly separate:
   - CLI installation,
   - one-time/background runtime start,
   - host autostart registration.
3. For setup help:
   - identify the OS,
   - inspect current autostart status,
   - explain what registration will change,
   - ask before performing a mutating registration command,
   - verify with `nextclaw service autostart status` or `doctor`,
   - tell the user how to disable it.
4. For troubleshooting, collect:
   - OS and install method,
   - `nextclaw --version`,
   - `nextclaw status`,
   - `nextclaw service autostart status`,
   - `nextclaw service autostart doctor`.
5. Diagnose whether the issue is:
   - autostart not registered,
   - registration failed,
   - executable path changed after update,
   - permission/scope mismatch,
   - port conflict,
   - service starts then crashes.

## Product Guidance

When improving NextClaw itself, prefer an explicit guided path:

- `nextclaw setup` or an equivalent UI/agent-guided setup should detect OS and current status.
- If autostart is not enabled, explain the reboot impact and offer to register it.
- After registration, run status/doctor and show the disable command.
- `nextclaw start` may suggest autostart setup, but should not silently enable it.
- NPM install should remain side-effect free.

## Success Criteria

- The user understands whether NextClaw will come back after reboot.
- The AI can point to the host mechanism responsible for autostart.
- The AI can diagnose failed setup with actionable next steps.
- Every mutating registration path has explicit user consent and a matching uninstall path.
- Restart semantics stay precise: hot reload, manual restart, update relaunch, and host autostart are not mixed.
