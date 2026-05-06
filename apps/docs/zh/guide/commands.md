# 命令索引

这页是 NextClaw 公开 CLI 的查询型参考页。  
它的目标是**尽可能完整地收录可用命令**，方便你按主题查找、检索或让 AI/高级使用者对照使用。

如果你只是第一次安装、启动和排错，不要从这页开始。优先看：

- [上手](/zh/guide/getting-started)
- [核心命令](/zh/guide/core-commands)
- [运行与托管总览](/zh/guide/runtime-hosting)

## 核心运行命令

| 命令 | 说明 |
|------|------|
| `nextclaw start` | 后台启动网关 + UI |
| `nextclaw restart` | 重启后台服务，可附带启动参数 |
| `nextclaw stop` | 停止后台服务 |
| `nextclaw ui` | 前台启动 UI 与网关 |
| `nextclaw gateway` | 仅启动网关（用于渠道） |
| `nextclaw serve` | 前台运行网关 + UI |
| `nextclaw --version` | 查看已安装版本 |
| `nextclaw status` | 查看运行状态（支持 `--json`、`--verbose`、`--fix`） |
| `nextclaw doctor` | 运行诊断（支持 `--json`、`--verbose`、`--fix`） |
| `nextclaw usage` | 查看最近一次 LLM 使用快照（支持 `--history`、`--stats`、`--limit <n>`、`--json`） |
| `nextclaw update` | 自更新 CLI |

## 宿主运行与自启动命令

| 命令 | 说明 |
|------|------|
| `nextclaw service install-systemd --user` | 安装用户级 Linux `systemd` 服务 |
| `sudo nextclaw service install-systemd --system` | 安装系统级 Linux `systemd` 服务 |
| `nextclaw service uninstall-systemd --user` | 移除用户级 Linux `systemd` 服务 |
| `sudo nextclaw service uninstall-systemd --system` | 移除系统级 Linux `systemd` 服务 |
| `nextclaw service install-launch-agent` | 安装托管式 macOS LaunchAgent |
| `nextclaw service uninstall-launch-agent` | 移除托管式 macOS LaunchAgent |
| `nextclaw service install-task` | 安装托管式 Windows 计划任务 |
| `nextclaw service uninstall-task` | 移除托管式 Windows 计划任务 |
| `nextclaw service autostart status` | 查看宿主自启动状态 |
| `nextclaw service autostart doctor` | 诊断宿主自启动配置 |

补充说明：

- `npm i -g nextclaw` 只安装 CLI，不会自动注册宿主自启动
- Linux 可区分 `--user` / `--system`
- `autostart status` / `autostart doctor` 是只读检查命令

产品说明入口：

- [后台运行与自启动](/zh/guide/background-autostart)

## 工作区与初始化命令

| 命令 | 说明 |
|------|------|
| `nextclaw init` | 初始化工作区与模板文件 |
| `nextclaw init --force` | 重新执行初始化并覆盖模板 |

## Agent 命令

| 命令 | 说明 |
|------|------|
| `nextclaw agent -m "message"` | 发送一次性消息给 Agent |
| `nextclaw agent` | 终端交互聊天 |
| `nextclaw agent --session <id> --model <model>` | 为指定会话绑定模型/路由 |
| `nextclaw agents list` | 列出内建与已创建 Agent |
| `nextclaw agents runtimes` | 列出已安装的 Agent runtime（支持 `--json`、`--probe`） |
| `nextclaw agents new <agent-id>` | 创建新 Agent |
| `nextclaw agents update <agent-id>` | 更新已有 Agent 的展示元信息 |
| `nextclaw agents remove <agent-id>` | 删除额外 Agent（内建 `main` 不可删除） |

## 平台登录与远程访问命令

| 命令 | 说明 |
|------|------|
| `nextclaw login --api-base <url>` | 浏览器登录 NextClaw 平台并保存本地 token |
| `nextclaw remote enable` | 启用托管式远程访问 |
| `nextclaw remote disable` | 关闭托管式远程访问 |
| `nextclaw remote status` | 查看远程访问状态 |
| `nextclaw remote doctor` | 诊断远程访问就绪度 |
| `nextclaw remote connect` | 前台调试模式：注册并保持连接器在线 |

