# 选择安装方式

NextClaw 支持桌面版、npm 和 Docker。三种方式使用同一个产品，区别主要在于运行位置和维护方式。

## 普通用户：桌面版

桌面版适合希望下载后直接打开使用的人，支持 macOS、Windows 和 Linux。

[下载最新稳定版](https://nextclaw.io/zh/download/)

安装完成后启动 NextClaw，按界面提示配置模型，然后进入[快速开始](/zh/guide/getting-started)。

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

## 怎么选

| 你的情况 | 推荐方式 |
| --- | --- |
| 想尽快在自己的电脑上开始 | 桌面版 |
| 熟悉终端，需要 CLI 和本机服务 | npm |
| 需要服务器长期运行或远程访问 | Docker |
| 正在开发 NextClaw 本身 | [从源码运行](https://github.com/Peiiii/nextclaw#develop-from-source) |

选好之后继续：[快速开始](/zh/guide/getting-started)。
