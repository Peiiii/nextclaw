# AI 主动送达与收件箱设计

日期：2026-08-06

## 背景与目标

NextClaw 已有 `show_file`、`show_url` 和全局轻通知，但它们解决的是“当前会话、当前时刻立即展示”的问题。AI 在后台完成一份报告、推荐或长文后，仍缺少一种可持久、可回看、可继续讨论的交付形态。

本设计引入“收件箱（Inbox）”作为统一的主动送达表面。AI 可以通过一个稳定工具把 Markdown、隔离 HTML 正文或本地文本文件快照送入收件箱；用户在线时立即看到单一阅读弹窗，离线时在下次进入界面时看到；所有内容均可在收件箱中管理，并可一键创建后续会话。

这项能力服务于 NextClaw 的个人操作层定位：AI 不只在用户发起对话后回答，也能把异步工作结果可靠地送回统一入口，并保持结果、状态与后续行动的连续性。

## 核心判断

### 为什么需要新工具

需要新增 `deliver_to_inbox` 工具，而不是复用 `show_file`：

- `show_file` 是瞬时 UI 指令，没有持久化、未读状态或历史记录。
- 主动送达需要在用户不在线时仍然成立，工具执行成功必须先代表内容已持久化，而不是浏览器恰好收到了事件。
- 工具同时支持 `content` 与 `filePath`。文件模式在执行时读取并保存正文快照，原文件以后移动或删除不会破坏历史内容。
- 工具只负责创建送达项，生命周期变化统一由同一个内核 owner 处理。

### 为什么不能只存一个文件

正文可以来自一个文件，但一个裸文件无法可靠表达 `已呈现但未读`、`已读`、`归档`、`删除`、`来源会话` 和 `后续会话` 等状态。实现采用一个原子 JSON 存储保存记录与正文；这是当前规模下最简单、可迁移且无需新数据库依赖的方案。

当数据量或检索需求显著增长时，可在不改变上层合同的前提下将 Store 替换为数据库实现。

## 用户体验

### 自动阅读

1. 新送达项持久化后发出轻量实时事件。
2. 界面可见时，打开全局阅读弹窗；界面不可见时，等恢复可见后再检查。
3. 同时存在多项时只展示一个弹窗，顶部提供上一项、下一项和当前位置，不堆叠多个窗口。
4. 自动弹出只写入 `presentedAt`，不写入 `readAt`。
5. 用户关闭弹窗后，该项仍保持未读，但因为已经呈现，不再自动弹出。这是明确的产品合同。
6. 用户主动从收件箱打开、点击“标记已读”或点击“继续聊”时才进入已读状态。

### 收件箱

桌面端采用列表与阅读详情双栏布局，移动端采用列表到详情的路由切换。一级导航显示未读数量。收件箱提供：

- 未读、全部、已归档三种视图；
- Markdown 安全渲染与隔离 HTML 预览；
- 标记已读/未读；
- 归档/恢复；
- 删除；
- 继续聊。

收件箱初次进入时使用自动筛选：存在未读且未归档内容时展示“未读”，否则展示“全部”；只有全部视图也没有内容时才出现真正的空态。用户手动选择筛选后保持其明确选择，不再由数据变化擅自切换。

阅读弹窗对 Markdown 与 HTML 统一采用内容优先的紧凑 chrome：外层标题缩为左上角单行标签，摘要只保留为无障碍描述，时间、翻页和关闭操作留在同一条轻量顶栏，不再与正文争夺首屏。Markdown 与 HTML 正文都是视觉主体；HTML iframe 继续保留四周留白与圆角，但不绘制额外边框线，由文档自己决定内部边框与视觉层级。收件箱管理页同样移除页面说明与详情摘要，详情标题只作为单行选择标识；列表区使用轻量 muted 表面，与正文白底自然分层，当前项使用主题系统的 selection 表面，保证明暗主题都有明确反馈，普通历史项降低文字对比，未读项只通过标题字重与状态点增强。三个筛选项内联展示与其视图一致的数量，并使用同一套 selection / hover token；条目统一为一行标题和一行摘要/日期，避免三个等权文本行同时争抢注意力。Markdown 正文使用更宽的阅读画布，管理动作与“继续聊”在底部分组。这样既保留阅读身份和操作上下文，又避免正文自带标题时出现重复层级。

