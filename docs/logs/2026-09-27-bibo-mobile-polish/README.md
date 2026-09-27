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

## NPM 包发布记录

不涉及 NPM 包发布。Bibo 与 personal-agent-ui 均为 private workspace package，本批添加两包 patch changeset，版本记录交后续统一批次。
