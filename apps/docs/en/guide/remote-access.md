# Remote Access

Remote access lets you open the NextClaw instance running on this machine from another device. It is for users who already have a working local instance and want to turn it into a personal remote console.

## Before you start

You should already have:

- completed the [Quickstart](/en/guide/getting-started)
- one working model provider
- normal `nextclaw status`

If the service itself is not working yet, do not start with remote access.

## Good use cases

- access the NextClaw instance on your home computer from a phone or tablet
- access a server-hosted NextClaw from another machine
- place your local instance behind a controlled remote entry point

## Basic commands

```bash
nextclaw remote enable
nextclaw remote status
nextclaw remote doctor
nextclaw remote disable
```

Use `remote doctor` to check whether the remote access path is ready.

## Security notes

Remote access changes who can reach your instance. Before enabling it, confirm:

- you know who can access the entry point
- tokens or login state are not exposed
- the tunnel or reverse proxy is trusted
- the local management UI is not exposed to an untrusted network

## Related docs

- [Background & Autostart](/en/guide/background-autostart)
- [Docker Deployment](/en/guide/tutorials/docker-one-click)
- [Troubleshooting](/en/guide/troubleshooting)
