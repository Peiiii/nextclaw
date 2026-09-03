# 项目工作项管理

## 迭代完成说明

- 根因：项目页只能通过事件历史扫描推断零散进展，缺少独立、持久、可编辑的工作项事实源；工作项详情还会以内联平铺方式挤压页面，CLI 与项目会话也没有一致的操作入口。
- 确认方式：端到端核对项目注册、会话元数据、Agent 工具装配、Kernel、HTTP、SDK、CLI 与项目页，确认项目路径身份仍应保留，但工作项数据和统计不应写入或扫描项目目录。
- 完成内容：新增项目工作项 SQLite owner、自定义状态、不可变活动时间线、产物关联、软删除与乐观并发；已提交变化只发轻量事件通知 UI 刷新，不读取事件历史生成事实。
- 用户入口：项目会话条件式提供 4 个 CRUD 工具；CLI 使用显式 `--project`；项目概览、列表与看板中的工作项统一点击打开右侧详情抽屉。
- 后续根因收敛：Project Work 上线时仍保留了旧 `nextclaw.project/v1` 会话 Marker 的只读兼容链，导致历史消息中的无效 Marker 继续生成 `PROJECT_MARKER_INVALID`。本批通过端到端检索 producer、parser、projection、公共类型与 UI consumer 确认双 owner 仍然存在，并彻底删除 Marker 解析、生成 Skill、request/response UI 和旧配置合同；历史 Marker 现在只作为普通消息文本存在。
- 零配置材料收口：进一步确认 Marker 删除后仍残留 `ProjectObservationService`，它会读取 `.nextclaw/project.yaml`、扫描项目文件与全部历史会话，Kernel 冷启动还会通过全部会话反向导入项目。本批删除整条 observation 链和启动导入；产物、Skills、工作约定分别收敛到 Project Work 显式关联、当前项目 `.agents/skills` 和根 `AGENTS.md`。

## 测试/验证/验收方式

- `@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/service`、`@nextclaw/ui` 和 `nextclaw` 六个包的 TypeScript 检查通过。
- 定向测试通过：Kernel 10、Server 7、SDK 3、Service 2、UI 7、CLI 文档合同 2。
- 变更文件 ESLint、`git diff --check`、新代码治理和 skill 渐进加载检查通过。
- 维护性检查检查 56 个文件，结果为 0 error、12 warning；warning 均为既有目录例外或未越过预算的文件增长，已进行主观复核。
- Marker 删除批次补充验证：Kernel 10 项、UI 12 项定向测试通过，Kernel、UI、Core、Server、Client SDK、Service TypeScript 检查通过；旧协议、错误码、响应桥与生成 Skill 的当前源码扫描无命中。skill 渐进加载总体积检查在主工作区原基线同样超出 42 字节，与本批无关。
- 零配置材料收口验证：Core 16 项、Kernel 25 项、Server 17 项、SDK 3 项、Service 3 项、CLI 3 项、Projects UI 37 项定向测试通过；7 个受影响包 TypeScript、完整发布构建、变更文件 ESLint、文档镜像、生成资源、新代码治理和 backlog ratchet 通过。冷启动测试直接断言 `sessionManager.listSessions` 调用为 0；旧 observation 源码与构建产物扫描无命中，HTTP 旧入口返回 404，构建后的 CLI help 不再注册 `projects observe`。diff-only Review 覆盖 50 个文件，0 error、no findings。

## 发布/部署方式

- 实现与验证在隔离 worktree `codex/project-work-items` 中完成，提交后安全合入远程 `master`，不切换或清理带有活跃 WIP 的主工作区。
- Marker 删除与状态分组简化在隔离分支 `codex/simplify-work-state-groups` 完成，经合并提交 `581960bc2` 合入并推送 `origin/master`；`release:reconcile:mainline` 返回 `LOCAL_MAINLINE_SYNCED`。
- 零配置材料收口在隔离分支 `codex/remove-project-observation` 完成，功能提交 `4c6e72973` 经合并提交 `e363d73b0` 进入本地 `master`；`origin/master` 保持在 `e8a4ec84f`，未推送、未发布、未重启当前实例。
- Beta 通过仓库统一入口 `pnpm release:beta` 消费 `.changeset/add-persistent-project-work.md`，发布 NPM beta batch，并在 batch 包含 `nextclaw` 时闭合 beta runtime channel；不包含桌面安装包。

## 用户/产品视角的验收步骤

1. 在项目页创建工作项，切换列表、看板和概览，确认各处点击工作项都打开同一个右侧详情抽屉。
2. 在抽屉中编辑标题、说明、优先级、状态，确认时间线保留多次修改与 Review 往返记录。
3. 关联、打开和移除项目内产物，确认不影响产物本身；软删除后可恢复工作项。
4. 自定义状态与类别并迁移被删除状态上的工作项，确认看板和筛选按新配置展示。
5. 在项目会话中确认工作项工具可用，在非项目会话中确认工具不出现；CLI 未传 `--project` 时必须拒绝执行。
6. 检查项目根目录，确认没有为工作项写入 marker、skill、配置或数据库文件。
7. 打开包含历史 Marker 文本的项目，确认项目主页不再出现 Marker 诊断或确认/拒绝请求；列表与看板的状态分组没有外层卡片，工作项自身边界仍然保留。

## 可维护性总结汇总

- 工作项事实由 Kernel 的单一 manager/store contract 持有，Server、SDK、CLI、Agent 工具和 UI 均复用同一语义，没有平行实现状态机。
- SQLite 通用驱动被复用；状态、活动与工作项存储按 owner 拆分，避免单文件越过预算；UI 工作项组件进入独立 `work/` 子树。
- 会话只保存项目身份元数据，事件只承担失效通知，消除了扫描事件历史与项目目录侵入。
- 自动维护性检查无错误；12 条 warning 已审阅，不需要为消除提醒制造无真实变化点的 wrapper 或空目录层级。
- 后续批次净删除旧 Marker 主链及 UI 残留，工作项事实 owner 进一步收敛到 Project Work；diff-only 检查为 0 error、2 条未恶化的既有预算 warning，没有新增兼容层或抽象跳转。

## NPM 包发布记录

项目工作项作为 minor 级用户能力进入统一 beta batch；涉及 `nextclaw`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/service`、`@nextclaw/shared` 和 `@nextclaw/ui`，实际版本与 dist-tag 以统一发布入口的 registry 验证为准。

Marker 删除通过 `.changeset/remove-project-markers.md` 进入后续统一发布批次；本次只完成提交与主干集成，没有执行 NPM 发布。
