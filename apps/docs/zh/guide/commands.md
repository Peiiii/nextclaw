# 命令

## 核心命令

| 命令 | 说明 |
|------|------|
| `nextclaw start` | 后台启动网关 + UI |
| `nextclaw restart` | 重启后台服务 |
| `nextclaw stop` | 停止后台服务 |
| `nextclaw ui` | 前台启动 UI 与网关 |
| `nextclaw gateway` | 仅启动网关（用于渠道） |
| `nextclaw serve` | 前台运行网关 + UI |
| `nextclaw status` | 查看运行状态（`--json`、`--verbose`、`--fix`） |
| `nextclaw doctor` | 运行诊断 |
| `nextclaw update` | 自更新 CLI |

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
| `nextclaw cron list` | 列出任务 |
| `nextclaw cron add ...` | 新增任务 |
| `nextclaw cron remove <jobId>` | 删除任务 |
| `nextclaw cron enable <jobId>` | 启用/禁用任务 |
| `nextclaw cron run <jobId>` | 立即执行一次 |
