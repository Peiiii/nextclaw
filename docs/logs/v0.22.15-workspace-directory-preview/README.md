# v0.22.15 Workspace Directory Preview

## 迭代完成说明

本次为会话工作区右侧预览面板增加目录展示能力。当打开路径是目录时，面板不再停留在文件读取失败状态，而是直接列出目录内容；点击子目录会进入下一级目录，点击文件会复用原有文件预览链路展示对应文件。

实现上复用了已有 `server-path` browse/read owner，没有新增平行文件树系统。`browse` API 增加 `basePath`，让相对目录路径和文件读取一样基于当前会话工作目录解析；UI 侧把目录列表封装为独立的 `ChatSessionWorkspaceDirectoryBrowser`，主预览组件只负责决定当前路径应该展示目录、文件预览还是错误状态。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/workspace/components/__tests__/chat-session-workspace-file-preview.test.tsx src/features/chat/features/workspace/components/__tests__/chat-session-workspace-panel.test.tsx src/shared/lib/session-project/__tests__/workspace-file-breadcrumb.test.ts`
- `pnpm --filter @nextclaw/server test -- src/features/server-path/controllers/server-path.controller.test.ts`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/server tsc`
- `pnpm --filter @nextclaw/client-sdk tsc`
- `pnpm --filter @nextclaw/ui lint`
- `pnpm --filter @nextclaw/server lint`
- `pnpm --filter @nextclaw/client-sdk lint`
- `pnpm --filter @nextclaw/ui build`
- `pnpm --filter @nextclaw/server build`
- `pnpm --filter @nextclaw/client-sdk build`
- `pnpm check:generated-clean`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <本次目录预览触达文件>`
- `pnpm lint:new-code:governance -- <本次目录预览触达文件>`
- `pnpm check:governance-backlog-ratchet`

其中全仓 `pnpm lint:new-code:governance` 当前被无关 WIP 阻塞，失败点为 `packages/nextclaw-ui/src/features/chat/features/message/components/chat-inline-panel-app-card.tsx` 深导入 `features/panel-apps/utils/panel-app-iframe.utils`；本次目录预览触达文件的 scoped governance 已通过。

## 发布/部署方式

无需单独部署。本次改动进入 `@nextclaw/ui`、`@nextclaw/server` 与 `@nextclaw/client-sdk` 后，随下一次常规 NPM/桌面发布带出。

## 用户/产品视角的验收步骤

1. 打开一个会话工作区右侧预览面板。
2. 打开相对路径目录，例如 `src`，确认它基于当前会话工作目录解析。
3. 确认目录内容按目录优先、名称排序展示，并能看到目录/文件的不同图标。
4. 点击子目录，确认面板进入下一级目录。
5. 点击文件，确认面板切回原有文件展示逻辑。
6. 点击刷新预览，确认当前目录或当前文件都能重新读取。

## 可维护性总结汇总

本次是新增用户可见能力，非测试生产代码有必要增长。实现没有复制文件预览逻辑，也没有新建第二套文件浏览 owner；后端继续由 `server-path` browse/read 负责文件系统访问，UI 继续由工作区预览面板组合查询结果和展示状态。

`post-edit-maintainability-guard` 在 scoped 触达范围通过，13 个文件 0 error，1 个既有目录预算 warning：`packages/nextclaw-client-sdk/src/services` 已有目录预算豁免且本次没有新增直接 service 文件。代码增减报告为总计 `+400/-79`，净增 321 行；非测试 `+230/-22`，净增 208 行。增长集中在目录展示组件、browse `basePath` 合同、面板组合逻辑和覆盖相对目录路径的测试。

## NPM 包发布记录

- 涉及包：`@nextclaw/ui`、`@nextclaw/server`、`@nextclaw/client-sdk`
- 发布状态：待下一次统一 NPM/桌面发布带出
- Changeset：`.changeset/workspace-directory-preview.md`
