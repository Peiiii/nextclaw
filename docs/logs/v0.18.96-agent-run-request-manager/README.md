# v0.18.96 Agent Run Request Manager

## 迭代完成说明

本次完成 Agent run request 链路阶段一、阶段二改造：新增 kernel 级 `AgentRunRequestManager` 作为 raw send request、session materialization、session request ingress 的 owner；`AgentRuntimeManager` 收敛为 runtime 管理和已 materialized request 执行入口。

HTTP `/api/ncp/agent/send` 现在通过 `agentRunRequests.send` 进入新 request owner，不再依赖旧的 `AgentRuntimeManager.createMaterializingAgentClientEndpoint` 链路。`DefaultNcpAgentBackend` 仍作为当前执行基础设施保留，避免丢失 live session、stream、abort、persistence、event normalization 等执行语义。

后续清理补丁继续删除阶段一、阶段二完成后暴露出的旧接触面：

- `UiRouterOptions` 删除 `agentRunRequests`、`agentRuntimeTypes`、`ncpAssets`、`sessions`、`providers` fallback 字段，server API 层统一通过 `kernel` 访问对应 manager。
- `@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/service` 删除对 `@nextclaw/ncp-http-agent-server` 的直接依赖；server tsconfig 同步删除旧 alias。
- 删除已失去产品价值的 `apps/ncp-demo`，并清理 root workspace、root dev/smoke 命令、pnpm lock importer 与 LOC 指标残留。

阶段三补丁把 HTTP agent run command 接入 kernel ingress：

- `ingressKeys.agentRuntime.sessionMessageRequest` 收敛为 `ingressKeys.agentRun.sessionMessageRequest`，并新增 `agentRun.send`、`agentRun.abort`。
- `AgentRunRequestManager.start()` 注册 `agentRun.send`、`agentRun.abort`、`agentRun.sessionMessageRequest` 三个 handler，manager 仍是完整执行 owner。
- HTTP `/api/ncp/agent/send` 与 `/api/ncp/agent/abort` 不再直接调用 manager command，而是通过 `kernel.ingress.handle(...)` 投递；`stream` 仍作为读侧订阅直接读取 `agentRunRequestManager.stream(...)`。
- `UiRouterOptions` 不再单独接收 `ingress`，router 已拿到 `kernel` 时直接使用 `kernel.ingress`。
- `UiRouterOptions.kernel` 从可选合同收紧为必填合同，server route/controller 不再保留 `kernel?` 和 `kernel?.xxx` 分支；测试侧统一通过 `createRouterTestKernel()` 显式提供 kernel。
- `NextclawApp` 不再支持 constructor 额外覆盖 kernel，kernel 只从 gateway owner 上取得。
- `AgentRunRequestManager` 不再通过 `this.options` 长期持有依赖，constructor 内将依赖收敛到自身 readonly 字段。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/kernel tsc && pnpm --filter @nextclaw/server tsc && pnpm --filter @nextclaw/service tsc`
- `pnpm --filter @nextclaw/kernel lint && pnpm --filter @nextclaw/server lint && pnpm --filter @nextclaw/service lint`
- `pnpm --filter @nextclaw/kernel test -- src/managers/agent-run-request.manager.test.ts`
- `pnpm --filter @nextclaw/server test -- src/app/router.ncp-agent.test.ts`
- `pnpm --filter @nextclaw/server test -- src/app/router.ncp-agent.test.ts src/app/tests/router.ncp-agent-runtime-manager.test.ts src/app/routes/ingress.route.test.ts src/app/router-provider-probe.test.ts`
- `pnpm --filter @nextclaw/service test -- src/shared/services/session/tests/service-deferred-ncp-agent.service.test.ts src/shared/services/session/tests/service-ncp-agent-send-http-contract.service.test.ts`
- `pnpm --filter @nextclaw/shared tsc && pnpm --filter @nextclaw/kernel tsc && pnpm --filter @nextclaw/server tsc && pnpm --filter @nextclaw/service tsc`
- `pnpm --filter @nextclaw/kernel lint && pnpm --filter @nextclaw/server lint && pnpm --filter @nextclaw/service lint`
- `pnpm --filter @nextclaw/kernel test -- src/managers/agent-run-request.manager.test.ts`
- `pnpm --filter @nextclaw/server test -- src/app/router.agents.test.ts src/app/router.auth.test.ts src/app/router.cron.test.ts src/app/router.marketplace-content.test.ts src/app/router.marketplace-installed.test.ts src/app/router.marketplace-manage.test.ts src/app/router.model-config.test.ts src/app/router.provider-enabled.test.ts src/app/router.provider-test.test.ts src/app/router.remote.test.ts src/app/router.runtime-control.test.ts src/app/router.search-config.test.ts src/app/router.weixin-channel-auth.test.ts src/app/router.weixin-channel-config.test.ts src/features/runtime-update/controllers/runtime-update.controller.test.ts src/features/server-path/controllers/server-path.controller.test.ts src/app/server.cors.test.ts src/app/server.weixin-channel.test.ts src/app/router.ncp-agent.test.ts src/app/tests/router.ncp-agent-runtime-manager.test.ts src/app/routes/ingress.route.test.ts src/app/router-provider-probe.test.ts`
- `pnpm --filter @nextclaw/service test -- src/shared/services/gateway/tests/nextclaw-app.service.test.ts src/shared/services/gateway/tests/service-bootstrap-status.service.test.ts`
- `pnpm --filter @nextclaw/server test -- src/app/router.ncp-agent.test.ts src/app/tests/router.ncp-agent-runtime-manager.test.ts src/app/server.cors.test.ts src/app/server.weixin-channel.test.ts src/app/router-provider-probe.test.ts`
- `pnpm install --lockfile-only --frozen-lockfile`
- `pnpm --filter @nextclaw/server lint`
- `pnpm metrics:loc`
- `node scripts/metrics/code-volume-metrics.mjs --benchmark-name openclaw --benchmark-root ../openclaw --benchmark-include-dirs src,extensions --benchmark-output docs/metrics/code-volume/comparison.json`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`

