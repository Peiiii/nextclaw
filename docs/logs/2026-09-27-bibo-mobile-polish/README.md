# Bibo 界面细节统一与上线

## 迭代完成说明

界面实现及本地验收完成，发布进行中。用户要求统一优化 BB 网页的字体、间距、布局与交互，最终选用普通文字 14px，并明确授权发布上线。范围见[问题与方案清单](../../designs/2026-09-27-bibo-mobile-polish.design.md)。

普通字号原先分散为 12／13／14／16px，由公共 theme 的 `--text-base` 统一拥有；正文、代码、导航、会话名、表单及输入面板共用，突出标题和空间密集元素保留例外。抽屉模块 40px 行距，独立触控操作 44px；任务首行对齐、窄屏筛选布局、概览状态标签与正文滚动区域均已修正。

会话导航原有三处运行阶段 guard；仅删除禁用会把后台事件写入当前页面。现有 ChatOwner 记录运行会话、历史快照和请求身份，事件及失败恢复按原会话归属，切换不抢路由或覆盖草稿。服务端账号同时一条生成请求的约束保持真实表达。

## 测试/验证/验收方式

本地 Worker／client／runner 与公共 UI tsc、Vite 构建、product／routing／composer／Markdown chat smoke 通过。14px 调整后构建、三份 tsc、product smoke 复跑通过；桌面和手机实际样式读数确认普通字号，窄屏无页面横溢。后台增量、提交、失败和空会话创建竞态由真实 React／SDK SSE 事件回放覆盖。真实手机系统键盘与 ChatGPT 同视口像素差异未实测。

2026-09-28 用户复核发现会话名硬裁切、更多操作反馈不清、左侧图标 hover 不可辨及输入区两端节奏不合适，已回实现修正。端到端样式证据：公共 NavigationItem 的 flex 与 padding 覆盖应用原有 block 和右侧留白；标题改为独立可收缩省略节点，应用明确保留操作槽。图标栏底色与 hover 同用同一 token，改用 selection-hover 作为反馈。桌面 textarea 最小 48px；手机最小 24px，与发送按钮同排；ResizeObserver 仅在宽度变化时重测，避免断点切换残留旧高度。新增断言纳入既有 product／composer／控件反馈 smoke，均通过；BB 三份 tsc、公共 UI tsc 与构建通过。截图保存在当前任务的 `bibo-mobile-polish/after-sidebar-composer-desktop.png` 和 `after-composer-single-line-390.png`。

已部署上一版的 composer 回放与 inbox 五视口（2048／1440／1100／390／320）通过。inbox 原断言不区分鼠标 32px 与触控 44px，已按 pointer 类型修正；导航等待改为 DOM 就绪，后续仍等待实际内容。真实线上模型验收 `bibo-live-31ce2e17`：64 段增量、1 次 display、16.786 秒，对话持久化、Agent 文件、自动 Markdown 预览及桌面／手机打开均通过。首次失败源于模型照自然语言创建内容时附加末尾换行，改为明确 JSON 工具输入后通过；逐字相等的持久化断言保持。该真实验收未覆盖网络搜索，后续纯布局修正沿用服务链路证据。

## 发布/部署方式

计划精确提交本批、合并同期主线并验证，从干净冻结的远程 master 执行 Bibo `deploy:client`。本批仅网页、静态帮助页和公共 UI，runner、容器及 Worker 到容器协议不变；保留线上镜像。部署前容器 `a03967fb-95da-496d-8c90-a4b4a010667a`，镜像 `sha256:b32bcfb2cde302b69944695df41ee5395ee3f27a6d1d6acc36cc1515f55b381a`、version 22、active、5 实例；部署后核对身份、静态资产和桌面／手机页面。

第一版主线 `5e94a775f10233bef9e93057add605514f83923b` 已通过 deploy:client 上线，Worker 版本 `73fbf673-2d83-4c9c-81e5-ccaf24685f2e`；线上 JS／CSS 与冻结构建逐字节 SHA256 相同，容器 id、镜像、version 与实例数保持。以上后续侧边栏与输入区修正将再次冻结主线后部署前端。主工作区原有想法文档 WIP 保留；第一次 `release:reconcile:mainline` 返回 LOCAL_WORKTREE_RETRYING，由 retry worker 负责本地主线闭合，未强行覆盖 WIP。

## 用户/产品视角的验收步骤

打开 https://app.bibo.bot/，检查会话、任务和输入面板的统一字号；手机打开抽屉和任务筛选核对间距。进入长对话滚动，输入框保持可见；生成时切换其他会话、编辑草稿，再切回原会话查看回复。失败仍可重试。文件 Markdown 与聊天正文使用同一字号。

## 可维护性总结汇总

复用公共组件配方和唯一 ChatOwner，没有第二套状态或传输路径。diff-only maintainability 为 0 错误、3 条既有预算提醒；定向 ESLint 和主观审查无未关闭 finding。目录改动只有既有设计文档、changeset 与本批发布记录，均通过 planned-path preflight。主工作区其他想法 WIP 保留；发布不包含 NextClaw 文档站、NPM、runtime channel 或桌面安装器。

## NPM 包发布记录

不涉及 NPM 包发布。Bibo 与 personal-agent-ui 均为 private workspace package，本批添加两包 patch changeset，版本记录交后续统一批次。
