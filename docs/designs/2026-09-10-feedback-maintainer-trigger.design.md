# 反馈维护命令触发闭环设计（已被通用讨论设计取代）

> 2026-09-10 起不再作为实现合同；当前设计见 [通用私密讨论与反馈闭环](./2026-09-10-feedback-conversation-identity.design.md)。本文仅保留实验演进背景。

## 结论

把现有“私有应用定时启动 Codex Exec”收敛为 `nextclaw feedback maintain` 下的本地常驻命令触发器。触发器只理解反馈事件、进程命令和退出状态；它不建立 Agent 类型、适配器注册表或模型调用协议。任意可执行文件都能作为消费者。Codex Desktop 是随 NextClaw 提供的推荐预设，位于通用触发器之外，使用同一进程合同。

`design-document: required`，因为本次改变公开 CLI、后台进程、持久化日志、跨进程协议、反馈状态消费方式和真实发布链路。

## 用户结果

维护者配置一次维护凭据文件和触发命令，运行：

```text
nextclaw feedback maintain start
```

命令立即扫描一次并在后台低成本轮询。管理员批准新反馈后，配置的命令收到一次事件；已进入维护会话的反馈收到用户补充后，同一反馈 ID 再次触发。空闲扫描不调用模型。使用 Codex Desktop 预设时，首次事件在桌面端 Tasks 中创建“反馈：[项目目录] <反馈标题>”任务，后续事件恢复同一个任务。下游处理器自行通过 `nextclaw feedback maintain get/claim/comment/result/...` 读取最新事实和回写，触发器不代写业务结论。

## 现状证据与缺口

- 平台已经拥有匿名/登录提交、回执访问、管理员审批、并发修订、运行代次、维护评论、验证结果和发布回写。
- `nextclaw feedback maintain` 已提供对象级读写命令和随包维护 skill。
- `apps/feedback-maintainer` 当前以仓库内 `pnpm ... <config.json>` 长命令启动，worker 写死 Codex Exec，只消费批准事件，没有公开的配置、start/status/stop/restart，也不能把用户后续消息送回稳定会话。
- worker 用普通代码轮询，所以空闲零模型调用这一基础成立；缺口在产品入口、通用进程合同、事件模型、会话映射及后台生命周期。
- Codex App Server 的稳定 JSONL/stdio 合同提供 `thread/start`、`thread/resume`、`thread/name/set` 和 `turn/start`；它可以在本地保存线程并追加 turn。WebSocket 仍是实验入口，本设计不采用。

## Owner 与单一主链路

### 平台

反馈平台继续拥有报告、审批、权限、revision、runId 和留言事实。首次处理必须由管理员批准。用户新留言会使原执行授权失效；若该反馈已经在本机进入过维护链路，留言仍可作为“继续沟通”事件唤醒同一消费者，但消费者重新 claim 或修复前必须等待当前 inputVersion 再次获批。

### NextClaw CLI 应用层

平台底层是带身份、状态、评论和管理员审批的 issue 论坛。它不认识 AI、Agent、会话、项目、工作目录或触发命令。

`packages/nextclaw` 的 feedback CLI 应用层拥有用户可安装的配置与本地后台进程，因为公开命令必须随 `nextclaw` NPM 包工作。它是论坛之外的维护者桥接器，不进入 kernel，也不把“反馈维护”提升为通用底层 Agent 能力。

触发器拥有：

- 配置校验与私有状态目录；
- 启动、状态、停止、重启；
- 代码轮询、事件派生、幂等 journal、每个反馈串行执行、重试退避；
- 以参数数组执行配置命令，并传入最小上下文。

`apps/feedback-maintainer` 保留发行批次核验职责，删除其 watcher、Codex runner 和重复进程执行 owner。这样发布编排与用户机器上的监听生命周期不会形成两个入口。

### 消费命令

消费命令拥有如何调度 Agent、脚本、队列或普通程序，以及是否把反馈 ID 映射到外部会话。Codex Desktop 预设拥有 Codex 线程映射；通用触发器不读写该映射。

## 最小进程合同

配置只保存可信的 argv 数组，执行时不经过 shell。触发器不配置、解释或传递项目与工作目录；命令若有目录需求，必须把它表达在自己的参数或脚本里。每个事件：

- stdin：一段短提示，只说明事件类型、反馈 ID、随包 skill 路径、当前安装的 CLI 参数前缀和“先用 CLI 读取最新内容”；不复制不可信反馈正文。
- `NEXTCLAW_FEEDBACK_ID`：稳定反馈/对话键。
- `NEXTCLAW_FEEDBACK_TITLE`：用于消费者展示和路由的当前反馈标题；仍是不可信数据，不得作为 shell 或操作指令解析。
- `NEXTCLAW_FEEDBACK_EVENT_ID`：本次事件的稳定幂等键。
- `NEXTCLAW_FEEDBACK_EVENT_KIND`：`approved`、`user-message` 或 `reapproved`。
- `NEXTCLAW_FEEDBACK_REVISION`：触发时观察到的平台 revision。
- `NEXTCLAW_FEEDBACK_ENDPOINT`、`NEXTCLAW_FEEDBACK_SKILL_PATH`：下游读取入口。
- `NEXTCLAW_FEEDBACK_STATE_DIRECTORY`：消费者可选的私有映射目录；通用脚本无需使用。

