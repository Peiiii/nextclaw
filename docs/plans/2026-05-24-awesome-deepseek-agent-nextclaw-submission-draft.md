# awesome-deepseek-agent NextClaw Submission Draft

## 目标

为 `deepseek-ai/awesome-deepseek-agent` 准备一份 NextClaw 接入指南 PR 草稿，先在本仓库内部 review，不直接提交外部仓库。

本次对外定位暂定：

> Turn your computer into a powerful AI assistant that coordinates agents, skills, CLI tools, automations, and messaging apps.

中文对应：

> 把你的电脑变成一个强大的 AI 助手，协调 Agent、技能、CLI 工具、自动化和消息应用。

## 对方仓库要求摘要

来源：

- `CONTRIBUTING.md`
- `README.md`
- `README.zh-CN.md`
- 现有 `docs/openclaw.md` / `docs/openclaw.zh-CN.md` 格式

必须满足：

- 一个 PR 同时包含英文和中文 guide。
- 新增 `docs/nextclaw.md` 与 `docs/nextclaw.zh-CN.md`。
- 同步更新 `README.md` 与 `README.zh-CN.md` 的工具表。
- README 表格按字母序插入，不单纯追加到末尾。
- 示例模型必须使用 `deepseek-v4-pro` / `deepseek-v4-flash`，不能使用 `deepseek-chat` / `deepseek-reasoner`。
- DeepSeek V4 1M context 至少要在指南中说明；如果工具支持显式 context window，需配置。
- DeepSeek V4 Pro 的 max/high thinking 需要兼容；只能写已经在 NextClaw 中验证有效的配置字段。

## 现状判断

可以直接写入指南的事实：

- NextClaw 可通过 npm 安装：`npm i -g nextclaw`。
- NextClaw 可通过 `nextclaw start` 启动，并在 `http://127.0.0.1:55667` 打开 UI。
- NextClaw 已有 DeepSeek provider，默认 API base 为 `https://api.deepseek.com`。
- 当前 provider catalog 包含 `deepseek/deepseek-v4-flash` 与 `deepseek/deepseek-v4-pro`。
- NextClaw 支持在 UI 中配置 provider API key 与默认模型。
- NextClaw 支持 Web UI、CLI、技能、自动化和消息应用集成这些产品能力。

提交前必须补齐或验证的点：

- 当前 DeepSeek provider catalog 仍包含旧模型 `deepseek/deepseek-chat` / `deepseek/deepseek-reasoner`。对外 PR 前建议把 DeepSeek 默认展示收敛到 V4 模型，避免与对方贡献规则冲突。
- 当前 OpenAI-compatible chat completions 请求路径没有显式发送 `reasoning_effort`；Responses API 路径可从 `thinkingLevel` 映射到 `reasoning.effort`，但 DeepSeek provider 默认不是 Responses-first。不能在外部指南里声称 max thinking 已支持，除非先实现并验证。
- 当前 `ThinkingLevel` 枚举含 `xhigh`，但 OpenAI reasoning effort 映射会把 `xhigh` 映射为 `high`，没有 `max`。若要满足对方 max thinking 要求，需要明确 NextClaw 的产品配置如何表达 DeepSeek `max`。
- NextClaw 目前似乎没有对 DeepSeek 1M context 的显式配置字段；指南可以先在 prose 说明 DeepSeek V4 支持 1M context，但如果要写配置项，必须先确认该字段真实生效。

## 建议 PR 文件清单

外部仓库中建议改动：

```text
README.md
README.zh-CN.md
docs/nextclaw.md
docs/nextclaw.zh-CN.md
```

不建议首个 PR 加截图，除非我们先准备稳定、轻量、不会过期的 provider 设置截图。

## README 表格草稿

英文表格行：

```md
| **NextClaw** | Open-source AI assistant that turns your computer into a powerful workspace for agents, skills, CLI tools, automations, and messaging apps. | [Guide](./docs/nextclaw.md) |
```

更短版本：

