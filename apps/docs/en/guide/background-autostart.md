# Background & Autostart

This page is for users who already started using NextClaw and want it to be more reliably available on the same machine.

It answers three things:

- what background runtime means
- what login-time autostart / host autostart means
- how npm-installed NextClaw enables that in practice

## First separate these three ideas

### 1. Manual background runtime

When you run:

```bash
nextclaw start
```

you are saying "start it in the background now."

### 2. Start automatically after login

This means your operating system launches NextClaw for you after you log in.

### 3. Recover after machine restart

That usually means you need a host-managed path such as:

- Linux `systemd`
- macOS LaunchAgent
- Windows Scheduled Task
- or a Docker / server-style hosting path

## Before enabling autostart, confirm the normal local path works

Make sure the basic runtime path is healthy first:

```bash
nextclaw start
nextclaw status
nextclaw doctor
```

If this shortest path is not stable yet, do not begin with autostart.

## One key fact

`npm i -g nextclaw` only installs the CLI.  
It does **not** register host autostart automatically.

That is the correct product behavior: installing the CLI should not silently edit your system startup entries. Host autostart should be an explicit choice.

## Enable it by platform

### Linux

#### Login-level autostart

```bash
nextclaw service install-systemd --user
```

#### Machine-wide autostart

```bash
sudo nextclaw service install-systemd --system
```

#### Remove it

```bash
nextclaw service uninstall-systemd --user
sudo nextclaw service uninstall-systemd --system
```

### macOS

#### Enable

```bash
nextclaw service install-launch-agent
```

#### Remove

```bash
nextclaw service uninstall-launch-agent
```

### Windows

#### Enable

```bash
nextclaw service install-task
```

#### Remove

```bash
nextclaw service uninstall-task
```

## How to verify that it worked

These two commands are read-only checks:

```bash
nextclaw service autostart status
nextclaw service autostart doctor
```

On Linux, add an explicit scope only when needed:

```bash
nextclaw service autostart status --user
nextclaw service autostart status --system
```

## When Docker or server hosting is a better fit

If your goal is:

- reliable recovery after reboot
- long-lived service behavior behind a reverse proxy
- hosting NextClaw more like infrastructure than a local app

then you should also evaluate:

- [Docker One-Click Deployment](/en/guide/tutorials/docker-one-click)
- Linux host-managed runtime via `systemd`

Do not mix up "I started it once today" with "this machine now hosts it reliably."

## Related Docs

- [Runtime & Hosting](/en/guide/runtime-hosting)
- [Core Commands](/en/guide/core-commands)
- [Command Index](/en/guide/commands)
- [Docker One-Click Deployment](/en/guide/tutorials/docker-one-click)
