# 定时任务工作台与会话创建链路

## 迭代完成说明

- 将 `/cron` 从卡片式管理页调整为自然增长的任务工作台：AI 会话入口、当前概况、页面流任务列表、低频模板和按需任务详情 Sheet。
- 任务行保留常驻启停状态，编辑和纵向更多操作在桌面 hover / 键盘聚焦时出现；hover 不再产生位移或几何变化。
- 任务行点击改为单项行内快捷预览：同一时间只展开一项，直接查看任务内容、Agent、执行会话和最近运行；铅笔仍独立打开完整管理 Sheet。整行不放常驻展开箭头，减少与编辑、更多操作的视觉竞争。
- 删除列表搜索框的桌面端最大宽度限制，让它占满状态筛选左侧的全部剩余空间；窄容器下继续按可用宽度收缩或换行。
- 新建任务入口删除 58px 高的页面私有输入壳，收敛为 shared Input 的 36px 标准高度、圆角、低对比度边框和无阴影常态；发送入口使用 28px 圆形主按钮，聚焦不改变容器视觉。
- 详情层复用基于 Radix Dialog 的 shared Sheet，头部和底部操作固定，中间内容独立滚动，并支持 Esc、遮罩和关闭按钮退出。
- 运行信息只展示 Cron owner 当前真实拥有的最近一次执行快照，区分绑定会话与独立会话，不伪造运行历史。
- 任务列表采用服务端搜索、状态筛选和分页，默认每页 10 项；概况始终统计全部任务，列表数量统计当前查询结果，多页时显示范围和前后翻页。
- 创建链路由 `ChatSessionListManager` 负责导航和路由状态交接，`createSession` 使用具名 options 合同承接 session type、project root 与 prompt；session conversation input state owner 在首次渲染前建立 composer snapshot，定时任务页面不直接操作聊天编辑器。
- 修正过的根因：最初把路由提示词放到 React effect 中补写，真实浏览器中首次 composer 同步会覆盖这次更新；改为输入状态 owner 的惰性初始值后，提示词和节点在编辑器首次渲染前已经就绪。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/features/cron/components/__tests__/cron-config.test.tsx src/features/chat/managers/__tests__/chat-session-list.manager.test.ts src/features/chat/features/conversation/components/__tests__/session-conversation-area.test.tsx src/features/chat/features/conversation/hooks/__tests__/use-session-conversation-input-state.test.tsx`：28 项通过。
- Cron 分页与行内预览增量验证：Server 路由测试 3 项、Client SDK 测试 14 项、UI 组件测试 7 项通过；覆盖分页参数序列化、服务端筛选/全局概况、单项展开切换、独立开关、翻页和筛选后回到第一页。
- `pnpm --filter @nextclaw/server tsc`、`pnpm --filter @nextclaw/client-sdk tsc`、`pnpm --filter @nextclaw/ui tsc`：全部通过。
- Server、Client SDK 与 UI package lint：全部退出码 0；Server 保留 8 个与本迭代无关的既有 warning，本次触达文件无 lint error/warning。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance`：通过；保留两个未继续恶化的历史目录结构 warning。
- 真实浏览器验收使用 `http://127.0.0.1:5174/cron`：输入“每天上午整理测试项目进展”并点击“进入 AI 会话”，跳转到 `/chat/draft`，编辑器显示完整提示词且发送按钮可用；未实际发送消息。
- 真实浏览器覆盖 1440/760/390 宽度相关子集，无横向溢出；短视口下 Sheet 中间内容 `overflow-y: auto`，头尾操作保持可达；Esc 可关闭。
- 行内预览真实浏览器验收使用 `self-wakeup` 与“微信打招呼”：行点击只展开预览且不打开 dialog，切换任务会自动收起上一项，铅笔才打开 Sheet；搜索后展开态清空。当前 1280px 视口下页面 `scrollWidth === clientWidth`。
- 搜索框剩余空间真实浏览器验收：1280px 视口下搜索区宽 838px、状态筛选区宽 224px、两者间距 10px，页面 `scrollWidth === clientWidth === 1280px`；原型同步删除最大宽度限制。
- 新建任务入口真实浏览器验收：1280px 视口下输入区由 58px 降至 36px，发送按钮由 36px 降至 28px；输入框常态与聚焦态均保持同一低对比度边框且无阴影，页面无横向溢出。
- 分页验收时真实任务库有 9 项，因此页面正确隐藏分页；真实 `/api/cron?limit=3&offset=3&status=disabled` 返回第二页 3 项、筛选总数 9、全局概况总数仍为 9。12 项多页 UI 状态由组件测试覆盖，未向真实任务库写入测试任务。

