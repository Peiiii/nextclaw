# Bibo 界面细节统一与上线

## 迭代完成说明

界面实现、本地验收及线上发布完成。用户要求统一优化 BB 网页的字体、间距、布局与交互，最终选用普通文字 14px，并明确授权发布上线；后续侧边栏与输入区纠正已随第二次前端部署交付。范围见[问题与方案清单](../../designs/2026-09-27-bibo-mobile-polish.design.md)。

普通字号原先分散为 12／13／14／16px，由公共 theme 的 `--text-base` 统一拥有；正文、代码、导航、会话名、表单及输入面板共用，突出标题和空间密集元素保留例外。抽屉模块 40px 行距，独立触控操作 44px；任务首行对齐、窄屏筛选布局、概览状态标签与正文滚动区域均已修正。

会话导航原有三处运行阶段 guard；仅删除禁用会把后台事件写入当前页面。现有 ChatOwner 记录运行会话、历史快照和请求身份，事件及失败恢复按原会话归属，切换不抢路由或覆盖草稿。服务端账号同时一条生成请求的约束保持真实表达。

## 测试/验证/验收方式

本地 Worker／client／runner 与公共 UI tsc、Vite 构建、product／routing／composer／Markdown chat smoke 通过。14px 调整后构建、三份 tsc、product smoke 复跑通过；桌面和手机实际样式读数确认普通字号，窄屏无页面横溢。后台增量、提交、失败和空会话创建竞态由真实 React／SDK SSE 事件回放覆盖。真实手机系统键盘与 ChatGPT 同视口像素差异未实测。

2026-09-28 用户复核发现会话名硬裁切、更多操作反馈不清、左侧图标 hover 不可辨及输入区两端节奏不合适，已回实现修正。端到端样式证据：公共 NavigationItem 的 flex 与 padding 覆盖应用原有 block 和右侧留白；标题改为独立可收缩省略节点，应用明确保留操作槽。图标栏底色与 hover 同用同一 token，改用 selection-hover 作为反馈。桌面 textarea 最小 48px；手机最小 24px，与发送按钮同排；ResizeObserver 仅在宽度变化时重测，避免断点切换残留旧高度。新增断言纳入既有 product／composer／控件反馈 smoke，均通过；BB 三份 tsc、公共 UI tsc 与构建通过。截图保存在当前任务的 `bibo-mobile-polish/after-sidebar-composer-desktop.png` 和 `after-composer-single-line-390.png`。

已部署上一版的 composer 回放与 inbox 五视口（2048／1440／1100／390／320）通过。inbox 原断言不区分鼠标 32px 与触控 44px，已按 pointer 类型修正；导航等待改为 DOM 就绪，后续仍等待实际内容。真实线上模型验收 `bibo-live-31ce2e17`：64 段增量、1 次 display、16.786 秒，对话持久化、Agent 文件、自动 Markdown 预览及桌面／手机打开均通过。首次失败源于模型照自然语言创建内容时附加末尾换行，改为明确 JSON 工具输入后通过；逐字相等的持久化断言保持。该真实验收未覆盖网络搜索，后续纯布局修正沿用服务链路证据。

同期收件箱提交 `77b1fc698` 已合并，保留简化列表、未读标记与相对时间；合并后 BB tsc、构建、product 与 inbox 五视口通过。专项 smoke 的默认 5192 端口被既有 Python 服务占用，原 fetch 就绪检查误认该服务，页面返回 404；改为等待本测试启动的 Vite stdout，端口冲突会明确失败并保留失败截图。实际通过的合并版测试使用已确认空闲的 5492 端口，未重启或删除原服务。新增函数的语句预算提醒已通过提取几何验收步骤修正；最终 diff maintainability 0 错误，产品 smoke 的既有文件预算提醒保留；定向 ESLint 与新增代码治理通过。

## 发布/部署方式

计划精确提交本批、合并同期主线并验证，从干净冻结的远程 master 执行 Bibo `deploy:client`。本批仅网页、静态帮助页和公共 UI，runner、容器及 Worker 到容器协议不变；保留线上镜像。部署前容器 `a03967fb-95da-496d-8c90-a4b4a010667a`，镜像 `sha256:b32bcfb2cde302b69944695df41ee5395ee3f27a6d1d6acc36cc1515f55b381a`、version 22、active、5 实例；部署后核对身份、静态资产和桌面／手机页面。