维护 token 只从配置的 token 文件读取并作为子进程环境传递；配置、日志、stdin 和 argv 不保存 token。下游退出码只表示本次命令是否成功接收/处理触发，不表示反馈已经修复或发布；业务完成只认平台状态。

不定义 stdout JSON、Agent 类型或回写代理。需要更复杂的调度时，维护者把它写进自己的命令或脚本，核心合同保持不变。

## 配置与生命周期

公开入口：

```text
nextclaw feedback maintain configure --token-file <path> -- <command> [args...]
nextclaw feedback maintain configure --workspace <path> --token-file <path> --preset codex-desktop
nextclaw feedback maintain start
nextclaw feedback maintain status
nextclaw feedback maintain stop
nextclaw feedback maintain restart
```

自定义命令不需要 `--workspace`：`nextclaw feedback maintain configure --token-file <path> -- <command> [args...]`。上面带 `--workspace` 的形式只适用于 `--preset codex-desktop` 这个一次性配置助手；助手立即把 workspace 编译成 Codex 专属命令参数，持久化后的通用配置仍只有 argv，不保存 preset 或 workspace。

`start` 也接受 configure 的字段，用于一次完成保存和启动；无已保存配置且缺少必需字段时明确失败并给出最短修复命令。默认 endpoint 为生产反馈平台，默认间隔 30 秒，单次消费命令默认最多运行 10 分钟。启动使用当前安装的 `nextclaw` launcher 创建脱离终端的后台进程，先完成一次 readiness/首轮扫描再报告成功。重复 start 幂等返回现有 PID；restart 只停止有状态文件所有权的进程；stop 不按名称杀其它进程。

状态位于 NextClaw 私有状态目录的 feedback-maintainer 子目录：配置、PID/启动标识、心跳、journal、日志和 Codex 映射分文件保存，POSIX 权限为目录 `0700`、文件 `0600`。状态检查同时验证 PID 对应命令和新鲜心跳，PID 复用不会误杀。异常退出后 start 清理已证实陈旧的状态并恢复 journal；进行中的事件回到可重试状态。

首版不增加 OS 登录自启动开关；它不是本次“运行 start 后进入稳定监听”结果所必需，也会引入 macOS/Linux/Windows 三套安装生命周期。后台进程不依赖终端，重启命令和状态恢复已覆盖当前真实使用。

## 事件与幂等

### 事件身份

- 首次/再次批准：`approval:<feedbackId>:<inputVersion>:<reviewedAt>`。
- 已进入过本地维护链路后的用户留言：`message:<feedbackId>:<messageId>`。

反馈 ID 是长期会话键；event ID 是投递幂等键；revision 是顺序和新鲜度；runId 只是一轮获批执行，不能充当外部会话 ID。

### 派生与处理

每轮分页读取维护队列：

1. 对当前 inputVersion 有有效 approval 的报告生成批准事件。
2. journal 已记录该反馈曾成功启动后，只为未见过的 `role=user` 留言生成用户消息事件；维护者自己的评论永不触发。
3. 同一反馈同时只执行一个事件；执行期间到达的多个消息在当前命令结束后按事件 ID 继续投递，消费者每次都读取最新报告，因此不会使用旧正文。
4. 写入 `launching` 后启动命令；启动失败或非零退出进入带错误摘要的可重试状态，指数退避封顶，不阻塞其它反馈。成功记为 `delivered`。
5. 进程中断时 `launching` 视为未知结果：使用相同 event ID 重试。消费者据 event ID 自行实现外部副作用幂等；Codex 预设在本地映射和线程事件状态上去重。

轮询本身不运行模型；有事件才启动消费命令。首轮扫描立即执行，非空处理完成后立即再扫，空闲才等待 interval。

## Codex Desktop 推荐预设

预设是 NextClaw feedback CLI 中独立的消费实现，不进入通用 worker：

