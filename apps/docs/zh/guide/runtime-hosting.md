# 运行与托管总览

这页解决的问题不是“某条命令怎么写”，而是：

- 我应该怎么让 NextClaw 跑起来
- 我应该怎么让它持续可用
- 我到底该用本地后台、宿主自启动、Docker，还是远程访问

## 先记住一个原则

`nextclaw start` 适合把 NextClaw 快速跑起来。  
但“跑起来一次”和“长期稳定可用”不是同一件事。

如果你只是今天想先开始用，`nextclaw start` 就够了。  
如果你希望它在登录后自动起来、机器重启后能恢复、或者能长期托管给别的设备访问，就应该进入更合适的托管路径。

## 四种最常见的路径

### 1. 只想在当前机器先用起来

适合你现在就想配置模型、打开 UI、开始聊天。

用这组命令：

```bash
nextclaw start
nextclaw status
nextclaw stop
```

文档入口：

- [核心命令](/zh/guide/core-commands)

### 2. 希望它在本机后台长期可用

适合你已经开始稳定使用，并且不希望每次都手动重新启动。

这时应该进一步理解：

- 后台运行
- 登录自启动
- 宿主原生托管

文档入口：

- [后台运行与自启动](/zh/guide/background-autostart)

### 3. 希望它在服务器或容器里常驻

适合你明确想要一条“更像服务”的路径，而不是依赖本地终端会话。

最直接的入口是：

- [Docker 一键部署教程](/zh/guide/tutorials/docker-one-click)

如果你是在 Linux 服务器后面接 Nginx / Caddy / Traefik，这条路径通常比“手工执行一次 `nextclaw start`”更可靠。

### 4. 希望从其他设备访问这台机器上的 NextClaw

适合你想把本地 NextClaw UI 变成自己的远程控制台。

文档入口：

- [远程访问](/zh/guide/remote-access)

## 什么时候不要只停留在 `nextclaw start`

如果你已经进入下面这些场景，就不应该只依赖一次性的 `nextclaw start`：

- 机器重启后希望自动恢复
- 长时间不盯着终端，也希望它继续可用
- 你把它挂在反向代理后面对外访问
- 你希望其他设备稳定连接这台机器上的 NextClaw

这时需要继续看：

- [后台运行与自启动](/zh/guide/background-autostart)
- [远程访问](/zh/guide/remote-access)
- [Docker 一键部署教程](/zh/guide/tutorials/docker-one-click)

## 一条简单的选择建议

- 今天先用起来：`nextclaw start`
- 想在本机长期用：看“后台运行与自启动”
- 想让它更像服务：看 Docker / 宿主托管
- 想跨设备访问：看远程访问

## 相关文档

- [核心命令](/zh/guide/core-commands)
- [后台运行与自启动](/zh/guide/background-autostart)
- [远程访问](/zh/guide/remote-access)
- [Docker 一键部署教程](/zh/guide/tutorials/docker-one-click)
