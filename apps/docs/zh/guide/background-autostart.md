# 后台运行与自启动

这页面向已经开始使用 NextClaw，并希望它在本机更稳定可用的用户。

它主要回答三件事：

- 什么叫后台运行
- 什么叫登录自启动 / 宿主自启动
- npm 安装版到底该怎么开启这件事

## 先区分三件事

### 1. 手动后台运行

你执行：

```bash
nextclaw start
```

这表示“现在把它在后台启动起来”。

### 2. 登录后自动启动

这表示你登录系统后，NextClaw 会由宿主平台自动拉起。

### 3. 机器重启后恢复

这通常意味着你需要宿主级托管路径，比如：

- Linux `systemd`
- macOS LaunchAgent
- Windows 计划任务
- 或者 Docker / 服务器部署路径

## 开启自启动前，先确认平时能正常跑

先确认基本运行链路没有问题：

```bash
nextclaw start
nextclaw status
nextclaw doctor
```

如果连这一条最短链路都还不稳定，不建议先跳去做自启动。

## 一个关键事实

`npm i -g nextclaw` 只负责安装 CLI。  
它**不会**自动替你注册宿主自启动。

这也是 NextClaw 当前正确的产品语义：  
安装 CLI 不等于偷偷改你的系统启动项；是否接入宿主自启动，应该由你显式决定。

## 按平台开启

### Linux

#### 登录级自启动

```bash
nextclaw service install-systemd --user
```

#### 机器级自启动

```bash
sudo nextclaw service install-systemd --system
```

#### 卸载

```bash
nextclaw service uninstall-systemd --user
sudo nextclaw service uninstall-systemd --system
```

### macOS

#### 开启

```bash
nextclaw service install-launch-agent
```

#### 卸载

```bash
nextclaw service uninstall-launch-agent
```

### Windows

#### 开启

```bash
nextclaw service install-task
```

#### 卸载

```bash
nextclaw service uninstall-task
```

## 怎么确认是否已经生效

下面两条命令都是只读检查：

```bash
nextclaw service autostart status
nextclaw service autostart doctor
```

如果你在 Linux 上需要区分作用域，再显式加：

```bash
nextclaw service autostart status --user
nextclaw service autostart status --system
```

## 什么时候更适合 Docker / 服务器托管

如果你的目标是：

- 机器重启后稳定恢复
- 反向代理后长期对外访问
- 把它当成长期服务而不是本机工具

那么你应该同时评估：

- [Docker 一键部署教程](/zh/guide/tutorials/docker-one-click)
- Linux 宿主托管路径（`systemd`）

不要把“我今天先运行起来一次”和“这台机器会长期稳定托管它”混成一件事。

## 相关文档

- [运行与托管总览](/zh/guide/runtime-hosting)
- [核心命令](/zh/guide/core-commands)
- [命令索引](/zh/guide/commands)
- [Docker 一键部署教程](/zh/guide/tutorials/docker-one-click)
