# @nextclaw/bibo-hosted

## 0.2.1-beta.1

### Patch Changes

- c108c95: 精简 Bibo 工作界面和笔记画布，统一操作入口、菜单焦点和侧栏动效。聊天输入器从单行增长，AI 回复使用轻中性卡片及配套 Markdown 配色，复制入口左对齐，等待回复使用三点提示。移动导航统一交互，打开收件箱消息自动保存已读状态。
- ffba9e5: 统一 Bibo 左侧图标栏的模块导航、侧栏切换与账号入口尺寸、图标线宽和交互反馈，修复左下角账号图标与其他入口不一致的问题。
- Updated dependencies
- Updated dependencies [7c00b06]
  - @nextclaw/core@0.18.6-beta.0
  - @nextclaw/harness@0.2.28-beta.1
  - @nextclaw/kernel@0.19.2-beta.1
  - @nextclaw/ncp-agent-runtime-next@0.1.30-beta.0
  - @nextclaw/ncp-toolkit@0.6.28

## 0.2.1-beta.0

### Patch Changes

- 6e5e750: Open Bibo task details in a right-side drawer with visible task properties and a clearer reading layout.
- 4841142: 重新设计任务详情的阅读、编辑和子任务布局；任务说明与文件共用 Markdown 富文本编辑器，支持嵌入内容页面。
- Updated dependencies [260165f]
- Updated dependencies [8c3e7d3]
  - @nextclaw/kernel@0.19.2-beta.0
  - @nextclaw/harness@0.2.28-beta.0

## 0.2.0

### Minor Changes

- 54ddd77: Bibo 普通对话和个人空间操作改由边缘会话运行，保留旧会话、文件与问答状态，并避免每条消息启动用户容器及生成整份快照。NextClaw 的通用对话输入与上下文能力增加可移植入口，现有 Node 宿主继续使用相同语义。

### Patch Changes

- e901514: Bibo 的原生 Agent 可以在继续处理任务时提出可选答复的问题；网页支持推荐项、选项解释、引用式回答和刷新恢复。
- f8e1503: 重新设计 Bibo 登录注册入口：桌面展示品牌角色与并排表单，手机使用可在短屏完成主操作的分步欢迎布局。保留原有邮箱流程，改善焦点隔离，以及验证码成功和失败的提示。

  手机采用连续的单列欢迎布局，角色、欢迎语与表单保持清晰的阅读顺序；长屏整体平衡留白，短屏保留首屏主操作，试用提示紧随主按钮。

  账号模式切换使用共享分段控件的中号尺寸，与输入框及提交按钮协调，避免切换条过薄。

- 616157d: 日程卡片将标题作为主信息，时间和说明作为辅助信息，并将开始和结束时间呈现为连续时段。桌面侧栏的后续日程改为逐项阅读的单列结构，避免长标题被日期列挤窄。月历改用日期数字上的标记区分选中日期和今天，避免整格高亮形成大块空白；修复首次双击相邻月份日期时误切换月份、出现加载态而未打开编辑窗的问题。
- 4d17044: 打开旧会话后可直接发送消息，个人空间的后台读取不再误报“正在处理上一条消息”。聊天完成后仍会更新当前可见的工作区内容。
- 48964e9: Bibo 工作台统一导航、阅读区、按钮、文件标签和提示的几何与交互规范。新增「Bibo 经典」和「简约」主题，默认保留经典配色，并记住浏览器中的选择。
- a111e0f: 移除妨碍长会话的 128 KiB 模型请求限制，继续复用 NextClaw 自动上下文压缩；区分模型、压缩、超时和保存错误，并增加可按会话和运行编号查询的脱敏服务端诊断日志。
- 6302ba5: Bibo 托管版新增 Exa 网络搜索，回答可附真实来源链接，并提供按账号与全站计算的搜索额度。Exa 搜索使用相关网页片段，减少无关正文进入模型上下文。

  实验期每账号每天支持 100 次搜索，聊天放宽为每小时 100 次；模型额度同步提高，避免旧限制过早阻碍连续试用。

- 19d891c: 加快待办页的添加、修改和删除：保存完成后立即更新列表并继续输入；刷新和运行环境重启后保留已保存事项，重试不会重复添加。
- c0cc602: AI 保存产物并请求展示后，自动在对话工作区打开文件，支持预览和源码编辑。停止生成或保存失败不会自动打开未保存的产物。Client SDK 提供文件展示事件和精确读取接口。
- 15f7057: Improve inbox reading with a compact message list, centered article, distinct status and date rows, and actions that stay visible above long messages. Hide an identical leading title in the reading copy while preserving stored content and mobile return navigation.

  Use two lines per inbox item: a title with an unread dot or resolved check at the top right, then a body preview with a short relative time. Refresh relative times every minute, align content consistently, and omit empty previews.

- 5849486: Bibo 中用户和助手的 Markdown 文件链接现在可打开该账号已保存的工作区文档，包括 `/data/workspace/...` 绝对路径、相对路径和本地 `file:` URI；越界或失效路径仍由服务端拒绝。收件箱内的文件链接在手机上直接打开对应文件。

  统一对齐 NextClaw 的 Markdown 正文与各级标题比例、段落和列表间距，恢复混合任务列表的圆点标记，并让聊天、收件箱和文件预览使用同一排版。

