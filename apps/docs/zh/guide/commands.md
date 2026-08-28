# NextClaw CLI：能力全景与命令全集

`nextclaw` 命令行是 NextClaw 的一等操作入口。适合结构化操作的产品能力会尽量同时通过 CLI 提供，让普通用户、高级用户、开发者、脚本、CI 和其他 Agent 可以调用同一套 NextClaw 能力。

这不意味着所有界面都要搬进终端。纯视觉、拖拽和直接操控仍然更适合图形界面；CLI 更适合启动与托管、查询与诊断、批量操作、自动化和系统集成。

本页有两个用途：

- 按能力域查看 NextClaw 当前可以做什么；
- 按命令路径查找完整 CLI 能力面。

命令注册树是本页的事实源。新增、删除或重命名 CLI 命令时，中英文页面必须同步更新，仓库测试会检查这里是否完整覆盖真实命令。

## 怎么使用这份全集

这里列出每一个可执行命令路径及其主要用途。查看某个命令的完整参数、默认值和选项时，运行：

```bash
nextclaw <command> --help
```

查看版本使用 `nextclaw --version`。许多查询和管理命令支持 `--json`；用于脚本、CI 或 Agent 集成前，请先查看对应命令的帮助。首次安装和启动请看[快速开始](/zh/guide/getting-started)，日常最常用的少量命令请看[核心命令](/zh/guide/core-commands)。

## 能力地图

| 能力域                | 可以完成的事                                      |
| --------------------- | ------------------------------------------------- |
| 初始化与账号          | 初始化工作区、登录平台、查看账号与设置用户名      |
| 运行、状态与日志      | 启停本地服务和 UI、更新、诊断、查询日志与模型用量 |
| 宿主托管              | 安装或移除 Linux、macOS、Windows 自启动服务       |
| 远程访问              | 启用、关闭、诊断和调试远程连接                    |
| Agent 与任务执行      | 终端聊天、Headless 执行、Agent 与 Runtime 管理    |
| 项目与会话            | 创建项目、查看模板、绑定和整理会话                |
| 自动化与学习循环      | 管理定时任务和学习循环策略                        |
| 配置与密钥            | 读写配置、审计和应用密钥引用                      |
| MCP 与消息渠道        | 管理 MCP 服务和消息渠道连接                       |
| Skills 与 Marketplace | 查看、安装、发布、更新和发现 Skills               |
| NextClaw Apps         | 检查、开发、打包、发布、调用和管理 App 数据       |

## 初始化与账号

| 命令                            | 用途                                      |
| ------------------------------- | ----------------------------------------- |
| `nextclaw onboard`              | 初始化 NextClaw 配置和工作区              |
| `nextclaw init`                 | 初始化工作区；可用 `--force` 覆盖模板文件 |
| `nextclaw login`                | 登录 NextClaw Platform 并保存本地凭据     |
| `nextclaw account status`       | 查看账号状态和 Marketplace 发布准备度     |
| `nextclaw account set-username` | 设置用于个人 Marketplace 发布的用户名     |

## 运行、状态与日志

| 命令                  | 用途                                             |
| --------------------- | ------------------------------------------------ |
| `nextclaw gateway`    | 前台启动 Gateway，可选择同时启用 UI              |
| `nextclaw ui`         | 启动 Gateway 和 UI                               |
| `nextclaw start`      | 在后台启动 Gateway 和 UI                         |
| `nextclaw restart`    | 重启后台服务                                     |
| `nextclaw serve`      | 前台运行 Gateway 和 UI，适合调试                 |
| `nextclaw stop`       | 停止后台服务                                     |
| `nextclaw status`     | 查看进程、健康度、配置摘要和可用端点             |
| `nextclaw doctor`     | 运行诊断，并可修复安全范围内的陈旧状态           |
| `nextclaw logs path`  | 查看本地日志文件路径                             |
| `nextclaw logs tail`  | 查看最近的服务或崩溃日志                         |
| `nextclaw logs query` | 按时间、级别、领域、事件和关联 ID 查询结构化日志 |
| `nextclaw usage`      | 查看最近模型用量、历史记录和缓存统计             |
| `nextclaw update`     | 检查、下载或应用 NextClaw Runtime 更新           |

