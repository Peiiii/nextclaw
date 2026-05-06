# Core Commands

This page only keeps the small set of commands most users need regularly.

If your goal is to install, start, confirm health, restart, or stop NextClaw, this page is enough.  
If you need the broader CLI surface, go to the [Command Index](/en/guide/commands).

## The 7 commands most users actually need

| Command | When to use it |
|---------|----------------|
| `npm i -g nextclaw` | First-time CLI install |
| `nextclaw start` | Start NextClaw in the background |
| `nextclaw status` | Confirm whether it is running normally |
| `nextclaw doctor` | Run diagnostics when something feels wrong |
| `nextclaw restart` | Restart after config changes or runtime issues |
| `nextclaw stop` | Stop the background service for now |
| `nextclaw update` | Upgrade the CLI to the latest version |

## Shortest useful workflow

### 1. First install

```bash
npm i -g nextclaw
nextclaw start
```

Then open `http://127.0.0.1:55667` and finish first-time setup.

### 2. Daily health check

```bash
nextclaw status
```

This is usually enough when you only want to confirm that the service is still there and the UI should still open.

### 3. Diagnose before guessing

```bash
nextclaw doctor
```

Use this first when the UI will not open, a connection looks broken, or runtime state feels off.

### 4. Restart after changes or weird state

```bash
nextclaw restart
```

### 5. Stop when you do not need it for now

```bash
nextclaw stop
```

### 6. Upgrade the CLI

```bash
nextclaw update
```

## When to open other pages

- If you want NextClaw to stay available in the background, read [Runtime & Hosting](/en/guide/runtime-hosting)
- If you want login-time autostart, read [Background & Autostart](/en/guide/background-autostart)
- If you need a specific command, open the [Command Index](/en/guide/commands)

## Related Docs

- [Quick Start](/en/guide/getting-started)
- [What To Do After Setup](/en/guide/after-setup)
- [Runtime & Hosting](/en/guide/runtime-hosting)
- [Troubleshooting](/en/guide/troubleshooting)