- c33c2f4: Bibo 的 Markdown 文件默认以预览打开。新增即时格式编辑与高亮源码模式，支持格式工具、列表续行、查找替换和撤销重做。预览切换保留编辑历史，保存状态直接可见，未保存草稿可在当前标签页刷新后恢复，版本冲突继续保留用户修改。
- 28bdd7d: 修复个人空间中失效文件标签的错误提示：刷新或切换到仍存在的文件时，不再持续显示“对象不存在或已删除”。
- 52fad38: Bibo 的普通文字统一为 14px，聊天与 Markdown 文件预览、导航、会话列表、表单及输入面板保持一致。收紧手机抽屉间距，统一任务栏控件尺寸与对齐，修正概览卡片和聊天滚动区域布局。

  桌面顶部、左侧入口与右侧工作区标题连成统一外框，会话列表与正文组成内侧大圆角面，工作区内容保持独立圆角。恢复会话名省略与更多操作反馈，桌面输入区保持两行起始高度，手机默认单行并随内容增长。

  文件页和对话工作区统一为文件标签、路径与操作两行，可点击面包屑浏览目录并打开文件。减少重复标题及空闲保存控件，窄屏标签保留省略与关闭操作，切换与关闭仍保护编辑草稿。

  左侧图标入口与内容卡片之间恢复等宽边距；目录菜单的文件图标紧邻名称，长名称仍可省略。

  会话标题占满侧栏并在末端渐隐，更多操作出现时覆盖在标题上；普通图标按钮按所在背景显示清晰的 hover 与键盘焦点反馈。日程「接下来」固定日期列宽，把主要空间留给标题。文件树、搜索结果和笔记列表均可从各行的更多菜单移动、重命名或确认删除。

  会话更多操作出现时，标题只在按钮前的短距离内渐隐，避免文字透到按钮旁边，也避免过早吞掉标题。

  文件树、搜索结果和笔记列表的更多操作改为悬浮或键盘聚焦时显示，触屏保留入口；操作覆盖在行内，不再让标题预留空位。选中行只保留一层背景，更多按钮的提示缩短为“更多操作”。

  文件、任务与笔记行的更多操作不再自带渐隐层；会话标题的渐隐只由会话列表负责。

  日程侧栏标题、安排数量和新建按钮共用垂直中线；新建日程中的“添加说明”改为左对齐的次要入口，展开后与说明字段保持统一间距。

  生成回复时可切换会话阅读或编辑草稿，后台回复保留在原会话。账号信息集中在左侧菜单，进入页面和发送消息时减少重复的连接、保存状态文字。

- a5eaf12: Remove duplicate success toasts from workspace actions. Keep errors beside their action, preserve file drafts and undo, and provide contextual feedback when a saved task is outside the current filter.
- f8ae484: Bibo 概览在欢迎语旁加入官网同款紫色搭档形象与品牌问候。形象仅作展示，与下方事项摘要及跳转入口独立，并适配手机布局。
- 31b9162: 缩短 Bibo 发送消息后的首字等待：新会话合并额度检查，精简嵌入式 Harness 的工具与上下文，并延长活跃会话的容器闲置窗口；保留 Agent 身份、记忆及安全规则。
- 85c2c16: Bibo 的 Markdown 编辑升级为直接编辑排版正文，支持表格增删行列、链接与图片、代码高亮、公式编辑和 Mermaid 预览。文件仍默认阅读，精确源码编辑移入文件菜单；保留草稿、版本冲突和保存保护。长文输入避免逐键全文转换，并适配窄屏工具栏。

  阅读与编辑共用正文排版；新增 slash 插入菜单、表格边缘与整表操作、就地公式预览和链接取消。统一 Notion 式块手柄、菜单、拖动排序及嵌套列表操作，完善图片选中反馈与撤销，加载状态在正文区域居中。

- fc986ad: 修复 Bibo 回复生成后偶发无法保存的问题，确保会话能够保存并在刷新或容器恢复后继续。
- fadac2f: 为 Bibo 应用与帮助页补齐浏览器标签页图标，与官网统一使用紫色 Bibo 形象。
- 92c3b25: 修复 Bibo 任务列表超出视口时无法滚动的问题，在任务行的更多菜单提供删除入口与确认，并让任务行的更多操作与现有行级菜单采用一致的悬停、焦点及触控规则。
- 804f46e: 精简任务列表的状态与辅助信息，保留圆圈、半月、勾选和横线图标；完成与取消任务收进可展开的「已结束」区域，搜索与已完成视图直接显示匹配项，看板不再重复状态文字。
- fae7d2d: 个人工作台统一使用 Tailwind CSS；任务整行提供一致反馈，任务详情和日程使用编辑弹窗，目录树收起后完整释放编辑宽度。

  统一全工作台文字层级和系统字体，修复表单字号被继承样式覆盖的问题；提示卡片提供独立关闭操作。

  移除全局读取和保存提示条；完成提示统一顶部居中，加载状态留在对应内容区域。回答和代码复制统一使用图标按钮，就地显示成功或失败反馈。

  概览摘要统一复用公共按钮，修复无圆角和零水平内边距的悬停反馈，保留长标题旁的状态与时间。

  对话、收件箱和文件正文统一支持系统资源链接；AI 保存产物后返回稳定引用，点击可在对话工作区预览、编辑同一份文件，文件改名或移动后引用保持有效。

