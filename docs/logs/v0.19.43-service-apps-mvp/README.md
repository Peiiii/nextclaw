# v0.19.43 Service Apps MVP

## 迭代完成说明

本次落地 Service Apps MVP：在 kernel 中新增 `ServiceAppManager` 作为业务 owner，支持从 workspace `service-apps/<id>/service-app.json` 发现 MCP-compatible Service App，按需 warm stdio MCP server，映射为 Service Actions，并以 kernel grant store 管理 Panel App 调用授权。

同时补齐 Panel App bridge：Panel App HTML 由宿主注入 `/api/panel-app-bridge.js`，iframe 只通过 `postMessage` 调用 `window.nextclaw.serviceActions`，server 侧通过 bridge session 还原 caller 与 allowlist，拒绝 iframe 自报 caller。右侧面板增加 Service Apps 状态页，展示服务、actions、错误、restart 与 grant revoke。

内置 skill 方面，新增 `service-app-creator`，并更新 `panel-app-creator`，让 AI 后续能生成配套 Service App 与声明了 action allowlist 的 Panel App。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/core tsc`
- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/server tsc`
- `pnpm --filter @nextclaw/client-sdk tsc`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/remote tsc`
- `pnpm --filter @nextclaw/kernel test -- src/managers/__tests__/panel-app.manager.test.ts src/managers/__tests__/service-app.manager.test.ts`
- `pnpm --filter @nextclaw/server test -- src/features/panel-apps/controllers/panel-apps.controller.test.ts src/features/service-apps/controllers/service-apps.controller.test.ts`
- `pnpm --dir packages/nextclaw-kernel exec eslint ...` 定向检查本次 kernel 触达文件
- `pnpm --dir packages/nextclaw-server exec eslint ...` 定向检查本次 server 触达文件
- `pnpm --dir packages/nextclaw-client-sdk exec eslint ...` 定向检查本次 client SDK 触达文件
- `pnpm --dir packages/nextclaw-ui exec eslint ...` 定向检查本次 UI 触达文件
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm lint:maintainability:report`

真实链路验收覆盖：临时 workspace 中创建真实 stdio MCP Service App，`ServiceAppManager` 能发现 `notes.echo`，未授权调用返回 `AUTHORIZATION_REQUIRED`，授权后可调用 MCP fixture 并得到 `echo:ok`。

补充验收：创建中的 `service-apps/<id>/` 空目录不会被识别为 failed Service App；存在但 JSON 非法的 `service-app.json` 会被识别为 failed，并展示解析错误。

已知验证说明：`pnpm lint:maintainability:hotspots` 当前因既有 tracked hotspots 的 missing/current 状态退出 1，本次未触达这些红区文件。

## 发布/部署方式

本次未执行发布、部署或 NPM 发版。改动涉及 `@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/ui` 的运行链路，后续若进入 beta 发布批次，需要随统一版本发布。

## 用户/产品视角的验收步骤

1. 在 NextClaw workspace 下创建 `service-apps/<app-id>/service-app.json` 和 MCP stdio server。
2. 打开右侧面板的“服务应用”，刷新后应能看到 Service App 状态与 action 列表。
3. 创建一个 Panel App，并在 `<head>` 声明 `<meta name="nextclaw-panel-actions" content="<app-id>.<tool-name>">`。
4. 在 Panel App 中调用 `window.nextclaw.serviceActions.invoke(...)`。
5. 首次调用应触发宿主授权确认；允许后返回 Service App 结果。
6. 在“服务应用”页撤销 grant 后，再次调用应重新要求授权。
7. Service App 失败时状态页应展示 failed/error，并可点击 restart。

## 可维护性总结汇总

本次是新增用户能力，非测试代码净增长是功能闭环所必需。实现中按 owner 收敛：kernel 管业务语义、MCP runtime service 管进程与 MCP lifecycle、server/controller 只做薄路由、client SDK 只做传输封装、UI manager 只做 iframe bridge 消息协调。

正向减债动作：将新 Service/Panel Apps API view 类型从接近预算的 `server-api.types.ts` 拆到 feature-owned types 文件，避免共享类型巨石继续越过 900 行预算。维护性 guard 通过，剩余为既有目录预算 warning：`packages/nextclaw-client-sdk/src/services`、`packages/nextclaw-server/src/app` 和 `server-api.types.ts` 接近预算。

## NPM 包发布记录

不涉及 NPM 包发布；本次处于本地实现与验收阶段。若后续进入发布流程，受影响包需要纳入统一 beta 批次。
