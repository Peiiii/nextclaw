# v0.15.11-chat-file-preview-and-diff

## 迭代完成说明（改了什么）
- 为聊天工具卡片新增结构化文件变更视图模型：不再只把 `file_change / edit_file / write_file / apply_patch / read_file` 当作普通字符串输出，而是先抽取文件路径、行级增删和预览内容，再交给 UI 渲染。
- 聊天文件工具卡片升级为“运行中可预览、完成后可读 diff”的体验：
  - `edit_file` / `write_file` / `apply_patch` / Codex `file_change` 在工具运行阶段即可展示目标文件与预期改动。
  - 工具完成后继续保留结构化 diff 视图，支持展开查看具体增删行。
  - `file_change` 被纳入文件操作卡片分类，`command_execution` 被纳入终端卡片分类，避免 Codex 运行时落到过于笼统的 generic 卡片。
- 新增专门的文件 diff / patch 解析层，并把“工具数据提取”和“diff 渲染原语”拆成两个文件，避免把新能力继续堆成一个超大 helper。
- 同批次续修 native 原生链路的真正断点：不是再补一层前端猜测，而是把 `tool_call_delta` 中的参数增量正式编码为 NCP `message.tool-call-args-delta` 事件，让 `native -> NCP -> UI` 链路在工具调用尚未结束时就能持续收到半成品参数。
- native 侧文件预览现在不再只依赖“工具调用结束后的一次性完整 args”：
  - 当模型正在逐步生成 `edit_file / write_file / apply_patch` 参数时，NCP conversation state 会跟随 `args delta` 累积工具参数。
  - 一旦参数文本已经足够形成可解析的文件操作数据，现有文件卡片就能提前展开预览，而不用等工具结果返回。
- 同批次再次续修前端后半段链路：确认浏览器侧已经能收到 `message.tool-call-args-delta`，但 UI 之前仍然只在 `args` 成为完整 JSON 后才提取 `path/content/oldText/newText/patch`，导致长时间只显示“准备中/转圈”而没有预览。
  - 现在文件工具卡片会对不完整但已具备关键信息的 JSON 参数做渐进式字段提取，优先抽取 `path`、`content`、`oldText`、`newText`、`patch`。
  - `write_file` 这类大文本写入场景在 JSON 尚未闭合时，也能提前显示目标文件和已生成的部分内容预览。
  - `partial-call` 状态文案从“准备中”调整为“运行中”，更贴近真实工具执行阶段，减少用户误判为卡死。
- 补充前端回归测试，覆盖：
  - 运行中 `edit_file` 自动展开预览
  - 完成后的 `file_change` diff 展开渲染
  - 适配层把文件类工具调用转换成结构化卡片数据
  - native NCP `tool-invocation` 流式参数在 result 前即可被适配成文件预览卡片
  - NCP stream encoder 会先发 `tool-call-start / tool-call-args-delta`，再发 `tool-call-end`
  - 不完整的 `write_file` 原生参数也能提前生成结构化预览

## 测试/验证/验收方式
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec vitest run src/components/chat/adapters/chat-message.adapter.test.ts`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/ui/chat-message-list/chat-message-list.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.file-operation.test.tsx`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui tsc`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec eslint src/components/chat/adapters/chat-message.file-operation-card.ts src/components/chat/adapters/chat-message.file-operation-diff.ts src/components/chat/adapters/chat-message-part.adapter.ts src/components/chat/adapters/chat-message.adapter.test.ts`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui exec eslint src/components/chat/view-models/chat-ui.types.ts src/components/chat/index.ts src/components/chat/ui/chat-message-list/chat-tool-card.tsx src/components/chat/ui/chat-message-list/tool-card/tool-card-views.tsx src/components/chat/ui/chat-message-list/tool-card/tool-card-file-operation.tsx src/components/chat/ui/chat-message-list/chat-message-list.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.file-operation.test.tsx`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw test -- src/cli/commands/ncp/stream-encoder-order.test.ts`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test -- src/components/chat/ncp/ncp-session-adapter.test.ts`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test -- src/components/chat/adapters/chat-message.adapter.test.ts src/components/chat/ncp/ncp-session-adapter.test.ts`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime tsc`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
- 已执行：`PATH=/opt/homebrew/bin:$PATH node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
  - 结果：本次改动文件无 error，保留 3 条 warning：
    - `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list` 目录历史上仍在预算线以上
    - `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-list.test.tsx` 接近测试文件预算
    - `packages/nextclaw-ui/src/components/chat/adapters/chat-message.adapter.test.ts` 本次增长较明显，后续可再拆 fixture / builder
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
  - 结果：通过；仅保留历史目录预算 warning，不阻塞本次交付：
    - `packages/ncp-packages/nextclaw-ncp-agent-runtime/src`
    - `packages/nextclaw/src/cli/commands/ncp`
    - `packages/nextclaw-ui/src/components/chat/ncp`

## 发布/部署方式
- 本次仅涉及聊天前端工具卡片与适配层体验升级，未执行发布。
- 如需发布，按既有前端/包发布流程执行受影响包构建、版本发布与前端上线闭环。

## 用户/产品视角的验收步骤
1. 在聊天页触发一次会修改文件的工具调用，例如 `edit_file` 或 Codex `file_change`。
2. 在 native 原生会话里观察工具调用开始后的中间阶段，确认不再只是长时间转圈；当工具参数逐步成形时，文件卡片会提前出现目标文件路径与预期改动。
3. 等工具完成后，确认卡片仍保留结构化 diff 视图，可清晰区分新增行和删除行。
4. 再触发一次 `apply_patch` 或 `write_file`，确认多种文件修改工具都走同一套结构化文件卡片体验，而不是退回普通文本日志。
5. 触发一次 `command_execution`，确认 Codex 命令执行不再误落到 generic 卡片，而是进入终端卡片视图。
