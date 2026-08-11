# 项目文件 Explorer 与 NextClaw v0.31.0 发布

## 迭代完成说明

本次把会话工作区从彼此割裂的“项目文件页 / 文件预览页”收敛为共享 Explorer 与多文件预览连续协作的工作界面，并闭合 NextClaw v0.31.0 stable 发布。

- 场景目标：用户应在保留当前预览上下文的同时浏览、创建、上传、下载、重命名和删除项目文件，并能把文件、文件夹或划选片段直接加入聊天。
- 交互修正：Explorer 默认宽度缩小为紧凑值，支持拖拽和持久化；只有工作区低于紧凑阈值时才使用覆盖侧栏。新建项目滚动到输入位置，面包屑保持单行，项目根目录空白处支持右键菜单，文件夹不再出现含义错误的“打开”。
- 根因：早期实现把目录浏览和文件预览作为互斥页面，响应式阈值又只按固定宽度切换；嵌套覆盖层同时遮挡了外层工作区 resize handle。文件与文件夹共用菜单首项还造成了错误语义。
- 确认方式：对比冻结的 HTML 原型与用户提供的 NextClaw/Cursor 截图，并沿 workspace panel、共享 Explorer、外层 resizable panel、Zustand persistence 和 server-path API 的真实链路逐项验证。
- 根因修复：共享 Explorer 实例在项目页和文件页之间保持挂载；布局 hook 统一拥有阈值、拖拽宽度与持久化；外层 resize shield 明确高于嵌套覆盖层；文件与目录菜单按对象语义分别构建。
- 服务端所有文件写操作以项目根目录作为边界，同名上传默认不覆盖，删除需要明确确认。

方案与实现依据：

- [工作区项目文件管理设计](../../designs/2026-08-10-工作区项目文件管理.design.md)
- [共享工作区文件浏览器实现计划](../../plans/2026-08-11-共享工作区文件浏览器.implementation-plan.md)
- [交互原型](../../designs/2026-08-11-shared-workspace-explorer.prototype.html)

## 测试/验证/验收方式

- 服务端 server-path controller：29 项通过、2 项按环境跳过；覆盖项目根边界、新建、上传覆盖策略、重命名与递归删除。
- Client SDK：18 项通过；覆盖新增 server-path 请求和返回协议。
- UI 定向回归：96 项通过；覆盖共享 Explorer、文件/文件夹菜单、新建定位、面包屑、覆盖阈值、宽度拖拽与持久化、外层 resize shield、文本划选和聊天引用。
- `@nextclaw/client-sdk`、`@nextclaw/server`、`@nextclaw/ui` TypeScript 检查通过。
- 三个触达包 ESLint 通过；只有仓库既有复杂度/文件长度 warning，无新增 error。
- 文档站与官网生产构建通过。
- 中英文公开截图均为 `3024 × 1656`，源图与 landing 镜像 SHA-256 分别一致；已人工检查无内部设计稿、错误态、个人路径或破图。
- release stable 脚本新增的 surface review 单元测试 11/11 通过。
- 完整 stable dry-run、严格 release check、registry、runtime channel 和真实安装升级证据在正式发布阶段补充。

## 发布/部署方式

- 产品代码、文档站、官网、截图与发布门禁先提交到本地 `master`，同步 `origin/master` 后推送。
- 完整 stable 发布使用 `pnpm release:stable`，先 dry-run，再由合同脚本完成 version、严格检查、NPM publish、release commit/tag/push、stable runtime channel 和真实安装升级。
- 文档站使用仓库 `docs-deploy.yml`，官网使用 Cloudflare Pages `nextclaw-landing`；发布后分别验证公开 URL。
- `minor` / `major` 新门禁要求 `docs/releases/nextclaw-v<version>.release-review.json` 同时审查文档站与官网，缺失或无理由的 `not-needed` 会在 publish 前阻断。

## 用户/产品视角的验收步骤

1. 打开任意会话项目文件，再打开一个 Markdown 或代码文件，确认目录树与预览同时存在，连续文件进入独立标签页。
2. 从顶部工具栏分别新建文件和文件夹，确认输入行自动进入视口；在项目根空白处和子文件夹右键，确认菜单目标目录正确。
3. 上传多个文件、下载 Agent 生成文件、重命名与删除项目，确认同名覆盖和删除都有明确确认。
4. 拖动 Explorer 分隔线并刷新，确认宽度保留；再缩窄工作区，确认达到阈值后才使用覆盖侧栏。
5. 在覆盖侧栏打开时拖动整个会话工作区边界，确认外层 resize 仍可操作。
6. 划选文件或会话文字，确认浮层稳定出现并可添加到聊天。
7. 打开中英文文档站版本说明与官网版本更新，确认截图、文案和链接正常。

## 可维护性总结汇总

- Explorer 状态、阈值、拖拽和持久化集中在单一 layout hook/store 主链路，文件操作集中在 action hook 与 server-path API，没有建立平行状态 owner。
- 项目文件菜单按文件/目录语义拆分为可测试 builder，避免在大组件中继续累加条件分支。
- 新文件均通过 planned-path preflight；新增发布机制由现有 stable release owner 和 NPM release skill 承担，没有把专项流程复制到常驻 `AGENTS.md`。
- diff-only maintainability guard 为 0 error、19 warning。warning 来自既有目录例外、接近预算的历史文件，以及本次新增的大型 tree/action 测试面；没有新增 hard-budget violation。
- 已按告警做主观复核：tree 只拥有递归展示和行内状态，action hook 只拥有文件操作编排，layout hook 只拥有阈值/拖拽/持久化；没有重复 API 或第二套 Explorer 状态。复核中把同时提交文件/文件夹创建的误导性 `createDirectory` 名称改为 `submitCreate`，其余告警均保留明确拆分缝，不为本次功能扩大无关重构。

## NPM 包发布记录

本批需要 stable minor 发布，计划目标如下：

- `nextclaw`：`0.30.0 → 0.31.0`（minor 产品版本）。
- `@nextclaw/server`：`0.15.23 → 0.15.24`。
- `@nextclaw/client-sdk`：`0.5.23 → 0.5.24`。
- `@nextclaw/ui`：`0.15.24 → 0.15.25`。
- `@nextclaw/core`：`0.15.21 → 0.15.22`。
- `@nextclaw/kernel`：`0.6.23 → 0.6.24`。
- `@nextclaw/ncp-agent-runtime-next`：`0.1.16 → 0.1.17`。
- `@nextclaw/ncp`：`0.7.16 → 0.7.17`。
- `@nextclaw/ncp-react`：`0.5.20 → 0.5.21`。
- `@nextclaw/service`：`0.3.24 → 0.3.25`。
- 其余 published workspace package 按依赖闭包跟随 patch；最终精确集合以 release checkpoint 为准。

发布前状态：changeset 计划已冻结为 `nextclaw@0.31.0`，正式 registry publish、tag、runtime channel 与真实安装验证待执行。涉及 changeset：`bright-workspace-files`、`native-tool-parallel-scheduling`、`quiet-sse-recovery`、`remove-gateway-agent-restart`、`guard-message-edit-during-startup`。
