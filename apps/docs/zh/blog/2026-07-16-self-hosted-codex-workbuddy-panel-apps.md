---
title: 2026-07-16 · 可以自己部署、自带小程序系统的 Codex / WorkBuddy
description: NextClaw 是一个开源、可以自己部署的 Codex / WorkBuddy，还能让 Agent 把临时需求做成可以反复使用的 Panel App。
---

# [开源] NextClaw：可以自己部署、自带小程序系统的 Codex / WorkBuddy

发布时间：2026-07-16

标签：`开源` `Agent` `自部署` `Panel App`

大家好，我是 NextClaw 的作者。

你可以把 NextClaw 理解成一个开源、可以自己部署的 Codex / WorkBuddy。

功能上，NextClaw 不是 Codex / WorkBuddy 的精简版。它可以像 Codex 一样在项目里读取和修改代码、运行命令，也可以像 WorkBuddy 一样搜索资料、整理文件、生成文档和处理日常任务。需要长期执行的工作可以设成定时任务，也可以像 OpenClaw 那样，从微信、飞书、QQ 等消息渠道发起任务。你可以直接使用 NextClaw 自带的 Agent，也可以接入 Codex、Claude Code 等第三方 Agent Runtime。

它支持桌面版，也可以装到 Linux、Docker、NAS 或云服务器上长期运行。

最近我觉得比较值得单独拿出来讲的，是它自带一套“小程序系统”。

产品里目前叫 Panel App。比如你经常需要合并 CSV，可以直接在聊天里说：

> 帮我做一个 CSV 合并工具。可以选择多份文件，预览文件名和行数，确认后合并并下载。

Agent 会把它做成一个小应用，直接在聊天右侧打开。

比如这个唐诗卡片：左边继续和 Agent 改，右边直接翻诗、随机切换或复制。做好以后也可以固定在右侧，随时再打开。

![NextClaw 左侧继续与 Agent 修改唐诗卡片，右侧运行可随时使用的小应用](/product-screenshots/nextclaw-panel-app-running-cn.png)

不一定每次都要做成长期使用的小程序。比如把几个月的收入和渠道数据交给 Agent，它可以直接生成一张执行摘要，把趋势、构成和目标完成度放在当前回复里：

![Agent 在 NextClaw 当前回复里生成收入趋势、渠道分布和目标完成度执行摘要](/product-screenshots/nextclaw-executive-summary-cn.png)

普通文档也是同一套工作方式：Agent 调用工具生成或修改 Markdown 后，可以直接在右侧查看方案、文章和清单。

![NextClaw 左侧展示 Agent 工具调用，右侧预览 Markdown 方案](/product-screenshots/nextclaw-tool-call-markdown-preview-cn.jpg)

Panel App 做好以后会进入应用列表，也可以固定到右侧边栏，以后随时打开。

哪里不好用，继续在聊天里改就行。

所以最后留下来的不只是一次对话、一段代码或者一个扔在文件夹里的 HTML，而是一个以后还能继续使用的小程序。计算器、数据看板、文件处理工具、资料搜索页，都可以这么做。

安装比较简单：

```bash
npm install -g nextclaw
nextclaw start
```

然后打开：

```text
http://127.0.0.1:55667
```

不想用 npm，也有 macOS、Windows、Linux 桌面版和 Docker 部署方式。

我不打算说它在所有地方都比 Codex 或 WorkBuddy 更好。纯看编程体验、响应速度和细节打磨，成熟产品仍然有优势。

NextClaw 比较适合的是另外一些情况：

- 你想把它装在自己的电脑、NAS 或服务器上；
- 你是开发者或开源爱好者，想参考一个完整 Agent 产品的实现，或者直接基于源码做自己的版本；
- 你经常想做一些只给自己用的小工具，又不想每次都重新建项目、部署和维护。

自部署也不等于数据绝不外发。接入云模型、消息渠道或其他服务时，任务数据仍可能发送给对应服务。

项目完全开源，欢迎试用和拍砖：

- GitHub：[github.com/Peiiii/nextclaw](https://github.com/Peiiii/nextclaw)
- 官网：[nextclaw.io](https://nextclaw.io/)
- 文档：[NextClaw 文档](/zh/)

我现在最想知道的是：如果 Agent 可以直接在旁边给你做一个以后还能继续使用的小程序，你最先会做什么？
