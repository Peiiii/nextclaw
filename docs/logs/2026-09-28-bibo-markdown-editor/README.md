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
