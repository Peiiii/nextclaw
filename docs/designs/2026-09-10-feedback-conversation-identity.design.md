# 通用私密讨论与反馈闭环设计（2026-09-10，Design）

## 结论

底层只建设一个私密论坛合同：`discussion thread → ordered post → verified actor → role-addressed event cursor`。它不知道反馈、审批、AI、Codex、项目或工作目录。

反馈是论坛之上的应用，拥有匿名回执、分类、审批、领取、修复状态和发布证明。管理员直接发起对话是论坛的第二个应用入口。代码监听器按游标读取面向参与角色的事件，并运行配置的参数数组；Codex Desktop 只是一个可替换的消费预设。

命名按边界固定：

- 通用 CLI：`nextclaw discussion ...` 与 `nextclaw discussion listen ...`。
- 反馈应用 CLI：`nextclaw feedback ...` 与 `nextclaw feedback workflow ...`。
- 平台直接创建的主题使用 `space=direct`，反馈投影使用 `space=support`。
- 通用协议、API 路由、状态目录和进程名不使用 `feedback` 或 `maintain`。

本功能尚无需要保护的外部消费者。实现采用一次性迁移并删除实验期旧入口，不建立兼容 wrapper、双写、旧状态复制或第二套 worker。

## 现状问题

旧支持链路把消息嵌在 `support_reports.document`，只有 `user | maintainer`，导致管理员和处理 Agent 显示为同一角色。管理平台已认证管理员，但 Gateway 转发时丢失管理员主体。本地监听器扫描完整反馈队列并理解审批状态，既浪费读取，也把通用触发与反馈业务耦合。

已有管理平台、反馈门户、D1、Gateway、NextClaw CLI 和 Codex App Server 都可以复用。缺少的底层能力只有：可验证参与者快照、有序帖子、角色定向事件游标，以及一个不解释业务的本地命令监听器。

## 核心合同

### DiscussionActor

```ts
type DiscussionActor = {
  id: string | null;
  kind: "human" | "agent" | "service" | "anonymous";
  displayName: string;
  roles: string[];
  authenticated: boolean;
};
```

客户端不能自报可信 actor。管理员 actor 由 Platform Gateway 在完成原管理员认证后签发；参与端 actor 由讨论服务根据专用凭据签发；匿名或登录用户 actor 由反馈入口根据回执和平台身份生成。帖子正文始终是不可信输入，身份字段才是服务端断言。

### Thread、Post 与 Event

Thread 保存 `id / space / title / openedBy / timestamps / lastEventCursor`。Post 保存全局幂等 ID、thread ID、序号、actor 快照、正文和时间。Event 保存单调 cursor、事件类型、thread/post ID、`audienceRole` 和时间。

`audienceRole` 是通用投递属性，讨论层只按字符串过滤，不解释角色含义。写入该事件的应用决定通知谁：

| 写入动作 | audienceRole |
| --- | --- |
| 用户提交或补充反馈 | `administrator` |
| 管理员批准当前反馈输入 | `participant` |
| 管理员创建 direct 主题或继续发帖 | `participant` |
| 参与端回复 | `administrator` |

这样审批门位于事件产生处。监听器看不到未面向自己的事件，也无需读取反馈状态。

## 数据所有权与事务

D1 的 `discussion_threads`、`discussion_posts`、`discussion_events` 是讨论事实源。`support_reports.document` 只保存反馈工作流状态；反馈详情读取时把 workflow 与 canonical discussion 投影为现有 SupportReport。

创建反馈、更新 workflow、写帖子和产生事件使用同一个 D1 batch。`requestId` 或 `operationId` 是幂等键，payload hash 不同则返回 409。workflow revision 条件与帖子/事件条件绑定；旧 revision 不会留下孤立帖子或错误通知。

迁移把旧反馈标题、描述和回复一次性写入 discussion 表，再从 workflow JSON 删除重复字段。无法证明来源的旧处理回复标为未认证历史主体，不伪造成管理员或 Agent。

## API 与权限

管理员继续通过 Platform Gateway：

- `/platform/admin/support`：反馈评审应用。
- `/platform/admin/discussions`：direct 主题列表、创建、详情和发帖。

讨论服务内部入口：

- `/api/discussions/admin`：管理员读写 `support | direct`。
- `/api/discussions/participant`：参与端读写 `support | direct`。
- `/api/discussions/participant/events?after=<cursor>`：只返回 `audienceRole=participant` 的事件。

反馈处理入口是 `/api/support/workflow`。管理员审批仍是 `/api/support/review`。参与凭据不能执行 review，管理员凭据不能伪装成参与端。当前只有一个参与凭据和固定参与 actor，不建设 registry、成员系统或动态 ACL。

## CLI 与能力索引

