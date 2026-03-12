# Docker One-Click Deployment Tutorial

This guide is for users who want to run NextClaw directly in Docker.  
Goal: start with one command and get URLs you can open immediately.

## Prerequisites

- Docker is installed and running (Docker Desktop or Docker Engine).
- Your machine can access:
  - `https://nextclaw.io` (install script)
  - Docker image registry (to pull `node:22-bookworm-slim`)
  - npm registry (to install `nextclaw`)
- Default ports are available:
  - UI: `18791`
  - Gateway: `18790`

## One-Click Command

```bash
curl -fsSL https://nextclaw.io/install-docker.sh | bash
```

## What You Will See After Startup

When startup succeeds, output looks like:

```text
UI: http://127.0.0.1:18791
API: http://127.0.0.1:18791/api
Gateway (direct): http://127.0.0.1:18790
Data dir: /Users/<you>/.nextclaw-docker
Container: nextclaw
```

Like `nextclaw start`, you can open the UI URL directly.

## Useful Operations

View logs:

```bash
docker logs -f nextclaw
```

Restart:

```bash
docker restart nextclaw
```

Stop:

```bash
docker stop nextclaw
```

Remove container (data directory stays):

```bash
docker rm -f nextclaw
```

## Customize Port / Data Directory / Container Name

### Option 1: Environment Variables (most common)

```bash
NEXTCLAW_DOCKER_UI_PORT=18891 \
NEXTCLAW_DOCKER_API_PORT=18890 \
NEXTCLAW_DOCKER_CONTAINER_NAME=nextclaw-prod \
NEXTCLAW_DOCKER_DATA_DIR="$HOME/.nextclaw-docker-prod" \
curl -fsSL https://nextclaw.io/install-docker.sh | bash
```

### Option 2: Script Flags

```bash
curl -fsSL https://nextclaw.io/install-docker.sh | bash -s -- \
  --ui-port 18891 \
  --api-port 18890 \
  --container-name nextclaw-prod \
  --data-dir "$HOME/.nextclaw-docker-prod"
```

### Dry Run (preview only)

```bash
curl -fsSL https://nextclaw.io/install-docker.sh | bash -s -- --dry-run
```

## Upgrade to Latest

Run the same one-click command again.  
The script recreates the same container name while keeping data in the mounted directory (default `~/.nextclaw-docker`).

If you want to pin a version:

```bash
NEXTCLAW_DOCKER_INSTALL_TARGET=nextclaw@0.13.0 \
curl -fsSL https://nextclaw.io/install-docker.sh | bash
```

## Common Issues

### Error: `docker is required`

Docker is not available in PATH. Install Docker and verify `docker version`.

### Error: `docker daemon is not reachable`

Docker service is not running. Start Docker Desktop/daemon first.

### Error: health check timeout (`/api/health`)

Check container logs:

```bash
docker logs --tail 120 nextclaw
```

Common reasons:

- slow network while pulling image/installing npm package
- port conflict prevented service startup

### Port Conflict

Re-run with custom ports. See customization examples above.

## Related Docs

- [Quick Start](/en/guide/getting-started)
- [Configuration](/en/guide/configuration)
- [Troubleshooting](/en/guide/troubleshooting)