## 宿主托管与自启动

| 命令                                      | 用途                                   |
| ----------------------------------------- | -------------------------------------- |
| `nextclaw service install-systemd`        | 安装 Linux 用户级或系统级 systemd 服务 |
| `nextclaw service uninstall-systemd`      | 移除 NextClaw 管理的 systemd 服务      |
| `nextclaw service install-launch-agent`   | 安装 macOS LaunchAgent                 |
| `nextclaw service uninstall-launch-agent` | 移除 macOS LaunchAgent                 |
| `nextclaw service install-task`           | 安装 Windows 计划任务                  |
| `nextclaw service uninstall-task`         | 移除 Windows 计划任务                  |
| `nextclaw service autostart status`       | 查看宿主自启动 owner 和运行状态        |
| `nextclaw service autostart doctor`       | 诊断宿主自启动配置                     |

## 远程访问

| 命令                      | 用途                             |
| ------------------------- | -------------------------------- |
| `nextclaw remote enable`  | 启用由服务托管的远程访问         |
| `nextclaw remote disable` | 关闭远程访问                     |
| `nextclaw remote status`  | 查看远程访问和连接状态           |
| `nextclaw remote doctor`  | 运行远程访问诊断                 |
| `nextclaw remote connect` | 以前台调试模式注册设备并保持连接 |

## Agent 与任务执行

| 命令                             | 用途                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `nextclaw agent`                 | 在终端交互，或通过 `-m` 发送一次性消息                                                             |
| `nextclaw exec`                  | 以 Headless 模式运行一次任务，支持文本、JSON 和 JSONL；详见 [`nextclaw exec`](/zh/developers/exec) |
| `nextclaw agents list`           | 列出已配置的 Agent                                                                                 |
| `nextclaw agents runtimes`       | 列出并可主动探测可用 Agent Runtime                                                                 |
| `nextclaw agents runtime config` | 查看或修改指定 Runtime 的配置                                                                      |
| `nextclaw agents new`            | 创建 Agent，并设置名称、头像、主目录和 Runtime                                                     |
| `nextclaw agents update`         | 更新现有 Agent                                                                                     |
| `nextclaw agents remove`         | 删除 Agent                                                                                         |

## 项目与会话

| 命令                              | 用途                                   |
| --------------------------------- | -------------------------------------- |
| `nextclaw projects list`          | 列出所有已注册项目，包括尚无会话的项目 |
| `nextclaw projects templates`     | 列出内置项目模板                       |
| `nextclaw projects create`        | 创建并注册项目                         |
| `nextclaw sessions rename`        | 重命名会话                             |
| `nextclaw sessions set-project`   | 把会话绑定到现有项目目录               |
| `nextclaw sessions clear-project` | 清除会话的显式项目绑定                 |
| `nextclaw sessions delete`        | 永久删除会话；需 `--confirm <会话 ID>` |

## 自动化与学习循环

| 命令                               | 用途                                        |
| ---------------------------------- | ------------------------------------------- |
| `nextclaw cron list`               | 列出定时任务                                |
| `nextclaw cron add`                | 添加按间隔、Cron 表达式或指定时间运行的任务 |
| `nextclaw cron remove`             | 删除定时任务                                |
| `nextclaw cron enable`             | 启用定时任务                                |
| `nextclaw cron disable`            | 禁用定时任务                                |
| `nextclaw cron run`                | 立即运行指定任务                            |
| `nextclaw learning-loop status`    | 查看学习循环设置                            |
| `nextclaw learning-loop enable`    | 启用学习循环                                |
| `nextclaw learning-loop disable`   | 禁用学习循环                                |
| `nextclaw learning-loop threshold` | 设置触发学习回顾的工具调用阈值              |

## 配置与密钥

| 命令                         | 用途                                   |
| ---------------------------- | -------------------------------------- |
| `nextclaw config get`        | 按点路径读取配置值                     |
| `nextclaw config set`        | 按点路径写入配置值                     |
| `nextclaw config unset`      | 删除指定配置值                         |
| `nextclaw secrets audit`     | 审计密钥引用的解析状态                 |
| `nextclaw secrets configure` | 配置 env、file 或 exec 密钥提供方式    |
| `nextclaw secrets apply`     | 批量或单项应用密钥引用与 provider 配置 |
| `nextclaw secrets reload`    | 通知运行中的服务重新加载密钥           |

