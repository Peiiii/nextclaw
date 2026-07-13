# 会话内工作台侧栏设计

## 背景

当前会话右侧已经存在 workspace panel，可以承载子会话、会话定时任务和文件预览，但入口分散在 Header 的条件按钮或消息内容中。没有子会话、定时任务或已打开文件时，用户也无法主动打开侧栏；项目文件只能从已知路径逐层浏览，缺少稳定的项目级入口。

本次把右侧面板明确为“当前会话的工作台”：Header 始终提供一个入口，首次主动打开时进入概览，再从概览进入子会话、会话定时任务和项目文件。

## 现状依据

- `ChatThreadManager` 已拥有 workspace panel 的打开、关闭、选中项和前进后退历史。
- `chat-thread.store` 已持久化当前会话的 workspace panel 连续性状态。
- `useChatConversationWorkspaceState` 已从 NCP session summary 和 cron query 组合出当前会话的子会话与定时任务事实。
- 当前选中 session summary 的 `projectRoot / workingDir` 是项目文件根路径事实源。
- `server-paths/browse` 已支持按目录读取文件与子目录；现有文件预览 tab 已支持文本、Markdown、HTML、Office、图片及 diff 等内容。

## 核心判断

不新增第二套右侧抽屉或项目文件 API，而是在现有 workspace panel 中增加稳定的概览、子会话列表和项目文件页面，并把已有定时任务内容收敛为始终可进入的稳定页面。

Header 最右侧只表达“展开 / 收起会话工作台”这一项双向意图，不再分别判断是否显示子会话和定时任务按钮。概览统一展示三类入口及数量；数量为零只表示内容为空，不影响入口视觉或交互。项目文件页按目录懒加载并原地展开，点击文件继续走现有文件预览 tab。

## 推荐方案

1. Header 操作组最右侧提供单一工作台图标按钮。关闭时点击进入 `overview`；打开时切换成收起图标，再次点击关闭工作台。面板自身的关闭入口继续保留。
2. workspace tab strip 固定提供“概览”“子会话”“定时任务”和“项目文件”，并继续保留动态的子会话详情、打开文件和 Side chat tab。
3. 概览展示：
   - 子会话：显示数量；进入子会话列表页，零数量时展示空状态，有内容时再进入具体子会话详情。
   - 会话定时任务：显示数量；始终可进入既有定时任务内容页，零数量时展示空状态。
   - 项目文件：始终可进入；没有可用项目路径时展示明确空态。
4. 项目文件采用 VS Code 式层级树：目录在当前层级原地展开/收起，子目录首次展开时调用既有 browse query，文件点击后调用 `openFilePreview`。
5. 侧栏会话行的选中态仅表达当前会话。置顶、编辑和子会话操作只在行 hover 或操作自身获得键盘焦点时显示，不由行按钮的残留 focus 触发常驻展示。
6. 会话工作台宽度是跨会话的布局偏好：拖拽中只更新组件本地宽度，拖拽结束后由 `ChatThreadManager` 回写持久化 store；刷新后恢复上次宽度，并继续按 360–860px 边界归一化。

## Owner 与数据流

```text
Header / 概览 / 文件树用户意图
  -> ChatThreadManager
  -> chat-thread.store (panel kind + navigation history)
  -> ChatConversationWorkspaceSection
  -> ChatSessionWorkspacePanel

NCP session summaries + cron query + selected session summary
  -> useChatConversationWorkspaceState / selected-session hook
  -> 概览数量、子会话 tab、定时任务内容、projectRoot / workingDir

projectRoot / workingDir
  -> useServerPathBrowse（目录级懒加载）
  -> 项目文件树
  -> ChatThreadManager.openFilePreview
  -> 既有文件预览 tab
```

状态转移只由 `ChatThreadManager` 执行；query hook 不镜像派生状态到 store，组件不直接拼写 workspace snapshot。

## 目录组织

- 状态合同继续位于 `features/chat/stores/chat-thread.store.ts`。
- workspace 导航派生继续位于现有 view-model utils。
- 概览归现有 workspace panel content，因为它是该内容路由的稳定页面。
- 现有 directory browser 改造成项目树展示，不并存第二套 flat browser。
- Header 入口继续位于 session header actions。

不新增 manager、store、service、adapter 或 feature root。

## 兼容与迁移

- 继续识别并恢复既有 `child-session / side-chat-draft / file / cron` 持久状态。
- 新增 `overview / child-sessions / project-files` 作为同一 selection contract 的成员，并让既有 `cron` selection 在零任务时仍可解析；不引入双写或旧字段 alias。
- 通过消息、工具结果或 breadcrumb 打开的文件仍进入同一个 workspace panel。
- 旧的 Header 子会话/定时任务条件按钮被统一工作台入口替代，不保留平行入口。

## 验收标准

- 任意已选择会话都能从 Header 一键打开右侧工作台，默认显示概览。
- 工作台打开后，Header 最右侧按钮切换为收起语义，再次点击能关闭侧栏。
- 即使当前没有子会话、定时任务和已打开文件，侧栏也能正常显示。
- 概览展示子会话、会话定时任务、项目文件入口；数量来自真实会话数据，零数量入口不置灰且可进入对应空状态页。
- 项目文件页以层级树展示目录，目录可原地展开/收起，点击文件复用现有预览。
- 后退/前进能覆盖概览、项目文件和既有 workspace selection。
- 刷新后仍能恢复新页面 selection，旧持久状态仍可读取。
- 调整工作台宽度后刷新页面，宽度仍保持，并且非法持久值会回到安全边界。
- 选中会话行在鼠标离开后不常驻显示置顶/编辑操作；hover 与操作自身键盘焦点仍可访问。
- 定向组件/manager/store 测试、NextClaw UI `tsc`、targeted ESLint、真实页面冒烟通过。

## 非目标

- 不实现文件新建、重命名、删除、拖拽或右键菜单。
- 不改变 server-path API 的权限和根路径合同。
- 不重做文件预览器、cron 管理页或子会话详情。
- 不把右侧工作台扩展成跨会话全局资源管理器。

## 后续实现顺序

1. 扩展 workspace selection 与历史合同。
2. 收敛 Header 入口并增加固定 tab。
3. 实现概览与项目文件树。
4. 修正会话行操作可见性。
5. 完成定向测试、类型、lint、治理和浏览器验收。
