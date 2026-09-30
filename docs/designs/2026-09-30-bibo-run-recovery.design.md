# Bibo 后台运行与页面恢复

2026-10-01 前端职责修订：后台服务主链路继续复用本文；页面刷新误报中断的根因、唯一业务状态 manager、只读 API 和新的端到端验证见[会话状态职责设计](2026-10-01-bibo-conversation-state.design.md)。旧前端 recovery store 已删除。本地请求凭据不能推断任务失败，先查询服务端；本文交付记录保留历史时间点，不作为当前前端文件结构。

## 来源与结果

2026-09-30 用户报告：手机切后台后不回复、刷新看不到正在运行、重复发送报错、返回出现网络错误。补充明确：页面断流不得取消生成，Agent 应在后台运行。范围为 Bibo 修复并上线，不发布 NextClaw 包；保留公共 Harness 唯一执行链。

已确认：`bibo-hosted.app.ts` 的 SSE cancel 调用 AbortController.abort；前端 bootstrap/recoverRun 只读历史，没有服务器运行状态；执行总时间固定 85 秒。线上日志存在首字约 2 秒、多个 exec 累计 75 秒之后在 85 秒终止且误记 RUN_CANCELLED 的请求。账号归属尚待用户提供链接/邮箱，不能把这些样本断言为用户会话。

## 结构与 API

复用现有用户 Durable Object、Cloudflare 持久存储和 NextclawHarness。新增 BiboRunService 是唯一的托管任务生命周期 owner，承担准入、账户内会话互斥、状态、订阅、取消、结束；不执行模型、工具或创建第二套 Agent。删除 app 中分散的 activeRuns/activeSessions 和流内执行逻辑。

```ts
type BiboRunSnapshot = {
  runId: string; sessionId: string; message: string;
  phase: 'generating' | 'saving' | 'completed' | 'failed';
  startedAt: number; updatedAt: number;
  partial: string; activity?: string;
  error?: { code: string; message: string };
};
// 均由当前登录账号的 DO 提供，不接受用户编号选取其他账号。
// GET /api/runs?sessionId=... -> {run: snapshot | null, activeRuns: snapshot[]}
// GET /api/runs/:runId/events -> SSE
// POST /api/chat -> 准入后 SSE，与 GET 订阅同一 owner。
// POST /api/cancel -> 只有此明确操作才中止执行。
```

订阅首先发送 snapshot（完整当前 partial，客户端替换而非追加），之后 delta/activity/saving/committed/error。关闭订阅只解除观察者；任务 Promise 始终交给 DO waitUntil。每个连接有心跳，前端读取超时主动重新连接，避免半开连接无限卡住。只重试只读恢复，绝不自动重发 chat/tool。终态后 GET 订阅通过原 history 返回 committed，不另存一份历史。

持久化每会话最新小型运行记录（初始用户输入、运行编号、状态、时间、错误）；partial 仅活跃实例内保留，已完成内容归现有 Harness journal/session。实例意外重启后加载时把失去执行器的任务明确终结为 RUN_INTERRUPTED；不会假装永久忙，也不自动重放可能已经产生副作用的工具。恢复初始化负责此协调，不把状态查询变成隐式写入。

普通聊天和后台任务都走同一 Harness。当前任务上限设为 10 分钟，低于官方 DO waitUntil 15 分钟保障窗口；工具/model 原有超时继续适用。取消、10 分钟超时、实例中断、模型错误分开显示。此处不承诺无限后台 daemon；需要超过该窗口的任务，应另行采用持久任务执行机制并建立工具幂等/断点合同，不能靠无限 Promise 保证。候选 Workflow 现在无法无损恢复非幂等的现有 Harness/tool 循环，加入它不解决当前重放风险，故不在此修复中盲加。

前端 Zustand 仍是唯一展示 owner；bootstrap、pageshow、visibilitychange(visible)、online 触发去重的 reconcile。发现活跃任务则恢复输入/partial/阶段、禁用重复发送、支持停止；终态读正式历史。网络不可达显示“连接中断，正在恢复”，保留未确认的 busy，不声称 AI 已停止。只读订阅采用有上限间隔的重连退避，隐藏/离线暂停重连，返回立即恢复。顶部显示可进入正在工作的会话的状态入口，当前会话下方显示工作/连接状态；idle 明确可见。服务器仍支持不同会话并发，网页按当前已有单运行展示模型不增加多任务管理界面。

## 必须通过的可观察验收

