# Chat 本地文件链接合同

## 背景

AI 在会话回复中经常引用仓库文件，例如：

- `[AGENTS.md](AGENTS.md)`
- `[cron](packages/nextclaw-ui/src/features/chat/components/workspace/session-cron-job-content.tsx)`
- `[README](/Users/demo/project/README.md:12:4)`

这些链接不是普通网页导航。它们表达的是“在当前会话所在项目中打开一个本地文件”。如果渲染层只接受 `./`、`../` 或绝对路径，像 `AGENTS.md`、`packages/...` 这类 Cursor / IDE 常见的项目相对引用会被降级成 `chat-link-invalid`，用户看到的只是带下划线但不可打开的文本，无法从 AI 回复进入文件上下文。

## 产品目标

本地文件链接应增强 NextClaw 的统一入口能力：用户在 chat 中看到 AI 引用文件时，可以直接进入当前会话工作区的文件预览，而不是手动复制路径、切换 IDE 或猜测路径基准。

目标体验对齐 Cursor / VS Code 类 IDE：

1. AI 回复里的项目相对文件路径是一等可点击引用。
2. 点击后在 NextClaw 会话 workspace 右侧文件预览打开。
3. 支持行列号定位语义，至少把 `line` / `column` 传入文件打开 action。
4. 外链仍按外链处理，危险协议不生成可点击链接。

## 路径合同

Chat markdown 链接的 `href` 按以下顺序解释：

### 外部链接

- `http://...`
- `https://...`
- `mailto:...`
- `tel:...`

外部链接保持浏览器链接行为；`http/https` 使用新 tab 打开。

### 本地文件链接

以下形态应解析为 `ChatFileOpenActionViewModel`，由宿主通过 `onFileOpen` 打开：

- 绝对路径：`/Users/peiwang/Projects/nextbot/AGENTS.md`
- 显式相对路径：`./AGENTS.md`、`../shared/foo.ts`
- 项目相对路径：`AGENTS.md`、`packages/nextclaw-ui/src/foo.tsx`
- 带行列号：`AGENTS.md:12`、`packages/a.ts:12:4`
- 带 query/hash 的文件链接：解析文件打开 action 时忽略 `?` 与 `#` 后缀

“项目相对路径”的基准不是浏览器 URL，而是当前会话的 `project_root` / `projectRoot`。渲染层只负责识别并发出相对路径 action；实际路径解析、越界保护和文件读取由宿主的 `server-path-read` 链路基于 `basePath=sessionProjectRoot` 完成。

### 不应当成本地文件链接

- 危险协议：`javascript:`、`data:` 等
- 协议相对 URL：`//example.com/a`
- 裸域名：`example.com`
- 没有明确文件语义的普通字符串

单文件名项目相对链接必须具备明确文件扩展名白名单，例如 `.md`、`.ts`、`.tsx`、`.json`、`.yaml`。这样可以支持 `AGENTS.md`，同时避免把 `example.com` 误判为项目根目录文件。

带目录的项目相对路径可以接受更宽的扩展名，因为 `packages/foo/bar.ext` 已经具备路径语义；最终是否存在仍由文件预览读取结果决定。

## 渲染与交互合同

1. 可识别的本地文件链接渲染为 `<a>`，保持普通链接样式。
2. 左键无修饰键点击时阻止浏览器默认导航，并调用 `onFileOpen(action)`。
3. `meta` / `ctrl` / `shift` / `alt` 点击不拦截，保留浏览器或系统默认行为。
4. 不安全链接渲染为 `chat-link-invalid`，不生成 anchor。
5. 文件不存在、读取失败或缺少项目根，不应在 markdown renderer 阶段提前吞掉；应交给右侧文件预览展示可理解错误。

## 当前落地

当前落点是 `@nextclaw/agent-chat-ui` 的 `ChatMessageMarkdown`：

- `resolveSafeHref` 负责判断 href 是否允许渲染成 anchor。
- `parseLocalFileAction` 负责把本地文件 href 转成 `ChatFileOpenActionViewModel`。
- 宿主 `NcpChatThreadManager.openFilePreview` 接收 action 并打开 workspace file tab。
- `ChatSessionWorkspaceFilePreview` 使用 `useServerPathRead({ path, basePath: sessionProjectRoot })` 完成基于项目根的真实读取。

## 验收用例

必须覆盖：

1. `[README](/Users/demo/project/README.md:12:4)` 触发绝对路径文件预览 action。
2. `[cron](packages/nextclaw-ui/src/features/chat/components/workspace/session-cron-job-content.tsx)` 触发项目相对路径文件预览 action。
3. `[rules](AGENTS.md)` 触发项目根文件预览 action。
4. `[Docs](https://nextclaw.io)` 保持外链，不触发文件预览。
5. `[site](example.com)` 不被误判成本地文件链接。
6. `[bad](javascript:alert(1))` 不生成 anchor。

## 后续可改进点

- 对更多 IDE 常见文件名做显式支持，例如 `Dockerfile`、`Makefile`、`.env.example`。
- 在 hover tooltip 中显示“在当前项目中打开 <path>”。
- 当会话没有项目根且 href 是项目相对路径时，在文件预览中展示“缺少项目根，无法解析相对路径”。