### 继续聊

“继续聊”创建一个真实的新会话，而不是把整篇正文塞进输入框。会话元数据保存 `inbox_delivery_id`，上下文 Provider 在每次 Agent 运行时读取对应送达项并注入上下文。这样正文只有一个事实来源，也不会伪装成用户消息。

同一送达项重复点击“继续聊”时复用仍存在的关联会话；如果关联会话已经被删除，则创建新会话并更新关联。

## 状态模型

每条 `InboxDelivery` 包含：

- 标识与内容：`id`、`title`、`summary`、`content`、`contentType`；
- 来源：Agent、来源会话、工具调用和可选原始文件路径；
- 生命周期：`createdAt`、`updatedAt`、`presentedAt`、`readAt`、`archivedAt`；
- 后续关系：`conversationSessionId`。

状态不压缩为单一枚举，因为呈现、阅读和归档是相互正交的事实。关键不变量如下：

- 已读一定意味着已呈现；
- 归档一定意味着已呈现；
- 标记未读不会清除 `presentedAt`，因此不会重新触发自动弹窗；
- 删除为物理删除；
- 自动弹出的候选必须同时满足未呈现、未读、未归档。

## Owner 与主链路

```mermaid
flowchart LR
  A["Agent: deliver_to_inbox"] --> B["InboxDeliveryManager"]
  F["HTTP 状态操作"] --> B
  B --> C["InboxDeliveryStore / 原子 JSON"]
  B --> D["inbox.delivery.changed 事件"]
  D --> E["WebSocket / Client SDK"]
  E --> G["InboxManager + React Query"]
  G --> H["阅读弹窗 / 收件箱"]
  H --> F
  H --> I["继续聊"]
  I --> B
  B --> J["SessionManager"]
  J --> K["InboxDeliveryContextProvider"]
```

- `InboxDeliveryManager` 是创建、查询、状态迁移、删除和继续聊的唯一业务 owner。
- `InboxDeliveryStore` 只负责版本化 JSON 的读取与原子写入，不复制业务规则。
- Server controller 只做 HTTP 输入校验和错误映射。
- Client SDK 只提供类型化请求。
- UI 使用 React Query 保存服务端事实，Zustand 仅保存阅读弹窗是否打开和当前项 ID，不复制送达数据。
- 实时事件只携带 ID 与操作类型，界面统一重新获取权威数据，避免把大正文通过事件总线重复广播。

## 接口与工具合同

### Agent 工具

`deliver_to_inbox` 参数：

- `title`：必填，最多 160 个字符；
- `summary`：可选，最多 500 个字符；
- `content` / `filePath`：二选一且只能提供一个；
- `contentType`：可选，取值为 `markdown` 或 `html`。显式值优先；省略时，`.html` / `.htm` 文件识别为 HTML，其余文件和直接正文按 Markdown 处理；
- 文件必须是绝对路径，执行时限制为 UTF-8 文本并进行大小检查；
- 单项正文上限为 512 KiB。

工具成功返回轻量结果 `{ ok, deliveryId, title }`。

### HTML 安全合同

HTML 是独立正文类型，不经过 Markdown renderer，也不复用面向用户本地可信文件的宽松 iframe：

