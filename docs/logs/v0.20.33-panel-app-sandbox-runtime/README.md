# v0.20.33 Panel App Sandbox Runtime

## 迭代完成说明

本次修复 Panel App 在 sandbox iframe 下的运行时接入问题。根因分三层：Vite/本地脚本在 opaque origin 下以 classic script 方式加载时缺 CORS；Panel App 资源接口缺少浏览器资源所需的 CORS 响应；Panel App 内部直接请求同宿主 `/api/...` 时没有可验证的运行时身份。

修复方式是保留 sandbox 不加 `allow-same-origin`，为本地脚本和注入 Client SDK 使用 CORS 加载，为 Panel App 资源响应补充受控 CORS，并在注入 bridge 中只为同宿主 `/api/...` fetch 附加 Panel App runtime token。server 只允许携带有效 runtime token 的 `Origin: null` API 请求，不全局放开 API。

同时更新 Panel App 创建相关 skills，明确 Panel App 不是普通同源网页，不能默认访问 `localStorage`、`sessionStorage`、cookie 或 IndexedDB；需要持久化时使用 Service App、App Client 标准能力，或显式导出/导入 JSON。

后续补充修复 Panel App 调用 `window.nextclaw.client.agentRuns.send()` 时出现 `Failed to execute 'fetch' on 'Window': Illegal invocation` 的问题。根因不是具体生成应用直接调用了 `fetch`，而是注入的旧 Client SDK 把浏览器原生 `fetch` 存成 service 字段后通过 `this.fetchImpl(...)` 调用，浏览器会把 receiver 绑定到 SDK service 实例而非 `window`。通过 Playwright 最小复现确认 `holder.fetchImpl = window.fetch; holder.fetchImpl(...)` 可得到同样错误，而显式 `window.fetch.bind(window)` 或 `resolvedFetch.call(globalThis, ...)` 正常。

修复方式是在 `@nextclaw/client-sdk` 中统一解析 fetch 调用 owner，确保 RequestService 与 AgentRunsService 默认 fetch 均以 `globalThis` 为 receiver 调用。同时修复宿主 `/api/panel-app-client-sdk.js` 的进程级永久缓存：原实现首次读取 dist browser bundle 后一直返回同一份字符串，开发态重新 build SDK 后仍会服务旧 bundle；现在按文件 `mtime` 刷新缓存。验证时确认全局安装版 `55667` 仍返回旧 bundle，而源码开发版 `18792` 在修复和 rebuild 后返回包含 `.call(globalThis)` 的新 bundle。