```md
| **NextClaw** | Open-source AI assistant that coordinates agents, skills, CLI tools, automations, and messaging apps from your computer. | [Guide](./docs/nextclaw.md) |
```

中文表格行：

```md
| **NextClaw** | 开源 AI 助手，把你的电脑变成可协调 Agent、技能、CLI 工具、自动化和消息应用的工作台。 | [指南](./docs/nextclaw.zh-CN.md) |
```

更短版本：

```md
| **NextClaw** | 开源 AI 助手，在你的电脑上协调 Agent、技能、CLI 工具、自动化和消息应用。 | [指南](./docs/nextclaw.zh-CN.md) |
```

推荐：使用短版本。表格不是官网 hero，越清楚越好。

## 英文 Guide 草稿

文件：`docs/nextclaw.md`

````md
[English](./nextclaw.md) | [简体中文](./nextclaw.zh-CN.md) · [← Back](../README.md)

# Integrate DeepSeek with NextClaw

NextClaw is an open-source AI assistant that turns your computer into a powerful workspace for coordinating agents, skills, CLI tools, automations, and messaging apps.

This guide shows how to configure DeepSeek V4 in NextClaw and send your first message.

#### 1. Install NextClaw

Install Node.js first if you have not already. Then install NextClaw from npm:

```bash
npm i -g nextclaw
```

Start NextClaw:

```bash
nextclaw start
```

Open the Web UI:

```text
http://127.0.0.1:55667
```

#### 2. Configure DeepSeek

In the Web UI:

