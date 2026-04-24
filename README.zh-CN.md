<p align="right">
  <a href="./README.md">English</a>
</p>

<div align="center">

<img src="images/marketing/nextclaw-omni-assistant-cn.jpg" alt="NextClaw — 极致简洁的个人全能 AI 助手" width="720" />

<br /><br />

# NextClaw

**你的数字世界全能管家。一条命令，完全本地运行。**

[![npm](https://img.shields.io/npm/v/nextclaw)](https://www.npmjs.com/package/nextclaw)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-blue)](https://nodejs.org)
[![Discord](https://img.shields.io/badge/Discord-NextClaw-5865F2?logo=discord&logoColor=white)](https://discord.gg/j4Skbgye)

[文档](https://docs.nextclaw.io/zh/) · [规划](docs/ROADMAP.md) · [Discord](https://discord.gg/j4Skbgye) · [微信群](images/contact/nextclaw-contact-wechat-group.png) · [Issues](https://github.com/Peiiii/nextclaw/issues) · [路线图](https://docs.nextclaw.io/zh/guide/roadmap)

<p>
  <img src="https://img.shields.io/badge/Windows-0078D6?style=flat-square&logo=windows&logoColor=white" alt="Windows" />
  <img src="https://img.shields.io/badge/macOS-000000?style=flat-square&logo=apple&logoColor=white" alt="macOS" />
  <img src="https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux&logoColor=black" alt="Linux" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/云服务器-4285F4?style=flat-square&logo=googlecloud&logoColor=white" alt="Cloud VMs" />
</p>

</div>

---

NextClaw 替你俯瞰并调度整个互联网与海量算力，让每一寸比特与字节都听从你的意图运转。受 [OpenClaw](https://github.com/openclaw/openclaw) 启发，完全兼容其插件生态。

- **一条命令启动** — `nextclaw start`，浏览器内配置一切
- **12+ AI 提供商** — OpenRouter、OpenAI、Anthropic、Gemini、DeepSeek、Groq、MiniMax 等
  <br /><img src="https://img.shields.io/badge/OpenRouter-6366F1?style=flat-square" alt="OpenRouter" /> <img src="https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white" alt="OpenAI" /> <img src="https://img.shields.io/badge/Anthropic-D4A27F?style=flat-square&logo=anthropic&logoColor=white" alt="Anthropic" /> <img src="https://img.shields.io/badge/Gemini-8E75B2?style=flat-square&logo=googlegemini&logoColor=white" alt="Gemini" /> <img src="https://img.shields.io/badge/DeepSeek-0066FF?style=flat-square" alt="DeepSeek" /> <img src="https://img.shields.io/badge/Groq-F55036?style=flat-square" alt="Groq" /> <img src="https://img.shields.io/badge/MiniMax-FF6B35?style=flat-square" alt="MiniMax" /> <img src="https://img.shields.io/badge/Moonshot-1A1A2E?style=flat-square" alt="Moonshot" /> <img src="https://img.shields.io/badge/通义千问-FF6A00?style=flat-square" alt="DashScope" /> <img src="https://img.shields.io/badge/智谱-0052CC?style=flat-square" alt="Zhipu" /> <img src="https://img.shields.io/badge/AiHubMix-00B4D8?style=flat-square" alt="AiHubMix" /> <img src="https://img.shields.io/badge/vLLM-FF4500?style=flat-square" alt="vLLM" />
- **10+ 消息渠道** — Discord、Telegram、Slack、WhatsApp、飞书、钉钉、企业微信、QQ、Email
  <br /><img src="https://img.shields.io/badge/Discord-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Discord" /> <img src="https://img.shields.io/badge/Telegram-26A5E4?style=flat-square&logo=telegram&logoColor=white" alt="Telegram" /> <img src="https://img.shields.io/badge/Slack-4A154B?style=flat-square&logo=slack&logoColor=white" alt="Slack" /> <img src="https://img.shields.io/badge/WhatsApp-25D366?style=flat-square&logo=whatsapp&logoColor=white" alt="WhatsApp" /> <img src="https://img.shields.io/badge/飞书-00D6B9?style=flat-square" alt="Feishu" /> <img src="https://img.shields.io/badge/钉钉-0089FF?style=flat-square" alt="DingTalk" /> <img src="https://img.shields.io/badge/企业微信-07C160?style=flat-square" alt="WeCom" /> <img src="https://img.shields.io/badge/QQ-EB1923?style=flat-square&logo=tencentqq&logoColor=white" alt="QQ" /> <img src="https://img.shields.io/badge/Email-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email" /> <img src="https://img.shields.io/badge/Mochat-6B7280?style=flat-square" alt="Mochat" />
- **内置自动化** — Cron & Heartbeat 让 AI 按计划执行后台任务
- **本地可控** — 完全本机运行，配置、会话与密钥保留在你自己的环境中
- **极致轻量** — 代码量约为 OpenClaw 的 1/20，更易维护与扩展

## 社群

- **微信群** — 扫码加群：

  <img src="images/contact/nextclaw-contact-wechat-group.png" width="180" alt="微信群二维码" />

- **Discord** — [NextClaw / OpenClaw](https://discord.gg/j4Skbgye)

## 快速开始

### 0. 前置准备

- 安装 Node.js（推荐 LTS）：[nodejs.org](https://nodejs.org/)
- 打开终端：
  - Windows：`Win + R` 输入 `cmd`（或打开 PowerShell）
  - macOS：`Command + 空格` 搜索 `Terminal`
  - Linux：`Ctrl + Alt + T`（或应用菜单中的 Terminal）

先验证环境：

```bash
node -v
npm -v
```

```bash
npm i -g nextclaw
nextclaw start
```

浏览器打开 **http://127.0.0.1:55667** → 设置 Provider 与模型 → 开始对话。

如果部署在云服务器上，NextClaw 对外提供的是 `55667` 端口的纯 HTTP 服务。你可以先用 `http://<服务器IP>:55667` 直连验证；如果要走 `80/443` 或 `https://`，请用 Nginx/Caddy 做反向代理和 TLS 终止，不要让 NextClaw 直接承担 HTTPS。

```bash
nextclaw stop    # 停止服务
```

如遇 `npm` 命令不存在，请先安装/重装 Node.js，并重开终端。

> 完整配置指南：[docs.nextclaw.io](https://docs.nextclaw.io/zh/guide/configuration)
>
> 新手分步教程（含常见问题）：[快速开始文档](https://docs.nextclaw.io/zh/guide/getting-started)

## 截图

一键刷新全部产品截图（官网 + GitHub 资源图）：

```bash
pnpm screenshots:refresh
```

**Agent 对话** — 在一个页面中发起任务并查看多轮对话：

![Agent 对话](images/screenshots/nextclaw-chat-page-cn.png)

**AI 提供商** — 在 UI 中配置与切换提供商：

![AI 提供商](images/screenshots/nextclaw-providers-page-cn.png)

**消息渠道** — 启用 Discord、Telegram、飞书、QQ 等：

![消息渠道](images/screenshots/nextclaw-channels-page-cn.png)

## 文档

访问 **[docs.nextclaw.io](https://docs.nextclaw.io/zh/)** 查看完整文档，包括：

- [模型选择](https://docs.nextclaw.io/zh/guide/model-selection)
- [命令参考](https://docs.nextclaw.io/zh/guide/commands)
- [愿景与路线图](https://docs.nextclaw.io/zh/guide/vision)
- [飞书接入教程](https://docs.nextclaw.io/zh/guide/tutorials/feishu)
- GitHub 规划文档：[Roadmap](docs/ROADMAP.md) · [TODO 待办池](docs/TODO.md)

## 参与贡献

欢迎贡献！请提交 Issue 或 Pull Request。

## 致谢

NextClaw 的诞生离不开以下优秀项目的启发：

- [OpenClaw](https://github.com/openclaw/openclaw) — 全栈 AI 助手平台，NextClaw 的架构与插件生态深受其影响。
- [NanoBot](https://github.com/nicepkg/gpt-runner) — 轻量 Python Agent 框架，展示了简洁与强大可以兼得。

## 许可证

[MIT](LICENSE)

---

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=Peiiii/nextclaw&type=Date)](https://star-history.com/#Peiiii/nextclaw&Date)

</div>
