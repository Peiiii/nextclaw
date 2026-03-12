# v0.13.81-ncp-http-agent-server-modularize

## 迭代完成说明（改了什么）

- 将 `@nextclaw/ncp-http-agent-server` 的单文件实现（`src/index.ts`）重构为模块化结构：
  - `src/routes.ts`：路由挂载与 forward/replay 组装。
  - `src/sse-stream.ts`：SSE 事件流抽象（`createSseEventStream`、frame 构造、response 构造）。
  - `src/parsers.ts`：请求体/查询参数解析与基础校验。
  - `src/scope.ts`：事件 scope 提取与匹配、terminal 事件判定。
  - `src/types.ts`：server 选项与内部共享类型。
  - `src/index.ts`：收敛为导出入口。
- 合并 `createForwardResponse` 和 `createReplayResponse` 的 SSE 写流重复模式，统一走 `createSseEventStream`。
- 将 scope 判断改为 `extractScopeFromEvent + matchesScope`，集中化字段提取逻辑。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ncp-http-agent-server lint`
- `pnpm -C packages/nextclaw-ncp-http-agent-server tsc`
- `pnpm -C packages/nextclaw-ncp-http-agent-server build`
- `pnpm -C packages/nextclaw-ncp-http-agent-server test`
- 回归执行：`pnpm -C packages/nextclaw-ncp-http-agent-client test`
- 结果：以上命令均通过。

## 发布/部署方式

- 本次为内部重构与可维护性提升，不涉及额外运行时接口变更，不需要额外部署动作。
- 后续若随版本发布，按项目既有 npm 发布流程执行（changeset/version/publish）。

## 用户/产品视角的验收步骤

1. 继续以既有方式挂载 `createNcpHttpAgentRouter`，确认 `/send`、`/reconnect`、`/abort` 路由行为与重构前一致。
2. 在 `/send` 与 `/reconnect` 场景下观察 SSE：`ncp-event` 与 `error` 事件帧格式保持兼容。
3. 验证跨会话事件不会串流（scope 过滤生效），以及 terminal 事件后连接可正常结束。
