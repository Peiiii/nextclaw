## 迭代完成说明

本次完成 client SDK 第一阶段补齐：在 `NextClawClient` 上新增标准 `agentRuns` namespace，提供 `send`、`stream`、`abort` 三个原子能力。`send` 与 `abort` 对齐后端 `agent-run.send` / `agent-run.abort` ingress payload，新增标准 HTTP route `/api/agent-runs/*`；历史 `/api/ncp/agent/*` route 保留，并复用同一 server route owner，避免新旧链路实现分叉。

本次没有实现 Panel App 外部投影，也没有把 agent 交互映射成 `panelApps.sendAgentMessage`。设计文档同步补充为：旧 client 先补齐标准 Agent Runs，后续 `window.nextclaw.client` 再薄映射到这组稳定能力。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/client-sdk test -- src/nextclaw-client.test.ts`：通过，覆盖 SDK `agentRuns.send/abort/stream` 映射。
- `pnpm --filter @nextclaw/client-sdk tsc`：通过。
- `pnpm --filter @nextclaw/server tsc`：通过。
- `pnpm --filter @nextclaw/client-sdk lint`：通过。
- `pnpm --filter @nextclaw/server lint`：通过，存在仓库既有 9 个 warning。
- `pnpm --filter @nextclaw/server test -- src/app/tests/router-agent-runs-route.test.ts src/app/router.ncp-agent-stream.test.ts`：未进入测试体，受既有 `@nextclaw/core/child-process-env` Vitest/path 解析问题阻塞。
- `pnpm check:generated-clean`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance`：失败项来自无关 `packages/aigen` 工作区改动；本次新增 `router-agent-runs-route.test.ts` 的 import 规范问题已修正。

真实接口验收：使用当前源码 runtime `http://127.0.0.1:18888`，通过 `NextClawClient.agentRuns.send()` 创建会话 `ncp-mpzrcu1x-0c05c9d3`，唯一标记 `AGENT_RUNS_SDK_SMOKE_1780593433107`。SSE 收到 `message.tool-call-start`、`message.tool-call-result`、`run.finished`，会话消息中落盘 `read_file` 工具调用，读取 `/Users/peiwang/Projects/nextbot/package.json` 的 `name` 为 `nextclaw-workspace`。

## 发布/部署方式

未发布。当前任务只完成第一阶段实现与本地真实接口验收；后续提交或统一 beta 发布时再按发布流程处理。

## 用户/产品视角的验收步骤

打开 `http://127.0.0.1:18888`，在会话列表中查找 `AGENT_RUNS_SDK_SMOKE_1780593433107` 或会话 `ncp-mpzrcu1x-0c05c9d3`。预期能看到 `default-demo` 新会话，最后活动包含 `工具调用完成：read_file`，回复内容包含 `nextclaw-workspace`。

## 可维护性总结汇总

本次新增的是用户可见 SDK/API 能力，生产代码净增为正：`agentRuns` service、server 标准 route 与导出类型是必要新增。已避免新增旧 facade 或重复业务 owner；server 新旧 route 复用同一个 `mountAgentRunRoutes`，没有让 `/api/agent-runs/*` 和 `/api/ncp/agent/*` 分叉。目录预算 guard 仍提示 `client-sdk/src/services` 与 `server/src/app` 超预算，但已补充 README 豁免说明；标准 route 测试放入 `src/app/tests/`，避免继续增加 app 根目录直放测试文件。

## NPM 包发布记录

涉及 `@nextclaw/client-sdk` 与 `@nextclaw/server` 的源码能力变化，但本轮未执行 NPM 发布。状态：待后续统一 beta 发布流程评估并发布。
