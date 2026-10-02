# Bibo 页面路由与按需加载修复

## 目标与证据

用户反馈进入笔记模块先看到列表，随后自动显示某条笔记，要求统一排查文件等页面。此修复尊重用户的当前位置与选择，减少搭档工作空间的意外切换。

源码已接入 React Router；`load(notes/files)` 在读取列表后调用 `restoredFileTargets`，恢复 localStorage 的 activeFileId 并通过 `openFile/revealFile` 隐藏列表。`SpacePage` 还在列表 ready 后才打开详情引用。任务、日程、收件箱的点击与关闭没有一致维护资源 URL，资源 manager 会把详情直链改回模块根路径。

风险 L2；flow=bugfix。直接源码锁定违约边界，skip-reproduction：没有修前浏览器失败基线；修后用真实 Router、延迟 API、持久化布局与浏览器历史验证同一违约点。

## 用户链路与选择

1. 登录后点击笔记或文件模块，稳定停留在集合/目录。已有 Tab 与未保存草稿保留，但不自动读取或选择旧正文。点击目标后 URL 变成详情地址，立即显示目标加载态，随后正文；返回、前进与刷新指向同一对象。
2. 直接打开笔记/文件详情地址，只请求目标正文；侧栏所需列表可并行加载，列表慢或失败不能阻塞正文。加载中不能显示旧详情或闪现笔记集合。路径引用通过同一 resource owner 解析。
3. 任务、日程、收件箱点击、关闭、模块切换和历史回退均由 URL 决定选中对象。快速切换及账号更换后旧响应不得夺取选择。对话中的文件引用继续打开右侧工作区，工作区恢复只在对话中按需发生。

采用已有 Router + Zustand + WorkspaceResourceManager；修正路由到领域 owner 的同步边界，不引入第二个路由框架或把草稿搬进 Router loader。相比只禁止恢复旧笔记，此方案也关闭直链串行依赖与历史失配；相比全面重写数据层，保留现有写入、草稿与权限 owner。

## 唯一主链路与生命周期

- React Router 拥有 view/resourceId/filePath。增加 `/notes/:resourceId?`，复用已有动态参数与 Link，模块根路径表示集合。
- WorkspaceResourceManager 同步 location/account 到领域 store：清除无 URL 的选中状态，立即启动目标读取，列表读取独立。组件只连接路由变化，不等待 readStatus 后再次打开资源。
- 文件关闭、移动和删除后的 URL/工作区同步由同一 resource manager 编排；store 只执行文件数据与草稿变更。展开目录树只改变目录显隐，不返回集合或清除当前正文。
- 领域点击导航到资源 URL；路由同步使用显式标志调用已有读取方法，避免递归导航。无 Router 的 owner 单测保留直接动作入口。
- `load` 只更新列表，不恢复主页面旧正文。旧 Tab 和草稿仍保留；主页面 URL 优先于持久化 activeFileId。
- 开始详情读取就投影目标 ID/加载态；完成时校验当前 route/request/account。失败展示可重试反馈，保持目标 URL；关闭或删除当前文件将 URL 更新到明确邻居或集合。
- 从集合删除文件保持集合和空选中状态，不从旧 Tab 推导新的正文；嵌套正文先显示，再由既有目录 owner 独立补齐祖先导航。创建响应已携带正文时复用该快照，不再次读取同一新建对象。
- 笔记只读取笔记列表；各空间页面通过 lazy/Suspense 按需加载模块。编辑器现有按需依赖继续复用，组件类型和实体 key 保持模块级稳定。

## 验收与交付

浏览器桌面/手机覆盖：持久化旧笔记后进入集合零正文请求；详情先于被延迟的列表完成；详情加载态不显示集合；A→B→集合后迟到响应不复活详情；历史返回/前进、刷新、缺失文件、任务/日程/收件箱选中与关闭、对话右侧文件引用。原有保存、冲突、草稿、发送和滚动用现有冒烟回归。

执行 Worker、网页、scripts 三项匹配 tsc、Vite build、定向 owner 测试、浏览器路由与资源回归、lint 与 maintainability Review。当前使用官方 Sandbox 镜像，没有本地 runner 源码变更或额外容器 tsc 目标。按 Bibo 默认授权精确提交、集成远程 master，冻结主干部署 Worker/网页并线上复验；无后端合同、容器代码、NPM、桌面或 NextClaw 文档站变更。

design-document: required；plan: not-required（单批闭环）。用户无需确认惯例路由修正；视觉偏好不在本次改动范围。

上游依据：[React Router 数据路由](https://reactrouter.com/start/data/routing)；URL 参数表达对象身份，领域草稿仍由现有 store 拥有。

## 集成与回归留痕

初始工作树基于本地主干 `feaa9aabe`。交付前发现远程主干已更新到 `a1f251be6`，将本次全部草稿保存为补丁，在同一隔离工作树快进并逐处合并；保留远程的单文档标题、直接新建笔记、目录分页、编辑 owner 与会话恢复。主工作区个人文档改动未纳入本次修改。

回归定位还修正了集合删除后从历史 Tab 自动选择邻居的分支；新增单测固定“集合中删除保持空选中”合同，完整文件浏览器冒烟覆盖其真实入口。手机导航测试跟随现有入口：聊天用标题菜单，单文档用底部“更多”；目录键盘测试等待展开后的异步子节点。方法沉淀留在现有设计和回归入口，不新增常驻规则或平行流程。

本地证据：三项 TypeScript 检查、159 项 Bibo 测试、Vite 构建通过；`bibo-routing.smoke.ts` 在 1440/390 宽度覆盖集合、直链、加载竞态、嵌套正文、历史、刷新、错误重试和来源跳转，`bibo-product.smoke.ts` 完整回归通过。浏览器这里使用 API fixtures，真实 Cloudflare 保存与刷新由部署后独立验收覆盖。targeted ESLint 与治理检查通过，diff-only maintainability 无错误；已有超预算 store 较基线缩小，测试与任务组件的临界体积警告经职责复核保留本次单一链路，没有为行数拆出平行 owner。
