# Runtime & Hosting

This page is not about memorizing one command. It answers a more important question:

- how should I run NextClaw
- how should I keep it available
- when should I use local background mode, host autostart, Docker, or remote access

## Keep one principle in mind

`nextclaw start` is the right command to get NextClaw running quickly.  
But "started once" and "stays available reliably" are not the same thing.

If you only want to begin using it today, `nextclaw start` is enough.  
If you want it to come back after login, survive machine restarts more predictably, or stay reachable from other devices, you should move to the right hosting path.

## The four most common paths

### 1. I just want it running on this machine now

Use this when your goal is to configure a provider, open the UI, and start using NextClaw immediately.

Use:

```bash
nextclaw start
nextclaw status
nextclaw stop
```

Entry page:

- [Core Commands](/en/guide/core-commands)

### 2. I want it to stay available in the background on this machine

Use this when NextClaw is already part of your routine and you no longer want to start it manually every time.

That means understanding:

- background runtime
- login-time autostart
- host-native ownership

Entry page:

- [Background & Autostart](/en/guide/background-autostart)

### 3. I want it to behave more like a hosted service

Use this when you want a server-style or container-style path instead of depending on one terminal session on one local machine.

The shortest entry is:

- [Docker One-Click Deployment](/en/guide/tutorials/docker-one-click)

If you are placing NextClaw behind Nginx / Caddy / Traefik on Linux, this path is usually more reliable than only running `nextclaw start` once.

### 4. I want to access this machine from other devices

Use this when you want the local NextClaw UI to behave like your own remote control surface.

Entry page:

- [Remote Access](/en/guide/remote-access)

## When not to stop at `nextclaw start`

If you are in any of these situations, a one-time `nextclaw start` is no longer enough:

- you want recovery after reboot
- you want it available even when you are not watching the terminal
- you expose it behind a reverse proxy
- you want stable access from other devices

Then continue with:

- [Background & Autostart](/en/guide/background-autostart)
- [Remote Access](/en/guide/remote-access)
- [Docker One-Click Deployment](/en/guide/tutorials/docker-one-click)

## A simple way to choose

- Just get started today: `nextclaw start`
- Keep using it on one machine: Background & Autostart
- Treat it more like a service: Docker or host-managed runtime
- Reach it from other devices: Remote Access

## Related Docs

- [Core Commands](/en/guide/core-commands)
- [Background & Autostart](/en/guide/background-autostart)
- [Remote Access](/en/guide/remote-access)
- [Docker One-Click Deployment](/en/guide/tutorials/docker-one-click)
