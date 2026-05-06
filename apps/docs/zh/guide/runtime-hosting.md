# 运行与托管手册

运行与托管手册解释 NextClaw 可以怎样持续存在。它帮助你选择前台运行、后台运行、自启动、远程访问或 Docker。

## 运行方式对比

| 方式 | 适合场景 |
|------|----------|
| `nextclaw start` | 本机日常使用，快速启动后台服务 |
| `nextclaw serve` | 前台调试，适合观察日志 |
| 自启动 | 登录或重启后自动恢复 |
| Docker | 服务器或容器化部署 |
| 远程访问 | 从其他设备访问这台机器上的实例 |

## 推荐选择

- 只是试用：`nextclaw start`
- 每天都用：后台运行 + 自启动
- 要给手机或其他设备访问：远程访问
- 要放在服务器：Docker 或系统级服务

## 关键边界

`npm i -g nextclaw` 不会自动注册自启动。  
安装 CLI 和安装宿主托管项是两件事。

## 相关指南

- [后台运行与自启动](/zh/guide/background-autostart)
- [远程访问](/zh/guide/remote-access)
- [Docker 部署](/zh/guide/tutorials/docker-one-click)
