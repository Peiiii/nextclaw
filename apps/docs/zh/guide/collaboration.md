# 在 Issue 中与本地 Agent 协作

GitHub Issue、Linear Issue 可以成为本地 Codex 的对话入口。首次邀请建立任务绑定，以后的留言继续同一个任务；原 Issue 会显示已接收、已开始和完成状态。无需另建服务端或重新填写平台凭据，优先复用本机 `gh` 或 `linear` CLI 登录。

## 连接一次

需要 Node.js 22.13+、本地 Codex，以及已登录且有目标项目读写权限的 GitHub CLI 或 schpet Linear CLI。NextClaw 用户运行：

```sh
nextclaw collaboration connect github --adapter github --repository OWNER/REPO --workspace /absolute/project
nextclaw collaboration connect linear --adapter linear --team TEAM --workspace /absolute/project
nextclaw collaboration check
nextclaw collaboration start
```

只接一种平台时只执行对应的 connect。独立使用可以安装 `npm install -g @nextclaw/collaboration`，把上述 `nextclaw collaboration` 换成 `nextclaw-collaboration`。平台 CLI 不在 PATH 时用 `--executable /absolute/cli` 指定；工作目录是 Agent 获准工作的项目目录。

默认仅接受当前登录账号的输入。连接时用 `--allow account1,account2` 授权其他参与者；GitHub 填 login，Linear 填用户 UUID。平台账号变化会停止消费并显示错误，不会悄悄更换身份。

## 优先验收这三条

1. **新增并唤醒**：在已连接项目中新建 Issue，写“请记住暗号 BLUE-47，只回复已记住”，加上 `agent:mozhao` 标签（首次需在平台创建标签）。电脑在线、宿主运行时，通常一个 30 秒轮询周期内开始接收；原 Issue 出现状态回执和 Codex 任务 ID，执行开始时显示“已开始处理”，随后收到回复。网络和排队会延长等待，用本地 `status` 查看原因。
2. **继续同一任务**：在原 Issue 留言“刚才的暗号是什么？”应得到 BLUE-47，回执中的 Codex 任务 ID 不变。GitHub 和 Linear 均可按此验证。没有必要回复的消息可以安静处理，回执会说明结果。
3. **暂停再恢复**：单独留言 `/agent pause`，看到暂停后再留言一个问题；不会立即执行。再单独留言 `/agent resume`，待处理问题在原任务中继续。`/agent cancel` 请求取消当前执行并暂停后续跟进，`/agent status` 查询状态。

标签是首次邀请开关；已参与的 Issue 不需要每条留言再次邀请。旧 Issue 可用 `follow CONNECTION SUBJECT` 显式邀请（GitHub 填 Issue 编号，Linear 填 UUID）。关闭 Issue 会暂停，重开只解除由关闭造成的暂停，不解除用户主动暂停。

## 本地运行与排错

```sh
nextclaw collaboration status
nextclaw collaboration show CONTEXT_KEY
nextclaw collaboration restart
nextclaw collaboration stop
```

本机休眠、关机或离线时不能处理；恢复并启动后从本地游标继续。`start` 是后台进程，不自动安装开机服务；需要自启动时让现有系统服务管理器运行 `run`。状态保存在 `~/.nextclaw/collaboration`，其中含私钥及任务输入；不要在运行时删除。启动时压缩 30 天前已处理的正文，保留绑定和小型去重记录。

执行接受状态未知时先 `reconcile CONTEXT_KEY` 查询；不会盲目重做。发送结果未知时检查原平台，再按 `resolve-output --help` 恢复。`retry-run --confirm-safe` 是确认历史副作用后才使用的显式重试。旧官方讨论监听停止后可用 `migrate-discussion --workspace /absolute/project` 导入原游标和 Codex 绑定。

## 同账号的多个 Agent 与新平台

Agent 使用独立签名身份，与平台账号分开。通过 `trust CONNECTION PUBLIC_IDENTITY_FILE --account ACCOUNT` 信任对方公钥，同账号 Agent 也能对话；自己的回写、状态和未验证身份不会触发。只有额外授予 `--controls` 的 Agent 能执行控制指令。默认限制四跳、每主题每小时十二次执行、全局两项并发，触限暂停。

第三方平台实现公开 `SourceAdapter`，安装模块、连接现有认证后即可使用同一条链路；普通命令也可作为 Consumer。无需新增平台管理系统。完整合同和非 Issue 示例见 [SDK 协议说明](https://github.com/Peiiii/nextclaw/tree/master/packages/nextclaw-collaboration/protocol)。可选协议事件入口接收经过认证和标准化的事件，默认轮询无需 webhook 服务。
