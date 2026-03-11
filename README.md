<p align="right">
  <a href="./README.zh-CN.md">简体中文</a>
</p>

<div align="center">

<img src="images/marketing/nextclaw-omni-assistant-en.jpg" alt="NextClaw — The Self-Aware Infrastructure for the AI Agent Era" width="720" />

<br /><br />

# NextClaw

**Your omnipotent personal AI assistant. One command. Runs locally.**

[![npm](https://img.shields.io/npm/v/nextclaw)](https://www.npmjs.com/package/nextclaw)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-blue)](https://nodejs.org)
[![Discord](https://img.shields.io/badge/Discord-NextClaw-5865F2?logo=discord&logoColor=white)](https://discord.gg/j4Skbgye)

[Documentation](https://docs.nextclaw.io/en/) · [Discord](https://discord.gg/j4Skbgye) · [Issues](https://github.com/Peiiii/nextclaw/issues) · [Roadmap](https://docs.nextclaw.io/en/guide/roadmap)

<p>
  <img src="https://img.shields.io/badge/Windows-0078D6?style=flat-square&logo=windows&logoColor=white" alt="Windows" />
  <img src="https://img.shields.io/badge/macOS-000000?style=flat-square&logo=apple&logoColor=white" alt="macOS" />
  <img src="https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux&logoColor=black" alt="Linux" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Cloud_VMs-4285F4?style=flat-square&logo=googlecloud&logoColor=white" alt="Cloud VMs" />
</p>

</div>

---

NextClaw orchestrates the entire internet and raw compute from your machine — bending every bit and byte to manifest your intent into reality. Inspired by [OpenClaw](https://github.com/openclaw/openclaw) and fully compatible with its plugin ecosystem.

- **One-command startup** — `nextclaw start`, then configure everything in the browser UI
- **12+ AI providers** — OpenRouter, OpenAI, Anthropic, Gemini, DeepSeek, Groq, MiniMax, and more
  <br /><img src="https://img.shields.io/badge/OpenRouter-6366F1?style=flat-square" alt="OpenRouter" /> <img src="https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white" alt="OpenAI" /> <img src="https://img.shields.io/badge/Anthropic-D4A27F?style=flat-square&logo=anthropic&logoColor=white" alt="Anthropic" /> <img src="https://img.shields.io/badge/Gemini-8E75B2?style=flat-square&logo=googlegemini&logoColor=white" alt="Gemini" /> <img src="https://img.shields.io/badge/DeepSeek-0066FF?style=flat-square" alt="DeepSeek" /> <img src="https://img.shields.io/badge/Groq-F55036?style=flat-square" alt="Groq" /> <img src="https://img.shields.io/badge/MiniMax-FF6B35?style=flat-square" alt="MiniMax" /> <img src="https://img.shields.io/badge/Moonshot-1A1A2E?style=flat-square" alt="Moonshot" /> <img src="https://img.shields.io/badge/DashScope-FF6A00?style=flat-square" alt="DashScope" /> <img src="https://img.shields.io/badge/Zhipu-0052CC?style=flat-square" alt="Zhipu" /> <img src="https://img.shields.io/badge/AiHubMix-00B4D8?style=flat-square" alt="AiHubMix" /> <img src="https://img.shields.io/badge/vLLM-FF4500?style=flat-square" alt="vLLM" />
- **10+ message channels** — Discord, Telegram, Slack, WhatsApp, Feishu, DingTalk, WeCom, QQ, Email
  <br /><img src="https://img.shields.io/badge/Discord-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Discord" /> <img src="https://img.shields.io/badge/Telegram-26A5E4?style=flat-square&logo=telegram&logoColor=white" alt="Telegram" /> <img src="https://img.shields.io/badge/Slack-4A154B?style=flat-square&logo=slack&logoColor=white" alt="Slack" /> <img src="https://img.shields.io/badge/WhatsApp-25D366?style=flat-square&logo=whatsapp&logoColor=white" alt="WhatsApp" /> <img src="https://img.shields.io/badge/Feishu-00D6B9?style=flat-square" alt="Feishu" /> <img src="https://img.shields.io/badge/DingTalk-0089FF?style=flat-square" alt="DingTalk" /> <img src="https://img.shields.io/badge/WeCom-07C160?style=flat-square" alt="WeCom" /> <img src="https://img.shields.io/badge/QQ-EB1923?style=flat-square&logo=tencentqq&logoColor=white" alt="QQ" /> <img src="https://img.shields.io/badge/Email-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email" /> <img src="https://img.shields.io/badge/Mochat-6B7280?style=flat-square" alt="Mochat" />
- **Built-in automation** — Cron & Heartbeat for scheduled autonomous tasks
- **Local & private** — Runs entirely on your machine; configs, history, and tokens stay with you
- **Ultra-lightweight** — ~1/20 the codebase of OpenClaw, easier to maintain and extend

## Quick Start

### 0. Prerequisites

- Install Node.js (LTS recommended): [nodejs.org](https://nodejs.org/)
- Open a terminal:
  - Windows: `Win + R`, type `cmd` (or open PowerShell)
  - macOS: `Command + Space`, search `Terminal`
  - Linux: `Ctrl + Alt + T` (or Terminal from app menu)

Verify your environment first:

```bash
node -v
npm -v
```

```bash
npm i -g nextclaw
nextclaw start
```

Open **http://127.0.0.1:18791** → set your provider and model → start chatting.

```bash
nextclaw stop    # stop the service
```

If `npm` is not found, install/reinstall Node.js and reopen your terminal.

### Run The Development Server

For local development in this repository, use the built-in dev runner from the repo root:

```bash
pnpm install
pnpm dev
```

This starts the NextClaw development stack and prints the local URLs in the terminal.

If you only need one side, you can run them separately:

```bash
pnpm dev:backend   # backend on 127.0.0.1:18792
pnpm dev:frontend  # frontend on 127.0.0.1:5174
```

> Full configuration guide: [docs.nextclaw.io](https://docs.nextclaw.io/en/guide/configuration)
>
> Beginner step-by-step guide (with troubleshooting): [Getting Started](https://docs.nextclaw.io/en/guide/getting-started)

## Screenshots

Refresh all product screenshots (website + GitHub assets):

```bash
pnpm screenshots:refresh
```

**Agent Chat** — send tasks and review multi-turn conversations in one place:

![Agent Chat](images/screenshots/nextclaw-chat-page-en.png)

**AI Providers** — configure and switch between providers in the UI:

![AI Providers](images/screenshots/nextclaw-providers-page-en.png)

**Message Channels** — enable Discord, Telegram, Feishu, QQ, and more:

![Message Channels](images/screenshots/nextclaw-channels-page-en.png)

## Documentation

Visit **[docs.nextclaw.io](https://docs.nextclaw.io/en/)** for the full documentation, including:

- [Model Selection](https://docs.nextclaw.io/en/guide/model-selection)
- [Commands](https://docs.nextclaw.io/en/guide/commands)
- [Vision & Roadmap](https://docs.nextclaw.io/en/guide/vision)
- [Feishu Setup Tutorial](https://docs.nextclaw.io/en/guide/tutorials/feishu)

## Community

- **Discord** — [NextClaw / OpenClaw](https://discord.gg/j4Skbgye)
- **WeChat Group** — Scan to join:

  <img src="images/contact/nextclaw-contact-wechat-group.jpg" width="180" alt="WeChat Group QR" />

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Acknowledgements

NextClaw is inspired by and built upon the shoulders of these great projects:

- [OpenClaw](https://github.com/openclaw/openclaw) — The full-stack AI assistant platform that inspired NextClaw's architecture and plugin ecosystem.
- [NanoBot](https://github.com/nicepkg/gpt-runner) — A lightweight Python agent framework that demonstrated how simplicity and power can coexist.

## License

[MIT](LICENSE)

---

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=Peiiii/nextclaw&type=Date)](https://star-history.com/#Peiiii/nextclaw&Date)

</div>
