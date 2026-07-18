---
title: 2026-07-18 · 在外面，也能继续使用家里的 NextClaw
description: NextClaw 远程访问现已可用：从手机或另一台电脑打开自己的本机工作台，继续会话、使用工具，并运行 Agent 做出的 Panel App。
---

# NextClaw 远程访问：在外面，也能继续使用家里的工作台

发布时间：2026-07-18

标签：`远程访问` `本地优先` `Panel App`

NextClaw 可以运行在自己的电脑、NAS 或服务器上。现在，你也可以从手机或另一台电脑打开这个实例，继续使用原来的会话、工具和小应用，而不需要把本机管理端口直接暴露给公网。

远程访问不是另做一个功能缩水的聊天页。它连接的是同一个 NextClaw 实例：本机继续运行 Agent、访问文件和调用工具，浏览器把操作送回这台设备，再把结果呈现出来。

## 第一步：在本机开启远程访问

打开 NextClaw 设置中的“远程访问”。连接建立后，设备信息卡会同时显示“平台已登录”“启用远程访问”和“服务运行中”，并给出设备名、连接状态与最近连接时间。

![NextClaw 本机远程访问设置中的设备信息与运行状态](/product-screenshots/nextclaw-remote-access-settings-cn.png)

_这张卡片确认的是运行端：哪台设备正在提供 NextClaw，以及它是否已经可以从网页打开。_

也可以通过命令行开启并检查：

```bash
nextclaw remote enable
nextclaw remote status
nextclaw remote doctor
```

## 第二步：在 Platform 找到在线实例

登录 [NextClaw Platform](https://platform.nextclaw.io/) 后，“我的实例”会列出已经开启远程访问的设备。列表支持当前实例、已归档和全部状态切换，也可以按名称、ID、平台、版本与连接状态筛选。

![NextClaw Platform 的实例列表、筛选器、在线状态与打开操作](/product-screenshots/nextclaw-platform-instances-cn.png)

_在线状态说明这台设备当前可连接；点击“打开”，就会进入它正在提供的 NextClaw 工作台。_

这个管理面把“远程访问”从一条难以记忆的地址，变成了可查看、可筛选、可操作的设备入口。需要时还可以固定域名、创建分享链接或归档旧实例。

## 第三步：进入同一个工作台

下面这张图来自真实运行中的远程页面。中间是原来的会话，右侧是 Agent 生成的“半导体 10 年”Panel App。图表、切换按钮和样式都由远程工作台直接加载和运行。

![通过 NextClaw 远程访问继续本机会话，并在右侧运行半导体数据 Panel App](/product-screenshots/nextclaw-remote-access-panel-app-cn.png)

这张图对应的是前两步的最终结果：不是打开一个独立的网页工具，而是从 Platform 进入同一个 NextClaw 工作环境。会话、技能、任务结果，以及 Agent 做出的 Panel App 都可以继续使用。

## 你真正带走的是什么

| 能力 | 远程使用时看到的结果 |
| --- | --- |
| 继续已有会话 | 会话、消息和当前工作区仍由原来的 NextClaw 实例提供 |
| 使用完整工作台 | 可以继续发送消息、调用技能、查看任务结果和操作右侧面板 |
| 运行 Panel App | 数据看板、文件工具和其他小应用可以在远程页面中正常运行 |
| 管理访问入口 | 可以查看设备状态、关闭远程访问，或按需创建和撤销分享链接 |

你带走的不只是一个输入框，而是自己已经配置好的 Agent 工作环境。家里的电脑、办公室的工作站或长期运行的服务器，都可以成为随时能够继续使用的 NextClaw 实例。

## 开始之前

先在本机打开 `http://127.0.0.1:55667`，确认 NextClaw 可以正常发送消息。远程访问不会替代本机服务；作为运行端的设备需要保持在线，NextClaw 后台服务也需要正常运行。

## 使用边界

- 远程访问依赖 NextClaw Account。不要把个人入口或分享链接交给不受信任的人。
- 不再使用时，可以随时在本机关闭远程访问：`nextclaw remote disable`。
- 接入云模型、搜索服务或其他在线工具时，相关数据仍会按照对应服务的规则发送给它们。

远程访问让“本地优先”不再等于“只能坐在这台电脑前”。运行环境和数据仍由自己的设备掌握，需要时再从外部安全地进入同一个工作台。

## 继续阅读

- [远程访问说明](/zh/guide/remote-access)
- [远程访问 UI 教程](/zh/guide/tutorials/remote-access-ui)
- [运行与托管手册](/zh/guide/runtime-hosting)
