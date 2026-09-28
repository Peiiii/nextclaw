# Bibo Markdown 阅读与编辑升级

## 迭代完成说明

用户要求 Markdown 默认预览，并将成熟的编辑体验落地上线。根因由远程主线两个 FileEditor consumer 与 textarea 实现确认；初始主工作区落后于当前 Bibo，任务从 `a23b961c0` 隔离启动，原工作区思考文档未触碰。

实现默认预览、CodeMirror 即时格式／源码、代码语法高亮、格式工具、列表续行、查找替换、撤销重做及三态切换保留实例。复杂表格、公式与图表继续使用既有阅读 renderer，编辑保留原文。保存复用既有版本合同；按账号隔离的当前标签页草稿备份提供刷新恢复，显示备份失败，清空空间同步清理备份。

设计：[阅读与编辑方案](../../designs/2026-09-28-bibo-markdown-editor.design.md)。文档已同步中英文 Bibo 指南、应用与共享组件 README。

## 测试/验证/验收方式

- Worker、client、runner 三份 tsc；personal-agent-ui tsc；Vite production build。
- 完整产品 smoke（进程隔离端口及构建 HTML 身份校验）覆盖原有聊天、文件/笔记、关闭重开、保存刷新、桌面手机与主题。
- 编辑定向 smoke：1440/390/320px 默认预览、格式与源码高亮、真实 Chromium IME composition、节点身份、撤销重做、查找、列表续行、刷新草稿、503 重试、409 恢复及保存中继续输入。
- 草稿单测覆盖账号隔离、基版本、保存清理、无效数据和存储配额错误。原 store Node 测试因已有 router → app CSS 导入而无法在 tsx 中加载；不计为通过，改以真实页面组装链路证明本次状态行为。
- targeted ESLint、governance、ratchet 与 maintainability 检查；脚本和 store 既有近预算提示保留，无新增预算豁免。
- 视觉截图在 `/tmp/bibo-markdown-editor-{1440,390,320}.png`；纯审美仍由用户判断。浏览器模拟不能宣称所有实体手机输入法通过。

## 发布/部署方式

授权来自“那你来落地上线”。只影响前端，采用干净远程 master 的 `pnpm -C apps/bibo-hosted run deploy:client`，无数据库迁移、NPM、桌面或容器 rollout。

部署冻结 SHA：`836bc2c92999fce60f113fbded29f29e8c26c4c8`，已包含并行主线 `aa4156550` 的界面修正。部署前后两次 preflight 通过。正式 Worker 版本：`7379a7ce-1103-45ac-bf99-4741d46093a1`。

部署前后容器 `bibo-hosted-bibousercontainer` application version 均为 23，image digest 均为 `sha256:4ef68e222cc8ea7f8bdd9681aa1ca78890cda123eda9e8b522ff24b388fe364c`，确认未 rollout。

正式站 1440/390/320px 定向 fixture 验收全部通过，覆盖实际部署资源的编辑、IME、长文滚动、草稿恢复、失败与冲突。独立真实账号通过正常 UI 创建笔记，在 1440px 和 390px 编辑／保存，服务端逐字内容校验、刷新默认预览全部通过；仅删除本轮测试笔记。线上截图 `/tmp/bibo-markdown-editor-live-{1440,390}.png`。

`pnpm release:reconcile:mainline` 返回 `LOCAL_WORKTREE_RETRYING`：远程 master 已完成，本地主工作区因原有活跃文档 WIP 保留不动，自动 retry worker 已接管；本任务源区无遗漏。AUTOMATION_INTERVENTIONS: 0。

## 用户/产品视角的验收步骤

在 app.bibo.bot 刷新，打开任意 Markdown 文件或笔记，先阅读预览；切换编辑查看即时格式、切换源码查看语法高亮；输入中文和列表，预览往返、撤销重做后保存，刷新确认内容。手机通过“更多格式”添加标题、列表或行内代码。未保存内容仅备份在当前标签页，关闭前应保存。

## 可维护性总结汇总

复用现有 file-state 纯状态转换与 Bibo store 保存 owner，不引入第二文档模型、存储 API 或富文本 serializer。共享编辑器归现有 Markdown 组件目录，第三方编辑器生命周期通过 effect 同步，业务网络与恢复不进入 UI 包。维护性告警已通过按职责归位关闭；这属于本次实现调整，不新增全局规则。端口冲突教训落实为现有产品 smoke 的进程隔离端口、产物身份校验与直接管理 Vite 子进程，避免验证到别的 worktree。

## NPM 包发布记录

不适用：独立托管 Bibo 前端上线。两个私有包的用户可见变化已写 changeset，不触发 NextClaw NPM/runtime/desktop 发布。


## 同日第二轮：正文直接编辑与体验优先

用户反馈第一版仍不像成熟的 Markdown 写作体验，要求 AI 自定目标、集中排查并对标 Typora；进一步纠偏“用户体验是第一位的，开发成本比较小”，并要求提供可尽早反馈的预览链接。此轮继承上线授权，独立验收合同见 [BT-01..08](../../work/2026-09-28-bibo-typora/acceptance-contract.md)，设计见 [正文编辑设计](../../designs/2026-09-28-bibo-typora.design.md)。此前 CodeMirror 即时装饰结论仅描述上一版，不代表本轮最终架构。

