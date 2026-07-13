# Chat 消息卡片式与平铺式布局设计

## 背景

当前聊天消息统一使用带头像的卡片/气泡外壳。它能明确区分消息边界，但在长回答、工具过程和宽内容较多时，会让 AI 回复形成连续的卡片墙，正文层级不够轻。

本轮希望在保留现有体验的同时，新增一种更接近主流 AI 工作台的平铺式布局，让用户能在外观设置中即时切换、实际比较，再决定更适合自己的阅读方式。

这项能力增强的是 NextClaw 作为统一工作台的长期可读性和个性化体验，不改变消息事实、执行链路或工具能力。

## 现状依据

- `/appearance` 由 `AppearanceSettingsPage` 承载，目前只有“显示快捷栏”一项外观配置。
- 产品侧 `ChatMessageListContainer` 负责把 NCP message 适配为 `ChatMessageViewModel`，并处理上下文压缩、上下文继承和文件/工具动作。
- `@nextclaw/agent-chat-ui` 的 `ChatMessageList` 负责单条消息的头像、卡片位置、角色/时间和复制动作；`ChatMessage` 负责正文、过程折叠、工具卡和附件内容。
- 当前卡片外壳由 `ChatMessage` 固定提供，产品侧没有可配置的消息布局合同。
- 现有 Zustand `persist` store 已用于侧栏、快捷栏和聊天状态的跨刷新恢复，适合承载小型、可序列化的 UI 偏好。

## 核心判断

1. **保留两种模式，产品默认调整为平铺式。** 已保存的合法用户选择继续优先；没有历史偏好或持久化值无效时使用平铺式，卡片式仍可在外观设置中随时切换。
2. **用户与 AI 采用非对称视觉层级。** 平铺式下，用户消息继续使用右侧气泡，保留输入与回答的快速区分；AI/工具消息取消外层卡片，使用“头像 + 名称”的头部行，正文在下一行展示，时间和复制操作继续位于正文下方。
3. **只切换消息外壳，不复制消息内容实现。** Markdown、reasoning、工具过程、附件、宽内容、复制动作和 streaming 状态继续走同一条渲染链路。
4. **布局偏好属于聊天展示状态，不属于主题。** 主题继续只负责颜色与明暗；消息布局由独立 chat store 持久化，避免把两个正交概念绑在一起。
5. **共享 UI 只接收显式布局合同，不访问产品 store。** `@nextclaw/agent-chat-ui` 保持可复用、无产品状态依赖。

## 推荐方案

### 卡片式（保留）

```text
AI 头像  ┌────────────────────┐
         │ AI 消息 / 工具过程 │
         └────────────────────┘
         AI · 时间  复制

             ┌──────────────┐  用户头像
             │ 用户消息气泡 │
             └──────────────┘
```

保持现有 DOM 语义和视觉，不做顺手重设计。

### 平铺式（产品默认）

```text
AI 头像  AI名称
AI 消息 / 工具过程（另起一行、无外层卡片）
时间  复制

             ┌──────────────┐  用户头像
             │ 用户消息气泡 │
             └──────────────┘
```

- assistant / tool 使用全宽平铺区，头部行只展示头像和角色名。
- 平铺头部使用紧凑头像，降低元信息行视觉权重；卡片模式和用户头像尺寸保持不变。
- 头像只属于头部行；正文另起一行并使用消息容器完整宽度，头像下方不保留空白列。
- 正文取消外层 border、background、shadow 和大圆角。
- 时间与复制动作保持在正文下方，不因布局切换改变操作位置。
- user 继续使用当前右对齐气泡，避免双向内容失去视觉区分。
- typing 状态在平铺式下使用轻量头像 + 动态文字，不重新包卡片。
- 消息内部的工具详情卡、文件块和未知内容提示仍保留各自必要边界；“平铺”只取消消息最外层卡片，不抹平内部信息结构。

### 内嵌图片约束