## MCP 与消息渠道

| 命令                       | 用途                             |
| -------------------------- | -------------------------------- |
| `nextclaw mcp list`        | 列出已配置 MCP 服务              |
| `nextclaw mcp add`         | 添加 stdio、HTTP 或 SSE MCP 服务 |
| `nextclaw mcp remove`      | 删除 MCP 服务                    |
| `nextclaw mcp enable`      | 启用 MCP 服务                    |
| `nextclaw mcp disable`     | 禁用 MCP 服务                    |
| `nextclaw mcp doctor`      | 检查 MCP 连接与工具发现          |
| `nextclaw channels add`    | 添加或更新消息渠道配置           |
| `nextclaw channels list`   | 列出已配置渠道                   |
| `nextclaw channels status` | 查看渠道状态                     |
| `nextclaw channels login`  | 通过二维码连接支持的渠道账号     |

## Skills 与 Marketplace

| 命令                                    | 用途                               |
| --------------------------------------- | ---------------------------------- |
| `nextclaw skills installed`             | 列出当前运行环境已安装的 Skills    |
| `nextclaw skills info`                  | 查看已安装 Skill 的详情            |
| `nextclaw skills install`               | 从 NextClaw Marketplace 安装 Skill |
| `nextclaw skills publish`               | 创建或发布 Marketplace Skill       |
| `nextclaw skills update`                | 更新已发布的 Marketplace Skill     |
| `nextclaw marketplace skills search`    | 搜索 Marketplace Skills            |
| `nextclaw marketplace skills info`      | 查看 Marketplace Skill 详情        |
| `nextclaw marketplace skills recommend` | 查看推荐 Skills                    |
| `nextclaw marketplace skills install`   | 安装 Marketplace Skill             |
| `nextclaw marketplace skills update`    | 更新本地已安装的 Marketplace Skill |

## NextClaw Apps

| 命令                            | 用途                                           |
| ------------------------------- | ---------------------------------------------- |
| `nextclaw app check`            | 检查 Panel App 或 Service App 目录             |
| `nextclaw app dev`              | 通过真实 Runtime 启动并调试 MCP 或轻量 Service App |
| `nextclaw app pack`             | 为指定平台目标打包 `.napp` 产物                |
| `nextclaw app validate-publish` | 在提交 Marketplace 前验证 App 和目标产物       |
| `nextclaw app publish`          | 向 App Marketplace 提交 App                    |
| `nextclaw app call`             | 通过真实 Runtime 调用 MCP 或轻量 Service App action |
| `nextclaw app restart`          | 重启运行中 NextClaw UI 内的 Service App        |
| `nextclaw app data list`        | 列出活动和保留的 App 数据实例                  |
| `nextclaw app data delete`      | 永久删除保留的 App 数据实例，需精确确认 App ID |

Service App 的使用方式见 [Service Apps](/zh/guide/service-apps)；WASM 开发命令与 Runtime 合同见 [开发 WASM Service App](/zh/developers/portable-service-apps)。

## 自动化使用建议

- 查询或管理命令支持 `--json` 时，脚本和 Agent 应优先使用机器可读输出。
- 非交互任务使用 `nextclaw exec --format text|json|jsonl`，并根据退出码判断结果。
- 变更配置、密钥、宿主服务和永久删除数据前，先查看该命令的 `--help` 和权限边界。
- CLI、UI 和内置 AI 工具应调用同一个产品 owner；如果同一能力在多个入口行为不一致，请提交问题。

## 相关文档

- [核心命令](/zh/guide/core-commands)
- [`nextclaw exec` Headless 执行](/zh/developers/exec)
- [运行与托管](/zh/guide/runtime-hosting)
- [配置手册](/zh/guide/configuration)
- [故障排查](/zh/guide/troubleshooting)
- [安全与权限](/zh/guide/security-and-permissions)
