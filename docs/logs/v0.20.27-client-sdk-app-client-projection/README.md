## 迭代完成说明

本次完成第二阶段：`@nextclaw/client-sdk` 新增 `createNextClawAppClient(hostClient)` 与 `NextClawAppClient`，并把 Panel App client 注入链路从“直接挂完整底层 `NextClawClient`”改为“创建 host client 后挂 `NextClawAppClient` projection”。

对外 `window.nextclaw.client` 当前只暴露 `sessions`、`agents`、`agentRuns`、`serviceActions`、`assets`、`events` 六组 app-facing namespace，不暴露 `config`、`runtimeControl`、`panelApps`、`serviceApps`、`eventBus` 等 host/admin surface。旧 `window.nextclaw.agent` 与 `window.nextclaw.serviceActions` bridge 保留。

同步更新了 Panel App / NextClaw App creator skill 和注入设计文档，避免继续引导 AI 把 `window.nextclaw.client` 当完整底层 client 使用。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/client-sdk test -- src/nextclaw-client.test.ts`：通过，覆盖 app-facing projection key set、host-only namespace 不暴露、projection 方法直连 host client。
- `pnpm --filter @nextclaw/client-sdk tsc`：通过。
- `pnpm --filter @nextclaw/client-sdk lint`：通过。
- `pnpm --filter @nextclaw/client-sdk build`：通过，确认 ESM + browser global bundle 可构建。
- `pnpm --filter @nextclaw/kernel tsc`：通过。
- `pnpm --filter @nextclaw/kernel lint`：通过。
- `pnpm --filter @nextclaw/kernel test -- src/managers/__tests__/panel-app.manager.test.ts`：通过。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm check:generated-clean`：通过。

真实接口验收：用当前源码 runtime `http://127.0.0.1:18888` 创建真实 Panel App `client-projection-smoke-1780595200000`，声明 `client: true` 并通过 `/api/panel-app-client-grants/...` 授权。拉取 content 后执行真实 `/api/panel-app-client-sdk.js` bundle 与 HTML inline scripts，确认：

- `window.nextclaw.client` keys 为 `["agentRuns","agents","assets","events","serviceActions","sessions"]`。
- `config`、`eventBus`、`panelApps`、`runtimeControl`、`serviceApps` 均不存在。
- 旧 bridge keys `agent` 与 `serviceActions` 仍存在。
- `window.nextclaw.client.sessions.list({ limit: 1 })` 可真实请求 API。
- 通过注入出的 `window.nextclaw.client.agentRuns.send/stream` 创建会话 `ncp-mpzs10y6-65d15952`，SSE 收到 `message.tool-call-start`、`message.tool-call-result`、`run.finished`，消息里落盘 `read_file` 工具调用并返回 `nextclaw-workspace`。

## 发布/部署方式

未发布。本次仅完成源码实现、本地源码 runtime 重启与真实接口验收；后续如需发布，走统一 NPM beta 发布流程。

## 用户/产品视角的验收步骤

打开 `http://127.0.0.1:18888`，在 Panel Apps 中可找到 `Client Projection Smoke 1780595200000`，其 `clientDeclared` 与 `clientGranted` 均为 true。会话列表中可查找 `APP_CLIENT_AGENT_RUN_SMOKE_1780594561801` 或会话 `ncp-mpzs10y6-65d15952`，应看到 `default-demo` 会话完成 `read_file` 工具调用。

## 可维护性总结汇总

本次是新增用户可见 app-facing SDK 能力，非测试代码净增为必要增长。实现保持单一事实源：`createNextClawAppClient()` 的返回对象就是 API map；注入链路只调用该 factory，不复制 namespace 映射；旧 bridge 不迁移、不删除、不新增并行业务代理。maintainability guard 0 error，1 个既有测试文件接近预算 warning。

## NPM 包发布记录

涉及 `@nextclaw/client-sdk`、`@nextclaw/core`、`@nextclaw/kernel` 的发布包内容变化，已新增 changeset。状态：待后续统一 beta 发布流程发布。
