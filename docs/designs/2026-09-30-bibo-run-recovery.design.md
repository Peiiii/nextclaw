# Bibo 后台运行与页面恢复

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

- 后端完整回归 135/135：新增组装真实 Worker→Harness→Cloudflare storage adapter 的断流恢复测试，task.create 副作用只出现一次；刷新订阅相同 runId、并发拒绝、结束后实例重启读取、账户隔离、中断识别均通过。
- SDK 18/18、连接恢复 owner 3/3：snapshot/heartbeat 解析、无接收确认恢复、旧回答不能冒充新回答、未知网络不能冒充 idle。
- Worker/client/scripts 与 SDK tsc 通过；Vite 构建通过。
- 真实 Chromium 桌面 1360×900、手机模拟 390×844：无 sessionStorage 新页恢复、刷新、网络中断/online、结果回读、失败原因展示、刷新后停止均通过；没有自动重发 POST；每个场景 5 次只读订阅。提问交互原回归通过。
- 云端控制任务证明 92 秒运行在页面完全断开时仍能完成，非实际模型或 OS 工具耗时测试；真实 Harness 工具副作用证据由上述组装测试提供。不把控制任务冒充用户账号或 iPhone 实机。
- diff maintainability 与定向 lint 通过（测试文件和 chat store 接近文件预算，保留 owner 单一，不为压行打散状态）。
- 用户账号最近对话归属尚未确认，等待邮箱/故障链接；本次已确认通用根因，不声称已读取该用户最新私有对话。

### 上线复验

待写入最终生产身份、首字/恢复时间与主线同步结果。旧大型交付 BE-03/BE-12 的网络恢复结论仅覆盖“真实终态后恢复”，本次发现运行中移动恢复缺口；完成此处 RR-01～RR-07 后才补上该范围。
