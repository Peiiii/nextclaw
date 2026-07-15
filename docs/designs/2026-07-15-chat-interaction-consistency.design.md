# 聊天交互一致性设计

## 背景

NC-123 集中暴露了聊天主界面中的多处一致性问题：会话切换后模型偏好未恢复、重试时旧错误仍停留、`/` 与 `@` 选择项缺少类型图标、折叠侧栏的会话弹层缺少分组层级、技能面板高度跳变且内建技能不易发现。后续补充明确了分组语义：时间模式保持轻量静态标题，项目模式才支持逐组展开和收起。

## 现状依据

- 会话模型与思考等级已经有统一 resolver，但输入组件仍保留并行 fallback，切换会话时没有以目标会话 metadata 重新同步输入状态。
- NCP 会话状态 manager 持有错误事实，但发送新请求前没有清理旧错误的公共 mutation。
- 共享输入表面的 item contract 没有图标语义，宿主只能提供纯文字条目。
- 展开侧栏已经复用 `groupSessionsByDate`，折叠标题弹层此前只渲染扁平列表。
- 技能数据已经按 NextClaw、全局、内建三个来源分组，但技能选择器只顺序展示分组，没有直接来源筛选。
- 现有运行实例属于用户工作现场，功能验收不能以擅自重启换取便利。

## 核心判断

本轮应扩展现有 owner，而不是新增平行状态或第二套列表：会话偏好继续由输入状态 owner 与既有 resolver 协作；错误继续由 NCP manager 管理；图标语义进入共享输入 item contract；会话分组继续复用同一个分组函数；技能来源继续复用既有 group 数据。

## 推荐方案

- 会话切换时先保留当前选择，等目标 session metadata 到达后再一次性恢复目标模型与思考等级，避免异步空窗把用户选择重置为默认值。
- NCP runtime 在有效发送开始前调用 manager 的 `clearError`，让旧错误在重试动作发生时立即消失。
- 为输入表面 item 增加 `command`、`panel-app`、`skill` 三种语义图标，并由共享菜单统一渲染。
- 折叠会话弹层复用侧边栏的“时间 / 项目”模式。时间模式使用无底色、无边框的静态小标题；项目模式使用 Folder、数量和 Chevron，并复用既有项目折叠状态。
- 技能选择器使用固定的自适应高度，并在搜索框下提供全部、NextClaw、全局、内建来源筛选。
- 在常驻协作规则中明确：未得到用户知情同意时不得重启当前 NextClaw 运行实例，优先热更新或隔离进程验收。

## Owner 与数据流

- `useSessionConversationInputState` 聚合输入快照；偏好动作由独立 preference actions hook 管理，并调用既有 preference resolver。
- `NcpAgentConversationStateManager` 是错误状态唯一 owner；React runtime 只在发送边界调用其 mutation。
- `ChatInputSurfaceItem` 持有图标语义，slash / panel-app plugin 负责赋值，共享菜单负责展示。
- `groupSessionsByDate` 与 `groupSessionsByProject` 继续生成唯一分组事实；标题切换器复用 session list store 的模式、置顶与项目折叠状态，不建立局部平行状态。
- `ChatInputBarSkillPicker` 只持有搜索、来源筛选和键盘活动项等局部 UI 状态，不复制技能来源数据。

## 目录组织

- 会话偏好动作留在 conversation hooks，与输入状态 owner 同根。
- 输入图标合同和渲染留在 `nextclaw-agent-chat-ui` 的 input-surface owner。
- 折叠分组交互留在 session header title switcher，不改变展开侧栏结构。
- 新增测试使用按组件角色命名的独立文件，避免继续扩张已接近预算的综合测试文件。

## 兼容与迁移

不需要数据迁移。所有新增字段均由现有宿主构建器提供；会话 metadata 缺失时继续保留当前选择，待数据到达后再恢复。分组默认展开，因此不会让既有用户首次打开时丢失会话内容。

## 验收标准

- 在同一 UI 实例内从 DeepSeek 会话切到 MiniMax 会话，模型按钮恢复目标会话偏好。
- manager 已有错误时发送新请求，错误立即清空且请求继续发出。
- `/` 与 `@` 构建出的 command、panel app、skill 条目带对应图标语义，共享菜单渲染对应图标。
- 折叠会话弹层可切换时间与项目模式；时间分组标题简约且不可折叠，项目分组点击 Chevron 可折叠和展开。
- 技能面板在有结果与无结果时高度不跳变，可直接筛选内建技能。
- 相关包测试、`tsc`、ESLint、治理检查、可维护性 guard 与隔离浏览器冒烟通过。

## 非目标

- 不重做完整聊天信息架构。
- 不新增会话分组持久化偏好。
- 不更改技能来源优先级或安装机制。
- 不重启、发布或部署用户当前运行的 NextClaw 实例。

## 后续实现顺序

先闭合状态 owner 与共享合同，再完成列表和技能交互，最后执行隔离 UI 验收、治理检查和 PR 交付。
