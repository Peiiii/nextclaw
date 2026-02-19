# NextClaw 功能清单（2026-02）

## 1. 启动与运行

- `nextclaw start`
- `nextclaw restart`
- `nextclaw stop`
- `nextclaw serve`
- `nextclaw ui`
- `nextclaw gateway`
- `nextclaw status`
- `nextclaw doctor`
- `nextclaw update`
- `nextclaw init`
- `nextclaw onboard`

## 2. 配置管理

- 配置文件：`~/.nextclaw/config.json`
- `nextclaw config get <path>`
- `nextclaw config set <path> <value>`
- `nextclaw config unset <path>`
- 配置 UI（Model / Providers / Channels）
- 配置 API（`/api/config*`）
- 配置变更 WebSocket 推送（`/ws`）

## 3. Provider 能力

- OpenRouter
- OpenAI
- Anthropic
- DeepSeek
- Gemini
- Zhipu
- DashScope
- Moonshot
- MiniMax
- Groq
- vLLM
- AiHubMix
- OpenAI `wireApi`：`auto` / `chat` / `responses`

## 4. Agent 能力

- CLI 单轮对话：`nextclaw agent -m "..."`
- CLI 交互式对话：`nextclaw agent`
- Session 管理（列表/历史/发送）
- Memory 检索（search/get）
- Subagent 任务编排
- Gateway 工具（config/restart/update）

## 5. 内置工具

- 文件工具：`read_file` / `write_file` / `edit_file` / `list_dir`
- 命令工具：`exec`
- 网络工具：`web_search` / `web_fetch`
- 消息工具：`message`
- 定时工具：`cron`
- 会话工具：`sessions_list` / `sessions_history` / `sessions_send`
- 记忆工具：`memory_search` / `memory_get`
- 子代理工具：`subagents`
- 网关工具：`gateway`

## 6. 渠道能力

- Telegram
- Discord
- WhatsApp
- Feishu
- DingTalk
- Slack
- Email
- QQ
- Mochat

## 7. 渠道运维命令

- `nextclaw channels status`
- `nextclaw channels login`

## 8. 自动化能力

- Cron 任务：`list` / `add` / `remove` / `enable` / `run`
- Heartbeat 周期任务检查

## 9. Skills 能力

- `nextclaw skills install <slug>`
- `nextclaw clawhub install <slug>`
- 内置 skills 模板注入（init 时种子）

## 10. 当前已知生效边界

- `providers.*`：运行时应用
- `channels.*`：运行时应用
- `agents.defaults.model`：运行时应用
- `agents.defaults.maxToolIterations`：运行时应用
- `agents.defaults.maxTokens`：运行时应用
- `agents.context.*`：运行时应用
- `tools.*`：运行时应用
