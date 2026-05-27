# v0.19.43 Service Apps MVP

## 迭代完成说明

本次落地 Service Apps MVP：在 kernel 中新增 `ServiceAppManager` 作为业务 owner，支持从 workspace `service-apps/<id>/service-app.json` 发现 MCP-compatible Service App，按需 warm stdio MCP server，映射为 Service Actions，并以 kernel grant store 管理 Panel App 调用授权。

同时补齐 Panel App bridge：Panel App HTML 由宿主注入 `/api/panel-app-bridge.js`，iframe 只通过 `postMessage` 调用 `window.nextclaw.serviceActions`，server 侧通过 bridge session 还原 caller 与 allowlist，拒绝 iframe 自报 caller。右侧面板增加 Service Apps 状态页，展示服务、actions、错误、restart 与 grant revoke。

内置 skill 方面，新增 `service-app-creator`，并更新 `panel-app-creator`，让 AI 后续能生成配套 Service App 与声明了 action allowlist 的 Panel App。

补充修复：Panel App bridge 改为内联注入，不再依赖外链 `/api/panel-app-bridge.js` 作为 Panel App 主路径。根因是 sandbox iframe 在 Vite dev/proxy 环境下加载 classic script 时会触发跨 origin 限制，Network 可能显示 bridge 请求 200，但脚本未执行，导致 `window.nextclaw.serviceActions` 缺失，Panel App 保存时报 `Service actions unavailable`。修复后 bridge 随 HTML 一起返回，避免被 script origin 策略挡住；独立 `/api/panel-app-bridge.js` 仍保留为调试/兼容资源。

补充合同收敛：Service Actions 列表语义改为纯读取 `service-app.json.actions`，不再在列表页暗中 warm MCP server。新增显式 `POST /api/service-apps/:appId/actions/discover`，只发现单个 Service App 的运行时 `tools/list`，并标记 `matched`、`missing`、`undeclared` 三类 manifest/runtime 合同状态。`invoke` 路径先校验 manifest 声明、Panel App allowlist 与 grant，再 lazy start 目标 Service App 执行 action。

补充前端 owner 纠偏：Service Action 授权与 Panel App bridge 不再通过 feature-level presenter、manager singleton 或 `afterSignedIn` / `bindXxx` 之类 callback 二阶段装配串联。前端统一由应用级 `AppPresenter` 像后端 kernel 一样装配长期 manager，manager 之间保持平级 direct dependency。账号登录完成改为 `AccountManager` 返回登录完成结果，`RemoteAccessManager` 直接依赖 `AccountManager` 并继续自己的远程访问流程，不再把 pending action 写入账号 store。

补充 Panel App SDK 合同修复：Panel App 注入 SDK 的 `window.nextclaw.serviceActions.invoke()` 现在直接返回 action 业务 payload，不再把 Service Gateway 的 `{ actionId, result }` envelope 暴露给 iframe。根因是 creator skill 与桥接 SDK 的返回形态没有说清，导致 Markdown 管理器这类 Panel App 读取 `files` 时误把 envelope 当业务结果，显示“Service App 不可用”并回退 localStorage。修复后 server/client 内部仍保留 envelope，iframe SDK 只在 `invoke` 方法上解包 `result`；同时完善 `panel-app-creator`、`service-app-creator` 与方案文档，要求生成代码直接读取 payload，并区分 bridge 缺失、调用失败和返回结构未识别。

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

Bridge 注入修复补充验证：

- `pnpm -C packages/nextclaw-kernel tsc --noEmit`
- `pnpm -C packages/nextclaw-kernel exec vitest run src/managers/__tests__/panel-app.manager.test.ts`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `curl http://127.0.0.1:5174/api/panel-apps/<心情日历-id>/content` 确认返回 HTML 已内联 bridge 脚本，不再注入外链 bridge script。

Service Actions 合同收敛补充验证：