- Updated dependencies
- Updated dependencies [e901514]
- Updated dependencies [54ddd77]
- Updated dependencies [6302ba5]
- Updated dependencies [31b9162]
- Updated dependencies [b99507f]
  - @nextclaw/ncp@0.11.3
  - @nextclaw/kernel@0.19.1
  - @nextclaw/harness@0.2.27
  - @nextclaw/core@0.18.5
  - @nextclaw/ncp-agent-runtime-next@0.1.29
  - @nextclaw/ncp-toolkit@0.6.28
  - @nextclaw/shared@0.8.4

## 0.1.1

### Patch Changes

- 24336ee: 任务可在列表直接回车连续添加并展开完整详情；月历支持双击新建，日／周支持半小时时段，调整开始时间保留时长并拦截无效时间。

## 0.1.0

### Minor Changes

- f7b646a: Add a personal workspace with separate conversations, an attention inbox, month/week/day calendar, project tasks, notes, and tabbed files. Notes and Agent-created artifacts share the same files, with version checks and draft-preserving save recovery.

  Unify menus, dialogs, navigation, and action feedback across desktop and mobile. New conversations are created only when the first message is sent. Add a public session deletion operation so deleting a hosted conversation also removes its underlying Agent journal.

  Keep long conversation titles within the toolbar without hiding actions, and constrain long item names across overview cards, task lists, inbox, and notes on narrow screens.

  Correct file-tree keyboard navigation at root and empty-folder boundaries, preserve a keyboard entry after deleting a node, and reveal the active tab when many files are open.

  Restore the chat workspace selection after refresh, preserve close and selection intent during slow reads, and show recoverable file errors inside the workspace.

  Keep missing conversation links identifiable, return a not-found response for deleted history, and avoid silently switching to another conversation.

  Prevent mobile navigation drawers from opening icon tooltips on automatic focus, while preserving keyboard focus and Escape behavior.

  Improve shared Markdown reading in chat, inbox, and file previews with code highlighting and copying, math, Mermaid diagrams, safe image fallback, and consistent small-screen layout.

### Patch Changes

- 091af2b: Make the empty area of each calendar month cell select its date while keeping event items independently clickable.
- b18b88b: Improve the file tree with consistent type icons, explicit empty-folder states, and retryable read and search failures.
- e053638: Keep inbox context when a referenced task, event, or file is unavailable, and open valid sources after a single detail read.
- 163f1db: Keep task and inbox pagination controls inside their independently scrolling lists.
- 55af90a: Improve Bibo Markdown readability during generation and after saving, use a compact reading layout and readable list excerpts in the inbox, and add a one-command local frontend preview with hot updates and streamed sample replies.

  Use an opaque, compact down-arrow button to return to the latest chat message.

  Unify composer send, stop, and waiting controls; allow drafting during generation and preserve both failed messages and new drafts during retry.

  Centralize section and conversation navigation with React Router, preserve per-conversation drafts across navigation, and make browser history and direct conversation links consistent.

- dd52bd6: Prevent the mobile navigation drawer from showing a new-conversation tooltip in hybrid touch and pointer environments. Tighten the drawer layout while retaining 44px touch targets and an accessible title. Remove redundant composer and empty-state hints, and keep the file editor controls visible at narrow desktop widths.
- 219a6fa: Report exhausted Bibo model quota before starting a chat request, preserving the draft and avoiding an empty new conversation.
- 54d5fcf: Show notes by most recent edit across the complete file space and place pagination controls inside the file and note lists.
- 0337c3b: Make the overview denser with a compact priority brief, independent content columns, and clearer mobile reading order.
- a09d863: Show retryable page errors instead of empty data when overview, inbox, tasks, or calendar reads fail.
- 3be19dc: Improve Bibo hosted chat with direct answer streaming from the first visible model tokens, stable conversation scrolling, explicit save and retry states, and a React/TypeScript component system.
- e721420: Show project and status in task rows and use the shared accessible icon action for deleting subtasks.
- 500a925: Prevent icon tooltips from appearing over the mobile navigation drawer on touch devices.
- 24336ee: 为各工作模块采用独立路径路由，优化任务快速创建、直接完成与撤销、截止时间筛选，手机月历与当天安排、笔记名称搜索和收件箱筛选；文件编辑支持键盘保存。
  - @nextclaw/harness@0.2.26

## 0.0.2

### Patch Changes

- 85bab59: 新增基于 NextClaw Agent 内核的 Bibo 独立网页服务，支持邮箱注册、持续对话和个人空间保存，并提供有每日上限的免费模型试用。
  - @nextclaw/harness@0.2.25
