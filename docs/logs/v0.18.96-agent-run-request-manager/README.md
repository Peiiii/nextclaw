# v0.18.96 Agent Run Request Manager

## 迭代完成说明

本次完成 Agent run request 链路阶段一、阶段二改造：新增 kernel 级 `AgentRunRequestManager` 作为 raw send request、session materialization、session request ingress 的 owner；`AgentRuntimeManager` 收敛为 runtime 管理和已 materialized request 执行入口。

HTTP `/api/ncp/agent/send` 现在通过 `agentRunRequests.send` 进入新 request owner，不再依赖旧的 `AgentRuntimeManager.createMaterializingAgentClientEndpoint` 链路。`DefaultNcpAgentBackend` 仍作为当前执行基础设施保留，避免丢失 live session、stream、abort、persistence、event normalization 等执行语义。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/kernel tsc && pnpm --filter @nextclaw/server tsc && pnpm --filter @nextclaw/service tsc`
- `pnpm --filter @nextclaw/kernel lint && pnpm --filter @nextclaw/server lint && pnpm --filter @nextclaw/service lint`
- `pnpm --filter @nextclaw/kernel test -- src/managers/agent-run-request.manager.test.ts`
- `pnpm --filter @nextclaw/server test -- src/app/router.ncp-agent.test.ts`
- `pnpm --filter @nextclaw/service test -- src/shared/services/session/tests/service-deferred-ncp-agent.service.test.ts src/shared/services/session/tests/service-ncp-agent-send-http-contract.service.test.ts`
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

## NPM 包发布记录

不涉及 NPM 包发布。
