# v0.13.83-ncp-http-agent-client-error-flow-fix

## 迭代完成说明（改了什么）

- 修复 `@nextclaw/ncp-http-agent-client` 的错误流重复上报问题：
  - SSE `error` 帧触发的 `endpoint.error` 只发布一次，不再在外层 catch 中重复发布。
  - 保留 SSE 错误的原始 NCP 错误码（如 `timeout-error`），避免被二次转换成 `runtime-error`。
- 修复 `abort()` 在 `stop()` 主动中断场景下的误报：
  - 中断后静默返回，不发布 `endpoint.error`。
- 修复 SSE UTF-8 解码边界问题：
  - 在流结束时增加 `TextDecoder` flush，避免多字节字符跨 chunk 时被破坏。
- 补充/增强单测：
  - UTF-8 跨 chunk 解码场景。
  - SSE `error` 上报去重场景。
  - `stop()` 中断 in-flight abort 场景。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ncp-http-agent-client lint`
- `pnpm -C packages/nextclaw-ncp-http-agent-client tsc`
- `pnpm -C packages/nextclaw-ncp-http-agent-client test`
- `pnpm -C packages/nextclaw-ncp-http-agent-client build`
- 结果：上述命令全部通过，测试共 5 条通过。

## 发布/部署方式

- 本次改动为客户端包内部行为修复，不涉及部署动作。
- 若后续发布 NPM 包，按既有发布流程执行 changeset/version/publish。

## 用户/产品视角的验收步骤

1. 在服务端返回 SSE `error`（例如 timeout）时，客户端只收到一次 `endpoint.error`。
2. 观察错误码，确认保留语义（如 `timeout-error`），不被统一降级。
3. 服务端推送含中文等多字节字符的流式 delta，确认前端展示不乱码。
4. 在页面关闭或主动 stop 导致请求取消时，不出现多余的错误提示。
