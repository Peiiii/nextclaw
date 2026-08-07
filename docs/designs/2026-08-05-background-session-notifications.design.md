# 后台会话完成提醒与全局站内通知设计

## 背景

用户在会话 A 等待 AI 回复时，可能已经切换到会话 B 或其它页面。当前回复虽然会继续完成并写入会话，但用户只能靠侧边栏状态或主动返回发现结果。参考 ChatGPT 的右上角通知，本次增加一张可点击的站内通知卡：显示会话名称和回复摘要，点击后回到对应会话。

这项能力增强 NextClaw 作为统一工作台的连续性：用户可以同时推进多个任务，不必反复巡检每个会话。

## 现状依据

- AI 最终回复由 NCP `message.completed` 表达，payload 已包含 `sessionId`、完整 `message` 和稳定 `message.id`。
- `ServiceGatewayManager` 将 UI 的 `appEventBus` 直接指向 `kernel.eventBus`；UI Server 再通过 `/ws` 向已认证 UI 推送 `ncp.event`。因此后台会话完成事件已经存在于全局实时主链路，无需轮询或新事件。
- Chat 路由使用 `buildSessionPath` / `parseSessionKeyFromRoute` 维护会话身份，可作为通知跳转和“当前会话不提醒”的唯一判断依据。
- 应用已经全局挂载 Sonner。现有成功/失败 toast 与本次通知可以共用同一 portal、队列、堆叠、自动关闭和无障碍基础设施。

## 核心判断

推荐“通用通知展示 owner + Chat 完成提醒 owner + 现有 Sonner 生命周期”的三段结构：

1. `AppNotificationManager` 只负责把稳定的数据合同交给全局通知表面，统一 ID、展示时长和关闭行为。
2. `ChatCompletionNotificationManager` 只负责订阅既有 `ncp.event`，识别后台会话的 assistant final reply，并构造会话标题、回复摘要和目标路由。
3. `AppNotificationToast` 是纯展示组件，复刻参考图的右上角圆角卡片、品牌图标、标题/摘要层级和轻阴影；有目标路由时使用真实 `Link`。

没有采用以下方案：

- 在 Chat 页面直接调用 `toast`：改动最小，但页面卸载后失效，业务判定散落在 hook，无法成为全局机制。
- 自建 Zustand 通知队列和 viewport：可完全控制生命周期，但与现有 Sonner 形成平行通知系统，增加定时器、堆叠、手势和可访问性维护成本。
- 新增后端“会话完成通知”事件：`message.completed` 已经是准确事实，新增派生事件会制造双链路和重复去重责任。

## Owner 与数据流

```text
kernel EventBus: ncp.event(message.completed)
  -> UI /ws + nextclawClient.eventBus
  -> ChatCompletionNotificationManager
       - assistant + final + visible
       - sessionId !== activeSessionId
       - 从现有 session query 快照读取会话名称
       - 从 message.parts 提取纯文本短摘要
  -> AppNotificationManager.show({ id, title, description, href })
  -> Sonner global toaster
  -> AppNotificationToast
  -> 点击正文：dismiss 后进入目标会话
  -> 点击关闭：仅 dismiss 当前通知
```

状态与不变量：

- 当前会话 ID 由 Chat 页面进入/离开时同步给 `ChatCompletionNotificationManager`；通知 manager 不解析路由，也不复制路由状态。
- 通知 ID 使用 `chat-reply:${message.id}`；Chat owner 额外保留有界的最近已处理消息 ID 集合。当前会话完成的消息也会记入集合，离开会话后即使终态事件重放也不会补弹旧提醒，同时集合不会无限增长。
- 回复摘要是面向通知表面的纯文本投影：去除标题、列表、引用、强调、代码围栏、链接地址和表格分隔符等 Markdown 展示语法，保留可读正文，再折叠空白并按 Unicode 字符截断到 120 字。通知不引入第二套 Markdown renderer，也不修改会话里的原始消息。
- 通知不持久化。刷新后以会话消息和未读状态为事实，不恢复过期弹窗。
- manager 在 App 受保护区域挂载时 `start`，卸载时 `stop`；订阅清理统一归 manager。

