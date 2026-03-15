# v0.13.109 ncp-demo-composable-fullstack

## 迭代完成说明（改了什么）

- 新增 `@nextclaw/ncp-toolkit` 通用积木：`DefaultNcpInMemoryAgentBackend`
- 能力覆盖：会话内存态管理、`send` 运行、`runId` 事件回放（stream）、abort、中间事件广播
- 在 `run.finished` 阶段自动补齐 `message.completed`，避免上层重复兜底
- 新增 `apps/ncp-demo` 完整前后端 demo
- 后端：Hono + `@nextclaw/ncp-http-agent-server`，直接挂载 `/ncp/agent/send|stream|abort`
- 后端：附带 `/demo/sessions`、`/demo/sessions/:sessionId/messages`、`/health` 用于可视化与验收
- 前端：React + `@nextclaw/ncp-http-agent-client` + `DefaultNcpAgentConversationStateManager`，直接消费 NCP 事件流
- 根目录新增一键开发命令：`pnpm dev:ncp-demo`
- 根目录新增 demo 冒烟命令：`pnpm smoke:ncp-demo`

## 测试/验证/验收方式

- Toolkit 单测：`pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit test`
- Toolkit 类型检查：`pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit tsc`
- Demo 类型检查：`pnpm -C apps/ncp-demo tsc`
- Demo lint：`pnpm -C apps/ncp-demo lint`
- Demo 冒烟：`pnpm -C apps/ncp-demo smoke`
- 根目录快捷冒烟：`pnpm smoke:ncp-demo`

## 发布/部署方式

- 本次是开发态 demo，不涉及线上部署
- 本地开发启动：在仓库根目录执行 `pnpm dev:ncp-demo`
- 若后续需要发布包：按既有发布流程执行 `changeset -> version -> publish`

## 用户/产品视角的验收步骤

1. 在仓库根目录执行 `pnpm dev:ncp-demo`
2. 打开终端输出中的前端地址（默认 `http://127.0.0.1:5181`）
3. 输入一条消息并发送
4. 观察消息流：应出现工具调用（`get_current_time`）和最终 assistant 文本
5. 点击 `replay last run`，应可重放该 run 的流式事件
6. 再次发送后点击 `abort`，应停止当前运行并看到错误态收敛
7. 在左侧 session 面板确认消息计数、会话状态更新正常
