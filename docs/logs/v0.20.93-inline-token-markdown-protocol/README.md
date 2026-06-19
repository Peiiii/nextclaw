# v0.20.93 Inline Token Markdown Protocol

## 迭代完成说明

本次修复聊天消息 inline token 协议在 Markdown code 语义中被错误渲染的问题。

改动：

- 新增 `docs/designs/2026-06-19-inline-token-markdown-protocol.design.md`，明确 inline token 展示必须发生在 Markdown AST 层。
- `@nextclaw/ui` 消息适配层不再把文本切成 `inline-content`，改为输出 `markdown` part 并附带 `inlineTokens`。
- `@nextclaw/agent-chat-ui` 在 `ChatMessageMarkdown` 中增加 remark transform，只替换 mdast `text` node 中的 token rawText。
- `code` 和 `inlineCode` 节点不参与 token 替换，代码文本保持 literal。

## 测试/验证/验收方式

定向行为测试：

- `pnpm -C packages/nextclaw-agent-chat-ui test -- --run src/components/chat/ui/chat-message-list/__tests__/chat-message-markdown.test.tsx src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`
- 结果：2 个 test files 通过，32 个 tests 通过。
- `pnpm -C packages/nextclaw-ui test -- --run src/features/chat/features/message/utils/__tests__/chat-message.utils.test.ts src/features/chat/features/input/utils/__tests__/chat-inline-token.utils.test.ts src/features/chat/features/message/components/__tests__/chat-message-list.container.test.tsx`
- 结果：3 个 test files 通过，27 个 tests 通过。

类型与 lint：

- `pnpm -C packages/nextclaw-agent-chat-ui tsc`：通过。
- `pnpm -C packages/nextclaw-agent-chat-ui exec eslint ...`：本次触达文件通过。
- `pnpm -C packages/nextclaw-ui exec eslint ...`：本次触达文件通过。
- `pnpm -C packages/nextclaw-ui tsc`：未通过，阻塞来自工作区既有并行改动 `src/shared/lib/ui-document-title/index.ts`，报错为 `location` 可能为 `null` 或 `undefined`，不在本次 inline token 改动路径内。

治理与生成物：

- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：0 errors，1 warning；警告为 `chat-message-markdown.tsx` 本次增长明显，已通过删除旧 `inline-content` renderer 与 split helper 抵消，非测试代码净减 48 行。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm check:generated-clean`：通过。
- `pnpm lint:new-code:governance`：未通过，阻塞来自工作区既有并行改动 `packages/nextclaw-ui/src/shared/lib/ui-document-title/__tests__/ui-document-title.test.ts` 使用了跨目录相对导入，不在本次 inline token 改动路径内。

协议验证：

- `rg -n "inline-content|ChatMessageInlineContent|ChatInlineContentSegmentViewModel|chat-message-inline-content" packages/nextclaw-agent-chat-ui packages/nextclaw-ui/src/features/chat -g '!node_modules'`：无命中，旧 inline-content 主链路已清空。

## 发布/部署方式

本次未执行发布、部署、远程 migration 或 runtime update。

发布判断：

- 这是用户可见聊天消息渲染 bugfix，已新增 `.changeset/inline-token-markdown-protocol.md`。
- 影响包：`@nextclaw/agent-chat-ui` patch、`@nextclaw/ui` patch。
- 不涉及数据库 migration、远程 deploy 或线上 API smoke。

## 用户/产品视角的验收步骤

1. 发送普通文本 `review @panel-app:task-board now`，预期 Panel App token 特殊展示。
2. 发送 inline code：`` `@panel-app:task-board` ``，预期保持代码文本，不展示 Panel App badge。
3. 发送 fenced code block：` ```txt @panel-app:task-board ``` `，预期代码块内容保持 literal。
4. 发送包含 `$skill` metadata 的消息，预期 skill token 仍特殊展示。

## 可维护性总结汇总

本次是用户可见 bugfix，按非功能改动收口。最终不是保留旧路径再叠加新逻辑，而是删除旧 `inline-content` 预切分模型，统一收敛到 `markdown + inlineTokens` 单一路径。

代码增减报告：

- staged 总计：新增 496 行，删除 322 行，净增 174 行；其中包含方案文档、迭代记录和 changeset。
- 测试代码：新增 143 行，删除 68 行，净增 75 行。
- 文档与 changeset：新增 149 行，删除 0 行，净增 149 行。
- 非测试生产代码：新增 204 行，删除 254 行，净减 50 行。

正向减债动作：

- 删除：移除 `ChatMessageInlineContent`、`ChatInlineContentSegmentViewModel`、`splitTextByInlineTokens` 和旧的消息适配预切分 helper。
- 职责收敛：业务适配层只提供 token 数据，Markdown renderer 负责 Markdown AST 语义下的 token 展示。
- 简化：消息 part 不再存在 `markdown` 与 `inline-content` 两条平行展示路径。

可维护性复核结论：

- no maintainability findings。
- 保留的观察点：`chat-message-markdown.tsx` 因承接 remark transform 有明显增长，后续若 Markdown 扩展继续增加，应把 AST transform 抽到独立 markdown plugin 工具文件。

## NPM 包发布记录

本次未发布 NPM 包。

后续若进入统一发布：

- `@nextclaw/agent-chat-ui`：patch，原因是 inline token 渲染改为 Markdown-aware。
- `@nextclaw/ui`：patch，原因是消息适配层输出 markdown part inline token 数据。