同批次还补充 Panel App 页面 Header：返回按钮与应用标题拆开，标题使用原“应用”文本的轻量样式但显示具体 Panel App 名称；并将低频 `Illegal invocation` 排障说明拆到专门 troubleshooting reference，主 skill 只保留遇到运行时报错时再查的路由提示。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/kernel test -- src/managers/__tests__/panel-app.manager.test.ts`：通过。
- `pnpm --filter @nextclaw/server test -- src/app/server.cors.test.ts src/features/panel-apps/controllers/panel-apps.controller.test.ts`：通过。
- `pnpm --filter @nextclaw/core test -- src/features/agent/features/tests/skills.test.ts`：通过。
- `pnpm --filter @nextclaw/kernel tsc`：通过。
- `pnpm --filter @nextclaw/server tsc`：通过。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/core tsc`：通过。
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client tsc`：通过。
- `pnpm --filter @nextclaw/client-sdk test -- src/nextclaw-client.test.ts`：通过。
- `pnpm --filter @nextclaw/client-sdk tsc`：通过。
- `pnpm --filter @nextclaw/client-sdk lint`：通过。
- `pnpm --filter @nextclaw/client-sdk build`：通过，browser IIFE bundle 重新生成。
- `pnpm --filter @nextclaw/service tsc`：通过。
- `pnpm --filter @nextclaw/service lint`：0 errors，仍有既有 warnings。
- `pnpm --filter @nextclaw/ui test -- src/features/panel-apps/components/panel-app-toolbar.test.tsx src/shared/components/doc-browser/doc-browser.test.tsx`：通过。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm exec eslint packages/nextclaw-ui/src/features/panel-apps/components/panel-app-toolbar.tsx packages/nextclaw-ui/src/features/panel-apps/components/panel-app-toolbar.test.tsx packages/nextclaw-ui/src/features/panel-apps/utils/panel-app-doc-browser.utils.tsx packages/nextclaw-client-sdk/src/utils/fetch.utils.ts packages/nextclaw-client-sdk/src/services/request.service.ts packages/nextclaw-client-sdk/src/services/agent-runs.service.ts packages/nextclaw-client-sdk/src/nextclaw-client.test.ts`：通过。
- `pnpm --filter @nextclaw/kernel lint`：通过。
- `pnpm --filter @nextclaw/server lint`：0 errors，仍有既有 warnings。
- `pnpm --filter @nextclaw/ui lint`：0 errors，仍有既有 warnings。
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client lint`：0 errors，仍有既有超长文件 warning。
- `pnpm lint:maintainability:guard`：通过；提示 `packages/nextclaw-client-sdk/src/services` 目录仍使用已记录预算豁免。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- 真实用户路径：打开 `http://127.0.0.1:5174/chat`，进入右侧“应用”里的“墨爪助手”，loading 消失，Agent 列表、输入框和发送按钮可见。
- 运行中 SDK bundle 对比：`http://127.0.0.1:55667/api/panel-app-client-sdk.js` 仍为全局安装版旧 bundle；`http://127.0.0.1:18792/api/panel-app-client-sdk.js` 已包含 `.call(globalThis)`。

## 发布/部署方式

本次未执行部署或 NPM 发布。已添加 changeset，后续统一 NPM 发布时纳入 patch。

## 用户/产品视角的验收步骤

1. 启动本地 NextClaw UI dev server。
2. 打开 `/chat`。
3. 进入右侧“应用”，打开声明 `client: true` 的目录式 Panel App。
4. 验证应用不再停留在 loading，控制台不再出现 Panel App Client SDK 加载失败、Vite classic script CORS 失败或 sandbox API CORS 失败。
5. 打开具体 Panel App 后，顶部工具栏返回按钮只负责返回应用列表，旁边标题显示具体应用名称。
6. 对声明 `client: true` 且已授权的 Panel App，发送消息触发 `window.nextclaw.client.agentRuns.send()`，确认源码开发版注入的新 Client SDK 不再抛出 `fetch Illegal invocation`。
7. 要求 AI 创建或修改 Panel App 时，确认它不会再默认使用 `localStorage` / `sessionStorage` / cookie / IndexedDB，并把低频运行时报错排障引导到 troubleshooting reference。

## 可维护性总结汇总

本次是 bugfix，但非测试代码净增为正。首轮 `post-edit-maintainability-guard --non-feature` 未通过行数门槛：总变更 `+208 / -28 / net +180`，非测试 `+139 / -24 / net +115`。增长来自必要运行时合同：sandbox 资源 CORS、runtime token API 认证、bridge fetch 注入，以及 Panel App skill 环境约束。后续同批次补充 Client SDK fetch owner、SDK bundle mtime 缓存刷新、Panel App toolbar 标题与运行时 troubleshooting reference 后，`pnpm lint:maintainability:guard` 通过，当前增量仍包含必要的新测试与用户可见 bugfix 代码。

已做的减债动作：把内部 `@nextclaw/core/child-process-env` 子路径 import 收敛回 `@nextclaw/core` 根入口，避免为测试补特殊 alias 并保持 package public import 治理通过。剩余增长作为本次修复必要合同记录，后续可以在 Panel App runtime CORS helper 或 server CORS policy owner 中继续收敛。

## NPM 包发布记录

已添加并更新 `.changeset/panel-app-sandbox-runtime.md`，涉及 `@nextclaw/core`、`@nextclaw/client-sdk`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/service`、`@nextclaw/ui` patch。当前不直接发布，状态为待统一发布。