## 发布/部署方式

本迭代通过本地 Git 提交交付源码、设计文档、原型和治理 skill；未推送、未部署、未发布。

## 用户/产品视角的验收步骤

1. 打开 `/cron`，确认概况位于任务列表之前，任务列表随页面自然增长，模板位于任务之后。
2. 聚焦顶部输入框，确认容器边框和阴影不发生变化；输入需求后按 Enter 或点击发送入口。
3. 确认进入 `/chat/draft`，会话编辑器已经填入原需求，可继续修改后发送。
4. hover 任一任务行，确认行不位移，只出现轻量背景以及编辑、纵向更多操作；启停开关始终可见。
5. 点击任务行，确认只展开当前项的快捷预览且不显示常驻展开箭头；再点击另一项，确认上一项自动收起。
6. 点击铅笔打开任务详情，确认内容区独立滚动、头尾固定，并能通过 Esc、遮罩或关闭按钮退出。
7. 检查绑定会话任务与独立会话任务的标识和打开会话行为。
8. 当任务超过 10 项时，确认只渲染当前页，分页展示结果范围；切换状态或修改搜索词后回到第一页并清理展开态。

## 可维护性总结汇总

- 新增能力沿用现有 Cron feature root，没有保留旧卡片和新列表两套实现。
- 行内预览复用现有 `CronJobView` 与日期/会话格式化 owner，只增加一个页面级 `expandedJobId`，没有新增详情组件、manager、effect 或第二份任务状态。
- 删除浏览器端全量任务筛选路径，分页、搜索和状态口径统一归 Server list controller；SDK 只负责具名参数序列化，UI 只持有页码与筛选视图状态。
- 跳转归 `ChatSessionListManager`，草稿初始状态归 conversation input state owner；页面不通过事件或 effect 建立平行交接链路。
- Sheet 是纯展示、业务无关的 shared primitive，并放入 `ui/overlays` 语义子目录，避免继续扩大已超预算的 shared UI 根目录。
- `post-edit-maintainability-guard` 检查 11 个本次生产路径文件，结果为 0 error、0 warning；主观复核未发现重复 owner、无意义 wrapper 或可继续删除的平行实现。
- 分页增量 guard 检查 9 个生产路径，结果为 0 error、5 个历史/预算接近 warning；`cron-config.tsx` 相对基线仍净减少 13 行，通用 Server API 类型通过拆出 Cron domain 类型文件净减少 46 行，没有为了分页继续膨胀既有大文件。
- 行内预览收尾 guard 检查 3 个 Cron UI 路径，结果为 0 error、1 个预算接近 warning；`cron-config.tsx` 为 467/500 行且组件函数未触发 ESLint 长度 warning。后续若页面继续增长，优先把概况与列表工具区收敛成独立展示组件，不把业务状态另建 manager。
- 分页增量代码增减为新增 638 行、删除 506 行、净增 132 行（含本批次此前工作台重构的同路径差异）；这是新增用户能力，剩余增长用于 Server/SDK/UI 分页合同与验证。旧浏览器端全量筛选路径已经删除，未保留双轨实现。
- 当前 3 个 Cron UI 路径相对 `HEAD` 的总增减为新增 925 行、删除 388 行、净增 537 行；排除测试后新增 664 行、删除 388 行、净增 276 行。增长来自工作台、Sheet、分页与行内预览这些新增用户能力；旧卡片、前端全量筛选和点击行直接开抽屉的路径均未保留。
- 根据本轮用户纠偏，`frontend-style-encapsulation` 增加“已认可原型必须作为同视口视觉验收基线”的可执行检查，避免实现只对齐信息架构。

## NPM 包发布记录

- 本次提交不直接执行 NPM 发布。
- `@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/ui` 已添加 patch changeset，状态为待统一发布。
