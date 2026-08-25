# 选择安装方式

NextClaw 支持桌面版、npm 和 Docker。三种方式使用同一个产品，区别主要在于运行位置和维护方式。

## 普通用户：桌面版

桌面版适合希望下载后直接打开使用的人，支持 macOS、Windows 和 Linux。

[下载最新稳定版](https://nextclaw.io/zh/download/)

安装完成后启动 NextClaw。全新安装会默认启用 OpenCode Zen 免费试用模型，无需填写 API Key 就能发送第一条消息，然后进入[快速开始](/zh/guide/getting-started)。

你可以在桌面端设置中选择更新渠道。stable 只接收正式版；beta 会同时检查预览版和正式版，并提示其中版本较新的更新。

## 终端与本机服务：npm

如果你习惯命令行，或希望在本机以服务方式运行，可以安装 npm 包。

```bash
npm install -g nextclaw
nextclaw start
```

启动后打开：

```text
http://127.0.0.1:55667
```

首次打开即可使用内置免费试用模型，无需先准备 API Key。

常用管理命令：

```bash
nextclaw status
nextclaw doctor
nextclaw stop
```

## 服务器与云主机：Docker

Docker 适合长期运行、远程访问、反向代理或部署到云主机。

```bash
curl -fsSL https://nextclaw.io/install-docker.sh | bash
```

在服务器执行远程脚本前，建议先打开脚本地址检查内容。域名、端口、数据目录和反向代理设置见 [Docker 部署](/zh/guide/tutorials/docker-one-click)。

未启用的消息渠道不会常驻独立进程。当前已验证的 ARM64 Linux 空配置基准中，三轮平均 working set 约为 165 MiB。这个数字是空闲基准，不是所有机器的最低配置；当前服务器起步配置和会增加内存的工作负载见[运行资源与内存基准](/zh/guide/resource-usage)。

## 怎么选

| 你的情况 | 推荐方式 |
| --- | --- |
| 想尽快在自己的电脑上开始 | 桌面版 |
| 熟悉终端，需要 CLI 和本机服务 | npm |
| 需要服务器长期运行或远程访问 | Docker |
| 正在开发 NextClaw 本身 | [从源码运行](https://github.com/Peiiii/nextclaw#develop-from-source) |

选好之后继续：[快速开始](/zh/guide/getting-started)。

> OpenCode Zen 免费试用由公共网关提供，限额和模型可能变化。请求数据可能被用于改进模型，请勿发送密码、密钥或其他敏感与机密信息。
