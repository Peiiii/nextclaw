# 核心命令

这页只放普通用户最常需要的少量命令。

如果你只是想安装、启动、确认服务健康、重启或停止 NextClaw，看这页就够了。  
如果你要查完整 CLI 表面，再去看 [命令索引](/zh/guide/commands)。

## 最常用的 7 条命令

| 命令 | 什么时候用 |
|------|------------|
| `npm i -g nextclaw` | 首次安装 CLI |
| `nextclaw start` | 后台启动 NextClaw |
| `nextclaw status` | 查看当前是否正常运行 |
| `nextclaw doctor` | 遇到问题时先做诊断 |
| `nextclaw restart` | 改完配置或状态异常时重启 |
| `nextclaw stop` | 临时停止后台服务 |
| `nextclaw update` | 升级到最新 CLI 版本 |

## 推荐的最短工作流

### 1. 第一次安装

```bash
npm i -g nextclaw
nextclaw start
```

然后打开 `http://127.0.0.1:55667` 完成首次配置。

### 2. 日常确认是否正常

```bash
nextclaw status
```

如果你只是想确认“服务还在不在、UI 还能不能打开”，这条命令通常就够了。

### 3. 遇到异常先诊断

```bash
nextclaw doctor
```

这条命令适合在“打不开、连不上、感觉不对劲”时先跑一遍。

### 4. 改完配置或状态不对时重启

```bash
nextclaw restart
```

### 5. 暂时不用时停止

```bash
nextclaw stop
```

### 6. 升级到最新版本

```bash
nextclaw update
```

## 什么时候去看别的页面

- 如果你想让 NextClaw 长期在后台可用，去看 [运行与托管总览](/zh/guide/runtime-hosting)
- 如果你想开启登录自启动，去看 [后台运行与自启动](/zh/guide/background-autostart)
- 如果你想查某条具体命令，去看 [命令索引](/zh/guide/commands)

## 相关文档

- [上手](/zh/guide/getting-started)
- [配置后做什么](/zh/guide/after-setup)
- [运行与托管总览](/zh/guide/runtime-hosting)
- [故障排查](/zh/guide/troubleshooting)
