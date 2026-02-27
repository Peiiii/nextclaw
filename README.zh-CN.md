<div align="center">

# NextClaw

**你的专属神级管家**

[![npm](https://img.shields.io/npm/v/nextclaw)](https://www.npmjs.com/package/nextclaw)
[![Node](https://img.shields.io/badge/node-%3E%3D18-blue)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![LOC](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FPeiiii%2Fnextclaw%2Fmaster%2Fdocs%2Fmetrics%2Fcode-volume%2Flatest.json&query=%24.totals.codeLines&label=LOC&suffix=%20lines&color=7A4DFF)](https://docs.nextclaw.io/zh/)
[![OpenClaw LOC](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FPeiiii%2Fnextclaw%2Fmaster%2Fdocs%2Fmetrics%2Fcode-volume%2Fcomparison.json&query=%24.benchmark.totals.codeLines&label=OpenClaw%20LOC&suffix=%20lines&color=6B7280)](https://docs.nextclaw.io/zh/)
[![NextClaw vs OpenClaw](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FPeiiii%2Fnextclaw%2Fmaster%2Fdocs%2Fmetrics%2Fcode-volume%2Fcomparison.json&query=%24.comparison.basePercentOfBenchmark&label=NextClaw%20vs%20OpenClaw&suffix=%25&color=0EA5E9)](https://docs.nextclaw.io/zh/)

[English](README.md) | [简体中文](README.zh-CN.md)

[为什么选择 NextClaw？](#为什么选择-nextclaw) · [快速开始](#-快速开始) · [功能](#-功能) · [截图](#-截图) · [命令](#-命令) · [渠道](#-渠道) · [文档](https://docs.nextclaw.io/zh/)

</div>

---

受 [OpenClaw](https://github.com/openclaw/openclaw) 与 [nanobot](https://github.com/HKUDS/nanobot) 启发，**NextClaw** 是你的专属神级管家：在你自己的机器上调度互联网资源与海量算力，同时保持 OpenClaw 兼容。安装后执行 `nextclaw start`，即可在浏览器中配置 Provider 与渠道，无需向导或守护进程，一条命令即可使用。

**适合：** 快速试用、备用机，或希望多渠道 + 多 Provider 且维护成本低的用户。

### 为什么选择 NextClaw？

| 优势 | 说明 |
|------|------|
| **功能丰富** | 多 Provider、多渠道、Cron/Heartbeat、网页搜索、exec、记忆、子 Agent — 与 OpenClaw 核心能力对齐。 |
| **OpenClaw 兼容** | 使用 OpenClaw 插件 SDK 与渠道插件格式；内置渠道（Telegram、Discord、WhatsApp 等）风格一致、配置方式相同。 |
| **更易上手** | 无需复杂 CLI 流程 — 一条命令 `nextclaw start`，其余在内置 UI 中完成（含对话与配置）。 |
| **可维护设计** | 运行时能力集中在内置能力，减少隐式耦合与长期维护成本。 |
| **轻量化** | 源自 [nanobot](https://github.com/HKUDS/nanobot)；代码量小、运行与维护快。 |

---

## ✨ 功能

| 功能 | 说明 |
|------|------|
| **OpenClaw 兼容** | 相同插件 SDK 与渠道插件格式；可使用 OpenClaw 风格插件与配置。 |
| **一键启动** | `nextclaw start` — 后台网关 + 配置 UI，无需额外步骤 |
| **内置对话 + 配置 UI** | 先在 UI 内对话（Markdown 渲染、工具轨迹卡片、消息分组合并），再配置模型、Provider、渠道；配置文件位于 `~/.nextclaw/config.json` |
| **Secrets 支持** | 支持 OpenClaw 风格 secret ref（`env` / `file` / `exec`），通过 `secrets.refs` 引用，避免在配置中保存明文密钥 |
| **多 Provider** | OpenRouter、OpenAI、MiniMax、Moonshot、Gemini、DeepSeek、DashScope、智谱、Groq、vLLM 等（OpenAI 兼容） |
| **多渠道** | Telegram、Discord、WhatsApp、飞书、钉钉、企业微信、Slack、Email、QQ、Mochat — 在 UI 中启用与配置 |
| **自动化** | Cron + Heartbeat 定时任务 |
| **本地工具** | 网页搜索、命令执行、记忆、子 Agent |

---

## 🚀 快速开始

```bash
npm i -g nextclaw
nextclaw start
```

浏览器打开 **http://127.0.0.1:18791**，在 UI 中设置 Provider（如 OpenRouter）与模型，然后进入 **Chat** 页即可直接对话。

`start/restart/serve/ui/gateway` 的 UI 模式默认绑定 `0.0.0.0`；启动日志会打印检测到的公网 URL。

```bash
nextclaw stop   # 停止服务
```

---

## 📸 截图

**配置 UI** — 模型、Provider 与默认项一屏搞定：

![Config UI](images/screenshots/nextclaw-ui-screenshot.png)

**AI Provider** — 配置 OpenRouter、OpenAI、MiniMax、DashScope 等；查看已配置与全部 Provider：

![AI Providers](images/screenshots/nextclaw-providers-page.png)

**消息渠道** — 启用与配置 Discord、飞书、QQ 等：

![Message Channels](images/screenshots/nextclaw-channels-page.png)

**定时任务** — 查看与管理 Cron，立即运行、启用/禁用、查看上次运行：

<img src="images/screenshots/nextclaw-cron-job-page.png" width="960" alt="Cron Jobs" />

**插件** — 从目录安装与管理渠道、Provider 等插件：

![Plugins](images/screenshots/nextclaw-plugins-page.png)

**技能** — 启用与配置技能（网页搜索、exec、记忆、子 Agent 等）：

![Skills](images/screenshots/nextclaw-skills-page.png)

---

## 🔌 Provider 示例

<details>
<summary>OpenRouter（推荐）</summary>

```json
{
  "providers": { "openrouter": { "apiKey": "sk-or-v1-xxx" } },
  "agents": { "defaults": { "model": "minimax/MiniMax-M2.5" } }
}
```

</details>

<details>
<summary>MiniMax（中国大陆）</summary>

```json
{
  "providers": {
    "minimax": { "apiKey": "sk-api-xxx", "apiBase": "https://api.minimaxi.com/v1" }
  },
  "agents": { "defaults": { "model": "minimax/MiniMax-M2.5" } }
}
```

</details>

<details>
<summary>本地 vLLM</summary>

```json
{
  "providers": {
    "vllm": { "apiKey": "dummy", "apiBase": "http://localhost:8000/v1" }
  },
  "agents": { "defaults": { "model": "meta-llama/Llama-3.1-8B-Instruct" } }
}
```

</details>

---

## 📋 命令

| 命令 | 说明 |
|------|------|
| `nextclaw start` | 启动后台服务（网关 + UI，默认公网可访问） |
| `nextclaw restart` | 重启后台服务，无需先 stop 再 start |
| `nextclaw stop` | 停止后台服务 |
| `nextclaw ui` | 仅启动 UI 后端 + 网关（前台） |
| `nextclaw gateway` | 仅启动网关（供渠道使用） |
| `nextclaw agent -m "hello"` | 在 CLI 中对话 |
| `nextclaw status` | 查看进程/健康/配置状态（`--json`、`--verbose`、`--fix`） |
| `nextclaw update` | 自更新 CLI |
| `nextclaw channels status` | 查看已启用渠道 |
| `nextclaw doctor` | 运行诊断（健康、状态一致性、端口等） |
| `nextclaw channels login` | 支持渠道的扫码登录 |
| `nextclaw config get <path>` | 按路径读取配置（`--json` 输出结构化） |
| `nextclaw config set <path> <value>` | 按路径设置配置（`--json` 将 value 解析为 JSON） |
| `nextclaw config unset <path>` | 按路径删除配置项 |

---

## 💬 渠道

| 渠道 | 配置难度 |
|------|----------|
| Telegram | 简单（Bot Token） |
| Discord | 简单（Bot Token + Intents） |
| WhatsApp | 中等（扫码登录） |
| 飞书 | 中等（应用凭证） |
| Mochat | 中等（claw token + websocket） |
| 钉钉 | 中等（应用凭证） |
| 企业微信 | 中等（企业应用 + 回调地址） |
| Slack | 中等（Bot + App Token） |
| Email | 中等（IMAP/SMTP） |
| QQ | 简单（应用凭证） |

---

## 📚 文档

- [路线图](https://docs.nextclaw.io/zh/guide/roadmap)
- [配置、Provider、渠道、Cron](https://docs.nextclaw.io/zh/guide/configuration)
- [多 Agent 架构：单网关、绑定、会话隔离](https://docs.nextclaw.io/zh/guide/multi-agent)
- [RFC: Action Schema v1](https://docs.nextclaw.io/zh/)
- [代码量监控流程](https://docs.nextclaw.io/zh/)
- [Marketplace Worker 部署流程](https://docs.nextclaw.io/zh/)
- [Marketplace 只读 Worker API](https://github.com/Peiiii/nextclaw/blob/master/workers/marketplace-api/README.md)

---

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=Peiiii/nextclaw&type=Date)](https://star-history.com/#Peiiii/nextclaw&Date)

**许可证** [MIT](LICENSE)

</div>
