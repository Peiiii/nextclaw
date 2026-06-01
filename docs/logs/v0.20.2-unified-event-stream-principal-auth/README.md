# v0.20.2 Unified Event Stream Principal Auth

## 迭代完成说明

本次按 `docs/designs/2026-06-01-unified-event-stream-principal-auth-design.md` 落地统一事件流入口鉴权。

命名收敛：原方案中的 `realtime` 只描述“实时效果”，没有表达这条 `/ws` 链路的真实职责。本次统一改为 `event-stream`，表示“面向不同 principal 的 app event stream”，避免调用方感知 UI 或 extension 这类来源分支。

根因：`/ws` 顶层只调用 `UiAuthService.isSocketAuthenticated`，把事件流连接主体等同于 UI 浏览器 session；channel extension 虽然 HTTP `/webhook` 有 extension token，但 WebSocket 没有 UI cookie，`ui.auth.enabled=true` 时会被拒绝。

确认方式：查看 `packages/nextclaw-server/src/app/server.ts` 旧实现中的 `Set<WebSocket>` 广播与 UI cookie 判断，并补充 assembled server WebSocket 测试复现“UI 未登录 401、extension token 通过”的差异。

修复方式：

- 新增 server 内部 `features/event-stream`，由 `EventStreamAuthService` 归一化 UI cookie 与 extension bearer token 为 `EventStreamPrincipal`。
- 用 `EventStreamClientRegistry` 替换 `server.ts` 中的裸 `Set<WebSocket>` 广播。
- extension principal 按 `extensionId` 和 channel scope 接收 `extension.request` / `ncp.event` / channel config updates。
- kernel extension runtime 改为 per-extension token，并暴露窄的 `authenticateEventStreamCredential`。
- extension SDK WebSocket factory 传递 `Authorization` 与 `X-NextClaw-Extension-Id`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/server test -- src/app/tests/server-event-stream.test.ts`：通过，覆盖 UI auth 开启时未登录 UI socket 401、extension token socket 通过、`ncp.event` 按 channel route 过滤、`config.updated` 只投递 channel config 更新。
- `pnpm --filter @nextclaw/kernel test -- src/services/extension-runtime.service.test.ts`：通过，覆盖 extension request response 与 event stream credential 绑定 extensionId。
- `pnpm --filter @nextclaw/extension-sdk test -- src/extension-sdk.test.ts`：通过，覆盖 SDK WebSocket header 传递。
- `pnpm --filter @nextclaw/server tsc`、`@nextclaw/kernel tsc`、`@nextclaw/extension-sdk tsc`、`@nextclaw/shared tsc`、`@nextclaw/service tsc`：通过。`@nextclaw/service tsc` 首次被 kernel 旧 dist 类型挡住，执行 `pnpm --filter @nextclaw/kernel build` 刷新类型出口后通过。
- `pnpm --filter @nextclaw/kernel build`：通过，用于刷新跨包 dist 类型出口后验证 service。
- targeted ESLint：本次触达源码和测试文件 `--max-warnings=0` 通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`：通过，0 errors，3 warnings。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <本批次触达文件>`：通过，0 errors，3 warnings；本批次统计为 total +642 / -54 / net +588，non-test +352 / -50 / net +302。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`：未作为本批次最终门禁；该命令按纯非功能改动判定整批 diff，被统一鉴权新增能力的非测试净增挡住。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。

## 发布/部署方式

未执行发布、部署或 NPM publish。本次是源码与测试落地，后续应随统一版本批次发布相关包。

## 用户/产品视角的验收步骤

1. 开启并配置 `ui.auth.enabled=true`。
2. 浏览器未登录时直接连 `/ws` 应被 401 拒绝。
3. channel extension 使用运行时注入的 `NEXTCLAW_EXTENSION_ID` 与 `NEXTCLAW_EXTENSION_TOKEN` 连接同一个 `/ws`，应认证通过。
4. 触发 channel auth request、outbound request 或 NCP reply 时，目标 extension 能收到属于自己的事件流事件，其他 extension 不应收到。

## 可维护性总结汇总

已使用 `post-edit-maintainability-review` 做二次复核。结论：通过。

本次是新增用户可见运行能力，非测试代码净增为必要增长。正向动作是职责收敛和必要解耦抽象：`server.ts` 不再直接拥有 socket set、认证分支和广播授权，事件流连接状态、主体认证、事件授权分别进入明确 owner。

守住的边界：

- kernel 只返回 `{ extensionId }`，不依赖 server 的 `EventStreamPrincipal`。
- server 只通过 `UiExtensionHost.authenticateEventStreamCredential` 使用窄接口，不读取 extension token 内部状态。
- extension token 与 `extensionId` 绑定，不再使用全局 token。
- 新增测试放在 `app/tests`，避免继续扩大 `app` 根目录文件数。
- server 内部 feature root 从 `realtime` 收敛为 `event-stream`，命名直接对应事件流 owner，不再使用模糊效果词。

剩余债务：

- `ExtensionRuntimeService` 接近文件预算，后续可把 extension request pending lifecycle 或 ingress auth 继续拆入 extension-runtime feature 内部 owner。
- extension SDK 测试文件接近预算，后续可拆 fixtures/builders 与行为用例。
- `packages/nextclaw-server/src/app` 目录仍高于预算，但本次没有增加根目录文件数。

## NPM 包发布记录

不涉及 NPM 包发布。受影响包包括：

- `@nextclaw/server`
- `@nextclaw/kernel`
- `@nextclaw/shared`
- `@nextclaw/service`
- `@nextclaw/extension-sdk`

状态：待后续统一发布批次评估。