1. Open **Providers**.
2. Select **DeepSeek**.
3. Paste your [DeepSeek API key](https://platform.deepseek.com/api_keys).
4. Keep the API base as `https://api.deepseek.com` unless you use a compatible proxy.
5. Save the provider configuration.

Then open the model/default agent settings and choose one of the current DeepSeek V4 models:

```text
deepseek/deepseek-v4-pro
deepseek/deepseek-v4-flash
```

Use `deepseek-v4-pro` for the strongest coding and reasoning experience. Use `deepseek-v4-flash` when you want faster, lower-cost responses.

DeepSeek V4 supports up to 1 million tokens of context. NextClaw does not require a separate context-window field for the basic setup; use the V4 model names above and keep your installed NextClaw version current.

> Maintainer note before PR: only keep the next paragraph if max thinking has been verified in NextClaw.
>
> For DeepSeek V4 Pro, enable the highest available thinking level in NextClaw's chat/model controls so requests are sent with DeepSeek-compatible reasoning effort.

#### 3. First Run

Open **Chat** in the Web UI and send a short test prompt:

```text
Explain how NextClaw can use DeepSeek together with tools and automations.
```

You can also use NextClaw from the terminal:

```bash
nextclaw agent "Say hello from DeepSeek V4."
```

After the first reply works, you can connect more NextClaw capabilities, such as skills, CLI tools, scheduled automations, and messaging apps.

#### Troubleshooting

- **401 / invalid API key**: Check the DeepSeek API key in the provider settings.
- **Unknown model**: Make sure the model is `deepseek/deepseek-v4-pro` or `deepseek/deepseek-v4-flash`.
- **Cannot open the UI**: Confirm `nextclaw start` is still running and open `http://127.0.0.1:55667`.
- **Thinking / reasoning errors**: Upgrade NextClaw first. Do not switch to old V3 model names as a workaround.
````

## 中文 Guide 草稿

文件：`docs/nextclaw.zh-CN.md`

````md
[English](./nextclaw.md) | [简体中文](./nextclaw.zh-CN.md) · [← 返回](../README.zh-CN.md)

# 在 NextClaw 中接入 DeepSeek

NextClaw 是一个开源 AI 助手，可以把你的电脑变成一个强大的工作台，用来协调 Agent、技能、CLI 工具、自动化和消息应用。

这份指南会带你在 NextClaw 中配置 DeepSeek V4，并完成第一次对话。

#### 1. 安装 NextClaw

如果还没有安装 Node.js，请先安装 Node.js。然后通过 npm 安装 NextClaw：

```bash
npm i -g nextclaw
```

启动 NextClaw：

```bash
nextclaw start
```

打开 Web UI：

```text
http://127.0.0.1:55667
```

#### 2. 配置 DeepSeek

在 Web UI 中：

1. 打开 **Providers**。
2. 选择 **DeepSeek**。
3. 填入你的 [DeepSeek API Key](https://platform.deepseek.com/api_keys)。
4. API Base 默认保持为 `https://api.deepseek.com`，除非你使用兼容代理。
5. 保存 Provider 配置。

然后打开模型或默认 Agent 设置，选择当前 DeepSeek V4 模型：

```text
deepseek/deepseek-v4-pro
deepseek/deepseek-v4-flash
```

如果你需要更强的编码和推理能力，推荐使用 `deepseek-v4-pro`。如果你更看重速度和成本，可以使用 `deepseek-v4-flash`。

DeepSeek V4 支持最高 100 万 token 上下文。NextClaw 的基础配置不需要单独填写 context window 字段；使用上面的 V4 模型名，并保持 NextClaw 为较新版本即可。

> 提交 PR 前维护说明：只有在 NextClaw 中真实验证 max thinking 后，才保留下一段。
>
> 对于 DeepSeek V4 Pro，可以在 NextClaw 的对话或模型控制中启用最高可用 thinking level，让请求使用 DeepSeek 兼容的 reasoning effort。

#### 3. 第一次运行

打开 Web UI 中的 **Chat**，发送一条测试消息：

```text
解释一下 NextClaw 如何把 DeepSeek 和工具、自动化一起使用。
```

也可以在终端中使用 NextClaw：

```bash
nextclaw agent "Say hello from DeepSeek V4."
```

第一次回复成功后，你可以继续接入 NextClaw 的技能、CLI 工具、定时自动化和消息应用。

#### 常见问题

- **401 / API Key 无效**：检查 Provider 设置里的 DeepSeek API Key。
- **Unknown model**：确认模型名是 `deepseek/deepseek-v4-pro` 或 `deepseek/deepseek-v4-flash`。
- **打不开 UI**：确认 `nextclaw start` 仍在运行，并打开 `http://127.0.0.1:55667`。
- **Thinking / reasoning 报错**：先升级 NextClaw，不要把旧 V3 模型名当作规避方案。
````

## 提交前建议先做的 NextClaw 内部改动

推荐最小准备项：

1. DeepSeek provider 默认模型只展示或优先展示 V4：
   - `deepseek/deepseek-v4-pro`
   - `deepseek/deepseek-v4-flash`
2. 为 DeepSeek V4 Pro 明确配置 thinking capability，UI 中能显示可用 thinking level。
3. 确认 NextClaw 请求 DeepSeek 时能发送 DeepSeek 兼容的 max thinking 参数。
4. 用真实 DeepSeek API key 做一次 smoke：
   - provider test 成功；
   - Web UI Chat 成功；
   - CLI `nextclaw agent` 成功；
   - 若宣称 max thinking，则抓取或记录请求侧证据，确认字段真实发送。

## Review 问题

需要你确认：

1. README 表格描述使用哪版：
   - 推荐短版：`Open-source AI assistant that coordinates agents, skills, CLI tools, automations, and messaging apps from your computer.`
   - 或使用更 slogan 化版本：`Open-source AI assistant that turns your computer into a powerful workspace for agents, skills, CLI tools, automations, and messaging apps.`
2. 中文是否保留 `Agent` 英文，还是写成 `智能体`。
3. 是否要在外部指南中提到 CLI 命令 `nextclaw agent`；如果当前 CLI 对新用户默认链路不够稳，可以只写 Web UI 首次运行。
4. 是否先做 NextClaw 内部 DeepSeek V4/max thinking 修正，再提交外部 PR。

## 当前建议

不要现在直接提 PR。先补齐并验证 DeepSeek V4 Pro max thinking 支持，然后再提交，这样 PR 更容易通过 review，也不会把 NextClaw 写成“基本能接 DeepSeek，但不满足对方关键 checklist”的状态。
