# NextClaw 项目功能全集

本文档按模块梳理 NextClaw 的完整功能集合，便于产品规划、对外宣传与研发对齐。与 [USAGE](USAGE.md)、[PRD 功能清单](prd/current-feature-list.md) 互补。

---

## 1. 产品定位

- **一句话**：你的数字世界全能管家，兼容 OpenClaw，以 UI 为先，并在本地调度互联网与算力。
- **核心体验**：`nextclaw start` 后，在浏览器中配置 Provider 与渠道，无需复杂 CLI 流程。
- **适用场景**：快速试玩、备用机、多渠道 + 多模型且希望低维护成本的个人助理用户。

---

## 2. 仓库与包结构

| 包 | 职责 |
|----|------|
| `nextclaw` | CLI 入口、start/stop/serve/gateway、agent/config/channels/cron/plugins/skills 等命令 |
| `nextclaw-core` | Agent 循环、Provider 管理、内置工具、Cron、Session、Memory、配置 schema |
| `nextclaw-server` | HTTP API、WebSocket、与 UI 和 Channel 的对接 |
| `nextclaw-ui` | 配置 Web UI（模型 / Provider / 渠道 / 路由与运行时） |
| `nextclaw-openclaw-compat` | OpenClaw 插件 SDK 与兼容层 |
| `nextclaw-channel-runtime` | 渠道运行时（加载、注册、消息入站/出站） |
| `nextclaw-channel-plugin-*` | 各渠道插件：telegram, discord, slack, feishu, dingtalk, wecom, whatsapp, email, qq, weixin, mochat |

---

## 3. CLI 命令全集

### 3.1 服务生命周期

| 命令 | 说明 |
|------|------|
| `nextclaw start` | 后台启动助理服务 + UI（默认 0.0.0.0，端口 55667） |
| `nextclaw restart` | 重启后台服务（可带 start 参数） |
| `nextclaw stop` | 停止后台服务 |
| `nextclaw serve` | 前台运行助理服务 + UI |
| `nextclaw ui` | 前台运行 UI + 助理服务 |
| `nextclaw gateway` | 仅启动通道服务（供渠道连接） |

### 3.2 对话与工作区

| 命令 | 说明 |
|------|------|
| `nextclaw agent -m "..."` | 单轮对话 |
| `nextclaw agent` | 交互式对话 |
| `nextclaw agent --session <id> --model <model>` | 指定会话与模型路由 |
| `nextclaw init` | 初始化工作区与模板文件 |
| `nextclaw init --force` | 覆盖已有模板 |
| `nextclaw onboard` | 引导流程 |

### 3.3 状态与诊断

| 命令 | 说明 |
|------|------|
| `nextclaw status` | 进程 / 健康 / 配置摘要（`--json`、`--verbose`、`--fix`） |
| `nextclaw doctor` | 运行时诊断（`--json`、`--verbose`、`--fix`） |
| `nextclaw update` | 自更新（可配 `NEXTCLAW_UPDATE_COMMAND`） |

### 3.4 配置

| 命令 | 说明 |
|------|------|
| `nextclaw config get <path>` | 按路径读取配置（`--json` 输出结构化） |
| `nextclaw config set <path> <value>` | 按路径设置（`--json` 解析 value） |
| `nextclaw config unset <path>` | 按路径删除 |

### 3.5 渠道

| 命令 | 说明 |
|------|------|
| `nextclaw channels status` | 已启用渠道及状态 |
| `nextclaw channels login` | 支持渠道的扫码登录 |
| `nextclaw channels add --channel <id> ...` | 通过 setup adapter 配置渠道 |

### 3.6 定时任务

| 命令 | 说明 |
|------|------|
| `nextclaw cron list` | 列出定时任务（`--json`） |
| `nextclaw cron add -n <name> -m <message> ...` | 新增任务（`--at` 一次性 / `-c` cron / `-e` 间隔秒） |
| `nextclaw cron remove <jobId>` | 删除任务 |
| `nextclaw cron enable <jobId>` | 启用（`--disable` 禁用） |
| `nextclaw cron run <jobId>` | 立即执行一次（可选 `--force`） |

### 3.7 插件（OpenClaw 兼容）

| 命令 | 说明 |
|------|------|
| `nextclaw plugins list` | 已发现插件列表 |
| `nextclaw plugins info <id>` | 插件详情 |
| `nextclaw plugins install <path-or-spec>` | 从路径或 npm 安装 |
| `nextclaw plugins uninstall <id>` | 卸载（可选 `--dry-run`） |
| `nextclaw plugins enable <id>` | 在配置中启用 |
| `nextclaw plugins disable <id>` | 在配置中禁用 |
| `nextclaw plugins doctor` | 插件加载诊断 |

### 3.8 Skills / Marketplace

| 命令 | 说明 |
|------|------|
| `nextclaw skills install <slug>` | 从 marketplace 安装 skill |
| `nextclaw skills publish <dir>` | 上传/创建 marketplace skill |
| `nextclaw skills update <dir>` | 更新已有 marketplace skill |

---

## 4. 配置与数据

- **配置路径**：`~/.nextclaw/config.json`（可通过 `NEXTCLAW_HOME` 覆盖目录）。
- **工作区默认路径**：`~/.nextclaw/workspace`（可在 `agents.defaults.workspace` 覆盖）。
- **热应用（无需重启）**：`providers.*`、`channels.*`、`agents.defaults.*`、`agents.context.*`、`tools.*`。
- **需重启**：UI 端口（`--port`/`--ui-port`）、`plugins.*`。

---

## 5. Provider 全集

内置 Provider 规格（见 `nextclaw-core` `providers/registry.ts`）：

