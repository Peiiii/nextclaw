# v0.20.37-chat-local-file-links

## 迭代完成说明

本次补齐 Chat markdown 本地文件链接合同，让 AI 回复中的项目相对文件引用能够按当前会话项目根打开，而不是被降级为 `chat-link-invalid`。

根因：`ChatMessageMarkdown` 之前只把绝对路径、`./`、`../` 和少数安全协议当作可渲染链接。AI 在会话里常输出 Cursor / IDE 风格的项目相对链接，例如 `[AGENTS.md](AGENTS.md)`、`[cron](packages/nextclaw-ui/src/features/chat/components/workspace/session-cron-job-content.tsx)`，这些 href 没有 `./` 前缀，导致渲染成不可点击的 invalid span。

确认方式：读取目标会话 `ncp-mq24q944-575b304f` 的消息数据，确认 AI 实际输出了 `packages/...` 形式的 markdown 链接；用户进一步反馈页面里出现 `<span class="chat-link-invalid">AGENTS.md</span>`，确认单文件项目相对路径也未被合同覆盖。

修复方式：

- 新增设计文档 `docs/designs/2026-06-06-chat-local-file-link-contract.md`，明确项目相对文件链接以当前会话 `project_root` / `projectRoot` 为基准。
- 扩展 `ChatMessageMarkdown` 的本地文件 href 识别，支持 `AGENTS.md` 和 `packages/.../*.tsx` 这类 IDE 风格项目相对链接。
- 保持外链和危险协议边界：`https://...` 不触发文件预览，`example.com` 不误判成本地文件，`javascript:` 不生成 anchor。
- 补充 `chat-message-markdown.test.tsx` 覆盖绝对路径、项目相对路径、项目根文件、外链、裸域名和危险协议。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-message-list/__tests__/chat-message-markdown.test.tsx`
  - 结果：通过，`1` 个测试文件、`8` 个测试通过。
- `pnpm -C packages/nextclaw-agent-chat-ui tsc`
  - 结果：通过。
- `pnpm -C packages/nextclaw-agent-chat-ui exec eslint src/components/chat/ui/chat-message-list/chat-message-markdown.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-markdown.test.tsx`
  - 结果：通过，无输出。
- `pnpm lint:new-code:governance`
  - 结果：通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过，ratchet status OK。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-markdown.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/__tests__/chat-message-markdown.test.tsx docs/designs/2026-06-06-chat-local-file-link-contract.md`
  - 结果：Errors 0，Warnings 1。warning 为 `chat-message-list` 目录既有文件数预算提醒，`delta_count=+0`，本次未新增该目录文件。

## 发布/部署方式

本次未执行部署或发布。

改动位于 `@nextclaw/agent-chat-ui` 源码与测试；本地开发环境通过 workspace source consumption 生效。若需要交付到已发布包，需要后续统一发布 `@nextclaw/agent-chat-ui` 并同步依赖方版本。

## 用户/产品视角的验收步骤

1. 打开一个带 `project_root` 的 NextClaw chat 会话。
2. 让 AI 输出 markdown 链接 `[rules](AGENTS.md)`。
3. 确认 `AGENTS.md` 渲染为可点击链接，而不是 `<span class="chat-link-invalid">AGENTS.md</span>`。
4. 点击该链接，确认右侧 workspace file preview 打开 `AGENTS.md`。
5. 让 AI 输出 `[cron](packages/nextclaw-ui/src/features/chat/components/workspace/session-cron-job-content.tsx)`。
6. 点击链接，确认右侧文件预览按当前会话项目根解析并打开对应文件。
7. 确认 `[site](example.com)` 不被误判成本地文件链接，`[bad](javascript:alert(1))` 不生成可点击 anchor。

## 可维护性总结汇总

本次把本地文件链接规则沉淀到设计文档和单元测试中，避免继续依赖口头约定或零散正则补丁。实现仍集中在 `ChatMessageMarkdown` 这个现有 markdown href owner 中，没有新增平行打开链路；宿主仍通过既有 `onFileOpen -> workspace file preview -> server-path-read(basePath=sessionProjectRoot)` 链路解析文件。

`post-edit-maintainability-review` 结论：通过。总代码和测试行数有净增，原因是本次属于用户可见能力补齐，并新增了覆盖安全边界的测试与设计文档。未新增生产文件，未扩大目录平铺度；维护性剩余关注点是 `chat-message-list` 目录已有文件数超预算，后续应按既有 seam 拆分，但本次 delta 为 0。

## NPM 包发布记录

本次未发布 NPM 包。

涉及包：

- `@nextclaw/agent-chat-ui`

发布判断：需要随下一次统一 NPM 发布批次带出，否则已安装的外部包不会获得该链接合同修复。本轮未执行发布，状态为待后续统一发布。