1. 配置助手把 `--workspace` 写入隐藏的 Codex 消费命令 argv。通用 worker 只执行该 argv，不知道参数含义。Codex 消费命令为每次事件启动 `codex app-server --stdio`，完成 `initialize`/`initialized`；以 `workspace-write` sandbox 和 `never` approval policy 创建任务。平台管理员批准与维护 skill 继续约束可执行的业务动作，workspace 之外的权限不由预设扩大。
2. Codex 消费命令以反馈 ID 查询私有映射。没有映射时使用自己的 workspace 参数调用 `thread/start`，以经过控制字符清理和长度限制的“反馈：[项目目录] <标题>”设置任务名并保存 thread ID；已有映射时调用 `thread/resume`。实机与[官方 App Server 协议](https://learn.chatgpt.com/docs/app-server)均证明 `thread/start` 只有 cwd、没有 Desktop project ID 输入，当前任务显示在 Codex Desktop 的 Tasks 中。Codex 消费命令在标题中提供项目索引，不写 Codex 私有数据库；需要原生项目分组的宿主仍可通过自己的命令接入。
3. 通过 `turn/start` 发送维护提示，提示只带反馈/事件标识、CLI 入口和 skill 路径。Codex 自行读取最新报告、判断授权并回写。
4. 等待该 turn 的完成/失败事件后退出，保证直接 App Server 不会在任务完成前被关闭；超出通用命令 timeout 时由 worker 中止并按相同 event ID 重试。相同事件重试时先查映射中的最近 event 状态，避免重复 turn；线程不存在或损坏时明确记录原因并创建替代线程，同时原子更新映射。
5. 同一反馈的命令执行由 worker 串行，因此不会向同一线程并发追加 turn。其它反馈可按 worker 的全局单并发首版顺序处理，避免桌面端任务风暴。

预设依赖本机已安装并认证的 Codex Desktop/CLI；缺失、未认证或 App Server 不可用时事件执行明确失败并写入 status，不静默退化为 `codex exec` 后台任务。实机证据表明桌面随附 CLI 没有运行 control socket，而 `app-server daemon start` 要求额外 standalone 安装，因此默认链路不能依赖 proxy/daemon。直接 stdio App Server 产生同一份持久 thread，桌面端可见；首版按事件串行等待一轮完成，任意自定义命令仍可自行异步派发。

## 状态与恢复矩阵

| 场景                 | 可观察结果                                      | 恢复                                             |
| -------------------- | ----------------------------------------------- | ------------------------------------------------ |
| 无配置 start         | 非零退出并给出 configure 最短命令               | 配置后重试                                       |
| 首次 start           | 立即扫描、后台 PID 与新鲜心跳可见               | 重复 start 返回同一实例                          |
| 空闲                 | 仅 HTTP 轮询，无消费进程/模型调用               | 新事件在下一周期触发                             |
| 管理员批准           | 生成唯一 approval 事件                          | 失败按 event ID 退避重试                         |
| 用户补充             | 已激活反馈生成 message 事件，原修复授权仍失效   | 同一消费者会话继续；需新审批才能 repair          |
| 管理员撤销/用户撤回  | 不生成新的批准事件；消费端 CLI 写操作被平台拒绝 | 重新审批或新反馈                                 |
| 维护者评论           | 不触发                                          | 无                                               |
| worker 崩溃/机器睡眠 | 心跳过期；journal 保留                          | restart/start 恢复，未知投递按相同 event ID 重试 |
| trigger 非零退出     | status 展示最近错误，不把 ticket 标成已完成     | 自动退避；修复命令后 restart                     |
| trigger 领取后超时   | working 报告与未完成 journal 事件继续匹配       | 仍按原 event ID 恢复同一消费者会话               |
| Codex thread 丢失    | 记录丢失原因并创建替代线程                      | 映射原子更新，反馈 ID 不变                       |
| stop                 | 只终止本实例，等待/终止当前子进程并保存状态     | start 继续未完成事件                             |

## 候选与取舍

1. **Agent registry + 多种内置 adapter**：能显式认识 Codex、其它 Agent，但创建无真实消费者的类型体系、配置 UI 和兼容面；不采用。
2. **把 watcher 做成 Resident Service App**：复用已有应用生命周期，但当前 resident runtime 是 WASI，强迫 Node watcher 跨 runtime 重写且反馈语义仍需 CLI 外壳；不采用。
3. **公开 CLI 的通用命令触发器 + 可选 Codex 消费预设**：完整覆盖当前用户链路，保留任意命令扩展能力，只有一个轮询和进程 owner；采用。

保留平台审批和对象级 CLI；删除私有 app 中重复 watcher/Codex Exec。延后没有当前消费者的 Agent 注册表、webhook 平台事件总线、并发调度和 OS 开机自启。

## 验收与交付

AI 必须完成：

- CLI 配置/start/status/stop/restart 的安装后真实运行；
- 自定义无 AI 命令收到准确 env/stdin，空闲不执行；
- 批准门、事件去重、失败恢复、用户消息继续、维护者消息过滤；
- Codex Desktop 首次创建带项目目录索引的真实可见任务，同一反馈补充后恢复同一 thread；
- Codex 使用随包 skill 和公共 CLI 读取/回写，平台原反馈出现维护回复或结果；
- TypeScript、定向测试、维护性 Review、打包内容、NPM 安装、生产平台和发布后 smoke；
- 中英文用户文档、CLI 能力全集、`docs/USAGE.md`、随包 USAGE 与维护 skill 索引同步；
- 发布后逐项核对 active acceptance ledger 和所有原始需求。

用户验收只需：在管理平台批准一条反馈，然后在 Codex Desktop 看到以“反馈：[项目目录]”开头的新任务；在原反馈补充消息后看到同一任务出现新 turn，并在反馈页看到维护者回写。AI 交付时提供这条已验证链路、入口、版本和证据，不要求用户打开终端排障。

`plan: required`，实现依次跨公开 CLI 后台生命周期、事件引擎、Codex App Server、旧路径删除、平台真实验收和稳定发布，需可恢复的跨批执行账本。
