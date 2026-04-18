# 命令

## 核心命令

| 命令 | 说明 |
|------|------|
| `nextclaw start` | 后台启动网关 + UI |
| `nextclaw restart` | 重启后台服务 |
| `nextclaw stop` | 停止后台服务 |
| `nextclaw service install-systemd --user` | 安装用户级 Linux `systemd` 服务 |
| `sudo nextclaw service install-systemd --system` | 安装系统级 Linux `systemd` 服务 |
| `nextclaw service uninstall-systemd --user` | 移除用户级 Linux `systemd` 服务 |
| `sudo nextclaw service uninstall-systemd --system` | 移除系统级 Linux `systemd` 服务 |
| `nextclaw service autostart status --user` | 查看宿主自启动状态 |
| `nextclaw service autostart doctor --user` | 诊断宿主自启动配置 |
| `nextclaw ui` | 前台启动 UI 与网关 |
| `nextclaw gateway` | 仅启动网关（用于渠道） |
| `nextclaw serve` | 前台运行网关 + UI |
| `nextclaw --version` | 查看已安装的 NextClaw 版本 |
| `nextclaw status` | 查看运行状态（`--json`、`--verbose`、`--fix`） |
| `nextclaw doctor` | 运行诊断 |
| `nextclaw update` | 自更新 CLI |

`npm i -g nextclaw` 只负责安装 CLI，不会自动替你注册宿主自启动。

如果你是在 Linux 服务器上通过 Nginx / Caddy / Traefik 对外暴露 NextClaw，请不要只依赖一次性的 `nextclaw start`。一旦机器重启或进程退出，反向代理层通常就会直接表现为 `502 Bad Gateway`。此时应使用 `sudo nextclaw service install-systemd --system` 安装受管常驻服务。

## Agent 命令

| 命令 | 说明 |
|------|------|
| `nextclaw agent -m "message"` | 发送一次性消息 |
| `nextclaw agent` | 终端交互聊天 |
| `nextclaw agent --session <id>` | 指定会话 |

## 配置命令

| 命令 | 说明 |
|------|------|
| `nextclaw config get <path>` | 读取配置 |
| `nextclaw config set <path> <value>` | 写入配置（`--json`） |
| `nextclaw config unset <path>` | 删除配置 |
| `nextclaw init` | 初始化工作区模板 |

## Secrets 命令

| 命令 | 说明 |
|------|------|
| `nextclaw secrets audit` | 审计 refs 解析状态（支持 `--strict`、`--json`） |
| `nextclaw secrets configure --provider <alias> ...` | 新增/更新/删除 provider 别名（`env/file/exec`） |
| `nextclaw secrets apply ...` | 应用 refs/defaults/providers 补丁（`--file` 或单条 `--path`） |
| `nextclaw secrets reload` | 触发运行时 secrets 重载 |

完整上手与迁移示例见：[密钥管理](/zh/guide/secrets)。

## 渠道命令

| 命令 | 说明 |
|------|------|
| `nextclaw channels status` | 查看已启用渠道 |
| `nextclaw channels login` | 打开扫码登录（支持渠道） |
| `nextclaw channels add --channel <id>` | 添加/配置渠道 |

## 插件命令

| 命令 | 说明 |
|------|------|
| `nextclaw plugins list` | 列出已发现插件 |
| `nextclaw plugins install <spec>` | 安装插件 |
| `nextclaw plugins uninstall <id>` | 卸载插件 |
| `nextclaw plugins enable <id>` | 启用插件 |
| `nextclaw plugins disable <id>` | 禁用插件 |
| `nextclaw plugins doctor` | 插件诊断 |

## Cron 命令

| 命令 | 说明 |
|------|------|
| `nextclaw cron list` | 列出所有任务（含已禁用） |
| `nextclaw cron add ...` | 新增任务 |
| `nextclaw cron remove <jobId>` | 删除任务 |
| `nextclaw cron enable <jobId>` | 启用已禁用任务 |
| `nextclaw cron disable <jobId>` | 禁用任务但不删除 |
| `nextclaw cron run <jobId>` | 立即执行一次 |