## 交互与视觉

- 位置：复用全局 `top-right` toaster；参考图按 Retina 比例还原为约 320px 宽、74px 高，桌面顶部留 44px，移动端右侧留 16px。NextClaw 桌面端右侧额外避让 Side Dock，这是相对参考图唯一显著的布局适配。
- 结构：左侧 24px NextClaw 图标容器，卡片水平 inset 18px、图文间距 12px；右侧一行加粗会话名和一行低对比回复摘要，长内容使用省略号，保持参考图的固定紧凑高度。
- 视觉：20px 圆角、低对比边框、实体主题背景，以及约 18px 落幅的克制双层阴影；不使用大面积 blur、透明材质或 hover 上浮，避免比参考图更厚重。
- 操作：正文区域是内部路由链接，点击时关闭当前通知并打开目标会话；右上角始终展示独立关闭按钮，仅移除当前通知，不触发跳转或改变会话状态。两个操作都是同级语义控件，键盘可分别聚焦，保留 `focus-visible`，不主动抢焦点。
- 生命周期：默认展示 8 秒；多条通知由 Sonner 堆叠；相同消息 ID 去重。
- 当前会话完成回复时不弹窗，避免重复反馈；用户在其它会话或其它页面时弹窗。

## 目录组织

`packages/nextclaw-ui` 已采用前端 `app-l3` 协议。本次新增稳定并列 feature：

```text
src/features/notifications/
├── index.ts
├── components/
│   └── app-notification-toast.tsx
└── managers/
    └── app-notification.manager.ts
```

Chat 事件到通知的业务映射仍留在 `features/chat/managers/`；应用级启动/停止放在 `app/components/`。`notifications` 不读取 Chat store、NCP 协议或路由业务，因而未来系统状态、下载完成、定时任务等来源可以复用同一个展示 owner。

## 兼容与迁移

- 保留现有 `toast.success/error`，它们是即时操作反馈；本次新增的是可导航的全局活动通知表面，两者共用 Sonner，不迁移无关调用方。
- 不新增 fallback、旧字段兼容或第二条事件通道。
- Markdown 清洗只发生在通知摘要的只读投影中；原消息仍由会话 renderer 按原合同展示。对清洗后缺少可展示文字的合法 assistant final reply，使用 i18n 通用摘要；空 session ID、隐藏消息、非 assistant、非 final 或当前会话事件直接忽略。

## 验收标准

- manager 单测覆盖：后台 assistant final 弹出、Markdown 摘要转为可读纯文本、当前会话及其后续重放不弹、非 assistant/非 final/隐藏消息不弹、重复消息 ID 去重、start/stop 幂等。
- 组件测试覆盖：真实 link 语义、标题与两行摘要、正文点击跳转、独立关闭不跳转、无路由通知保持非链接状态但仍可关闭。
- App/页面连接测试覆盖：全局 runtime 启停订阅；Chat 路由切换同步 active session，卸载时清空。
- TypeScript `tsc`、定向 ESLint、相关 Vitest、Vite build、new-code governance 与 maintainability 检查通过。
- 真实浏览器在正常桌面、窄桌面和移动宽度下触发通知并截图，验证位置、宽度、文字截断、点击跳转、焦点语义和主题对比度。

## 非目标

- 不实现浏览器/操作系统原生通知和权限申请。
- 不实现通知中心、历史列表、已读状态或跨设备同步。
- 不对失败、取消、工具完成等其它 NCP 事件提前扩展；它们未来按各自产品语义复用 `AppNotificationManager`。
- 不修改 NCP 协议、后端事件或会话持久化合同。

## 后续实现顺序

1. 建立通知纯展示组件和通用 manager。
2. 建立 Chat completion manager，接入现有全局 `ncp.event`。
3. 在 App 生命周期挂载订阅，在 Chat 页面同步当前会话。
4. 补齐 i18n、定向测试、类型/治理检查和真实浏览器验收。