`nextclaw discussion list/events/get/post` 暴露最小对象级合同。`nextclaw feedback workflow list/get/claim/comment/result/triage/recover/authorize-delivery/publish` 只处理反馈应用状态。

随包 `discussion-participant/SKILL.md` 是消费端的按需索引。事件提示只提供本地 skill 路径、讨论 ID、游标和精确 CLI 前缀。AI 在被触发时读取 skill；无需在每个产品页面注入入口。`support` 主题由该 skill 路由到反馈 workflow，`direct` 主题只使用 discussion。

## 本地监听与消费端

```bash
nextclaw discussion listen configure --token-file <file> -- <executable> [args...]
nextclaw discussion listen start|status|stop|restart
```

监听器每次只读取游标后的角色事件，拉取对应主题，并直接 spawn 已保存 argv；不调用 shell。stdin 提供短提示，`NEXTCLAW_DISCUSSION_*` 提供事件元数据和 skill 路径。成功退出后才推进 journal cursor；失败按同一 event ID 退避重试。空闲轮询只运行普通代码，不产生模型调用。

通用配置只有 endpoint、tokenFile、intervalMs、timeoutMs 和 command argv。协议及监听器不保存 Agent 类型、会话 ID、项目或工作目录。

Codex Desktop 预设是监听器外的消费适配：配置助手把 workspace 编译进自己的 argv；适配器以 discussion ID 持久化 Codex task ID。首次事件调用 `thread/start` 并命名任务，后续事件调用 `thread/resume`。它把 skill 路径作为 App Server skill input 传入；Agent 先在原主题确认收到，之后可按实际进展回帖。

Codex 适配分成短握手进程和独立 runner。握手在 App Server 接受 turn、持久化 discussion/event 映射后立即成功，监听器据此推进事件；runner 脱离监听器继续等待 Agent 完成。这样一次长修复不会占住扫描循环，也不需要用“一小时超时”假装生命周期管理。握手失败仍保留原事件并按退避重试；已经被 Codex 接受的 turn 通过稳定 event ID 去重。

## 管理平台体验

原管理平台导航使用“讨论”，默认进入“用户反馈”。“直接对话”是并列视图，管理员只填标题和首帖即可创建主题；无需反馈、CLI 或另一个登录页。详情按真实 actor 显示管理员、匿名/登录用户与讨论 Agent，不从旧二元 role 猜身份。

反馈队列保留现有搜索、分页、状态筛选和独立发布批准。评审意见以管理员帖子写入同一 support 主题。direct 主题不展示反馈分类、回执、repair 或 deliver 状态。

## 不建设的内容

当前不增加公开 Roadmap 迁移、频道树、成员目录、关注/未读、全文搜索、附件、编辑删除、reaction、WebSocket、Webhook、Agent registry、动态 ACL、项目字段或工作目录字段。它们不阻断反馈闭环与管理员直接对话。

## 失败与恢复

| 场景 | 结果 |
| --- | --- |
| 未审批反馈 | 只有 administrator 事件，参与监听不可见。 |
| 新用户证据 | 旧审批失效并只通知管理员；重新批准后产生新 participant 事件。 |
| 管理员追问 | 相同 discussion ID 事件恢复原消费上下文。 |
| 参与端回帖 | 写为认证 participant actor，只通知管理员，不形成自触发循环。 |
| 重复或丢响应 | 相同 operation ID 与载荷返回原结果；不同载荷 409。 |
| 消费命令握手失败 | cursor 不前移，同一事件退避重试；`start` 首轮直接失败并清理后台进程。 |
| Codex 已接受但处理较久 | 监听器继续扫描；独立 runner 等待该 turn，Agent 自行回写进展。 |
| 监听器重启 | 从持久化 cursor 和消费端映射恢复。 |

## 验收标准

- 匿名/登录用户提交、管理员审批、参与端领取与回写、用户查看原反馈完整通过。
- 管理员在原平台直接创建主题；一个扫描周期内出现本地 Codex 任务，先收到 Agent 回执。
- 管理员追问恢复同一 Codex 任务；重启监听器后映射保持。
- 用户、管理员和讨论 Agent 的身份可辨认；客户端伪造管理员 actor 无效。
- 未审批反馈不进入 participant 事件流；重新输入必须重新审批。
- 空闲扫描不调用模型；监听器代码无 feedback、Codex、project 或 workspace 语义。
- D1 migration、本地 SQLite、HTTP/CLI、Gateway、双端 UI、监听 journal、Codex task 映射、tsc/build 和 diff review 均有有效证据。

## 交付顺序

这是一次合同切换：同一交付批次更新 shared contract、D1 migration、讨论/反馈服务、Gateway、管理端、NextClaw CLI、随包 skills 和文档。部署时先停止旧实验监听，部署数据库与服务，再部署 Gateway/管理端，最后发布并配置新 CLI。验收使用新状态目录 `discussion-listener`，不读取旧实验状态。