- Markdown 图片与文件型图片预览使用同一展示边界：保留原始比例和自然尺寸，小图不放大。
- 大图在消息流中最大显示宽度为 `32rem`，窄屏时最大宽度为容器的 `100%`，避免图片主导整段会话。
- Markdown 图片和文件型图片复用同一个 hover 放大入口与灯箱，保留原有展开操作、键盘焦点和 Esc 关闭行为。
- 连续图片无论写在同一 Markdown 段落还是多个段落中，都保持稳定的垂直间距，不再依赖软换行的偶然 DOM 结构。
- Markdown 图片和文件型图片使用克制的小圆角；圆角由透明的共享预览层统一承担，不增加边框、底色、阴影或第二层遮罩。
- 同一 Markdown 段落中至少三张图片若只以空格相邻、没有换行且不夹杂正文，则使用三列紧凑图片行；超过三张时按每行三张自然换行。
- 显式换行、图文混排以及不足三张的图片保持纵向自然流，避免把作者已经表达的段落结构擅自改成图库。
- 同一条消息中的连续可预览图片附件也遵循三张成行规则；Markdown、非图片文件或其它消息 part 会中断图片组，避免跨内容边界错误合并。
- 三列图片行使用消息可用完整宽度、`12px` 间距，行本身不增加边框、底色或阴影；单图和双图保持自然尺寸展示。
- 消息流约束不改变原图数据与展开行为。

### 平铺阅读轨道

- 平铺模式下，消息流使用 `52rem` 居中阅读轨道，默认输入面板使用同中心线、同响应式留白的 `54rem` 输入轨道。
- 输入面板桌面端每侧比消息轨道多 `1rem`，且两者在窄屏都回落到 `100%`；宽度合同保证输入面板不会比会话区域窄。
- 卡片模式继续使用现有 `1120px` 宽轨；欢迎页的内嵌输入不受影响。

### Markdown 标题节奏

- 标题字号、颜色和字重保持现状，只修正标题与后继内容之间的垂直节奏。
- 标题自身提供相对字号 `0.5em` 的下方留白，保证不同级别标题获得约 `8–10px` 的呼吸空间。
- 紧邻标题的正文节点不再叠加通用块间距，避免段落、列表、引用、代码块或图片容器因 DOM 类型不同产生忽大忽小的间隔。

### 正文与过程元信息层级

- Markdown 正文继续使用 `0.925rem / 1.72` 的高对比正文排版，不改变既有字体、颜色体系和内容密度。
- reasoning、tool activity、process summary 统一复用 `ChatProcessMetaRow` 灰阶 owner；字号与行高继续保持正文的 `0.925rem / 1.72`，只把颜色调整为 `text-muted-foreground/80`，不通过字体变化制造层级，也不引入彩色状态。
- hover / focus 仍可提升到前景色，保证折叠提示的可发现性和键盘可达性。

## Owner 与数据流

```text
AppearanceSettingsPage
  -> useChatMessageLayoutStore.setLayout(layout)
  -> localStorage: nextclaw.chat.message-layout
  -> ChatMessageListContainer 订阅 layout
  -> <ChatMessageList layout={layout} />
  -> ChatMessageList 选择消息编排外壳
  -> ChatMessage 选择卡片或透明正文外壳
```

### 产品状态 owner

`packages/nextclaw-ui/src/features/chat/stores/chat-message-layout.store.ts`

- 拥有 `card | flat` 状态、默认值、持久化、校验和原子 setter。
- 不保存每会话副本；这是用户级展示偏好，切换后作用于全部聊天。
- 不新增 manager：当前动作只是一个无副作用的原子 UI 偏好更新，没有跨模块编排、异步流程或业务状态转移；增加单方法 manager 只会形成空心转发层。

### 产品连接 owner

`ChatMessageListContainer`

- 订阅布局偏好并传入共享 UI。
- 不改变 message view model，不把布局写进 NCP message 或会话 metadata。

### 共享展示 owner

`@nextclaw/agent-chat-ui`

- 公共类型增加 `ChatMessageLayout = "card" | "flat"`。
- `ChatMessageList` 默认 `layout="card"`，保持现有消费者兼容。
- `ChatMessage` 仅按 layout 和 role 切换最外层视觉合同。
- 不读取 localStorage、Zustand、主题 provider 或 NextClaw 产品状态。

## 目录组织

- 设计文档：`docs/designs/2026-07-13-chat-message-layout-modes.design.md`
- 产品状态：`packages/nextclaw-ui/src/features/chat/stores/chat-message-layout.store.ts`
- 外观入口：`packages/nextclaw-ui/src/features/settings/pages/appearance-settings-page.tsx`
- 产品连接：`packages/nextclaw-ui/src/features/chat/features/message/components/chat-message-list.container.tsx`
- 会话宽度 owner：`packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-track.tsx`
- 共享合同：`packages/nextclaw-agent-chat-ui/src/components/chat/view-models/chat-ui.types.ts`
- 共享展示：`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-list.tsx`、`chat-message.tsx`
- 文案：`packages/nextclaw-ui/src/shared/lib/i18n/locales/*/core.json`

