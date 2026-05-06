# 后台运行与自启动

`nextclaw start` 可以让 NextClaw 跑起来，但它不等于系统级长期托管。

这一页讲什么时候需要后台运行和自启动，以及 NPM 安装版应该怎样显式开启。

## 什么时候需要它

你进入这些场景时，就应该考虑自启动：

- 每天都使用 NextClaw
- 希望登录后自动可用
- 不想每次重启机器后手动启动
- 已经接入聊天渠道或自动化任务

## NPM 安装不会自动注册自启动

```bash
npm i -g nextclaw
```

这条命令只安装 CLI。它不会偷偷修改系统启动项。

如果需要自启动，你必须显式安装宿主托管项。

## 按平台开启

Linux 用户级：

```bash
nextclaw service install-systemd --user
```

Linux 系统级：

```bash
sudo nextclaw service install-systemd --system
```

macOS：

```bash
nextclaw service install-launch-agent
```

Windows：

```bash
nextclaw service install-task
```

## 检查状态

```bash
nextclaw service autostart status
nextclaw service autostart doctor
```

## 什么时候不用自启动

如果你只是试用，或者只在本机 UI 偶尔打开，`nextclaw start` 就够了。

## 相关文档

- [运行与托管](/zh/guide/runtime-hosting)
- [远程访问](/zh/guide/remote-access)
- [命令索引](/zh/guide/commands)
