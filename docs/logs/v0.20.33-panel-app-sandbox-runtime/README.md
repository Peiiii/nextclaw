# v0.20.33 Panel App Sandbox Runtime

## 迭代完成说明

本次修复 Panel App 在 sandbox iframe 下的运行时接入问题。根因分三层：Vite/本地脚本在 opaque origin 下以 classic script 方式加载时缺 CORS；Panel App 资源接口缺少浏览器资源所需的 CORS 响应；Panel App 内部直接请求同宿主 `/api/...` 时没有可验证的运行时身份。

修复方式是保留 sandbox 不加 `allow-same-origin`，为本地脚本和注入 Client SDK 使用 CORS 加载，为 Panel App 资源响应补充受控 CORS，并在注入 bridge 中只为同宿主 `/api/...` fetch 附加 Panel App runtime token。server 只允许携带有效 runtime token 的 `Origin: null` API 请求，不全局放开 API。

同时更新 Panel App 创建相关 skills，明确 Panel App 不是普通同源网页，不能默认访问 `localStorage`、`sessionStorage`、cookie 或 IndexedDB；需要持久化时使用 Service App、App Client 标准能力，或显式导出/导入 JSON。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/kernel test -- src/managers/__tests__/panel-app.manager.test.ts`：通过。
- `pnpm --filter @nextclaw/server test -- src/app/server.cors.test.ts src/features/panel-apps/controllers/panel-apps.controller.test.ts`：通过。
- `pnpm --filter @nextclaw/core test -- src/features/agent/features/tests/skills.test.ts`：通过。
- `pnpm --filter @nextclaw/kernel tsc`：通过。
- `pnpm --filter @nextclaw/server tsc`：通过。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/core tsc`：通过。
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client tsc`：通过。
- `pnpm --filter @nextclaw/kernel lint`：通过。
- `pnpm --filter @nextclaw/server lint`：0 errors，仍有既有 warnings。
- `pnpm --filter @nextclaw/ui lint`：0 errors，仍有既有 warnings。
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client lint`：0 errors，仍有既有超长文件 warning。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- 真实用户路径：打开 `http://127.0.0.1:5174/chat`，进入右侧“应用”里的“墨爪助手”，loading 消失，Agent 列表、输入框和发送按钮可见。

## 发布/部署方式

本次未执行部署或 NPM 发布。已添加 changeset，后续统一 NPM 发布时纳入 patch。

## 用户/产品视角的验收步骤

1. 启动本地 NextClaw UI dev server。
2. 打开 `/chat`。
3. 进入右侧“应用”，打开声明 `client: true` 的目录式 Panel App。
4. 验证应用不再停留在 loading，控制台不再出现 Panel App Client SDK 加载失败、Vite classic script CORS 失败或 sandbox API CORS 失败。
5. 要求 AI 创建或修改 Panel App 时，确认它不会再默认使用 `localStorage` / `sessionStorage` / cookie / IndexedDB。

## 可维护性总结汇总

本次是 bugfix，但非测试代码净增为正，`post-edit-maintainability-guard --non-feature` 未通过行数门槛：总变更 `+208 / -28 / net +180`，非测试 `+139 / -24 / net +115`。增长来自必要运行时合同：sandbox 资源 CORS、runtime token API 认证、bridge fetch 注入，以及 Panel App skill 环境约束。

已做的减债动作：把内部 `@nextclaw/core/child-process-env` 子路径 import 收敛回 `@nextclaw/core` 根入口，避免为测试补特殊 alias 并保持 package public import 治理通过。剩余增长作为本次修复必要合同记录，后续可以在 Panel App runtime CORS helper 或 server CORS policy owner 中继续收敛。

## NPM 包发布记录

已添加 `.changeset/panel-app-sandbox-runtime.md`，涉及 `@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/ui` patch。当前不直接发布，状态为待统一发布。
