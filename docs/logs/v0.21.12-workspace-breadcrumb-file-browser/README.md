# v0.21.12 Workspace Breadcrumb File Browser

## 迭代完成说明

本次完成右侧 workspace 文件预览面包屑导航增强：

- 为 `buildWorkspaceFileBreadcrumb` 生成的每个路径段补齐 `path` 与 `browsePath`，让 UI 能知道点击每段时应该浏览哪个目录。
- 将文件预览面包屑从静态文本升级为可点击 Popover。
- Popover 内复用现有 `useServerPathBrowse({ includeFiles: true })` 目录浏览能力，目录项可继续钻取，文件项复用既有 `onFileOpen` / `ChatThreadManager.openFilePreview` 链路进入预览。
- 将弹层浏览器拆到 `chat-session-workspace-file-breadcrumb-browser.tsx`，避免主面包屑组件继续膨胀。
- 触达历史纯工具文件后，将 `workspace-file-breadcrumb.ts` 按治理规则归正为 `workspace-file-breadcrumb.utils.ts`。
- 新增方案设计文档 `docs/designs/2026-07-04-workspace-file-breadcrumb-navigation.design.md`。
- 根据视觉验收反馈压缩 Popover 内部路径栏和文件列表密度：降低 header padding、路径段字号/高度、列表行高，并适度加宽 Popover，减少路径换行导致的高度占用。

根因与确认：

- 原问题不是缺少后端文件树能力，而是 breadcrumb view model 只输出展示 label，没有输出可点击导航所需的 segment target path。
- 通过代码链路确认：文件预览 owner 是 `ChatSessionWorkspaceFilePreview`，面包屑展示 owner 是 `ChatSessionWorkspaceFileBreadcrumbs`，目录浏览能力已经由 shared `useServerPathBrowse` 提供，文件打开主链路已经由 `ChatThreadManager.openFilePreview` 承接。
- 修复点落在现有 owner 上，没有新增平行文件系统 API、store 或 manager。

## 测试/验证/验收方式

- `corepack pnpm -C packages/nextclaw-ui test src/shared/lib/session-project/__tests__/workspace-file-breadcrumb.test.ts src/features/chat/features/workspace/components/__tests__/chat-session-workspace-file-preview.test.tsx`：通过，2 个测试文件，14 个用例。
- `corepack pnpm -C packages/nextclaw-ui test src/features/chat/features/workspace/components/__tests__/chat-session-workspace-file-preview.test.tsx`：通过，1 个测试文件，11 个用例；用于验收紧凑度修正后文件预览交互仍可运行，并覆盖 Popover 宽度、浏览器最大高度、路径段高度和列表项高度。
- `corepack pnpm -C packages/nextclaw-ui tsc`：通过。
- `corepack pnpm -C packages/nextclaw-ui exec eslint ...相关面包屑源码与测试文件`：通过。
- `corepack pnpm -C packages/nextclaw-ui lint`：当前被工作区无关 WIP 阻塞，失败点在 `input-surface-plugins/slash-command-plugin.utils.ts` 的 unused import / unused var；本次相关文件定向 eslint 已通过。
- `corepack pnpm -C packages/nextclaw-ui build`：通过；存在既有 Browserslist 数据、动态导入 chunk 与大 chunk 警告，无构建失败。
- `corepack pnpm clean:generated`：通过，生成物保持干净。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`：通过，Errors 0，Warnings 0。
- `corepack pnpm lint:new-code:governance`：通过。
- `corepack pnpm check:governance-backlog-ratchet`：通过。
- `corepack pnpm check:generated-clean`：通过。

## 发布/部署方式

本次仅修改前端源码、测试、设计文档、迭代记录和 changeset，未执行发布、部署、远程 migration 或 runtime update。

## 用户/产品视角的验收步骤

1. 打开一个包含文件预览的聊天 workspace 右侧面板。
2. 点击文件路径面包屑中的 workspace、目录或当前文件段。
3. 确认弹层展示对应目录的路径 breadcrumbs、同级文件和子目录。
4. 点击目录项，确认弹层内继续进入下一级目录。
5. 点击文件项，确认右侧 workspace 切换或打开该文件预览。

## 可维护性总结汇总

- 本次是新增用户可见能力，生产代码净增属于功能实现所需；没有套新后端 API、store、manager 或兼容双路径。
- 代码增减报告：排除工作区既有无关改动后，相关源码、测试、文档和 changeset 合计 `+677 / -210 / net +467`；生产源码 `+263 / -30 / net +233`。
- 正向可维护性动作：复用现有 server-path browse/read 和 ChatThreadManager 文件打开主链路；将弹层浏览器拆出独立组件；将历史纯工具文件归正为 `.utils.ts` 后缀，消除治理漂移。
- 目录组织仍保持在 `features/chat/features/workspace/components` 与 `shared/lib/session-project` 现有 owner 内，没有新增 feature root。
- `post-edit-maintainability-guard` 结果为 Errors 0、Warnings 0；主观复核结论为通过，测试文件已通过抽取读取与渲染 helper 消化新增用例带来的体积增长，剩余观察点是后续如果面包屑弹层继续增长，可再把 entry row 或 browse header 拆成更小展示组件。

## NPM 包发布记录

需要后续统一 NPM 发布：

- `@nextclaw/ui`：已新增 `.changeset/workspace-breadcrumb-file-browser.md`，patch，原因是新增用户可见的 workspace 文件预览面包屑目录浏览能力。

未在本轮执行 NPM 发布。
