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
| 项目与会话            | 创建项目、观测项目进展、绑定和整理会话            |
| 自动化与学习循环      | 管理定时任务和学习循环策略                        |
| 配置与密钥            | 读写配置、审计和应用密钥引用                      |
| MCP 与消息渠道        | 管理 MCP 服务和消息渠道连接                       |
| Skills 与 Marketplace | 查看、安装、发布、更新和发现 Skills               |
| NextClaw Apps         | 检查、开发、打包、发布、安装、调用和管理 App 数据 |

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

| 命令                                     | 用途                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `nextclaw projects list`                 | 列出所有已注册项目，包括尚无会话的项目                                                 |
| `nextclaw projects templates`            | 列出内置项目模板                                                                       |
| `nextclaw projects create`               | 创建并注册项目                                                                         |
| `nextclaw projects observe`              | 读取已注册项目的只读观测快照                                                           |
| `nextclaw projects work list`            | 按项目 ID 分页列出工作项；支持 `--state`、`--cursor`、`--limit` 和 `--include-deleted` |
| `nextclaw projects work get`             | 查看工作项详情                                                                         |
| `nextclaw projects work create`          | 创建持久化工作项                                                                       |
| `nextclaw projects work update`          | 更新工作项字段、状态或关注标记                                                         |
| `nextclaw projects work delete`          | 软删除工作项                                                                           |
| `nextclaw projects work restore`         | 恢复已删除工作项                                                                       |
| `nextclaw projects work activity`        | 查看工作项的不可变活动历史                                                             |
| `nextclaw projects work artifact link`   | 关联项目内的产物文件                                                                   |
| `nextclaw projects work artifact unlink` | 移除产物关联                                                                           |
| `nextclaw projects work state list`      | 列出项目的自定义工作状态                                                               |
| `nextclaw projects work state create`    | 创建工作状态                                                                           |
| `nextclaw projects work state update`    | 更新或重排工作状态                                                                     |
| `nextclaw projects work state delete`    | 删除状态并按需迁移现有工作项                                                           |
| `nextclaw sessions rename`               | 重命名会话                                                                             |
| `nextclaw sessions set-project`          | 把会话绑定到现有项目目录                                                               |
| `nextclaw sessions clear-project`        | 清除会话的显式项目绑定                                                                 |
| `nextclaw sessions delete`               | 永久删除会话；需 `--confirm <会话 ID>`                                                 |

所有 `projects work` 命令都必须显式传入 `--project <项目 ID>`，并通过正在运行的本地 NextClaw 服务执行。

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

| --------------------------------------- | ---------------------------------- |
| `nextclaw skills installed` | 列出当前运行环境已安装的 Skills |
| `nextclaw skills info` | 查看已安装 Skill 的详情 |
| `nextclaw skills install` | 从 NextClaw Marketplace 安装 Skill |
| `nextclaw skills publish` | 创建或发布 Marketplace Skill |
| `nextclaw skills update` | 更新已发布的 Marketplace Skill |
| `nextclaw marketplace skills search` | 搜索 Marketplace Skills |
| `nextclaw marketplace skills info` | 查看 Marketplace Skill 详情 |
| `nextclaw marketplace skills recommend` | 查看推荐 Skills |
| `nextclaw marketplace skills install` | 安装 Marketplace Skill |
| `nextclaw marketplace skills update` | 更新本地已安装的 Marketplace Skill |

## NextClaw Apps

