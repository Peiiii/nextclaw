# 项目工作项管理

## 迭代完成说明

- 根因：项目页只能通过事件历史扫描推断零散进展，缺少独立、持久、可编辑的工作项事实源；工作项详情还会以内联平铺方式挤压页面，CLI 与项目会话也没有一致的操作入口。
- 确认方式：端到端核对项目注册、会话元数据、Agent 工具装配、Kernel、HTTP、SDK、CLI 与项目页，确认项目路径身份仍应保留，但工作项数据和统计不应写入或扫描项目目录。
- 完成内容：新增项目工作项 SQLite owner、自定义状态、不可变活动时间线、产物关联、软删除与乐观并发；已提交变化只发轻量事件通知 UI 刷新，不读取事件历史生成事实。
- 用户入口：项目会话条件式提供 4 个 CRUD 工具；CLI 使用显式 `--project`；项目概览、列表与看板中的工作项统一点击打开右侧详情抽屉。

## 测试/验证/验收方式

- `@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/service`、`@nextclaw/ui` 和 `nextclaw` 六个包的 TypeScript 检查通过。
- 定向测试通过：Kernel 10、Server 7、SDK 3、Service 2、UI 7、CLI 文档合同 2。
- 变更文件 ESLint、`git diff --check`、新代码治理和 skill 渐进加载检查通过。
- 维护性检查检查 56 个文件，结果为 0 error、12 warning；warning 均为既有目录例外或未越过预算的文件增长，已进行主观复核。

## 发布/部署方式

- 实现与验证在隔离 worktree `codex/project-work-items` 中完成，提交后安全合入远程 `master`，不切换或清理带有活跃 WIP 的主工作区。
- Beta 通过仓库统一入口 `pnpm release:beta` 消费 `.changeset/add-persistent-project-work.md`，发布 NPM beta batch，并在 batch 包含 `nextclaw` 时闭合 beta runtime channel；不包含桌面安装包。

## 用户/产品视角的验收步骤

1. 在项目页创建工作项，切换列表、看板和概览，确认各处点击工作项都打开同一个右侧详情抽屉。
2. 在抽屉中编辑标题、说明、优先级、状态，确认时间线保留多次修改与 Review 往返记录。
3. 关联、打开和移除项目内产物，确认不影响产物本身；软删除后可恢复工作项。
4. 自定义状态与类别并迁移被删除状态上的工作项，确认看板和筛选按新配置展示。
5. 在项目会话中确认工作项工具可用，在非项目会话中确认工具不出现；CLI 未传 `--project` 时必须拒绝执行。
6. 检查项目根目录，确认没有为工作项写入 marker、skill、配置或数据库文件。

## 可维护性总结汇总

- 工作项事实由 Kernel 的单一 manager/store contract 持有，Server、SDK、CLI、Agent 工具和 UI 均复用同一语义，没有平行实现状态机。
- SQLite 通用驱动被复用；状态、活动与工作项存储按 owner 拆分，避免单文件越过预算；UI 工作项组件进入独立 `work/` 子树。
- 会话只保存项目身份元数据，事件只承担失效通知，消除了扫描事件历史与项目目录侵入。
- 自动维护性检查无错误；12 条 warning 已审阅，不需要为消除提醒制造无真实变化点的 wrapper 或空目录层级。

## NPM 包发布记录

项目工作项作为 minor 级用户能力进入统一 beta batch；涉及 `nextclaw`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/service` 和 `@nextclaw/ui`，实际版本与 dist-tag 以统一发布入口的 registry 验证为准。