| ID | 场景与判定 |
| --- | --- |
| RR-01 | 已 accepted 后主动取消流；后台继续，恢复同 runId，工具副作用仅一次，正式回答保存 |
| RR-02 | 工作中刷新/新标签页，无 sessionStorage 也能看见工作和 partial、不能重复发送、可停止 |
| RR-03 | 手机尺寸切后台/离线/返回，连接恢复，完整回答无 delta 重复；未知状态不冒充空闲 |
| RR-04 | 任务超过 85 秒能完成；显式停止、超时及失败各自准确，错误可见；实例丢失不永久 busy |
| RR-05 | 完成后再刷新仍有正式历史；不同账户不能查询/订阅/停止他人的任务 |
| RR-06 | 纯聊天仍不启动 Sandbox；记录至少 5 次首字耗时和状态恢复耗时，新增状态操作不阻塞首字秒级目标 |
| RR-07 | Worker/client/scripts tsc、Vite、协议/生命周期定向回归、真实浏览器桌面/手机链路及线上复验 |

真实手机硬件不可用时必须注明：浏览器窄屏、网络离线与页面重建证据不能冒充 iPhone 实机。

## 方案 Review

2026-09-30 mode=design：核对用户原始场景和反例（断流、接收 accepted 前丢连接、终态与刷新竞态、实例重启、取消与保存竞态、跨账户订阅、部分副作用已生效）。不变量为：执行生命周期独立于连接；保存后才能 committed；未知网络状态不得允许盲重发；不自动重放工具。公共 SDK snapshot variant 须同步 producer、parser、SSE、client、store、UI、测试；NPM 不发布。以上范围 design-review: passed。后台无限运行不在当前执行机制保证内，明确 10 分钟边界，不能使用“长期”掩盖限额。

## 交付证据

### 现场失败与设计补充

仅使用 DO waitUntil 的隔离 Cloudflare 运行仍在无连接时丢失执行器，恢复返回 RUN_INTERRUPTED。官方 workerd 的 `durable_object_io_tasks_prevent_eviction` 是显式 opt-in，没有默认启用日期；生产 wrangler 原来只有 nodejs_compat。启用该开关后，同一生命周期 owner 与 Cloudflare 控制任务在无订阅 94 秒后恢复成功，总耗时 104502ms，操作计数始终为 1。明确停止和 RUN_TIMEOUT 原因也分别通过。隔离 Worker 版本：9320f8c0-aa04-4fd0-8a07-03e1da8d9b76。

