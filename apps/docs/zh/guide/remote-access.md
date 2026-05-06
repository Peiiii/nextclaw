# 远程访问

远程访问用于从其他设备打开这台机器上的 NextClaw。它适合你已经在本机跑通，并希望把本机实例变成自己的远程控制台。

## 使用前先确认

你应该已经完成：

- [快速开始](/zh/guide/getting-started)
- 一个可用模型提供方
- `nextclaw status` 正常

如果服务本身还没跑通，先不要配置远程访问。

## 适合的场景

- 在手机或平板上访问家里电脑上的 NextClaw
- 在办公室访问服务器上的 NextClaw
- 把本地实例挂到受控的远程入口后面

## 基本命令

```bash
nextclaw remote enable
nextclaw remote status
nextclaw remote doctor
nextclaw remote disable
```

`remote doctor` 用来检查远程访问是否具备必要条件。

## 安全提醒

远程访问会改变访问边界。开启前请确认：

- 你知道谁能访问这个入口
- token 或登录状态没有泄露
- 反向代理或隧道服务配置可信
- 不把本地管理界面暴露给不可信网络

## 相关文档

- [后台运行与自启动](/zh/guide/background-autostart)
- [Docker 部署](/zh/guide/tutorials/docker-one-click)
- [故障排查](/zh/guide/troubleshooting)