当前讨论是包内部结构：`nextclaw-ui` 继续使用既有 L3 feature root；新 store 留在 chat feature 的 `stores/` 白名单目录，不新增子 feature、shared 模块或 barrel。`agent-chat-ui` 保持现有 L1 可复用包结构，不新增产品依赖。

## 兼容与迁移

- NextClaw 产品默认值为 `flat`；没有历史偏好或持久化值无效的用户使用平铺式。
- 已保存的合法 `card | flat` 选择继续优先，不通过版本迁移覆盖用户的明确偏好。
- 公共 `ChatMessageList` 的 layout prop 可选并默认 `card`，已有外部消费者无需同步改造。
- 不改变消息协议、历史数据、tool action、附件打开、上下文 divider 或过程折叠状态。
- 不把主题和布局合并为组合枚举，避免未来每增加一种主题都复制布局变体。

## 验收标准

1. `/appearance` 出现“消息布局”，可在“卡片式 / 平铺式”之间直接切换，并有清晰的选中态与键盘焦点。
2. 选择平铺式后，assistant / tool 消息头部只显示头像和名称，正文没有消息级 border/background/shadow，时间和复制操作仍位于正文下方。
3. 平铺式下 user 消息仍为右对齐气泡；卡片式下所有现有消息表现保持不变。
4. Markdown、代码块、工具活动组、过程折叠、附件、宽内容和复制动作在两种模式都可用。
5. 发送中但还没有 assistant draft 时，两种模式各自显示正确 typing 外观。
6. 刷新后布局偏好恢复，非法持久化值安全回落到平铺式，已有卡片式偏好不被覆盖。
7. `@nextclaw/agent-chat-ui`、`@nextclaw/ui` 的定向测试、TypeScript、ESLint 和治理检查通过。
8. 使用真实本地页面分别切换两种模式，检查桌面宽度与窄容器下没有横向溢出或消息动作丢失。
9. Markdown 各级标题与段落、列表、引用、代码块及图片容器之间保持稳定的必要留白，不改变既有字号层级。
10. 同一消息中连续三张可预览附件使用无边框三列图片行，内容 part 会正确中断分组；正文与 reasoning/tool 提示形成清晰但克制的黑白灰层级。

## 非目标

- 不删除或隐藏卡片式；本轮只调整产品默认值，不改变两种模式的切换能力。
- 不逐像素复刻 ChatGPT、Claude 或其他产品。
- 不新增每会话独立布局、自动布局或按角色自定义矩阵。
- 不重做消息内部工具卡、头像品牌形象或时间格式；Markdown 只修正标题间距与内嵌图片的明确问题，不扩展为整套排版重设计。
- 不把布局偏好同步到后端账号；第一阶段沿用本地设备持久化。
- 不改正文或过程元信息的字体体系、字号与行高，也不改输入框内部结构或侧栏视觉；reasoning/tool 只调整中性灰颜色，会话与默认输入面板只增加平铺模式需要的阅读宽度约束。

## 实现顺序

1. 增加布局公共类型和持久化 store。
2. 在外观页增加两项直接选择控件及 i18n。
3. 从产品容器把 layout 传入共享消息列表。
4. 在共享消息列表中实现平铺 assistant/tool 外壳，并保持 user 气泡。
5. 补共享 UI 与外观设置定向测试。
6. 运行 tsc、测试、lint、浏览器冒烟、maintainability 与 governance 检查。

## 原则与取舍

- `single-domain-owner`：布局偏好只由一个 store 拥有，不在设置页、容器和共享 UI 多处存储。
- `protected-variations`：变化点收敛在 `ChatMessageList` / `ChatMessage` 的展示合同，消息内容链路不分叉。
- `simple-structure-first`：不新增 layout manager、provider 或第二套消息组件。
- `frontend-style-encapsulation`：消息外壳样式随共享消息组件走，宿主页不使用全局 CSS 反向覆盖。
- `frontend-interaction-quality`：外观页提供直接、可理解、可键盘聚焦的模式选择；不把轻量切换做成确认弹窗。
