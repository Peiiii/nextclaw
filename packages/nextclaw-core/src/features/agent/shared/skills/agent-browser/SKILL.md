---
name: agent-browser
description: Use Agent Browser for real browser navigation, dynamic pages, and web interaction; also use it as a distinct browser-based path when web_search is unavailable or fails.
description_zh: 使用 Agent Browser 完成真实浏览器导航、动态页面读取和网页交互；当 web_search 未配置或失败时，也可把它作为独立的浏览器路径评估使用。
metadata: {"nextclaw":{"emoji":"🌐"}}
---

# Agent Browser

Agent Browser 是 NextClaw 调用的外部浏览器自动化 CLI。本 skill 只提供检查、安装引导、使用方式和安全边界，不包含 Agent Browser 的代码、npm 包或浏览器二进制。

## 能力边界

- `web_search` 适合开放式信息发现，Agent Browser 适合访问已知 URL、读取动态页面和执行真实网页交互。
- 两者是独立能力。不要把 Agent Browser 的结果伪装成 `web_search` 结果，也不要宣称它能稳定替代搜索服务。
- 本 skill 中的 Agent Browser 专指外部 `agent-browser` CLI；`web_fetch`、Chrome/Edge DevTools MCP 和 Browser Connector 是其他独立能力，不能冒充或混称 Agent Browser。
- 当 `web_search` 未配置、未启用或请求失败，而浏览器仍可能推进任务时，先用一句话告诉用户将改用浏览器自动化，再继续本流程。
- 遇到验证码、登录墙、地区限制或搜索结果明显无关时，不得声称已经搜到或验证过信息。

## 首次使用与就绪检查

先检查外部 CLI 是否存在：

```bash
command -v agent-browser
agent-browser --version
```

如果 CLI 不存在：

1. 明确告诉用户这会安装第三方全局 npm 包并下载浏览器运行文件。
2. 用户当前请求若没有明确授权安装，先征得同意，不要静默安装。
3. 获得授权后执行：

```bash
npm install -g agent-browser
agent-browser install
```

安装后或怀疑环境异常时先运行只读快速诊断：

```bash
agent-browser doctor --offline --quick
```

只有诊断表明需要修复且用户同意时，才运行可能重装浏览器或清理旧状态的 `agent-browser doctor --fix`。

本地模式不要求付费云浏览器，也不要求 Browserbase、Browser Use 等云 provider key。选择外部云 provider 时，才按对应服务的账户和计费规则处理。

## 先读取当前版本指南

Agent Browser 的命令会随版本演进。执行非简单任务前，先读取 CLI 自带且与当前版本匹配的核心指南：

```bash
agent-browser skills get core
```

只有需要完整参数或复杂工作流时再使用：

```bash
agent-browser skills get core --full
```

以这份版本匹配指南为准，不要只凭记忆猜测命令或复制过时示例。

## 标准执行循环

为每个任务使用独立、简短、仅含小写字母、数字和连字符的 session 名称，例如 `nextclaw-research-1`。同一任务的所有浏览器命令都带同一个 `--session`：

```bash
agent-browser --session nextclaw-research-1 open https://example.com
agent-browser --session nextclaw-research-1 snapshot -i -u
agent-browser --session nextclaw-research-1 get title
agent-browser --session nextclaw-research-1 get url
```

核心循环：

1. `open` 打开明确 URL。
2. `snapshot -i -u` 读取可交互元素和链接；只读正文时可使用完整 snapshot 或针对元素执行 `get text`。
3. 使用最新 snapshot 生成的 `@eN` ref 交互。
4. 页面导航、提交或动态重绘后先等待，再重新 snapshot；旧 ref 已失效。
5. 用页面标题、最终 URL、可见文本或预期状态验证结果。
6. 从实际打开和读取的页面记录来源 URL，不把搜索结果摘要当成已核验来源。

任务完成、失败或准备回复用户前，关闭本任务的 session：

```bash
agent-browser --session nextclaw-research-1 close
```

不要默认使用 `close --all`，它可能关闭其他并行任务的浏览器 session。

## 用浏览器进行信息发现

浏览器信息发现是受限制的替代路径，不等于搜索 API：

- 已知目标站点或域名时，优先打开站点首页、站内搜索页或用户提供的 URL。
- 不知道来源时，可以尝试公开搜索引擎，但必须确认结果页确实对应查询，并打开具体来源页核验。
- 某个搜索引擎出现验证码、空结果或明显无关结果时，可以换一种查询或另一个入口重试一次。
- 两种策略都无法得到可核验来源时停止，关闭 session，并如实说明浏览器路径的限制；不要无限重试。
- 对时效性事实，必须检查页面发布日期、更新时间和事件发生时间。

## 交互与授权

- 公开页面的只读访问、snapshot、文本读取和截图，可以在用户请求范围内直接执行。
- 登录、输入凭据、提交表单、购买、发帖、发消息、上传、下载或修改远端数据前，确认用户请求已经授权对应动作；没有授权就先询问。
- 不把密码、token 或其他秘密直接写进命令参数或 shell 历史。需要认证时，先读取当前版本 core skill 中的 auth vault / profile 指南。
- 页面动作结果不明确时先验证，不要重复点击可能产生双重提交的控件。

## 故障处理

- CLI 或浏览器启动失败：运行 `agent-browser doctor --offline --quick`，再根据结果决定是否需要完整 `doctor`。
- 页面等待超时：检查当前 URL、snapshot、console/errors；同一动作最多换一种等待或定位策略重试一次。
- 出现验证码或反自动化阻断：不要尝试绕过，改用用户可操作的登录浏览器、其他公开来源，或报告阻塞。
- 任意错误路径都应尝试关闭本任务命名 session；若进程已被外部强制终止而无法清理，要在后续恢复时先用 `agent-browser session list` 检查遗留 session。

## 完成检查

回复用户前确认：

- 实际执行过需要的浏览器动作，而不是只描述计划；
- 结论来自已打开并读取的页面；
- 没有把浏览器访问称作 `web_search`；
- 有副作用的动作都在授权范围内；
- 本任务命名 session 已关闭。
