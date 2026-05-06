# Background & Autostart

`nextclaw start` starts NextClaw, but it is not the same as host-level long-running management.

This page explains when you need background runtime and autostart, and how the NPM install path enables it explicitly.

## When you need it

Consider autostart when:

- you use NextClaw every day
- you want it available after login
- you do not want to restart it manually after reboot
- you have connected channels or automations

## NPM install does not register autostart

```bash
npm i -g nextclaw
```

This only installs the CLI. It does not silently modify system startup entries.

If you want autostart, install the host-managed entry explicitly.

## Enable by platform

Linux user service:

```bash
nextclaw service install-systemd --user
```

Linux system service:

```bash
sudo nextclaw service install-systemd --system
```

macOS:

```bash
nextclaw service install-launch-agent
```

Windows:

```bash
nextclaw service install-task
```

## Check status

```bash
nextclaw service autostart status
nextclaw service autostart doctor
```

## When you do not need it

If you are only trying NextClaw or using the local UI occasionally, `nextclaw start` is enough.

## Related docs

- [Runtime & Hosting](/en/guide/runtime-hosting)
- [Remote Access](/en/guide/remote-access)
- [Command Index](/en/guide/commands)
