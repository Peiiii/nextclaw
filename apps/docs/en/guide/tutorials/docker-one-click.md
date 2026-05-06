# Docker Deployment

Docker is for servers or long-running environments.  
If you are trying NextClaw for the first time, use [Quickstart](/en/guide/getting-started).

## Good use cases

- you have a server that stays online
- you want a repeatable environment
- you want to use it with a reverse proxy, domain, or remote access path

## Before deploying

- Docker is ready
- you know where configuration should live
- model provider credentials are prepared
- you know who should be able to access this instance

## After deployment

```bash
nextclaw status
nextclaw doctor
```

If the CLI is not available inside the container, use container logs and health checks.

## Related docs

- [Runtime & Hosting Manual](/en/guide/runtime-hosting)
- [Remote Access](/en/guide/remote-access)
- [Secrets Management](/en/guide/secrets)