第一版主线 `5e94a775f10233bef9e93057add605514f83923b` 已通过 deploy:client 上线，Worker 版本 `73fbf673-2d83-4c9c-81e5-ccaf24685f2e`；线上 JS／CSS 与冻结构建逐字节 SHA256 相同，容器 id、镜像、version 与实例数保持。后续侧边栏与输入区修正的最终部署见下文。主工作区原有想法文档 WIP 保留；第一次 `release:reconcile:mainline` 返回 LOCAL_WORKTREE_RETRYING，由 retry worker 负责本地主线闭合，未强行覆盖 WIP。

最终前端部署冻结于干净远程 master `9a154ee3cc0356d536bd794f3c4a6f525d2cc7c5`，执行 `deploy:client --containers-rollout none`（脚本内参数），Worker 版本 `cd617574-8015-4928-b137-ccc5e4d495ba`。线上 composer 回放重新验证桌面 48px、手机 24px 单行与同排发送、内容增长／清空，以及后台切换和失败恢复；收件箱五视口和相对时间检查通过。部署前后容器 id、镜像 SHA256、version 22、5 实例及更新时间完全一致，状态 ready。最终 `release:reconcile:mainline` 继续由已有 pid 53415 retry worker 接管，原因仅为主工作区有受保护的活跃 WIP；远程主线已包含本批，未声称本地 master 已快进。临时 5492 测试服务已停止，原 5388 预览保留。

线上 HTML 引用的三项资产与本地冻结构建字节完全相同：`index-DteeZBvB.js` SHA256 `f8d7a7efd3f0574dfad48d199795b86cc7f568e28999e30fce4b6d9ced0a5aa6`、`index-Dj5nFUvV.css` SHA256 `2891a3ebed06d3b3773f12b7d62fdf2dae01fa3179b4dcb260c7f8c15913f55f`、`katex-Dqjy2yOe.js` SHA256 `d413e993070559d7a1cacd9a13c8155419370991ef6fb60a8e258844ecd041c8`；`/help` 已显示 14px 与两端输入布局说明。最后只提交本发布记录，未修改部署产物，因此不重复部署。线上资源的固定账号／会话回放截图为 `online-composer-desktop.png` 与 `online-composer-390.png`，与前述真实模型检查区分。

`AUTOMATION_INTERVENTIONS: 3`：首轮发布后的验收修正分别是旧桌面尺寸断言、模型文件创建提示含糊、专项测试误认被占用端口。消除落点分别为 pointer 类型断言、明确 JSON 工具输入且保持逐字内容验证、只等待本测试启动的预览并保留失败诊断。用户后续补充的界面修正属于第二批发布准备；正常 dispatch、只读身份核对、瞬时网络传输复验和主线 owner 自动重试不计。没有手工修改线上版本、镜像或发布阶段身份。

连续外框批次已从干净远程 master `6735d6b622fa5e02be8da5f5a105b7b81ba8d6c2` 执行 `deploy:client` 上线，Worker 版本 `17d3eaa4-5f15-4bf7-afa4-d1cc55b7ca68`。线上 `index-ihoBvSWr.js` SHA256 `0d6c3c6bdfd0177fc537e7d4885c8a08bc5ebcfc916a57f4422d8ee8b6705340`、`index-CfzAhL0J.css` SHA256 `d46237456d6106aead0ec586887c08a03ddeb53c03da581610f5ac25567aef90`、原 KaTeX 及 `/help` 与冻结产物逐字节相同。容器完整元数据与发布前完全一致；线上 composer 桌面／手机回放通过。真实线上模型验收 `bibo-live-d8702ede`：64 段增量、1 次 display、16.221 秒，回复持久化、文件逐字内容、自动预览、桌面／手机打开均通过，专用验收账号产物按既有流程清理，未覆盖搜索。768px 实际视口的主标题／工作区标题／内容顶部均为 44px，页面无横溢。主线协调仍由既有 pid 53415 retry worker 接管受保护 WIP；最后仅提交本记录，无需重复部署。该连续外框发布批次 `AUTOMATION_INTERVENTIONS: 0`，前述测试注入函数修正在发布准备期间完成。

## 用户/产品视角的验收步骤

2026-09-28 连续外框纠正：依据用户提供的 Codex 桌面截图，顶部、左侧图标栏及右侧文件标题共用现有 frame 颜色；会话栏与正文组成内侧大圆角面，右侧文件内容独立圆角，统一 8px 外沿与 18px 现有圆角。工作区组件移至主布局，与全局标题共用同一行；复用原 store 和组件，无新增状态或传输路径。收起侧栏恢复内容左侧圆角，手机工作区仍整面覆盖，14px 与桌面 48px／手机 24px 输入行高保持。

