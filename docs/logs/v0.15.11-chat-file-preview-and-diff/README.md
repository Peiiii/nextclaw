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
- 同批次继续做根因级性能修复，解决“写入文件一开始界面几乎卡死”：
  - 在 `ncp-react` 里把高频 `message.tool-call-args-delta` 先按 16ms 小窗口批量合并，再统一交给 conversation state manager，避免每个增量都触发一次完整 UI 链路。
  - conversation state manager 新增批量分发入口，确保一帧内的多条事件只通知订阅者一次，而不是“攒了一批再连发多次通知”。
  - `write_file` 的流式阶段不再每次都尝试构造完整替换 diff，而是改为轻量预览模式；性能控制聚焦在事件批处理和“大预览默认不自动展开”，而不是直接裁掉用户要看的内容。
  - 大体积流式 `write_file` 预览不再默认自动展开，用户仍可点开查看，但默认不会在工具刚开始时把大量内容直接塞进 DOM。
  - 把 partial JSON 字段读取逻辑拆到了独立 helper，避免继续把 `chat-message.file-operation-card.ts` 堆胖。
- 同批次继续收敛文件卡片的视觉结构，解决“已经能预览，但预览很别扭”的问题：
  - 文件工具卡片现在明确区分 `preview` 与 `diff` 两种展示模式，不再把纯内容预览硬塞进双栏 diff 网格里。
  - `write_file` 与 `read_file` 统一使用单栏预览布局：只保留一列行号，把内容放回主体，去掉此前不必要的第二列行号和过大的左侧留白。
  - 单文件卡片在 header 已经展示路径时，预览区域不再重复再画一层路径头，信息层次更接近顶级产品常见的“header 承担定位、正文承载内容”。
  - 文件面板的内层视觉进一步参考了 Cursor 一类产品的文件 diff 体验，但保留 NextClaw 的亮色风格：代码区域改为更中性的浅色面板，新增/删除行用更明确的绿/红层次表达，而不是继续让整个预览被 amber 容器色干扰。
  - 文件预览区进一步改成更接近 IDE 的结构：代码行不再自动换行，横向滚动仅作用在代码区，左侧 gutter 行号列与代码横向滚动彻底解耦，不再依赖 sticky 假装固定，也不会在拖到边界时被浏览器的横向回弹带一下。
  - `+N / -N` 的统计语义也统一回归纯文本：新增统一用绿色、删除统一用红色，不再额外包成 tag，减少视觉噪音。
  - 外层文件卡片布局进一步收敛为“更轻的工具外壳 + 更主导的编辑器面板”：减弱外层 amber 背景和阴影存在感，把视觉焦点重新交给内部的代码/差异面板，整体层级更接近 Cursor 一类产品常见的简约布局。
  - 展开态布局继续收敛为更单层的结构：不再在内容区再套一层额外白盒壳，header 展开后不再重复展示路径，而是把路径与 `+N / -N` 摘要统一放到 header 下方那一行，形成“左侧路径、右侧变更统计”的信息排布。
  - 路径行进一步收敛为真正的单行布局：超长路径改为省略显示，不再把右侧统计挤到第二行；hover 时复用现有 tooltip primitive 展示完整路径，不额外新造一套提示组件。
  - `write_file` 一类场景不再额外显示 `WRITE` 这类重复语义，只保留真正有价值的变更统计数字。
  - `edit_file / file_change / apply_patch` 的 gutter 也进一步从双列旧/新行号收敛为单列行号：只显示当前可见行的核心编号，并把 gutter 缩窄、数字居中，减少冗余留白，更接近主流 IDE / Cursor / Codex 的 diff 阅读方式。
  - `write_file` 的运行中与完成态都改为完整预览模式，不再显示 `Preview truncated for streaming performance.` 这类为内部实现让位的提示；性能控制收敛为“大内容运行中默认不自动展开”，而不是直接裁内容。
  - 仍需截断的真正 diff 预览，提示文案改为更准确的 `Showing a shortened diff preview.`，避免把历史性能策略错误暴露给用户。
- 同批次继续修正终端工具卡片，解决“结果区显示 JSON 对象而不是终端输出”的问题：
  - 终端卡片继续保留“上方命令、下方输出”的结构，但在展示层专门解析结构化结果，优先提取 `aggregated_output / stdout / stderr / output`，避免把整个结果对象直接渲染成 JSON。
  - 终端输出在展示层顺手去掉 ANSI 颜色控制字符，确保卡片里看到的是干净的人类可读终端文本，而不是终端协议残留。
  - 针对“命令执行成功但本身没有任何终端输出”的结构化结果（例如后台启动服务），终端卡片不再回退显示整段 JSON 结果对象，而是按真正的“无输出结果”处理。
- 同批次补齐普通 generic 工具卡片的展开正文：
  - 之前普通工具调用只有 header 摘要，没有“完整参数正文”字段，长参数一旦被 header 截断，展开后也看不全。
  - 现在适配层会为非文件预览类的普通工具调用保留完整 `input` 文本；header 继续只显示短摘要，展开区则显示完整参数正文。
  - 这样普通工具调用不再把完整参数挤在 header 一行里，展开卡片后可以稳定查看完整 args，而不是只能看到截断摘要。
