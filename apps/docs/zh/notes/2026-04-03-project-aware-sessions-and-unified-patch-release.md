---
title: 2026-04-03 · 会话现在会真正带着项目一起工作
description: 新会话可以先绑定项目目录，项目 skills 会按会话加载，项目标签可直接管理，同时完成了一轮统一的 npm patch release。
---

# 2026-04-03 · 会话现在会真正带着项目一起工作

发布时间：2026-04-03  
标签：`release` `chat` `project context`

## What changed

- 新会话现在不用先发一条“占位消息”了。你可以先设置项目目录，再开始聊天。
- 会话的技能加载现在真正按项目上下文工作：
  - 会读取当前项目下 `.agents/skills`
  - 也会保留 workspace 已安装的 `skills`
  - 同名 skill 不会互相覆盖，而是按唯一标识区分
- 项目自己的 `AGENTS.md` 和项目上下文会进入独立的 `Project Context` 区块，不再和宿主 workspace 上下文混在一起。
- 聊天 header 里的项目标签现在不只是展示：
  - 点击后会直接弹出操作菜单
  - 可以在这里修改项目目录
  - 也可以直接移除项目目录
- 这轮还顺手补齐了一些交互细节，包括项目切换后的 skills 立即刷新、路径选择体验更稳定，以及相关 UI polish。

## Why it matters

- NextClaw 终于更像“带项目上下文的会话”，而不是“只有 cwd 变了但其它链路没跟上”。
- 项目技能、项目规则、项目上下文现在从第一轮消息开始就能生效。
- 同一个工作区里切不同项目时，会话之间的边界会更清楚，不容易再出现“技能看起来没加载完整”或“两个来源被混成一个”的问题。
- 项目标签本身变成了一个高频操作入口，设置、修改、清除都更顺手。

## How to use

1. 在聊天页新建一个会话。
2. 先设置项目目录。
3. 打开技能选择器，确认项目下 `.agents/skills` 已经出现。
4. 发送第一条消息，让模型直接在这个项目上下文里开始工作。
5. 如果后续想改项目或移除项目，直接点击 header 里的项目标签即可。

## Also in this release

- 这不是只补一个包的小修，而是一轮统一的 npm patch release。
- 这次一起发布的范围覆盖了核心链路与直接受影响的公共包，包括：
  - `nextclaw`
  - `@nextclaw/core`
  - `@nextclaw/server`
  - `@nextclaw/ui`
  - `@nextclaw/openclaw-compat`
  - `@nextclaw/ncp-toolkit`
  - `@nextclaw/ncp-react`
  - `@nextclaw/ncp-mcp`
  - `@nextclaw/mcp`
  - `@nextclaw/remote`
  - `@nextclaw/runtime`
  - `@nextclaw/agent-chat-ui`
  - `@nextclaw/channel-runtime` 与相关 channel plugins
  - `@nextclaw/nextclaw-engine-*` / `@nextclaw/nextclaw-ncp-runtime-plugin-*` 相关引擎与运行时插件

## Links

- [聊天指南](/zh/guide/chat)
- [会话管理](/zh/guide/sessions)
- [Skills 教程](/zh/guide/tutorials/skills)