- `pnpm --filter @nextclaw/kernel test -- src/managers/__tests__/service-app.manager.test.ts`
- `pnpm --filter @nextclaw/server test -- src/features/service-apps/controllers/service-apps.controller.test.ts`
- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/server tsc`
- `pnpm --filter @nextclaw/client-sdk tsc`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/kernel lint`
- `pnpm --filter @nextclaw/server lint`
- `pnpm --filter @nextclaw/client-sdk exec eslint src/services/service-apps.service.ts --max-warnings=0`
- `pnpm --filter @nextclaw/ui exec eslint src/features/service-apps/components/service-apps-panel.tsx src/features/service-apps/hooks/use-service-apps.ts src/shared/lib/i18n/runtime/doc-browser-labels.utils.ts --max-warnings=0`
- `pnpm --filter @nextclaw/server exec eslint src/features/service-apps/controllers/service-apps.controller.ts src/features/service-apps/controllers/service-apps.controller.test.ts src/app/router.ts src/app/tests/router-test-kernel.ts --max-warnings=0`
- `pnpm lint:new-code:doc-file-names`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <本批 Service Apps 触达文件>`

Frontend owner 纠偏补充验证：

- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/ui test -- src/features/remote/components/remote-access-page.test.tsx src/app/components/layout/sidebar.layout.test.tsx src/features/panel-apps/managers/panel-app-bridge.manager.test.ts`：3 个测试文件、6 个用例通过。
- `pnpm --filter @nextclaw/ui exec eslint src/app/presenters/app.presenter.ts src/app/components/app-presenter-provider.tsx src/app/index.tsx src/app/components/layout/sidebar.tsx src/app/components/layout/sidebar.layout.test.tsx src/features/account/index.ts src/features/account/stores/account.store.ts src/features/account/managers/account.manager.ts src/features/account/components/account-panel.tsx src/features/remote/managers/remote-access.manager.ts src/features/remote/components/remote-access-page.tsx src/features/remote/components/remote-access-page.test.tsx`：通过。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`：通过，0 errors / 2 warnings；warning 为既有 client-sdk services 目录预算与本批 doc-browser 测试增长观察点。

Panel App SDK 合同修复补充验证：

- `pnpm --filter @nextclaw/kernel test -- src/managers/__tests__/panel-app.manager.test.ts`：通过，1 个测试文件、8 个用例通过。
- `pnpm --filter @nextclaw/kernel tsc`：通过。
- `pnpm --filter @nextclaw/kernel exec eslint src/utils/panel-app-bridge.utils.ts src/managers/__tests__/panel-app.manager.test.ts --max-warnings=0`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-kernel/src/utils/panel-app-bridge.utils.ts packages/nextclaw-kernel/src/managers/__tests__/panel-app.manager.test.ts packages/nextclaw-core/src/features/agent/shared/skills/panel-app-creator/SKILL.md packages/nextclaw-core/src/features/agent/shared/skills/service-app-creator/SKILL.md docs/designs/2026-05-27-service-apps-mcp-gateway-discussion.md docs/logs/v0.19.43-service-apps-mvp/README.md`：通过，非测试代码净增 0。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- 真实链路补充：直接请求本机 Service Gateway 的 panel bridge session 与 `workspace-files.list` invoke，通过；后端仍返回 envelope，注入脚本包含 `method === "invoke"` 解包逻辑，Panel App 侧拿到的是 payload。

已知验证说明：`pnpm --filter @nextclaw/client-sdk lint` 当前因既有 `request.service.ts` 的 `max-statements` warning 在 `--max-warnings=0` 下失败；本次改动文件已用 targeted ESLint 通过。`pnpm --filter @nextclaw/ui lint` 当前因 chat/marketplace/system-status 等既有无关 lint error 失败；本次 UI 触达文件已用 targeted ESLint 通过。

已知验证说明：`pnpm lint:maintainability:hotspots` 当前因既有 tracked hotspots 的 missing/current 状态退出 1，本次未触达这些红区文件。