## 发布/部署方式

本次只完成源码重构和本地验证，尚未执行发布或部署。

## 用户/产品视角的验收步骤

通过 UI API 发送：

```text
POST /api/ncp/agent/send
```

预期：无 `sessionId` 的新会话请求仍会被 materialize 成真实 session；接口响应仍返回 `NcpRunHandle`；service contract 测试确认该接口不再调用旧 `agentClientEndpoint.send`。

## 可维护性总结汇总

本次主要减债动作是职责收敛和删除旧路径：`AgentRuntimeManager` 删除 request materialization、materializing endpoint wrapper 和 ingress session message handler。新增的 `AgentRunRequestManager` 是完整 request owner，不是只转发 backend 的空壳。

可维护性 guard scoped 到本次触达源码后通过：非测试源码净减 4 行。保留的 warning 是既有 `packages/nextclaw-server/src/app` 目录文件数超预算，以及 `server-api.types.ts` 接近文件预算，本次未继续扩大。

清理补丁整体删除 35 个 `apps/ncp-demo` 文件，并从 server router option 面删除多条旧 fallback 注入路径。最终 diff 为 `55 files changed, 1020 insertions(+), 4383 deletions(-)`；maintainability guard 对本次仍保留源码触达面统计为非测试代码净减 43 行，新增的主要插入来自生成指标 JSON 刷新。保留 warning 是既有 `packages/nextclaw-server/src/app` 目录文件数超预算，以及 `router.ncp-agent.test.ts` 接近文件预算。

阶段三补丁 scoped maintainability guard 通过：`total +173 / -146 / net +27`，`non-test +120 / -120 / net +0`。保留 warning 是既有 app 目录文件数超预算、`router.ncp-agent.test.ts` 接近预算，以及 `agent-run-request.manager.ts` 接近 600 行预算。

阶段三确定化补丁继续通过 scoped maintainability guard：`total +334 / -191 / net +143`，`non-test +125 / -131 / net -6`。本次正向减债是删除 router/controller/service 上非必要的 optional kernel 分支，并把测试依赖显式化；保留 warning 是既有 app 目录文件数超预算、`agent-run-request.manager.ts` 接近预算，以及几个 router 测试文件接近预算。

## NPM 包发布记录

不涉及 NPM 包发布。