最终选择 Tiptap 3.31.3 / ProseMirror 作为正文内核，CodeMirror 仅作为精确源码入口；移除 Milkdown 试验依赖和旧 liveDecorations。选择依据为 [24组性能与保真实验](artifacts/2026-09-28-editor-benchmark.md)，不是“现成组件更多、开发更便宜”。两内核分别按需加载，停顿250ms转换Markdown，保存/失焦/离开立即同步，避免每个按键全文转换。新增表格行列、链接/图片改址、公式编辑、代码高亮与 Mermaid 预览；原文节点保护 frontmatter、HTML、脚注和引用定义。保存/版本/草稿 owner 不变。

当前证据：UI与宿主三份 tsc、targeted ESLint、production build、产品 smoke 通过；编辑 smoke 覆盖1440/390/320px、中文IME、跨段删除与撤销、列表缩进退出、对象编辑、精确模式往返、草稿恢复、503/409、保存中继续富文本输入。集成300节CPU4x按键到下一帧p95约12–18ms；单机模拟，不宣称全设备等价。主入口JS gzip由约519KB降至348KB，两个编辑内核不由默认阅读加载。图表React root延迟清理修复StrictMode卸载警告。

用户预览为本机43988端口的独立临时空间，已提供直达测试笔记链接；可自由修改，不影响线上。使用既有UI开发入口，不引入平行预览架构。

Review：单 manager 管理事务与投影，两个编辑视图各持自身历史但共用Markdown草稿；格式和插入UI复用共享控件。自动检查零错误，产品smoke既有近预算告警不扩大处理。无新全局规则；体验优先偏好写入个人知识库原领域，未对该独立仓库提交。第二轮尚待线上验收，不以第一轮生产证据替代。

成品复查补充：真实整页发现待办勾选框与正文错行，根因为内核 NodeView 未输出静态 data-type；通过扩展的正式 HTMLAttributes 配置修复，并新增桌面/窄屏位置与勾选回归。修后截图 `/tmp/bibo-user-preview.png` 已复看。普通产品脚本近预算及编辑 smoke 增长为已审查提示，后者按写作、对象、列表、存储各自函数组织，无维护性错误。合并主干的类型缓存通过重建 kernel/harness 产物闭合，合并后产品 smoke 通过。


### 第二轮正式部署与验收

2026-09-28 冻结 `bcb0d384645e5445503229412341cbaa74995cfc`，使用 `deploy:client`，两次 clean/remote-master preflight 均通过。Worker `f56e774c-51cb-4baa-845a-cf75675f6ff0`；线上 HTML 引用 `/assets/index-BRdnLowS.js`，与本次构建一致。早先一次并发主干更新由 preflight 在上传前拒绝，随后正常合并日程提交并重验，没有强推或覆盖别人工作。

本轮实际部署前后容器均为 application version24，image `sha256:5321b947e19e609a4b75b703b558786ae0924f53cd1716e4b30ebea376df0852`，max_instances20。此前version23到24属于并行延迟任务的后端发布，本轮等其发布完成后才冻结镜像基线；没有镜像构建或rollout。

线上发布资源定向 smoke 在1440/390/320px全部通过，含中文IME、跨段历史、表格、待办对齐/勾选、列表缩进/退出、公式、图表、链接/图片、保真、草稿/失败/冲突及保存中继续输入。正式资源300节CPU4x按键到下一帧p95为13.4ms（本机Chromium）。真实账号在1440/390px通过正常UI创建唯一测试笔记，源码逐字保存，刷新默认预览，正文输入后立即Cmd/Ctrl+S保存并由服务端读取确认；仅清理本轮测试笔记。线上截图 `/tmp/bibo-markdown-editor-live-{1440,390}.png`。

远程master已闭合；`release:reconcile:mainline`返回LOCAL_WORKTREE_RETRYING，现有retry worker自动处理主工作区原有文档WIP，任务无源区遗漏。无需数据库迁移、NPM/runtime/desktop或文档站部署。AUTOMATION_INTERVENTIONS: 0。BT-01..08均有有效通过证据；审美和真实设备全平台体验不冒充已经用户验收。


### 第三轮：统一块操作与编辑交互

用户连续截图纠偏表明原局部按钮和块尾光标方案未形成统一体验。本轮改用官方 Tiptap Drag Handle 定位、目标与拖动生命周期，MarkdownBlockManager 统一菜单/事务；删除各 NodeView 的重复整块按钮。列表按项及子孙操作，表格区分整块与行列作用域。编辑专用手柄覆盖 padding/min-size/hover surface，复用行为而不继承通用按钮几何。表格插入通过同一 TableMap 事务选中新单元格，选择边框贴合外缘。

读写共用 markdown-document 样式。slash 命令单活动项、描述与窄屏碰撞；行内公式/公式块分开命名和序列化。空段落 $$ 加空格/回车创建公式块；取消保留原文，aligned 示例和多行预览可直接使用。菜单文案从构造快照改为跟随 props 更新，避免开发预览长期打开时新增名称空白。正文交互测试须等待内核选区同步，不能把浏览器原生选区变化视为编辑器已经完成选择。

当前验证：1440/390/320px 完整编辑回归、三宽度两类公式名称/插入/源码与预览往返，触摸手柄与resize关闭，产品smoke、UI/宿主三份tsc、生产构建通过。300节CPU4x按键到帧p95 21.6ms，主包gzip约349KB，富编辑lazy约319KB。diff maintainability零错误，主测试461行近预算提示已审查，各功能独立函数且后续块操作已拆分，不扩大无关重构。治理/skill加载/ratchet通过。单owner及异步清理主观review通过。待线上部署验收，不沿用第二轮线上证据。