- 通过只允许用户点击链接打开外部窗口的 sandbox iframe 渲染，HTML 获得不透明来源，无法访问 NextClaw 页面、Cookie 或本地存储；
- 脚本、表单、下载、顶层导航和外部 frame 均不可用；第一版面向静态信件与报告，不执行 AI 送达内容中的 JavaScript，也不允许内容自行创建弹窗；
- 在完整 HTML 文档中注入 CSP：禁止网络连接、远程脚本/样式/图片/字体、对象、frame 与表单，只允许内联样式及 `data:` / `blob:` 媒体；
- 移除 meta refresh，并统一将链接改为新窗口目标；sandbox 只授予 `allow-popups allow-popups-to-escape-sandbox`，使用户主动点击的外链与内联 HTML 一样在阅读器外打开，同时不把外部页面继承到收件箱的其余限制中；
- 原始 HTML 按原文持久化并在“继续聊”时注入 Agent 上下文，安全包装只属于展示边界，不改写事实来源。

这项合同优先支持可离线保存的静态自包含报告。需要脚本、联网或更高权限的 HTML 应继续使用可信工作区文件预览或显式 URL 展示，不扩大收件箱的默认权限；未来若确有交互文档需求，应新增显式信任类型，而不是放宽现有 `html` 合同。

### HTTP

- `GET /api/inbox/deliveries`
- `GET /api/inbox/deliveries/:deliveryId`
- `PATCH /api/inbox/deliveries/:deliveryId`
- `DELETE /api/inbox/deliveries/:deliveryId`
- `POST /api/inbox/deliveries/:deliveryId/continue`

PATCH action 为 `present`、`read`、`mark_unread`、`archive` 或 `restore`。

## 文件组织

- Shared：跨运行时 DTO、状态 action 与事件载荷。
- Kernel：Store、Manager、Agent 工具、工具 Provider、上下文 Provider。
- Server：`features/inbox-deliveries` HTTP 边界。
- Client SDK：`inboxDeliveries` 服务。
- UI：单一 `features/inbox` 根，内部按 managers/stores/hooks/components/pages 折叠。

不新增通用 registry、factory 或平行消息通道。当前规模下，一个 feature root 已足够清晰。

## 兼容性与迁移

这是全新能力。已存在的送达记录已经显式保存 `contentType: "markdown"`，扩展为 `"markdown" | "html"` 无需数据迁移；存储不存在时按空收件箱启动；写入采用临时文件加 rename，避免中途崩溃留下半截 JSON。`show_file/show_url` 的现有行为不变。

## 非目标

- 本期不做富文本编辑器、邮件协议、外部邮件同步或附件系统；
- 不做全文索引、分页和云端多端同步；
- 不为收件箱 HTML 开放同源权限、远程网络资源、表单、脚本创建的弹窗、下载或顶层导航；仅允许用户主动点击外链时打开外部窗口；
- 不在点击“继续聊”后自动发送消息或启动 Agent，避免制造未经用户确认的新回复。

## 验证标准

1. 工具以直接正文和文件快照两种方式创建送达项，覆盖显式类型、`.html` / `.htm` 推断、显式覆盖、非法参数与超限输入。
2. 数据跨 Kernel 重建仍可读取，连续写入不会丢更新。
3. `present/read/mark_unread/archive/restore/delete` 状态不变量由定向测试覆盖。
4. HTTP 与 Client SDK 的响应类型和错误状态正确。
5. 新实时事件能使已打开界面刷新；首次进入和恢复可见时能打开最早待呈现项。
6. 关闭阅读弹窗后仍未读但不再次自动弹；多项只在同一弹窗内切换。
7. 继续聊创建或复用会话，并在下一次 Agent 运行中注入对应正文上下文。
8. Markdown 保持原渲染行为；HTML 在阅读弹窗与收件箱详情中使用同一隔离 renderer，验证 sandbox、CSP、无远程资源权限及 iframe DOM 身份连续性。
9. 中英文 UI、键盘可达性、移动端与桌面端布局通过组件与构建验收。
10. 运行 TypeScript、定向测试、治理检查、生产构建和本地隔离运行链路冒烟。