BB 三份 tsc、客户端构建、product（两种主题、连续外框、收起侧栏及原模块布局）和 composer（桌面／手机、增长／清空、后台切换／失败恢复）通过。真实浏览器打开 Markdown 文件核对框架与预览；手机 390px 关闭工作区后输入框 24px，页面无横向溢出。截图为 `bibo-mobile-polish/after-continuous-frame-desktop.png`。新增样式与组件 diff maintainability 0 错误／0 提醒，定向 ESLint、新增代码治理及 diff 空白检查通过；新增浏览器几何断言一并人工复核，无未关闭 finding。初次几何测试因 tsx 在嵌套命名函数中注入 `__name` 失败，改用匿名遍历回调后同一 product 验收通过。真实手机系统键盘及与参考应用的同视口逐像素差异未实测。

打开 https://app.bibo.bot/，检查会话、任务和输入面板的统一字号；手机打开抽屉和任务筛选核对间距。进入长对话滚动，输入框保持可见；生成时切换其他会话、编辑草稿，再切回原会话查看回复。失败仍可重试。文件 Markdown 与聊天正文使用同一字号。

## 可维护性总结汇总

复用公共组件配方和唯一 ChatOwner，没有第二套状态或传输路径。diff-only maintainability 为 0 错误、3 条既有预算提醒；定向 ESLint 和主观审查无未关闭 finding。目录改动只有既有设计文档、changeset 与本批发布记录，均通过 planned-path preflight。主工作区其他想法 WIP 保留；发布不包含 NextClaw 文档站、NPM、runtime channel 或桌面安装器。

## 两行文件工作区（2026-09-28）

依据用户提供的文件预览截图，文件区与聊天右侧预览共用 FileTabs：第一行直接置于外框，第二行仅保留路径和操作，随后进入内容。移除重复模块标题、额外标签栏和常驻保存状态；保存按钮仅在有修改或保存期间出现。普通字号仍为 14px。路径各段可点击，以公共 Radix Popover 浏览直属目录、返回上级并打开文件；复用原 files 列表、分页、错误重试及唯一草稿 store，未增加 API 或缓存。

当前标签再选中保留预览模式；关闭当前标签选择相邻文件，最后一个关闭后保留目录入口；保存失败、版本冲突和未保存关闭确认沿用原链路。目录列表未加载完整时不误报空文件夹。长标签按可用宽度省略并保留关闭按钮；手机工具栏内侧绘制分隔线，44px 触控按钮不再因边框占位偏移半个像素。Escape 关闭目录并返回入口焦点，目录返回按钮不叠加会吞掉首次 Escape 的 Tooltip。

首次部署后的资源回归发现，同文件预览模式保留条件过宽，让消息资源链接重新打开 HTML 产物时仍停在编辑模式。条件现限定为未传入 verified 文件详情的同标签操作；资源引用经 manager 重新读取的详情恢复原有默认模式，Agent 显式 preview 优先级保持。修正后三份 BB tsc、1440／390 两行目录与草稿验收、1440／390／320 资源保存／失败／冲突／竞态全链路复跑通过；单行 diff maintainability 0 错误、store 既有预算提醒，无未关闭 finding。

BB 三份 tsc、公共 UI tsc、Vite 构建、product smoke（桌面 1440px／手机触控 390px 的两行结构、目录、草稿、保存、相邻标签、空态、分页、失败重试，以及原模块与两种主题）通过。既有资源 smoke（1440／390／320，含保存期间继续编辑、失败恢复、版本冲突和 display 竞态）与 composer smoke 通过。diff maintainability 15 个文件、0 错误、2 条预算提醒（product 490 行、store 400 行，未扩大 store 行数）；定向 ESLint、新代码治理、治理 ratchet 和 diff 空白检查通过，人工复核无未关闭 finding。

桌面／手机真实浏览器截图为 `bibo-mobile-polish/after-file-two-rows-desktop.png` 与 `after-file-two-rows-390.png`。已更新自身 `/help`、公共 UI README、同批设计与 changeset；这是 BB 专项，不适用 NextClaw 文档站、NPM、runtime、desktop 或迁移发布。真实手机系统键盘及与参考应用同视口逐像素差异未实测。主工作区已有想法文档 WIP 保留。

