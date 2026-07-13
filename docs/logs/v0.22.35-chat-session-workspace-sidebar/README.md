# v0.22.35 会话内工作台侧栏

## 迭代完成说明

- 会话 Header 最右侧新增稳定的工作台开关：关闭时打开概览，打开时切换为收起图标，再次点击即可关闭。
- 概览统一提供子会话、会话定时任务和项目文件入口。数量为零只表达空数据，入口保持正常视觉和交互，并进入对应空状态页。
- 新增子会话列表页；项目文件复用当前会话的 `projectRoot / workingDir` 和既有 server-path browse API，以目录树方式懒加载、展开并打开文件预览。
- 会话列表的置顶、编辑和子会话操作不再被选中态或会话行残留焦点常驻触发，只在 hover 或具体操作获得键盘焦点时显示。
- 工作台宽度进入 `chat-thread.store` 的 Zustand `persist` 合同。根因是原实现仅由 `ResizableRightPanel` 本地 `useState` 持有宽度；第一次修正虽写入 persist，但仍把恢复值作为一次性 `defaultWidth`，rehydrate 后无法驱动已挂载组件。最终改为 store 控制宽度、拖拽期间使用本地临时值、松手后统一提交，刷新后可恢复。
- 全局右侧面板实际由 `DocBrowser`、`DocBrowserManager` 和 `doc-browser.store` 负责，与会话工作台不是同一个 owner。此前只修了会话工作台，因此调整全局右栏后刷新仍会回到写死的 `420px`；现已把 `dockedWidth` 纳入 DocBrowser 自己的 Zustand `persist` 快照，并以受控宽度驱动全局面板。该根因由 `DocBrowser` 的硬编码 `defaultWidth={420}` 和持久快照缺少宽度字段直接确认。
- 本次纠偏暴露的是作用域识别失败，而不是缺少规则：现有代码调查规则已经要求先沿 `producer -> owner/state -> UI` 查完整链路。机制改进落在验证层，为全局 DocBrowser 新增独立的拖拽提交和 reset/rehydrate 回归测试，防止再次用会话工作台测试替代全局边栏验收。

## 测试/验证/验收方式

- `(cwd packages/nextclaw-ui) ./node_modules/.bin/tsc --noEmit -p tsconfig.json`：通过。
- 14 个相关 Vitest 文件：116 项测试通过，覆盖 Header 开关、概览与空状态、文件树、导航历史、持久化、会话行操作和 resize。
- 宽度受控修正后的 4 个定向文件：13 项测试通过，包含“480px 首次挂载后 rehydrate 为 620px”的恢复场景。
- 全局 DocBrowser 宽度修正后的 3 个定向文件：44 项测试通过，包含“全局面板拖拽后提交 600px”和“持久化 610px 后 reset/rehydrate 仍为 610px”。
- NextClaw UI 定向 ESLint：0 错误、0 警告；包级 ESLint：0 错误，仅保留无关 `cron-config.tsx` 历史复杂度 warning。
- scoped `lint-new-code-governance`：通过；governance backlog ratchet：通过。全脏工作区同时包含其他 AI 的消息布局 WIP，因此不作为本批验收口径。
- 运行中的 `127.0.0.1:5174` Vite 消费链已返回受控 `width`、`onWidthCommit`、`workspacePanelWidth` 和 Zustand `persist` 的转换后源码。内嵌浏览器 webview 无法挂载，因此未把浏览器自动化计为真实点击验收。
- 同一 Vite 消费链已返回全局 `DocBrowser` 的 `width={dockedWidth}`、`onWidthCommit={setDockedWidth}`，以及 `doc-browser.store` 持久化 `dockedWidth` 的转换后源码。

## 发布/部署方式

- 本次未执行部署、NPM 发布或 desktop 发布。
- 已新增 `@nextclaw/ui` patch changeset，等待后续统一发布。
- 不涉及数据库 migration、远程 API migration 或服务端部署。

## 用户/产品视角的验收步骤

1. 进入任意已有会话，确认 Header 最右侧展示工作台图标；点击后右侧栏打开并默认进入概览。
2. 确认 Header 图标切换为收起语义；再次点击后侧栏关闭。也可使用侧栏自身关闭按钮。
3. 在子会话和定时任务均为 0 时，确认两个入口不置灰；点击后分别看到对应空状态。
4. 进入项目文件，确认目录可原地展开、子目录懒加载，点击文件后复用现有预览 tab。
5. 拖动工作台左侧 resize handle 改变宽度，松手后刷新页面，确认宽度保持。
6. 选中会话列表项并移开鼠标，确认置顶/编辑操作不常驻；hover 或 Tab 聚焦具体操作时仍可见、可用。
7. 打开应用级全局右侧面板，拖动左侧 resize handle，松手并刷新页面，确认恢复的是全局面板本身的宽度，而不是会话工作台宽度。

## 可维护性总结汇总

- 本次是新增用户能力，允许必要代码增长；没有新增第二套侧栏、文件 API、manager、store 或兼容分支，复用了现有 workspace panel、ChatThreadManager、server-path browse 和文件预览链路。
- 将历史 selection 到 snapshot 的纯映射从已超预算的 `ChatThreadManager` 收回现有 workspace utils，manager 从 602 行降到 598 行并消除阻塞项。
- 将宽度边界归一化放入 workspace layout utils，Zustand store 只负责状态和持久化，避免 store 卡在 400 行预算边缘。
- 递归项目树把图标与子节点状态渲染拆成局部纯展示单元，定向 ESLint 的认知复杂度 warning 已消除。
- 新测试按组件和 manager 角色落入既有 `__tests__`，没有新增 feature root、shared、barrel 或白名单外目录。
- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review`；守卫无阻塞项，增长警告集中在本次新增的概览/项目树内容，后续若继续扩展应把稳定页面从 panel content 拆成独立组件。
- 全局 DocBrowser 修正范围共新增 71 行、删除 4 行，净增 67 行；其中非测试新增 36 行、删除 4 行，净增 32 行。该增长用于补齐新的用户可见持久化合同与两层回归证明，没有新增 store、wrapper 或兼容分支。守卫无错误；`doc-browser.tsx` 和 `doc-browser.manager.ts` 接近文件预算但仍未越线，若继续增长应优先拆分浮动窗口交互与 tab 状态转换职责。

## NPM 包发布记录

- 需要发布：是，用户可见 UI 能力与交互修复需要进入 changelog。
- 包：`@nextclaw/ui`。
- 版本策略：patch。
- 当前状态：已添加 changeset，待统一发布。