来源：[DO waitUntil](https://developers.cloudflare.com/durable-objects/api/state/)、[官方兼容开关定义](https://github.com/cloudflare/workerd/blob/main/src/workerd/io/compatibility-date.capnp)。开启是部署合同，不能只检查源码有 waitUntil。该反例改变了原方案“只调用 waitUntil 已足够”的前提，补充后的设计 Review 核对配置传播与无订阅真实运行，passed。

请求编号也进入 snapshot：接收确认丢失后，用 clientRequestId 区分当前发送与以前的回答，不自动重发，不能把上一轮完成记录当成本轮成功。

### 发布前证据

- 集成后完整回归 141/141（含 3 项连接恢复测试）：新增组装真实 Worker→Harness→Cloudflare storage adapter 的断流恢复测试，task.create 副作用只出现一次；刷新订阅相同 runId、并发拒绝、结束后实例重启读取、账户隔离、中断识别均通过。部署配置回归锁定官方防回收开关，防止只保留 waitUntil 却漏掉平台前提。
- SDK 18/18、连接恢复 owner 3/3：snapshot/heartbeat 解析、无接收确认恢复、旧回答不能冒充新回答、未知网络不能冒充 idle。
- Worker/client/scripts 与 SDK tsc 通过；Vite 构建通过。
- 真实 Chromium 桌面 1360×900、手机模拟 390×844：无 sessionStorage 新页恢复、刷新、网络中断/online、结果回读、失败原因展示、刷新后停止均通过；没有自动重发 POST；每个场景 5 次只读订阅。提问交互原回归通过。
- 云端控制任务证明 92 秒运行在页面完全断开时仍能完成，非实际模型或 OS 工具耗时测试；真实 Harness 工具副作用证据由上述组装测试提供。不把控制任务冒充用户账号或 iPhone 实机。
- diff maintainability 与定向 lint 通过（测试文件和 chat store 接近文件预算，保留 owner 单一，不为压行打散状态）。
- 用户账号最近对话归属尚未确认，等待邮箱/故障链接；本次已确认通用根因，不声称已读取该用户最新私有对话。

### 上线复验

源码 `ff985b814` 从干净冻结远程 master 发布；生产 Worker `2bf0e569-98a1-41d8-8746-217076ac5461`，Deployment `c06db9b8-b2bc-4946-aadd-13867b9da07c`，100% 流量。API 读取实际版本确认 nodejs_compat 和 durable_object_io_tasks_prevent_eviction 均生效。上传 16.96 秒、切换 3.40 秒，无镜像构建，继续使用官方 Sandbox 0.12.10。后续新增仅为测试和证据，不改变已部署业务产物。

| ID | 状态 | 当前证据与边界 |
| --- | --- | --- |
| RR-01 | passed | 真实模型 run `2587d519-e40a-4a12-84b5-c3881d9076ed` 接收后关闭原流，后续恢复相同 ID 与 committed，正式历史恰好两条。服务端日志只有预期的三次 exec（两次等待写入、一次读取），耗时 50196/45169/189ms；副作用不自动重放由组装 Harness 测试及云端计数控制任务证明。 |
| RR-02 | passed | 生产新页面与刷新均恢复正在执行的 run、停止按钮和忙状态，不依赖 sessionStorage；刷新后停止同一任务，终态 RUN_CANCELLED。 |
| RR-03 | passed | 生产 Chromium 手机模拟 390×844：刷新、实际网络离线、online 恢复，恢复到可停止 787ms，4 次只读订阅、0 自动 chat POST；未知状态没有发送入口。无 iPhone 实机证据。 |
| RR-04 | passed | 上述真实模型/OS 任务服务端实际总时长 104560ms 并保存成功，超过原 85 秒阈值。独立云端控制任务在无订阅 94 秒时仍完成；明确停止与 timeout reason 控制测试、初始化识别 RUN_INTERRUPTED 均通过。没有把客户端最终回读的总等待时间当执行耗时。 |
| RR-05 | passed | 生产已保存回答再次读 history 与 committed 一致；本地组装跨账号查询 404、取消 409。终态结果按 committedMessageCount 截止，避免读到后来另一轮回答。 |
| RR-06 | passed | 上海客户端经本机代理、默认模型、一个新会话加四次续聊：首字 3160/2345/1912/2025/1875ms，中位数 2025ms、最大 3160ms。日志逐条证实 Sandbox 获取 0/0/0/0/0，服务端首字 2465/1697/1225/1364/1236ms。仅 5 次描述样本，不能当长期 p95/p99 保证。 |
| RR-07 | passed | Worker/client/scripts 与 SDK tsc、Vite、141 项应用/恢复回归、18 项 SDK 回归、桌面/手机恢复与原提问 UI 回归通过。diff maintainability 无错误；集成后 chat store 402 行的预算警告保留，未为压行拆散状态 owner。implementation-review: passed。 |

验收账号为专用 synthetic smoke account；它此前用完 250 次 UTC 日模型限额，已通过既有管理入口仅清零该测试账号计数，总用量保留。测试脚本第一次收到 snapshot 后主动 abort，客户端迭代器按预期抛 AbortError；没有重发这次已接收任务，而是查询并恢复原 ID。API 查询发生于原任务执行第约 83 秒，随后 96 秒完全无请求；最终 104560ms 的执行耗时取自服务端日志。严格“执行全程无订阅”的证据来自前述云端控制任务与原流关闭后的真实 exec 阶段，不把所有客户端等待都当后台工作时间。

旧大型交付 BE-03/BE-12 的网络恢复结论原本仅覆盖“真实终态后恢复”。此处补足运行中恢复与断流不取消的明确合同，不改变旧整体合同其它未通过项的状态。上线入口：[Bibo](https://app.bibo.bot/)；刷新后可观察“工作中／工具执行／保存中／连接恢复／空闲”，只有明确停止才取消生成。当前单次 10 分钟上限继续适用。

## 复盘决定

`retrospective_decision=updated-original-owner`：在此设计与应用 README 明确订阅和执行的生命周期边界、官方开关及 10 分钟保障范围；既有应用回归增加部署开关测试，恢复 smoke 纳入 package 命令，旧验收账本补充实际运行中证据。高影响反例是“局部删除 cancel 不足以保证真实后台运行”，纠正点是验证平台配置、真实无连接存活和 UI 重新获取状态三者共同成立。没有新增全局提示词规则，也没有用测试夹具代替现网证明。
