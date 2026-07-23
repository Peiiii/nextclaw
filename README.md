<p align="right">
  <a href="./README.zh-CN.md">简体中文</a>
</p>

<div align="center">

# NextClaw

**Get real work done with AI on the computer you control.**

Tell NextClaw what you want done. It brings files, models, agents, skills, browser tools, local apps, automations, and messaging channels into one task, then keeps working toward a usable result.

[![npm](https://img.shields.io/npm/v/nextclaw)](https://www.npmjs.com/package/nextclaw)
[![GitHub Release](https://img.shields.io/github/v/release/Peiiii/nextclaw?display_name=tag)](https://github.com/Peiiii/nextclaw/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node.js LTS](https://img.shields.io/badge/Node.js-LTS-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Discord](https://img.shields.io/badge/Discord-NextClaw-5865F2?logo=discord&logoColor=white)](https://discord.gg/j4Skbgye)

[Website](https://nextclaw.io/en/) · [Download](https://nextclaw.io/en/download/) · [Install](https://nextclaw.io/en/install/) · [Documentation](https://docs.nextclaw.io/en/) · [Releases](https://github.com/Peiiii/nextclaw/releases)

<p>
  <img src="https://img.shields.io/badge/Windows-0078D6?style=flat-square&logo=windows&logoColor=white" alt="Windows" />
  <img src="https://img.shields.io/badge/macOS-000000?style=flat-square&logo=apple&logoColor=white" alt="macOS" />
  <img src="https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux&logoColor=black" alt="Linux" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Cloud_VMs-4285F4?style=flat-square&logo=googlecloud&logoColor=white" alt="Cloud VMs" />
</p>

</div>

![NextClaw showing a data visualization result with a Markdown document open beside it](images/screenshots/nextclaw-hero-workbench-cn.png)

NextClaw is a local-first AI workspace for tasks that need more than a single answer. A conversation can keep its files, references, tools, generated results, and follow-up work together instead of making you restart in separate apps.

## What You Can Do

- **Research and compare** — collect pages, notes, and references, then turn them into a brief, source list, or comparison table.
- **Analyze and visualize data** — gather data from websites, CSV files, or spreadsheets, clean it, draw charts, and write the conclusion.
- **Draft useful documents** — shape source material and rough notes into reports, articles, proposals, release notes, or weekly updates.
- **Process local files** — inspect, rename, extract, classify, and summarize documents without losing the task context.
- **Build small tools for yourself** — turn a repeated job into a script, local app, dashboard, or reusable workflow.
- **Keep recurring work moving** — receive requests from chat apps, run scheduled briefs or checks, and send results back to the right channel.

[Explore more use cases](https://nextclaw.io/en/use-cases/)

## Product Tour

### Choose the Agent Runtime for each task

Keep an Agent's identity, workspace, memory, and skills, then run the task with Native, Codex, Claude Code, OpenCode, or Hermes. The real task below uses Codex to refine a project architecture while the generated Markdown stays open beside the conversation.

[![NextClaw uses Codex to work on a project with its Markdown architecture document open beside the conversation](images/screenshots/nextclaw-codex-runtime-markdown-preview-cn.png)](images/screenshots/nextclaw-codex-runtime-markdown-preview-cn.png)

### Inspect real files beside the conversation

Open code, Markdown, HTML, Word, Excel, and PowerPoint without losing the task that produced them.

[![An Excel file open beside a NextClaw conversation](images/screenshots/nextclaw-office-file-preview-en.png)](images/screenshots/nextclaw-office-file-preview-en.png)

### Keep the small apps you build

Build a page with an Agent, run it beside the conversation, and keep it as a Panel App you can open and improve later.

[![A Panel App running beside a NextClaw conversation](images/screenshots/nextclaw-panel-app-running-en.png)](images/screenshots/nextclaw-panel-app-running-en.png)

### More of the workspace

<table>
  <tr>
    <td width="50%" valign="top">
      <strong>Dedicated Agents</strong><br />
      Give different kinds of work their own role, memory, skills, runtime, and workspace.<br /><br />
      <a href="images/screenshots/nextclaw-agents-page-en.png"><img src="images/screenshots/nextclaw-agents-page-en.png" width="100%" alt="NextClaw agent management page" /></a>
    </td>
    <td width="50%" valign="top">
      <strong>Image generation</strong><br />
      Generate an image, keep the local file, and continue using it in the same task.<br /><br />
      <a href="images/screenshots/nextclaw-image-generation-result-en.png"><img src="images/screenshots/nextclaw-image-generation-result-en.png" width="100%" alt="An image generated inside a NextClaw task" /></a>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>Messaging channels</strong><br />
      Connect Weixin, Feishu/Lark, QQ, and other channels to the Agents running on your machine.<br /><br />
      <a href="images/screenshots/nextclaw-channels-page-en.png"><img src="images/screenshots/nextclaw-channels-page-en.png" width="100%" alt="NextClaw messaging channel settings" /></a>
    </td>
    <td width="50%" valign="top">
      <strong>Scheduled work</strong><br />
      Run recurring briefs, checks, and other tasks on a schedule you control.<br /><br />
      <a href="images/screenshots/nextclaw-cron-job-page-en.png"><img src="images/screenshots/nextclaw-cron-job-page-en.png" width="100%" alt="NextClaw scheduled task list" /></a>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>Skills and references</strong><br />
      Install skills while keeping their documentation open in the right-side Doc Browser.<br /><br />
      <a href="images/screenshots/nextclaw-skills-doc-browser-en.png"><img src="images/screenshots/nextclaw-skills-doc-browser-en.png" width="100%" alt="NextClaw skill market with the Doc Browser open" /></a>
    </td>
    <td width="50%" valign="top">
      <strong>Model providers</strong><br />
      Use built-in providers or add your own OpenAI-compatible endpoint and models.<br /><br />
      <a href="images/screenshots/nextclaw-providers-page-en.png"><img src="images/screenshots/nextclaw-providers-page-en.png" width="100%" alt="NextClaw model provider settings" /></a>
    </td>
  </tr>
</table>

## Install NextClaw

### Desktop App

The desktop app is the easiest way to start on macOS, Windows, or Linux.

[Download the latest stable desktop release](https://nextclaw.io/en/download/)

### npm

Install Node.js LTS first, then run:

```bash
npm install -g nextclaw
nextclaw start
```

Open [http://127.0.0.1:55667](http://127.0.0.1:55667), choose a model provider, and start a task.

If `npm` is unavailable, install or reinstall Node.js LTS and reopen the terminal. On a remote host, port `55667` serves plain HTTP. Use it directly only for a quick check; terminate HTTPS with Nginx or Caddy for regular access.

```bash
nextclaw stop
```

### Docker

For a long-running server or cloud VM deployment:

```bash
curl -fsSL https://nextclaw.io/install-docker.sh | bash
```

See the [Docker deployment guide](https://docs.nextclaw.io/en/guide/tutorials/docker-one-click) for reverse proxy, domain, and remote access setup. You can compare every supported path on the [install options page](https://nextclaw.io/en/install/).

## Models, Channels, and Tools

- **Models** — OpenRouter, OpenAI, Anthropic, Gemini, DeepSeek, MiniMax, Moonshot, DashScope, Zhipu, AiHubMix, vLLM, and custom OpenAI-compatible endpoints.
- **Messaging channels** — Weixin, Feishu/Lark, QQ, DingTalk, WeCom, Telegram, Discord, Slack, WhatsApp, and email.
- **Capabilities** — skills, MCP servers, CLI tools, browser control, local files, Panel Apps, and scheduled tasks.
- **Local control** — configuration, conversations, and credentials stay in the environment you control. Connected providers and channels receive the data you send through them.

[See all integrations](https://nextclaw.io/en/integrations/)

## Develop From Source

From the repository root:

```bash
pnpm install
pnpm dev start
```

The development stack prints its local URLs in the terminal and uses `~/.nextclaw` by default. Set `NEXTCLAW_HOME=/path/to/home` to use an isolated data directory.

To run only one side:

```bash
pnpm dev:backend
pnpm dev:frontend
```

See the [developer command reference](docs/workflows/developer-commands.md) for local source-runtime checks, the manual runtime-update harness, platform stacks, Docker, and validation commands.

To refresh the repository and website screenshot set:

```bash
pnpm run screenshots:refresh
```

## Documentation

- [Getting Started](https://docs.nextclaw.io/en/guide/getting-started)
- [Configuration](https://docs.nextclaw.io/en/guide/configuration)
- [Model Selection](https://docs.nextclaw.io/en/guide/model-selection)
- [Commands](https://docs.nextclaw.io/en/guide/commands)
- [Feishu Setup](https://docs.nextclaw.io/en/guide/tutorials/feishu)
- [Vision](https://docs.nextclaw.io/en/guide/vision)
- [Roadmap](https://docs.nextclaw.io/en/guide/roadmap)
- [Product Updates](https://nextclaw.io/en/releases/)

Repository planning: [Roadmap](docs/ROADMAP.md) · [TODO](docs/TODO.md)

## Community

- [Discord](https://discord.gg/j4Skbgye)
- [GitHub Issues](https://github.com/Peiiii/nextclaw/issues)
- WeChat group: scan the QR code below.

<img src="images/contact/nextclaw-contact-wechat-group.png" width="180" alt="NextClaw WeChat group QR code" />

## Contributing

Contributions are welcome. Open an issue to discuss a bug or proposal, or submit a pull request with a focused change and its relevant verification.

## Acknowledgements

NextClaw was inspired by these projects:

- [OpenClaw](https://github.com/openclaw/openclaw) — inspired NextClaw's early exploration of a full-stack AI assistant.
- [NanoBot](https://github.com/nicepkg/gpt-runner) — demonstrated how a small agent framework can remain useful and extensible.

## License

[MIT](LICENSE)

---

<div align="center">

[![NextClaw GitHub star history](images/metrics/nextclaw-star-history.svg)](https://github.com/Peiiii/nextclaw/stargazers)

</div>