最终从干净远程 master `046572319077fc861f6785fd4d889c20d2a2c8d0` 执行 `deploy:client`，Worker 版本 `5fac0e0c-8119-4807-9aa6-5de0212ba84a`。此前 `beb125ef9940352947c7d924288617b7408f6a35`／`840ab4dd-222c-4dca-813e-d6155ec5b2ca` 已被这次前向修正替代，未回滚或重复派发同一产物。最终线上 `index-IcKV6GvC.js` SHA256 `e524b00eea59db57dcf8f5219dc93d48895b184764dd4a9909c2362237c2ca36`、`index-WmNRfFqs.css` SHA256 `21421f0d21de13653385594086cd66f99606393228c0c4f71784f4ee1c55f216`、原 KaTeX 以及 `/help` SHA256 `df217993b14e612e6f80955e8e4dbe8cd9779fa96414b134c6c44ff3e120861d` 均与冻结产物字节相同。完整容器元数据与本批发布前相同，未构建或 rollout 镜像。

最终线上实际 JS 的两行目录回放（1440／390）、资源保存／失败／冲突／竞态回放（1440／390／320）、收件箱五视口（2048／1440／1100／390／320）通过；未涉及的 composer 在本批首部署验证桌面／手机通过。最终真实模型验收 `bibo-live-9c0a4f7b`：16 段增量、1 次 display、15.695 秒，回复持久化、Agent 文件逐字内容、自动预览及桌面／手机打开均通过，专用账号产物按既有流程清理；未覆盖搜索。最后只提交发布记录，部署产物保持冻结。

该文件工作区发布批次 `AUTOMATION_INTERVENTIONS: 2`：一处是上述同文件模式保留条件修正，另一处是线上目录验收 fixture 起始状态已打开工作区，须在进入文件区前显式关闭以匹配既有验收初态；同一目录验收函数的布局、草稿和失败断言保持，最终通过。只读资源下载的瞬时传输重试、初始 dispatch、元数据观察和主线 retry 不计。主线协调由既有 retry owner 保留主工作区 WIP 并自动继续，未声称本地 master 已快进。

## 图标栏与目录间距纠正（2026-09-28）

用户补充截图显示左侧入口高亮不居中、目录菜单的图标与文件名被拉成两列。浏览器实际读数确认：52px 图标栏内导航从 x=6 到 42，内侧卡片从 x=60 开始，左右分别 6／18px；目录图标与标题两个 span 都匹配 `flex-1`，被各分到约 141px。将原卡片前的 8px 空隙并入图标栏布局、导航网格居中，展开及收起时内容仍从 x=60 开始；文件列表仅标题弹性伸缩，图标 16px 固定宽。没有改全局字号、配色、导航状态或文件读写 owner。

本地浏览器实测桌面 1440／768px：导航高亮两侧均为 12px，账号与导航同一中线；768px 展开／收起没有页面横溢。目录图标与文件名间距为 8px；手机 390px 浮层在视口内，无横溢。新几何断言已加入既有 product smoke。截图为 `bibo-mobile-polish/after-rail-and-directory-spacing-desktop.png`、`after-directory-spacing-390.png`。两项都是可见布局纠偏，不新增用户操作，故 `/help` 功能说明不需变更。

本次 BB 三份 TypeScript 检查、Vite 客户端构建、product smoke（1440／1280／390／320）、定向 ESLint、diff maintainability（0 错误／0 提醒）、新代码治理与 backlog ratchet 均通过。product smoke 同时覆盖导航展开／收起、两种主题、目录打开和原文件交互；上轮真实 Agent display、资源保存与 composer 链路没有源码变化，本次发布按 CSS 和几何验收，不重复调用模型。

## 后续纠偏：抽屉、会话、日程与文件操作（2026-09-28）

初稿误将桌面图标栏的网格居中规则写入桌面和手机共用的 `.bibo-primary-nav`，造成手机抽屉入口居中。现限定到图标栏，390px 实际浏览器验证抽屉导航从 x=17 横向填满 296px，`justify-items: normal`。新增手机抽屉行对齐断言，防止再次回归。

长会话标题去掉常驻右侧 38px 留白，末端渐隐；更多按钮悬浮出现，并以当前行底色遮挡下面的文字。共用 IconButton 通过 `--ui-icon-hover` 消费承载面提供的反馈色；外框和侧栏分别按底色供值，减少相同背景上的弱反馈。日程「接下来」改为窄日期列加弹性标题列。文件树、搜索和笔记行均复用已有更多菜单与删除确认。追加共用前端交互规范：通用组件及 token 不命名为产品专属能力，产品布局仍由宿主负责。

