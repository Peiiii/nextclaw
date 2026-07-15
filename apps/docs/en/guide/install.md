# Choose an Install Path

NextClaw is available as a desktop app, an npm package, and a Docker deployment. All three run the same product; the main difference is where it runs and how you maintain it.

## Most people: desktop app

Use the desktop app when you want to download NextClaw and open it directly. It supports macOS, Windows, and Linux.

[Download the latest stable release](https://nextclaw.io/en/download/)

Open NextClaw after installation, follow the model setup in the interface, then continue to the [Quickstart](/en/guide/getting-started).

## Terminal and local service: npm

Use npm when you prefer a command-line workflow or want NextClaw to run as a local service.

```bash
npm install -g nextclaw
nextclaw start
```

Then open:

```text
http://127.0.0.1:55667
```

Common management commands:

```bash
nextclaw status
nextclaw doctor
nextclaw stop
```

## Server or cloud VM: Docker

Use Docker for an always-on host, remote access, reverse proxy, or cloud VM deployment.

```bash
curl -fsSL https://nextclaw.io/install-docker.sh | bash
```

Review remote scripts before running them on a server. See [Docker Deployment](/en/guide/tutorials/docker-one-click) for domains, ports, data paths, and reverse proxy setup.

## Which one should you choose?

| Your situation | Recommended path |
| --- | --- |
| Start quickly on your own computer | Desktop app |
| Use a CLI or local background service | npm |
| Keep NextClaw running on a server | Docker |
| Develop NextClaw itself | [Run from source](https://github.com/Peiiii/nextclaw#develop-from-source) |

After choosing, continue to the [Quickstart](/en/guide/getting-started).
