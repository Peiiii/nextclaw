# 命令索引

这是查询型参考页，不是新手入门路径。  
如果你只是第一次安装和启动，请先看 [快速开始](/zh/guide/getting-started)。

## 核心运行

| 命令 | 用途 |
|------|------|
| `nextclaw start` | 后台启动服务和 UI |
| `nextclaw restart` | 重启服务 |
| `nextclaw stop` | 停止服务 |
| `nextclaw serve` | 前台运行，适合调试 |
| `nextclaw status` | 查看运行状态 |
| `nextclaw doctor` | 运行诊断 |
| `nextclaw update` | 更新 CLI |
| `nextclaw usage` | 查看使用快照 |

## 宿主托管

| 命令 | 用途 |
|------|------|
| `nextclaw service install-systemd --user` | 安装 Linux 用户级 systemd 服务 |
| `sudo nextclaw service install-systemd --system` | 安装 Linux 系统级 systemd 服务 |
| `nextclaw service install-launch-agent` | 安装 macOS LaunchAgent |
| `nextclaw service install-task` | 安装 Windows 计划任务 |
| `nextclaw service autostart status` | 查看自启动状态 |
| `nextclaw service autostart doctor` | 诊断自启动配置 |

## 远程访问

| 命令 | 用途 |
|------|------|
| `nextclaw remote enable` | 启用远程访问 |
| `nextclaw remote disable` | 关闭远程访问 |
| `nextclaw remote status` | 查看远程访问状态 |
| `nextclaw remote doctor` | 诊断远程访问 |

## 配置

| 命令 | 用途 |
|------|------|
| `nextclaw config get <path>` | 读取配置 |
| `nextclaw config set <path> <value>` | 写入配置 |
| `nextclaw config unset <path>` | 删除配置 |

## 密钥

| 命令 | 用途 |
|------|------|
| `nextclaw secrets audit` | 审计密钥引用 |
| `nextclaw secrets configure` | 配置密钥提供方式 |
| `nextclaw secrets reload` | 重载密钥 |

## 渠道

| 命令 | 用途 |
|------|------|
| `nextclaw channels status` | 查看渠道状态 |
| `nextclaw channels login` | 登录支持扫码的渠道 |
| `nextclaw channels add` | 添加渠道配置 |

## 自动化

| 命令 | 用途 |
|------|------|
| `nextclaw cron list` | 列出任务 |
| `nextclaw cron add` | 添加任务 |
| `nextclaw cron remove <jobId>` | 删除任务 |
| `nextclaw cron enable <jobId>` | 启用任务 |
| `nextclaw cron disable <jobId>` | 禁用任务 |
| `nextclaw cron run <jobId>` | 立即运行任务 |

## 扩展与 Skills

| 命令 | 用途 |
|------|------|
| `nextclaw plugins list` | 列出插件 |
| `nextclaw plugins install <spec>` | 安装插件 |
| `nextclaw plugins enable <id>` | 启用插件 |
| `nextclaw skills installed` | 列出已安装 skill |
| `nextclaw marketplace skills search` | 搜索 marketplace skill |
| `nextclaw marketplace skills install <slug>` | 安装 marketplace skill |

## Agent

| 命令 | 用途 |
|------|------|
| `nextclaw agent` | 终端交互 |
| `nextclaw agent -m "message"` | 发送一次性消息 |
| `nextclaw agents list` | 列出 Agent |
| `nextclaw agents runtimes` | 列出 runtime |

## 相关文档

- [核心命令](/zh/guide/core-commands)
- [故障排查](/zh/guide/troubleshooting)
- [运行与托管](/zh/guide/runtime-hosting)