用户继续指出新日程“添加说明”孤立居中、侧栏日期／数量／新建按钮不在同一中线。表单按钮改左对齐并沿用 16px 字段间距；侧栏标题行改为弹性标题列加两个固定操作列并垂直居中。真实本地浏览器测得三项中心 y 均为 125px；手机 390px 展开说明后上下各 16px，弹窗宽 358px，无页面横溢。

本批与同期主干的缺失文件提示、Markdown 文件链接实现合并；冲突仅在产品回归脚本导入和静态帮助文案，合并后保留两边行为。将通用页面越界检查从 500 行边界的产品脚本移到既有设计系统验收模块。合并后的 BB 三份 tsc、公共 UI tsc、Vite 构建、product、Markdown、资源保存／失败／冲突回归、定向 ESLint、skill 渐进加载及 diff-only maintainability 通过（0 错误，4 条原有预算提醒）。

从干净远程 master `3e9d2fa2ee434dd4ff5ff90125724e527ea46915` 执行 `deploy:client --containers-rollout none`，Worker 版本 `03c40026-4164-404a-aec8-bd5568498965`。线上入口引用的 `index-C9zmtr0Y.js` SHA256 `44e497e636eddc32f35c00599e25af7759d2240b7c374c0792f9d59b7e582b78`、`index-Bxts0dEv.css` SHA256 `66e6088f4033128d070dfdff3c231bf53bcf621d29c91dae725829d9ce80f647`、KaTeX JS 及 `/help` 均与冻结构建字节一致；部署前后完整容器元数据相同。线上实际资产回放通过 1440／390px 文件两行工作区与文件行更多、移动／重命名／确认删除，资源与日程回归覆盖 1440／390／320px，收件箱覆盖 2048／1440／1100／390／320px。本批仅前端与文案，不重复调用真实模型；真实 Agent 链路沿用上轮验收证据。最终只追加本发布记录，不再部署静态资产。

## NPM 包发布记录

不涉及 NPM 包发布。Bibo 与 personal-agent-ui 均为 private workspace package，本批添加两包 patch changeset，版本记录交后续统一批次。

## 会话与文件行操作反馈纠偏（2026-09-28）

用户在生产站指出长会话标题仍透到更多按钮旁边、笔记行 hover 后出现双层底色与过长提示、文件树每行操作常显。实测会话标题末端仅有 28px 渐隐，按钮遮挡层宽 52px，且靠近按钮才变成不透明。第一次加宽到按钮前 72px 起始过渡，线上复核发现提前吞掉太多标题；随即缩到按钮前 42px 开始、34px 内完成过渡，按钮前保留 8px 纯背景。默认状态仍由标题占满整行，视觉层不拦截会话链接。笔记的选中背景改为整行唯一绘制，更多按钮继续复用公共 IconButton 和 ActionMenu，提示缩短为「更多操作」。公共 RowActionTray 统一文件树、搜索结果和笔记行：桌面 hover 或键盘焦点出现，触屏常显，默认不占标题宽度；渐隐层不接收点击，仅实际按钮可命中。

本地 BB 与公共 UI tsc、Vite 构建、完整 product smoke、1440／390px 定向文件与笔记操作回归、ESLint、diff-only maintainability（0 错误／0 提醒）、新增代码治理和 backlog ratchet 均通过。视觉截图复核了默认／hover、选中及手机触屏状态；未改文件持久化、Worker 或容器链路。先前新增的回归断言使单函数超过语句预算，已按文件行反馈与笔记行反馈拆开，同一回归再次通过。

冻结远程 master `aa4156550b3f33b510058eccbfd934ae175ec726` 后执行 `deploy:client --containers-rollout none`，Worker 版本 `dc9cf177-1918-405f-bf8f-560e4a87c0e0`。线上 JS `index-CtEcxxAx.js` SHA256 `ec43cc6e9372a04e62e8c4f9817961684b5d1bcc9c446d9a0d410380b5c98395`、CSS `index-BJD-BEbS.css` SHA256 `ef27a15752cc59bc906590713a424c3dc2b279ab9abf0c2efb16981822347059`、KaTeX 与 `/help` 均与本次构建逐字节相同。生产域名上以 API fixture 回放了 1440／390px 会话渐隐和文件树、搜索结果、笔记菜单，收件箱五视口回归也通过。容器 id `a03967fb-95da-496d-8c90-a4b4a010667a`、镜像 SHA256 `4ef68e222cc8ea7f8bdd9681aa1ca78890cda123eda9e8b522ff24b388fe364c`、version 23、5 实例及更新时间部署前后相同。真实手机系统浏览器和本用户账号数据未直接回放；本批由线上静态资产一致性及模拟桌面／手机交互证明前端结果，不重复调用真实模型。

