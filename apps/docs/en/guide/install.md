# Choose an Install Path

NextClaw is available as a desktop app, an npm package, and a Docker deployment. All three run the same product; the main difference is where it runs and how you maintain it.

## Most people: desktop app

Use the desktop app when you want to download NextClaw and open it directly. It supports macOS, Windows, and Linux.

[Download the latest stable release](https://nextclaw.io/en/download/)

Open NextClaw after installation. A fresh install enables OpenCode Zen free-trial models by default, so you can send the first message without entering an API key. Then continue to the [Quickstart](/en/guide/getting-started).

You can choose an update channel in Desktop settings. Stable receives production releases only. Beta checks both preview and production releases and offers whichever version is newer.

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

The built-in free-trial models are ready on first launch; you do not need to prepare an API key first.

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

Unused messaging channels do not keep separate processes resident. The current verified ARM64 Linux empty-configuration benchmark averaged about 165 MiB of working set across three runs. This is an idle benchmark rather than a universal minimum; see [Runtime Resource Usage](/en/guide/resource-usage) for the tested server baseline and the workloads that add memory.

## Which one should you choose?

| Your situation | Recommended path |
| --- | --- |
| Start quickly on your own computer | Desktop app |
| Use a CLI or local background service | npm |
| Keep NextClaw running on a server | Docker |
| Develop NextClaw itself | [Run from source](https://github.com/Peiiii/nextclaw#develop-from-source) |

After choosing, continue to the [Quickstart](/en/guide/getting-started).

> OpenCode Zen free-trial access uses a public gateway. Limits and models may change, and request data may be used to improve models. Do not send passwords, secrets, or other sensitive or confidential information.