产品说明入口：

- [远程访问](/zh/guide/remote-access)

## 配置命令

| 命令 | 说明 |
|------|------|
| `nextclaw config get <path>` | 读取配置值 |
| `nextclaw config set <path> <value>` | 写入配置值（`--json` 可按 JSON 解析） |
| `nextclaw config unset <path>` | 删除配置值 |

## Secrets 命令

| 命令 | 说明 |
|------|------|
| `nextclaw secrets audit` | 审计 refs 解析状态（支持 `--strict`、`--json`） |
| `nextclaw secrets configure --provider <alias> ...` | 新增/更新/删除 provider alias（`env/file/exec`） |
| `nextclaw secrets apply ...` | 应用 refs/defaults/providers 补丁（支持 `--file` 或单条 `--path`） |
| `nextclaw secrets reload` | 触发运行时 secrets 重载 |

## 渠道命令

| 命令 | 说明 |
|------|------|
| `nextclaw channels status` | 查看已启用渠道与状态 |
| `nextclaw channels login` | 打开支持渠道的扫码登录 |
| `nextclaw channels add --channel <id> ...` | 通过 setup adapter 配置渠道 |

## 插件命令

| 命令 | 说明 |
|------|------|
| `nextclaw plugins list` | 列出已发现插件 |
| `nextclaw plugins info <id>` | 查看插件详情 |
| `nextclaw plugins install <path-or-spec>` | 从本地路径/压缩包/npm 规格安装插件 |
| `nextclaw plugins uninstall <id>` | 卸载插件（支持 `--dry-run`） |
| `nextclaw plugins enable <id>` | 在配置中启用插件 |
| `nextclaw plugins disable <id>` | 在配置中禁用插件 |
| `nextclaw plugins doctor` | 诊断插件加载问题 |

## Skills 与 Marketplace 命令

| 命令 | 说明 |
|------|------|
| `nextclaw skills installed` | 列出本地运行时已安装技能（支持 `--json`、`--scope`、`--query`） |
| `nextclaw skills info <selector>` | 查看本地已安装技能详情（支持 `--json`） |
| `nextclaw skills install <slug>` | 兼容入口：把 marketplace skill 安装到 `<workspace>/skills/<slug>` |
| `nextclaw skills publish <dir>` | 上传/创建 marketplace skill |
| `nextclaw skills update <dir>` | 更新已存在的 marketplace skill |
| `nextclaw marketplace skills search` | 搜索 marketplace skills |
| `nextclaw marketplace skills info <slug>` | 查看 marketplace skill 详情 |
| `nextclaw marketplace skills recommend` | 获取推荐 marketplace skills |
| `nextclaw marketplace skills install <slug>` | 使用显式 marketplace 域安装 skill |

## Cron 命令

| 命令 | 说明 |
|------|------|
| `nextclaw cron list` | 列出所有定时任务（含已禁用） |
| `nextclaw cron add ...` | 新增定时任务 |
| `nextclaw cron remove <jobId>` | 删除任务 |
| `nextclaw cron enable <jobId>` | 启用已禁用任务 |
| `nextclaw cron disable <jobId>` | 禁用任务但不删除 |
| `nextclaw cron run <jobId>` | 立即执行一次任务（必要时可配 `--force`） |

## 这页适合什么时候打开

- 你已经知道自己在查哪个主题
- 你想确认某条命令的正式名字
- 你想把“产品说明页”里的某个动作映射到具体 CLI 命令
- 你想让 AI 参考完整命令索引，而不是只看上手路径

## 相关文档

- [核心命令](/zh/guide/core-commands)
- [运行与托管总览](/zh/guide/runtime-hosting)
- [后台运行与自启动](/zh/guide/background-autostart)
- [故障排查](/zh/guide/troubleshooting)