本次为已有界面反馈纠偏，不新增用户操作或帮助页入口；已有前端交互规范已经要求悬浮操作默认零占位，具体实现收敛到公共组件，无需增写平行规则。`AUTOMATION_INTERVENTIONS: 0`。主工作区既有想法文档 WIP 保留，主线回流交现有 reconcile owner 判定。

## 手机认证页比例与操作渐隐纠偏（2026-09-28）

### 后续构图纠偏

前版虽解决截断，450px 的手机品牌区仍存在大块空白和视觉分离；AI 自评不满意后曾错误停止，用户要求自行设定目标并继续。沿原质量收敛合同返工，没有增加平行规则：手机改为单一背景、居中角色与欢迎语、连续表单；长屏整组下移平衡留白，短屏收紧，Logo 仍在顶部。第二步统一 96px 顶部区，避免 320px 角色与表单过近。未改变鉴权状态或 API。

实拍两轮：首轮解决色块拼接，但长屏重心偏上；第二轮平衡整组位置后，390×844 主按钮底部 599px、提示底部 639px，390×664 分别为 501px／541px，320×568 为 469px／509px，均无初始页面溢出。角色、标题和表单无交叠，经典／简约主题及桌面均复核。缩短至 380px 的模拟键盘视口可滚动到操作。复盘结论：既有质量方法足够，此次补齐其实际截图及完成判断证据，不再新增“务必检查”类规则；真实 iOS 系统键盘和用户个人审美判断仍不冒充已验证。

用户从真实手机指出登录页的角色被表单截断、表单下方有大量空白，也指出会话渐隐过宽、笔记行默认出现无来由的渐隐块。认证页根因是固定 184px 品牌区和撑满剩余高度的表单，再用 `margin-top:auto` 把安全提示推到底部；现让品牌区按视口高度变化，角色完整位于表单之上，表单按内容自然排列，试用提示紧跟主按钮。窄屏品牌主句与提示分别收为完整两行与单行；验证码／密码第二步的小角色也完整露出。会话标题的渐隐收至按钮前 42px 起始、按钮前 8px 完全遮盖，公共 RowActionTray 删除渐隐伪元素；桌面 hover／焦点和触屏常显的按钮规则保留。

本地最终版在 390×844、390×664、320×568 真实浏览器视口实拍：注册首屏角色不截断、不撞文案，主按钮与试用提示均在首屏且间隔 18px，无横向或纵向溢出；320×380 模拟键盘高度时认证页可滚动至主按钮。注册／登录第二步、验证码发送与重发、修改邮箱及返回链路通过。经典／简约两主题已复看。BB 三份 tsc、公共 UI tsc、Vite 构建、完整 product smoke、routing smoke、定向 ESLint、diff-only maintainability（0 错误／0 提醒）及 diff 空白检查通过；最新并行 Markdown 编辑器主干合入后重新跑过上述关键验收。实际 iOS Safari 软键盘、用户账号真实注册及用户主观喜好未直接验证。

从冻结远程 master `f69951ba4` 执行 `deploy:client --containers-rollout none`，Worker 版本 `3c39a9c9-9d65-4d99-9885-7cb5105e85d7`。生产 HTML 所引用的入口 JS `index-ENV4n3_X.js` SHA256 `41d5b4e38ba5c054cc81b6381de3f4e6390853d2b0580dfb81d55a0817d45c55`、CSS `index-N3m1ICYQ.css` SHA256 `c7a4c4813aa8ef14bbc62b1db538858b571d5af25ff2d70eeeaad4b5e3c23278`、其余直引 JS 与 `/help` 均与冻结构建逐字节相同。生产域名加载真实资产并用 API fixture 模拟未登录状态，在 390×844、390×664、320×568、320×380、1440×900 实拍首屏和第二步；1440／390px 会话渐隐、文件与笔记操作，以及五视口收件箱回放通过。容器 id、镜像 `sha256:5321b947e19e609a4b75b703b558786ae0924f53cd1716e4b30ebea376df0852`、version 24 和更新时间部署前后相同；实例数的运行时波动不作为镜像变更。此次只发布客户端与 Worker 静态资产，未部署 NPM、runtime 或桌面应用。
