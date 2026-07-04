# v0.21.3 Workspace File Syntax Highlight

## 迭代完成说明

本次补齐右侧 workspace 文件预览的代码语法高亮能力。

根因说明：

- 右侧文件预览已经复用 `FileOperationCodeSurface` 展示代码行，但 preview block 只携带行文本，没有把 server-path-read 返回的 `languageHint` 传给代码展示 surface。
- `@nextclaw/agent-chat-ui` 里已经有 `ChatCodeSyntaxHighlighter` 和 `highlight.js` 注册表，Markdown fenced code block 可以高亮；文件预览 surface 没有复用这条高亮 owner，所以 `js/ts/tsx/json` 文件在右侧仍显示为纯文本。

修复：

- `ChatFileOperationBlockViewModel` 新增 `languageHint`，作为代码展示层的语言事实。
- `ChatSessionWorkspaceFilePreview` 在构造 preview block 时传入后端 `languageHint`。
- `FileOperationCodeSurface` 复用现有 `ChatCodeSyntaxHighlighter`，按 `languageHint` 或文件扩展名逐行生成 `hljs-*` token。
- `packages/nextclaw-ui/src/index.css` 为文件预览代码行补齐轻量 token 配色，同时继续复用现有 markdown code token 语义。

## 测试/验证/验收方式

定向测试：

- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/chat-message-list/__tests__/tool-card-file-operation-lines.test.tsx`：通过，3 个 tests 通过。
- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/workspace/components/__tests__/chat-session-workspace-file-preview.test.tsx`：通过，7 个 tests 通过。

类型、lint 与构建：

- `pnpm --filter @nextclaw/agent-chat-ui tsc`：通过。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/agent-chat-ui lint`：通过。
- `pnpm --filter @nextclaw/ui lint`：通过。
- `pnpm --filter @nextclaw/ui build`：通过；仅保留既有 browserslist 数据偏旧、动态导入与 chunk size 警告。

治理与生成物：

- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`：通过，0 errors，0 warnings。
- `pnpm lint:new-code:governance`：初次被 module-structure-drift 拦截，原因是触达文件存在或新增跨目录 `../` import；改为 `@agent-chat-ui/...` 包内 alias 后复跑通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm clean:generated`：通过，生成物干净。
- `pnpm check:generated-clean`：通过。

功能验收覆盖：

- 组件测试已覆盖 `FileOperationCodeSurface` 对 `js` 代码行生成 `hljs-keyword`、`hljs-number` 等高亮 token。
- workspace preview 测试已覆盖 `server-path-read` 返回的 `languageHint` 会传入右侧代码 surface。
- 本轮未额外启动真实浏览器手工点击；当前使用组件 DOM 测试和 Vite build 作为最贴近链路的替代证明。

## 发布/部署方式

本次未执行发布、部署、远程 migration 或 runtime update。

发布判断：

- 这是用户可见 UI 能力补齐，已新增 `.changeset/workspace-file-syntax-highlight.md`。
- 影响包：`@nextclaw/agent-chat-ui` patch、`@nextclaw/ui` patch。
- 不涉及数据库 migration、远程 deploy 或线上 API smoke。

## 用户/产品视角的验收步骤

1. 打开一个绑定项目目录的 NextClaw chat 会话。
2. 点击消息中的本地代码文件链接，或通过文件 action 打开右侧 workspace file preview。
3. 选择 `example.js`、`example.ts`、`example.tsx` 或 `package.json` 这类代码文件。
4. 确认右侧文件内容不再是纯色等宽文本，关键字、数字、字符串、注释等 token 有区分。
5. 打开 markdown 文件时，仍走原有 Markdown 预览；打开 binary 文件时，仍显示不支持预览状态。

## 可维护性总结汇总

本次是新增用户可见能力，生产代码净增长属于必要能力成本。

可维护性复核：

- 结论：通过，no maintainability findings。
- 本次顺手减债：否；本轮重点是把已有高亮 owner 接入文件预览主链路。
- 代码增减报告：触达源码、样式与测试共新增 188 行，删除 20 行，净增 168 行。
- 非测试代码增减报告：新增 115 行，删除 18 行，净增 97 行。
- maintainability guard 的 TS/TSX 口径：总计新增 128 行，删除 10 行，净增 118 行；非测试 TS/TSX 新增 55 行，删除 8 行，净增 47 行。

可维护性判断：

- 复用：没有新增第二套语法高亮库，继续复用 `ChatCodeSyntaxHighlighter`。
- 职责收敛：语言解析与 token HTML 生成归共享 file-operation surface；workspace preview 只传递 `languageHint` 事实。
- 目录治理：没有新增文件；跨目录 import 已按治理要求改为 `@agent-chat-ui/...` alias。
- 后续观察点：如果 file-operation surface 后续继续增加复制、折叠或语言栏能力，应优先下沉到 `code-block` / `tool-card` 相关稳定子树，不要把 workspace preview 组件做厚。

## NPM 包发布记录

本次未发布 NPM 包。

后续若进入统一发布：

- `@nextclaw/agent-chat-ui`：patch，原因是共享 file operation code surface 新增语法高亮。
- `@nextclaw/ui`：patch，原因是 workspace file preview 传入 server language hint，并补齐文件预览 token 样式。