| Provider | 说明 |
|----------|------|
| openrouter | OpenRouter 网关 |
| aihubmix | AiHubMix 网关 |
| anthropic | Claude |
| openai | OpenAI（含 wireApi：auto/chat/responses） |
| deepseek | DeepSeek |
| gemini | Google Gemini |
| zhipu | 智谱（Zhipu / GLM / Zai） |
| dashscope | 阿里 DashScope（Qwen） |
| moonshot | Moonshot（Kimi） |
| minimax | MiniMax |
| vllm | 本地 / vLLM（OpenAI 兼容） |
| groq | Groq |

任意 OpenAI 兼容端点可通过自定义 `apiBase` + `apiKey` 使用。

---

## 6. Channel 全集

| Channel | 说明 |
|---------|------|
| telegram | Bot Token，支持群组/频道，可选 proxy |
| discord | Bot Token，MESSAGE CONTENT INTENT，群组策略/mention |
| slack | Socket 模式，Bot + App-Level Token |
| feishu | 飞书开放平台 App ID/Secret |
| dingtalk | 钉钉 Client ID/Secret |
| wecom | 企业微信 corpId/agentId/secret/token/callback |
| whatsapp | 通过 bridge（如 ws），可选 `channels login` |
| email | IMAP + SMTP，轮询回复 |
| qq | QQ 开放平台 appId/secret |
| mochat | claw token，可选 socketUrl/sessions/panels |

通用：`allowFrom` 白名单、`accountId`、各渠道策略（dmPolicy、groupPolicy、requireMention 等）。

---

## 7. 内置工具全集

Agent 主循环中注册的默认工具（`nextclaw-core` `agent/loop.ts` + `agent/tools/*`）：

| 工具名 | 说明 |
|--------|------|
| read_file | 读文件（可限制在工作区） |
| write_file | 写文件 |
| edit_file | 编辑文件 |
| list_dir | 列目录 |
| exec | 执行 shell 命令（超时、可选 restrictToWorkspace） |
| web_search | 可配置网页搜索（默认 Bocha，兼容 Brave） |
| web_fetch | 抓取 URL 内容 |
| message | 发送出站消息 |
| spawn | 调用 subagent |
| sessions_list | 会话列表 |
| sessions_history | 会话历史 |
| memory_search | 工作区 memory 检索 |
| memory_get | 读取 memory 条目 |
| subagents | 子代理能力查询/编排 |
| gateway | 配置与运维：config.get / config.schema / config.apply / config.patch / restart / update.run |
| cron | 定时任务列表/添加/删除/启用/禁用/立即执行（依赖 cronService） |

扩展插件通过 `extensionRegistry.tools` 注册，经 `ExtensionToolAdapter` 暴露为额外工具名。

---

## 8. 自动化

- **Cron**：一次性（`--at`）、cron 表达式（`-c`）、固定间隔秒（`-e`）；可选 `--deliver --to --channel` 将回复投递到渠道。
- **Heartbeat**：助理服务运行期间周期读取工作区 `HEARTBEAT.md`（如约 30 分钟），若有可执行任务则交给 Agent 执行。

---

## 9. 多 Agent 与路由

- **单进程多 Agent**：`agents.list` 定义多个常驻 Agent（如 main、engineer）。
- **路由**：`bindings` 按 `channel + accountId (+ peer)` 路由到 `agentId`。
- **会话隔离**：`session.dmScope`（main / per-peer / per-channel-peer / per-account-channel-peer）。
- **群组**：Discord/Telegram 支持 requireMention、mentionPatterns、groups 等。

详见 [多 Agent 架构](https://docs.nextclaw.io/en/guide/multi-agent)。

---

## 10. 插件与扩展

- **OpenClaw 兼容**：插件 SDK 与渠道插件格式与 OpenClaw 一致，可从本地或 npm 安装。
- **发现路径**：`$NEXTCLAW_HOME/extensions`、`<workspace>/.nextclaw/extensions`、`plugins.load.paths`。
- **渠道插件包**：`nextclaw-channel-plugin-telegram` 等，由 channel-runtime 加载并注册。

---

## 11. UI 与 API

- **Web UI**：默认 `http://127.0.0.1:55667`，可配 `ui.host`/`ui.port`/`ui.open`；start 时默认绑定 0.0.0.0。
- **能力**：模型与默认 Agent、Provider、Channel、路由与运行时（agents.list、bindings、session）的配置与展示。
- **API**：配置读写、模型/Provider/Channel 更新、WebSocket 推送配置变更。
- **通道服务端口**：默认 18790（渠道回调与内部通信）。

---

## 12. 工作区与 Skills

- **init 生成**：AGENTS.md、SOUL.md、USER.md、IDENTITY.md、TOOLS.md、BOOT.md/BOOTSTRAP.md、HEARTBEAT.md、memory/MEMORY.md、skills/。
- **Context**：bootstrap 文件、memory 片段、skills（always + 按需）注入系统提示。
- **Skills**：从 marketplace 安装或工作区 `skills/` 放置，由 ContextBuilder 加载并参与提示。

---

## 13. 自更新与运维

- **update**：`nextclaw update` 或通过 Agent 调用 `gateway` 的 `update.run`；可配置 `NEXTCLAW_UPDATE_COMMAND`；更新后支持自重启并通知会话。
- **静默回复**：模型输出含 `<noreply/>` 或最终回复为空/空白时不发送渠道回复（与 OpenClaw 对齐）。

---

## 14. 文档与迭代

- 使用说明：[USAGE](USAGE.md)
- 多 Agent：[multi-agent-architecture](https://docs.nextclaw.io/en/guide/multi-agent)
- 迭代与发布：`docs/logs/`、`docs/workflows/`、`docs/prd/`

---

*文档维护：与代码和 USAGE 同步；大功能变更时更新本全集及 PRD 功能清单。*