| 命令                                       | 用途                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `nextclaw app create`                      | 创建可独立构建的 App；默认生成 Rust/WASI 模板                            |
| `nextclaw app doctor`                      | 检查 WASI Guest 构建环境并给出修复命令                                   |
| `nextclaw app build`                       | 构建 App 内的 Rust/WASI Service Components                               |
| `nextclaw app check`                       | 检查完整 App 包、Panel 或 Service 目录                                   |
| `nextclaw app test`                        | 在隔离 Runtime 中执行 App 的 Action 冒烟测试                             |
| `nextclaw app dev`                         | 从完整 App 包或 Service 目录启动真实 Runtime                             |
| `nextclaw app pack`                        | 打包 `.napp`；纯 WASI App 默认生成通用产物                               |
| `nextclaw app validate-publish`            | 在提交 Marketplace 前验证 App 和目标产物                                 |
| `nextclaw app publish`                     | 向 App Marketplace 提交 App                                              |
| `nextclaw app call`                        | 从完整 App 包或 Service 目录调用真实 Action                              |
| `nextclaw app restart`                     | 重启运行中 NextClaw UI 内的 Service App                                  |
| `nextclaw app data list`                   | 列出活动和保留的 App 数据实例                                            |
| `nextclaw app data delete`                 | 永久删除保留的 App 数据实例，需精确确认 App ID                           |
| `nextclaw app marketplace search`          | 搜索官方 App Marketplace 中的 App                                        |
| `nextclaw app marketplace info`            | 查看 Marketplace App 和派生安装命令                                      |
| `nextclaw app list`                        | 列出运行中 NextClaw 宿主已安装的 App                                     |
| `nextclaw app info`                        | 查看已安装 App 的状态和版本                                              |
| `nextclaw app invoke`                      | 通过运行中的宿主调用已启用且已安装 App 的 Action                         |
| `nextclaw app verification`                | 读取运行中宿主保存的脱敏 Runtime 验证记录                                |
| `nextclaw app acceptance contract`         | 读取稳定的 Portable Runtime 验收合同                                     |
| `nextclaw app acceptance status`           | 读取当前 Portable Runtime 验收状态与证据新鲜度                           |
| `nextclaw app acceptance export`           | 以 JSON 导出合同、当前 Runtime 身份和验收状态                            |
| `nextclaw app jobs list`                   | 列出一个已安装 App 实例的持久化 Job                                      |
| `nextclaw app jobs inspect`                | 查看一个持久化 App Job                                                   |
| `nextclaw app jobs watch`                  | 从可选序号游标重放保留的 Job 进度与输出                                  |
| `nextclaw app jobs cancel`                 | 请求取消 Job；在 Runtime 确认前仍保持等待状态                            |
| `nextclaw app resident-inbox list`         | 查看持久化 Resident 事件投递状态；可用 `--dead-letters` 仅查看可恢复失败 |
| `nextclaw app resident-inbox replay`       | 通过宿主拥有的收件箱重放一条死信 Resident 事件                           |
| `nextclaw app dependencies inspect`        | 查看外部能力/资源依赖、候选 Provider 和当前绑定                          |
| `nextclaw app dependencies verify`         | 验证当前依赖是否已满足                                                   |
| `nextclaw app dependencies setup`          | 仅在兼容 Provider 唯一时自动建立绑定                                     |
| `nextclaw app dependencies bind`           | 将一个依赖绑定到已安装且受信任的 Provider                                |
| `nextclaw app dependencies unbind`         | 移除一个依赖绑定                                                         |
| `nextclaw app secrets inspect`             | 查看声明的密钥槽位和非敏感 SecretRef 绑定                                |
| `nextclaw app secrets verify`              | 解析绑定但绝不返回密钥值                                                 |
| `nextclaw app secrets bind`                | 将声明的密钥槽位绑定到 env、file 或 exec Provider                        |
| `nextclaw app secrets unbind`              | 移除 App SecretRef 绑定及其活动密钥权限                                  |
| `nextclaw app permissions inspect`         | 查看声明的目录 scope、授权状态和实际访问模式                             |
| `nextclaw app permissions document grant`  | 授予或替换运行主机上的目录，可选择只读或读写                             |
| `nextclaw app permissions document revoke` | 撤销一个目录 scope，停止旧挂载并阻止后续访问                             |
| `nextclaw app ai-capabilities inspect`     | 查看声明的非敏感模型和 Agent 槽位及当前绑定                              |
| `nextclaw app ai-capabilities verify`      | 验证必填模型和 Agent 槽位是否就绪                                        |
| `nextclaw app ai-capabilities bind`        | 将声明的模型或 Agent 槽位绑定到已配置目标                                |
| `nextclaw app ai-capabilities unbind`      | 移除一个模型或 Agent 槽位绑定                                            |
| `nextclaw app operations`                  | 列出持久化的 App 生命周期操作                                            |
| `nextclaw app install`                     | 通过运行中的 NextClaw 宿主安装 Marketplace、本地目录或 `.napp` App       |
| `nextclaw app enable`                      | 启用已安装的 App                                                         |
| `nextclaw app disable`                     | 停用已安装的 App                                                         |
| `nextclaw app update`                      | 发起 App 后台更新                                                        |
| `nextclaw app rollback`                    | 回滚到一个已安装版本                                                     |
| `nextclaw app uninstall`                   | 发起卸载；清除数据需要精确确认 App ID                                    |

Service App 的使用方式见 [Service Apps](/zh/guide/service-apps)；WASM 开发命令与 Runtime 合同见 [开发 WASM Service App](/zh/developers/portable-service-apps)。

`app dev` 和 `app call` 直接接受 schema v2 App 根目录。包内只有一个 Service 时会自动选择；有多个 Service 时使用 `--component <service-id>`。本地 `.napp` 可以使用相对路径安装，例如 `nextclaw app install ./my-app.napp`。

`app invoke <app-id> <action-name> --input '<json>'` 调用的是已启用、已安装的 App，而不是源码包；输出会带上调用 ID、追踪 ID、数据版本和验证记录 ID。使用 `app verification [--acceptance <id>] [--app <id>] [--limit <n>]` 可查看对应的脱敏、持久化 Runtime 事实；脚本可加 `--json` 获取机器可读输出。

`app acceptance contract|status|export` 读取产品、Server、CLI 与发布门共同使用的唯一 Portable Runtime 验收合同。`status` 会用当前产品版本、Runtime 版本、runner 指纹与合同指纹重新判断证据；只有 `current-passed` 才代表证据仍然当前有效。`export` 始终输出完整的机器可读状态文档。英文展示使用 `--locale en`；只有检查非默认验收 App 时才传 `--app <id>`。

声明了密钥槽位的 App，可先用 `app secrets inspect <app-id>` 查看需要的配置；该命令不会返回密钥值。用 `app secrets bind <app-id> --slot <slot> --source env|file|exec --id <secret-id> [--provider <provider>]` 绑定已声明槽位，再运行 `app secrets verify <app-id>`。必填槽位未绑定或无法解析时，App 会显示为 `needs-configuration`，启用会返回 `SECRET_*` 错误码。`app secrets unbind` 会移除活动密钥权限；即使保留 App 数据，也绝不保留 Secret 绑定。

声明了目录 scope 的 App 不会在安装时自动获得文件权限。用 `app permissions inspect <app-id>` 查看状态；用 `app permissions document grant <app-id> --scope <scope-id> --path <directory> --mode read|read-write` 授予或替换运行主机目录；用 `app permissions document revoke <app-id> --scope <scope-id>` 撤销。实际模式不能超过 App 声明的上限，授权变化会立即淘汰旧的 Runtime 挂载。

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
