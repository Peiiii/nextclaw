# [开源] NextClaw：可以自己部署、自带小应用系统的 Codex / WorkBuddy

大家好，我是 NextClaw 的作者。

你可以把 NextClaw 理解成一个开源、可以自己部署的 Codex / WorkBuddy。

了解和使用 NextClaw：

- GitHub：https://github.com/Peiiii/nextclaw
- 官网：https://nextclaw.io/
- 使用文档：https://docs.nextclaw.io/zh/

## 它能做什么

功能上，NextClaw 不是 Codex / WorkBuddy 的精简版。它可以：

- 像 Codex 一样，在项目里读取和修改代码、运行命令，也可以让多个 Agent 分工完成复杂任务；
- 像 WorkBuddy 一样，搜索资料、整理文件、生成文档和处理日常任务；
- 像 OpenClaw 一样，把需要长期执行的工作设成定时任务，也可以从微信、飞书、QQ 等消息渠道发起任务；
- 直接使用自带的 Agent，也可以接入 Codex、Claude Code 等第三方 Agent Runtime。

安装和运行方式包括：

- macOS、Windows、Linux 桌面版；
- 通过 npm 命令行安装，启动后在浏览器中使用本地网页版；
- 通过 Docker 部署到 NAS 或云服务器上长期运行；
- Windows 还提供免安装便携版。你甚至可以直接安装到 U 盘里，即插即用。

## Agent 做的小应用，不再日抛

最近我觉得比较值得单独拿出来讲的，是它自带一套“小应用系统”。

产品里目前叫 Panel App。比如你经常需要合并 CSV，可以直接在聊天里说：

> 帮我做一个 CSV 合并工具。可以选择多份文件，预览文件名和行数，确认后合并并下载。

Agent 会把它做成一个小应用，直接在聊天右侧打开。

比如这个唐诗卡片：左边继续和 Agent 改，右边直接翻诗、随机切换或复制。做好以后也可以固定在右侧，随时再打开。

![NextClaw 左侧继续与 Agent 修改唐诗卡片，右侧运行可随时使用的小应用](https://docs.nextclaw.io/product-screenshots/nextclaw-panel-app-running-cn.png)

Panel App 做好以后会进入应用列表，也可以固定到右侧边栏，以后随时打开。

哪里不好用，继续在聊天里改就行。

所以最后留下来的不只是一次对话、一段代码或者一个扔在文件夹里的 HTML，而是一个以后还能继续使用的小应用。计算器、数据看板、文件处理工具、资料搜索页，都可以这么做。

## 生成的图表和文档，可以直接查看

不一定每次都要做成长期使用的小应用。比如把几个月的收入和渠道数据交给 Agent，它可以直接生成一张执行摘要，把趋势、构成和目标完成度放在当前回复里：

![Agent 在 NextClaw 当前回复里生成收入趋势、渠道分布和目标完成度执行摘要](https://docs.nextclaw.io/product-screenshots/nextclaw-executive-summary-cn.png)

普通文档也是同一套工作方式：Agent 调用工具生成或修改 Markdown 后，可以直接在右侧查看方案、文章和清单。

![NextClaw 左侧展示 Agent 工具调用，右侧预览 Markdown 方案](https://docs.nextclaw.io/product-screenshots/nextclaw-tool-call-markdown-preview-cn.jpg)

## 安装

如果想用 npm 安装：

```bash
npm install -g nextclaw
nextclaw start
```

启动后，在浏览器中打开本地网页版：

```text
http://127.0.0.1:55667
```

其他选择还有 macOS、Windows、Linux 桌面版和 Docker。Windows 还提供免安装便携版。你甚至可以直接安装到 U 盘里，即插即用。

自部署不等于完全离线。接入云模型、消息渠道或其他在线服务时，相关数据仍会发送给对应服务。
