# v0.21.22 Native Abort Runtime

## 迭代完成说明

- 修复 native agent runtime 在工具调用长时间未返回时点击终止仍卡住的问题。
- 根因：`DefaultNcpAgentRuntime.drainRuntimeEvents()` 在等待 model stream 与 tool queue 时只 `Promise.race` source/tool 候选，没有把本轮 `AbortSignal` 放入竞态；当 source 已结束而 tool 仍运行时，runtime 会卡在 `toolExecutor.nextEvent()`，`finally` 中的 `toolExecutor.cancel()` 也无法及时执行。
- 扩展修复：`NcpToolExecutionContext` 增加可选 `abortSignal`，runtime 将本轮 signal 传给工具，`McpNcpTool` 再传到 `McpRegistryService` / `McpServerLifecycleManager`，最终进入 MCP SDK `client.callTool(..., { signal })`。
- 依据：Codex 公开问题同样将 stop 延迟归因到 tool-call loop / in-flight tool drain 未检查 cancellation；OpenCode 源码则把 abort signal 传入 LLM/tool 执行，并在 shell 执行中使用 scoped child process 与强杀兜底。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ncp-agent-runtime-next test -- agent-runtime.service.test.ts`
- `pnpm --filter @nextclaw/ncp-agent-runtime-next tsc`
- `pnpm --filter @nextclaw/ncp-mcp test -- mcp-ncp-tool-registry-adapter.test.ts`
- `pnpm --filter @nextclaw/ncp-mcp tsc`
- `pnpm --filter @nextclaw/ncp tsc`
- `pnpm --filter @nextclaw/mcp tsc`
- `pnpm -C packages/nextclaw-mcp exec vitest run tests/mcp-server-lifecycle-manager.test.ts`
- 临时功能 harness：`pnpm -C packages/nextclaw-server exec vitest run src/app/native-abort-functional.tmp.test.ts`
  - 验收内容：真实 Hono HTTP `/api/ncp/agent/send` + SSE `/stream` + `/abort`，中间装配 native `DefaultNcpAgentRuntime` 与长时间工具调用。
  - 结果：1 个功能测试通过，测试阶段 91ms；`/abort` 后 1s 内收到 `message.abort`，`SessionRun` 退出 running，未产生 `RunFinished` 误完成，工具收到并观察到同一轮 `AbortSignal`。
- `pnpm -C packages/nextclaw-ui exec vitest run src/features/chat/features/ncp/hooks/__tests__/use-ncp-agent-runtime.test.tsx`
  - 结果：1 个测试文件通过，4 个用例通过；新增覆盖 `message.abort` 到达后 `useNcpAgentRuntime.isRunning` 从 true 清成 false，终止按钮状态不应继续停留在 running。
- `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/features/chat/features/ncp/hooks/__tests__/use-ncp-agent-runtime.test.tsx`
  - 结果：新增 UI 测试文件治理通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- `pnpm lint:new-code:governance -- ...`

验证缺口：
- `pnpm --filter @nextclaw/mcp test -- mcp-registry-service.test.ts` 未进入目标用例，因既有 `@nextclaw/core` 源码 alias `@core/features/config/index.js` 在该 package 测试环境无法解析。
- `pnpm -C packages/nextclaw-ui tsc` 未通过，阻塞于既有 marketplace 类型错误：`marketplace-detail-doc.test.tsx` 缺 `toHaveAttribute` matcher 类型、`marketplace-detail-doc.tsx` 的 `Heading` JSX 类型错误；不在本次 abort 链路触达范围。
- 尚未做浏览器真实点击终止冒烟；已补真实 HTTP/SSE 功能 harness，覆盖前端实际依赖的 `message.abort` 到达时机，但仍不是人工浏览器按钮点击录像级验收。

## 发布/部署方式

- 本次不涉及立即部署。
- 已添加 changeset，后续走统一 NPM 发布闭环。

## 用户/产品视角的验收步骤

1. 在 native 会话中触发一个会进入长时间工具调用的请求。
2. 点击终止后，当前页面应在短时间内收到 `message.abort` 并退出 running/终止按钮状态，不需要刷新页面才能看到停止。
3. 如果工具实现支持 `AbortSignal`，底层 MCP/tool 请求应随同本轮终止信号取消。
4. 终止后再次发送消息，不应因为前一轮 UI 状态残留而出现“上一轮请求没有完成，请重新发送”。

## 可维护性总结汇总

- 本次遵守 owner 边界：runtime 负责 stream/tool event 合流与 terminal event，NCP tool context 负责工具执行合同，MCP lifecycle 负责把 signal 传给 SDK request options。
- 非测试生产代码净增：+44 行。原因是原链路缺少取消合同，只靠前端或 runtime 外层状态无法真实表达 tool/MCP 取消；需要补齐 `AbortSignal` 从 run 到 MCP SDK 的贯穿路径。
- Line-growth exemption：已检查当前责任链，没有可删除的旧取消路径或重复实现；继续压缩会降低 abort listener 清理、公共 context 字段和 MCP SDK options 传递的显式性。本次保留必要增长。
- 可维护性警告：`agent-runtime.service.ts` 接近文件预算，后续如果继续增加 runtime 编排逻辑，应优先拆出 drain/abort 协调 owner。
- 治理缺口：`pnpm lint:new-code:governance -- ...` 被既有 legacy 文件命名阻塞，涉及 `mcp-ncp-tool.ts`、`mcp-ncp-tool-registry-adapter.ts`、`mcp-server-lifecycle-manager.ts`、`mcp-registry-service.ts` 未使用点分角色后缀。本次未展开连锁重命名，避免把 abort 修复扩大成 MCP package 命名迁移。
- 已使用 `post-edit-maintainability-review` 做主观复核；结论为保留债务经说明记录。

## NPM 包发布记录

- 涉及 NPM 包发布，已添加 `.changeset/native-abort-signal.md`。
- 受影响包：`@nextclaw/ncp`、`@nextclaw/ncp-agent-runtime-next`、`@nextclaw/ncp-mcp`、`@nextclaw/mcp`。
- 发布状态：待统一发布。