- 同批次继续修正本地开发态历史会话里的终端 JSON 泄露问题：
  - 根因不在终端卡片渲染本身，而在历史会话恢复层会把独立 `tool.result` 里的 legacy JSON 字符串，再次覆盖掉 `assistant.tool_call.ncp_parts` 中已经存在的结构化 `tool-invocation.result`。
  - 现在恢复层会优先保留更高质量的结构化结果；只有在工具调用本身还没有结果时，才会补挂来自 legacy `tool.result` 的结果。
  - 同时，补挂 legacy tool result 时会优先尝试把 JSON 字符串解析回对象，避免会话恢复链路把更丰富的结构再次降级成纯字符串。
- 同批次继续把终端工具结果的语义修回正确层级：
  - 之前前端适配层会先把结构化 `command_execution` 结果整体 `stringify` 成文本，再让终端卡片在展示层反向猜它是不是 JSON；这条链路本质上是在主动丢失语义。
  - 现在工具卡片 view model 会显式保留 `outputData`，终端卡片优先直接读取结构化结果对象里的 `aggregated_output / stdout / stderr / output`，只有 legacy 纯文本结果才走字符串兜底。
  - 对于“命令执行成功但没有任何输出”的结构化结果，前端适配层也不再额外塞回整段 JSON 文本，因此本地开发态历史会话和新会话都会稳定落到“命令可见、输出为空”的真实展示，而不是再次泄露结果对象。
- 同批次继续收敛 generic 工具卡片的信息层次：
  - 之前普通工具卡片展开后只是两段长得几乎一样的浅色文本块，输入和输出缺少明确语义边界，失败结果也没有足够直观的视觉反馈。
  - 现在 generic 工具卡片改成更接近 IDE / DevTools 的“双面板”结构：输入使用更轻的中性色面板，输出使用更主体的结果面板，失败输出则切到更明确的错误色层级。
  - 面板顶部补上 `输入 / 输出` 语义标签，正文改为更接近代码查看器的 `whitespace-pre + 横向滚动` 形式，不再把长 JSON/长路径强行换行成一整块难读文本。
- 补充前端回归测试，覆盖：
  - 运行中 `edit_file` 自动展开预览
  - 高频原生事件会被批量派发，不再每个 delta 立刻触发 manager 更新
  - 大型 `write_file` 流式参数会保持 preview block 语义，同时避免默认自动展开导致卡顿
  - 大型流式 `write_file` 卡片默认保持折叠，用户点击后再展开查看
  - 完成后的 `file_change` diff 展开渲染
  - 适配层把文件类工具调用转换成结构化卡片数据
  - native NCP `tool-invocation` 流式参数在 result 前即可被适配成文件预览卡片
  - NCP stream encoder 会先发 `tool-call-start / tool-call-args-delta`，再发 `tool-call-end`
  - 不完整的 `write_file` 原生参数也能提前生成结构化预览
  - 单文件 `write_file` 预览不会重复显示路径，且只保留单列行号
  - 完成态 `write_file` 会继续保留内容预览，不会退回只显示字节摘要
  - 文件预览区保持编辑器式单行展示，支持代码区横向滚动，且行号 gutter 不参与横向滚动
  - 统计文案中的 `+N / -N` 使用统一红绿语义且保持纯文本
  - 终端卡片会把结构化结果渲染为真实终端输出，而不是直接显示 JSON
  - 结构化终端结果若 `stdout/stderr` 为空，不会再把整个 JSON 对象泄露到输出区
  - 结构化终端结果会以结构化数据形式保留到工具卡片 view model，而不是在适配阶段先降级成字符串
  - 终端卡片直接消费结构化结果对象时，不会再显示原始 JSON 载荷
  - generic 工具卡片展开后会明确区分输入面板和输出面板，而不是继续复用同一块样式堆叠两段内容
  - 普通 generic 工具卡片展开后会显示完整参数正文，而不是只在 header 中保留被截断的参数摘要
  - 历史会话恢复时，不会再让重复的 legacy `tool.result` JSON 覆盖已有的结构化工具结果

