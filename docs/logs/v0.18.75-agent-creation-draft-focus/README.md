# v0.18.75 Agent Creation Draft Focus

## 迭代完成说明

- 补齐“新增 Agent”入口的草稿创建体验：创建新会话并预填 Agent 创建 prompt 后，自动聚焦聊天输入框。
- 输入框光标会落到预填 prompt 的末尾，用户可以直接继续编辑或回车发送。
- 聚焦意图由 `NcpChatInputManager` 发出一次性 request，`ChatInputBarContainer` 消费后调用输入框句柄，Lexical composer 自己负责 DOM focus 与 selection 同步。
- 顺手将触达的 `agent-chat-ui` 跨目录相对导入收敛为 `@agent-chat-ui/` alias，满足 module-structure 治理。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-agent-chat-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-agent-chat-ui test src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx`：通过，21 个测试通过。
- `pnpm -C packages/nextclaw-ui test src/features/chat/managers/ncp-chat-input.manager.test.ts src/features/chat/utils/ncp-chat-input-availability.utils.test.ts`：通过，10 个测试通过。
- `pnpm -C packages/nextclaw-agent-chat-ui build`：通过。
- targeted ESLint：触达文件无错误；`agent-chat-ui` 保留既有 props destructuring / exhaustive-deps 警告。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- maintainability guard：通过；保留 `chat-input-bar` 目录预算和 `chat-input-bar.test.tsx` 接近预算的既有警告。
- `pnpm -C packages/nextclaw-agent-chat-ui lint`：未通过，阻塞来自既有 `chat-composer-plugins.tsx` React hooks immutability 错误，非本次新增。
- `pnpm -C packages/nextclaw-ui lint`：未通过，阻塞来自既有 UI lint 债务，非本次触达文件。

## 发布/部署方式

未发布。该改动触达 `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui`，需要随下一次前端/桌面或相关 NPM 发布批次带出。

## 用户/产品视角的验收步骤

1. 打开 Agent 页面。
2. 点击“新增 Agent”。
3. 确认页面跳到新会话，输入框已经填入 Agent 创建 prompt。
4. 确认输入框自动获得焦点，光标位于 prompt 末尾，可直接继续输入。

## 可维护性总结汇总

- 本次是新增用户可见体验，非测试代码净增用于承载一次性 focus request 与输入框文末聚焦句柄。
- 正向减债动作：职责收敛。页面不直接操作 DOM；focus 意图由 input manager 管理，具体 selection 同步由 composer owner 承担。
- `post-edit-maintainability-review` 已执行：no maintainability findings；剩余风险是 `chat-input-bar` 目录和测试文件继续接近维护预算，后续大改应拆分测试 fixtures / harness。

## NPM 包发布记录

- 涉及包：`@nextclaw/agent-chat-ui`、`@nextclaw/ui`。
- 当前状态：仅本地源码、构建与定向验证通过，未执行 NPM 发布。
- 发布判断：需要随下一次统一前端/桌面发布批次评估并带出。
