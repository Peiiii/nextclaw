# v0.13.79-ncp-http-agent-transport-mvp

## 迭代完成说明（改了什么）

- 新增 `@nextclaw/ncp-http-agent-server` 首版实现与单元测试：
  - 提供 `createNcpHttpAgentRouter` / `mountNcpHttpAgentRoutes`。
  - 提供 `POST /send`、`GET /reconnect`、`POST /abort`，并将 NCP 事件转为 SSE 输出。
- 新增 `@nextclaw/ncp-http-agent-client` 首版实现与单元测试：
  - 提供 `createNcpHttpAgentClient` 与 `NcpHttpAgentClientEndpoint`（实现 `NcpClientEndpoint`）。
  - 支持 `send` / `resume` / `abort`，支持 SSE `ncp-event` / `error` 解析与订阅分发。
- 根工作区脚本接入新包：`build`、`lint`、`tsc`。

## 测试/验证/验收方式

- 依赖同步：`pnpm install`
- Server 包验证：
  - `pnpm -C packages/nextclaw-ncp-http-agent-server lint`
  - `pnpm -C packages/nextclaw-ncp-http-agent-server tsc`
  - `pnpm -C packages/nextclaw-ncp-http-agent-server build`
  - `pnpm -C packages/nextclaw-ncp-http-agent-server test`
- Client 包验证：
  - `pnpm -C packages/nextclaw-ncp-http-agent-client lint`
  - `pnpm -C packages/nextclaw-ncp-http-agent-client tsc`
  - `pnpm -C packages/nextclaw-ncp-http-agent-client build`
  - `pnpm -C packages/nextclaw-ncp-http-agent-client test`
- 结果：上述命令全部通过。

## 发布/部署方式

- 本次为包内实现与测试落地，未执行对外 npm 发布。
- 若后续发布，按项目既有发布流程执行：
  - `pnpm release:version`
  - `pnpm release:publish`

## 用户/产品视角的验收步骤

1. 在服务端挂载 `createNcpHttpAgentRouter({ agentEndpoint })`，并确认 `/ncp/agent/send` 可返回 SSE 流。
2. 在客户端创建 `createNcpHttpAgentClient({ baseUrl })`，调用 `send` 后可收到 `message.accepted` / 流式事件 / `message.completed`。
3. 模拟断线后调用 `resume`，确认可走 `/ncp/agent/reconnect` 并收到恢复流。
4. 调用 `abort`，确认服务端收到 `message.abort` 并可终止对应 run。