## 测试/验证/验收方式
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec vitest run src/components/chat/adapters/chat-message.adapter.test.ts`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/ui/chat-message-list/chat-message-list.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.file-operation.test.tsx`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/ui/chat-message-list/chat-message-list.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.terminal.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.generic-tool.test.tsx`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw exec vitest run src/cli/commands/ncp/nextclaw-agent-session-store.test.ts`
- 已执行：`curl -s "http://127.0.0.1:5174/api/ncp/sessions/ncp-mng3yilf-ikyeqi9s/messages?limit=5"`，确认本地开发页实际 API 已返回结构化 `tool-invocation.result`，问题点不在“后端没发”，而在前端适配/展示链路
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui tsc`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec eslint src/components/chat/adapters/chat-message.file-operation-card.ts src/components/chat/adapters/chat-message.file-operation-diff.ts src/components/chat/adapters/chat-message-part.adapter.ts src/components/chat/adapters/chat-message.adapter.test.ts`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui exec eslint src/components/chat/view-models/chat-ui.types.ts src/components/chat/index.ts src/components/chat/ui/chat-message-list/chat-tool-card.tsx src/components/chat/ui/chat-message-list/tool-card/tool-card-views.tsx src/components/chat/ui/chat-message-list/tool-card/tool-card-file-operation.tsx src/components/chat/ui/chat-message-list/chat-message-list.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.file-operation.test.tsx`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec eslint src/components/chat/adapters/chat-message-part.adapter.ts src/components/chat/adapters/chat-message.adapter.test.ts src/components/chat/containers/chat-message-list.container.tsx src/components/chat/ncp/ncp-session-adapter.test.ts src/lib/i18n.chat.ts`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui exec eslint src/components/chat/ui/chat-message-list/tool-card/tool-card-views.tsx src/components/chat/ui/chat-message-list/chat-message-list.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.terminal.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.generic-tool.test.tsx src/components/chat/view-models/chat-ui.types.ts`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw test -- src/cli/commands/ncp/stream-encoder-order.test.ts`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test -- src/components/chat/ncp/ncp-session-adapter.test.ts`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test -- src/components/chat/useNcpAgentRuntime.test.tsx src/components/chat/ncp/ncp-session-adapter.test.ts`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test -- src/components/chat/adapters/chat-message.adapter.test.ts src/components/chat/ncp/ncp-session-adapter.test.ts`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test -- src/components/chat/adapters/chat-message.adapter.test.ts`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec vitest run src/components/chat/adapters/chat-message.adapter.test.ts`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-message-list/__tests__/chat-message-list.file-operation.test.tsx`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit test -- src/agent/agent-conversation-state-manager.test.ts src/agent/__tests__/agent-conversation-state-manager.batch.test.ts`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime tsc`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp tsc`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-react tsc`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit tsc`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui tsc`
- 已执行：`PATH=/opt/homebrew/bin:$PATH node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
  - 结果：本次改动文件无 error，保留 3 条 warning：
    - `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list` 目录历史上仍在预算线以上
    - `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-list.test.tsx` 接近测试文件预算
    - `packages/nextclaw-ui/src/components/chat/adapters/chat-message.adapter.test.ts` 本次增长较明显，后续可再拆 fixture / builder
- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
  - 结果：通过；当前仅保留 warning，不阻塞本次交付：
    - `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent` 中的 `agent-conversation-state-manager.ts` 仍是历史超预算文件，但本次已较上一版缩小 1 行，未继续膨胀
    - `packages/nextclaw-ui/src/components/chat` 目录有既有 exception，仍提示目录偏平
    - `packages/nextclaw-ui/src/components/chat/adapters/chat-message-part.adapter.ts` 接近预算线
    - `packages/nextclaw-ui/src/components/chat/adapters/chat-message.file-operation-card.ts` 接近预算线，但已较上一版减少 18 行

## 发布/部署方式
- 本次仅涉及聊天前端工具卡片与适配层体验升级，未执行发布。
- 如需发布，按既有前端/包发布流程执行受影响包构建、版本发布与前端上线闭环。

## 用户/产品视角的验收步骤
1. 在聊天页触发一次会修改文件的工具调用，例如 `edit_file` 或 Codex `file_change`。
2. 在 native 原生会话里观察工具调用开始后的中间阶段，确认不再只是长时间转圈；当工具参数逐步成形时，文件卡片会提前出现目标文件路径与预期改动。
3. 再触发一次较大的 `write_file`，确认界面不会在“运行中”阶段明显卡住；大体积预览默认保持折叠，但点开后看到的是完整内容预览，而不是“双行号 + 重复路径 + 截断提示”。
4. 观察单文件 `write_file` / `read_file` 卡片，确认 header 已展示路径时，正文区域不再重复显示同一路径；预览主体只保留一列行号，左侧留白明显收紧。
5. 水平滚动预览区，确认真正发生横向滚动的只有代码区，左侧行号 gutter 始终固定，不会在拖到边界时被带动或出现回弹错位。
6. 等工具完成后，确认 `write_file` 仍保留内容预览，不会退回成只有 `Wrote xxxx bytes` 这类摘要；`edit_file / apply_patch / file_change` 仍保留结构化 diff 视图，且 `+N / -N` 计数与新增/删除行本身使用同一套红绿语义。
7. 触发一次 `command_execution` 或 `exec_command`，确认卡片顶部仍显示命令摘要，展开后的正文展示真实终端输出，而不是一整段 JSON 结果对象。
8. 触发一次普通工具调用（例如不属于 terminal/file/search 专用卡片的 generic 工具），确认 header 仍显示精简摘要；点击展开后，正文区域可以看到完整参数，而不是只能看到 header 里那段被截断的摘要。
9. 刷新并重新打开一个已经保存过的本地开发态会话，确认历史里的 `command_execution` 卡片仍然展示结构化终端结果，而不是退回显示整段 legacy JSON。
