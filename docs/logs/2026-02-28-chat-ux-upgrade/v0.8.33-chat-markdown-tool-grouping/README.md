# v0.8.33-chat-markdown-tool-grouping

## 迭代完成说明（改了什么）

- 系统性升级 Chat UI 渲染能力（对齐并增强 openclaw 聊天体验）：
  - Markdown 渲染：支持代码块、表格、链接、引用等内容展示。
  - 工具展示：把 `tool_calls` 与 `tool` 结果渲染为结构化工具卡片（调用/结果分层、输出折叠）。
  - 消息合并：连续同角色消息自动分组，降低噪声、提升可读性。
- 数据契约升级：
  - 会话消息 `content` 改为结构化 `unknown`（不再强制字符串）。
  - 会话 history API 透出 `tool_calls`、`reasoning_content` 字段。
- 新增聊天解析与分组工具层：
  - `packages/nextclaw-ui/src/lib/chat-message.ts`
  - `packages/nextclaw-ui/src/components/chat/ChatThread.tsx`
- 会话管理页同步兼容结构化消息显示（避免 `[object Object]`）。
- 文档更新：
  - README（中/英）补充对话渲染能力说明
  - [docs/USAGE.md](../../../../docs/USAGE.md) 的 Chat 章节补充 Markdown/工具卡片/分组说明

## 测试 / 验证 / 验收方式

已执行：

- 全量验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm tsc`
- 定向验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server tsc`
- 聊天工具链冒烟（解析能力）：
  - `pnpm -C packages/nextclaw-ui exec tsx -e "<groupChatMessages + extractToolCards sample>"`
  - 观察点：输出 `groups/toolCards/toolName` 与预期一致。
- 运行态 API 冒烟（隔离目录）：
  - `NEXTCLAW_HOME=/tmp/... node packages/nextclaw/dist/cli/index.js ui --port 19107 --no-open`
  - `GET /api/health` 返回 `ok=true`
  - `POST /api/chat/turn` 在未配置 provider 时返回明确错误（预期行为）。

## 发布 / 部署方式

按项目 NPM 发布流程执行：

1. `PATH=/opt/homebrew/bin:$PATH pnpm release:version`
2. `PATH=/opt/homebrew/bin:$PATH pnpm release:publish`

发布后验证：

- 已发布：
  - `nextclaw@0.8.33`
  - `@nextclaw/server@0.5.17`
  - `@nextclaw/ui@0.5.21`
- 已生成 tag：
  - `nextclaw@0.8.33`
  - `@nextclaw/server@0.5.17`
  - `@nextclaw/ui@0.5.21`

## 用户 / 产品视角的验收步骤

1. 启动：`nextclaw start`
2. 打开 UI：`http://127.0.0.1:18791`
3. 进入 Chat 页并发送包含 Markdown 的消息（如代码块、表格）
4. 观察助手回复是否按 Markdown 正确渲染
5. 发送会触发工具调用的问题（如搜索、读取等）
6. 观察工具调用/结果是否以卡片形式展示、长输出可折叠查看
7. 连续多轮对话，观察同角色消息是否按分组展示（非逐条重复头部）
8. 切换会话后返回，确认历史渲染仍保持 Markdown/工具卡片/分组效果