## 发布/部署方式

本次已执行 NPM beta 全量 public workspace batch：

- 发布入口：`pnpm release:beta:npm`
- 发布 commit：`26163edeec90e6e033e2d4061b79a53eeb492ab0`
- 发布范围：46 个 public workspace package
- 顶层包：`nextclaw@0.19.31-beta.5`
- 运行时更新通道：本次按 NPM-only 发布请求跳过，未触发 `npm-runtime-update-release` workflow。

发布后验证：

- `npm view nextclaw@beta version`：`0.19.31-beta.5`
- `npm view nextclaw dist-tags --json`：`beta` 指向 `0.19.31-beta.5`
- `npm view @nextclaw/kernel@beta version`：`0.1.15-beta.5`
- `npm view @nextclaw/core@beta version`：`0.12.25-beta.5`
- 临时 prefix 安装 `nextclaw@beta` 后执行 `nextclaw --version`：`0.19.31-beta.5`
- 已确认临时安装包包含 `resources/update-bundle-public.pem`、`dist/cli/launcher/index.js` 与 `dist/cli/app/index.js`。
- 发布后发现 `changeset tag` 在 release commit 生成前创建 package tags，导致 tag 内版本文件仍为上一版；已将本批 46 个 tag 纠正到 release commit，并修复 `release-beta` 脚本，后续 beta 发布会在 release commit 后把 tags 移到正确提交。
- `pnpm release:report:health`：通过，repository release health is clean。

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

Bridge 注入补丁为非功能 bugfix，非测试代码净增 `0` 行。正向减债动作是简化：删除 Panel App 主路径对外链 bridge script 的运行时依赖，减少一次资源加载和一类 sandbox/CORS 失败面，职责仍收敛在 kernel `PanelAppManager` 的 HTML 注入链路内。

Service Actions 合同收敛属于发布级 Service Apps 能力完善，生产代码有必要增长。正向维护动作是职责收敛与查询/命令分离：`ServiceAppManager` 统一拥有静态 catalog、grant 校验和 runtime discovery 编排；server/client/UI 只暴露显式 discovery 入口；creator skill 同步约束生成物，减少后续生成旧合同的概率。维护性 guard 针对本批文件通过，剩余 warning 为既有目录预算超限：`packages/nextclaw-client-sdk/src/services` 与 `packages/nextclaw-server/src/app`。

Frontend owner 纠偏属于非功能架构修复，正向减债动作是职责收敛与隐藏通道删除：删除 feature-level presenter / manager singleton / callback 二阶段装配的错误路径，把长期 manager 图收回应用级 `AppPresenter`，并将账号登录继续流程从 account store pending action 改成 manager 方法的明确返回值。该批次减少了隐式状态与初始化顺序风险，但同一工作区仍有此前 Service Apps/DocBrowser 能力开发带来的总体净增长，后续应继续优先收敛测试 fixture 与 client-sdk services 目录。

Panel App SDK 合同修复属于非功能 bugfix。正向减债动作是职责收敛与合同简化：transport envelope 继续归 server/client/bridge 内部边界，Panel App 作者只接触 action payload，减少每个生成应用重复拆包、误判和自定义 fallback 的机会。同步修 creator skill，是把错误从生成源头消掉，而不是在单个 Panel App 里继续堆救援逻辑。

## NPM 包发布记录

已发布 NPM beta。

- batch：全量 public workspace beta batch
- dist-tag：`beta`
- registry：`https://registry.npmjs.org/`
- 发布包数：46
- 顶层安装包：`nextclaw@0.19.31-beta.5`
- 关键相关包：`@nextclaw/kernel@0.1.15-beta.5`、`@nextclaw/core@0.12.25-beta.5`
- release commit：`26163edeec90e6e033e2d4061b79a53eeb492ab0`
- tags：已推送本批 46 个 package tag，并已纠正到 release commit。
