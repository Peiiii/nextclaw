# v0.16.95-startup-extension-host-isolation

## 迭代完成说明（改了什么）

本次修复 `pnpm dev start` 后前端已可见但 `/api/auth/status` 和 `/api/runtime/bootstrap-status` 长时间不可访问的问题。方案设计见 [Extension Host Startup Isolation Design](../../designs/2026-04-23-extension-host-startup-isolation-design.md)。

根因确认：

- 第一层根因是插件 capability hydration 仍在主 Node.js 进程执行。真实验证中多个 bundled channel plugin 单个加载耗时约 `1.5s-1.9s`，旧结构会让这些 import/register/gateway 逻辑阻塞主事件循环，导致 status 接口无法及时响应。
- 第二层根因是真实用户环境里 `service.deferred_startup.warm_ncp_capabilities` 还会在主进程自动运行，验证中该阶段耗时约 `6941ms`，即使插件已经移到 Extension Host，status 仍会被 NCP derived capability warmup 卡住。
- 根因确认方式：新增 `scripts/smoke/startup-waterfall.mjs` 后，对 `pnpm dev start` 持续探测 frontend、`/api/auth/status`、`/api/runtime/bootstrap-status`，并结合 startup trace 对比插件加载日志、NCP warmup 日志和接口首次 200 时间。

本次落地：

- 新增 Extension Host 子进程与 IPC 协议，插件加载、插件 snapshot、plugin channel gateway 启动、tool/channel/runtime 代理入口不再要求主进程 import 插件代码。
- 主进程 capability hydration 改为消费 Extension Host snapshot，并生成 proxy plugin registry。
- `pnpm dev start` 前端改为与后端并行启动；后端默认使用快速 `tsx` 启动，需 watch 时显式设置 `NEXTCLAW_DEV_BACKEND_WATCH=1`。
- Vite dev proxy 在后端尚未 listen 时会把 `/api` 请求返回为受控 `503 backend_starting`，并关闭早期 WS 连接，避免短暂启动竞态刷出误导性的 `ECONNREFUSED` 红色 proxy error。
- service deferred startup 不再自动执行 `warm_ncp_capabilities`，避免 MCP/server prewarm 与 session-search warmup 卡住 status/front 可用路径。
- 新增常态化启动瀑布流脚本 `scripts/smoke/startup-waterfall.mjs`。
- 后续收口了 Extension Host 第一版遗漏的 3 个契约问题：
  - plugin runtime 在子进程内改为把会话事件批量回写父进程 `stateManager`，不再只在子进程本地维护会话状态。
  - runtime 每次运行前由父进程预解析 `resolveTools(input)`，子进程消费同一次 run 的已解析工具集合；`resolveAssetContentPath` 改为在子进程直接复用同一套本地资产存储路径规则。
  - service plugin reload 不再回退到主进程重新 `loadPluginRegistry`，而是统一走 Extension Host `load + proxy registry + gateway restart`。
  - Extension Host snapshot/proxy 现在完整保留 `providers` 契约，不再固定成空数组。
- 过程性目标锚与后续收敛入口见 [work/goal-progress.md](./work/goal-progress.md)。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw tsc --pretty false --noEmit`
- `pnpm -C packages/nextclaw test -- --run src/cli/shared/services/extension-host-client.service.test.ts src/cli/shared/services/extension-host-proxy-registry.service.test.ts src/cli/shared/services/plugin/service-plugin-reload.service.test.ts src/cli/shared/services/gateway/tests/nextclaw-app.test.ts src/cli/shared/services/gateway/tests/service-capability-hydration.service.test.ts src/cli/shared/services/gateway/tests/service-gateway-bootstrap.service.test.ts`
- `node scripts/smoke/startup-waterfall.mjs --duration-ms 7000 --isolated-home`
- `node scripts/smoke/startup-waterfall.mjs --duration-ms 20000`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw/src/cli/shared/types/extension-host.types.ts packages/nextclaw/src/cli/shared/services/extension-host-snapshot.service.ts packages/nextclaw/src/cli/shared/services/extension-host-proxy-registry.service.ts packages/nextclaw/src/cli/shared/services/extension-host-client.service.ts packages/nextclaw/src/cli/shared/services/extension-host-child.service.ts packages/nextclaw/src/cli/shared/services/plugin/service-plugin-reload.service.ts packages/nextclaw/src/cli/shared/services/gateway/service-gateway-bootstrap.service.ts packages/nextclaw/src/cli/shared/services/gateway/service-capability-hydration.service.ts packages/nextclaw/src/cli/shared/services/runtime/runtime-command.service.ts`
- `pnpm lint:new-code:governance -- packages/nextclaw/src/cli/shared/types/extension-host.types.ts packages/nextclaw/src/cli/shared/services/extension-host-snapshot.service.ts packages/nextclaw/src/cli/shared/services/extension-host-proxy-registry.service.ts packages/nextclaw/src/cli/shared/services/extension-host-client.service.ts packages/nextclaw/src/cli/shared/services/extension-host-child.service.ts packages/nextclaw/src/cli/shared/services/plugin/service-plugin-reload.service.ts packages/nextclaw/src/cli/shared/services/gateway/service-gateway-bootstrap.service.ts packages/nextclaw/src/cli/shared/services/gateway/service-capability-hydration.service.ts packages/nextclaw/src/cli/shared/services/runtime/runtime-command.service.ts`
- `pnpm -C packages/nextclaw-ui tsc --pretty false --noEmit`
- `pnpm -C packages/nextclaw-ui exec eslint vite.config.ts`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/vite.config.ts`
- `pnpm lint:new-code:governance -- packages/nextclaw-ui/vite.config.ts`
- `pnpm check:governance-backlog-ratchet`

真实用户环境瀑布流结果：

- `frontend_first_200_ms`: `710ms`
- `auth_status_first_200_ms`: `1955ms`
- `bootstrap_status_first_200_ms`: `1955ms`
- `auth_status_max_latency_ms`: `16ms`
- `bootstrap_status_max_latency_ms`: `16ms`
- `auth_status_timeout_count`: `0`
- `bootstrap_status_timeout_count`: `0`

说明：全量 `pnpm lint:new-code:governance -- <all touched paths>` 仍会命中既有 `packages/nextclaw/src/cli/shared/services/gateway/` 与 `services/runtime/` 嵌套目录合同问题；本次新增文件已放在允许的 direct service/type 路径，新增文件子集 governance 已通过，backlog ratchet 通过。

补充验证说明：Vite proxy 早期 `ECONNREFUSED` 噪音已改为受控处理；一次短启动验证未再出现原始 proxy ECONNREFUSED 日志，但该轮后端启动被工作区中另一个未完成文件 `packages/ncp-packages/nextclaw-ncp-agent-runtime/src/tool-result-content.manager.ts` 的语法错误阻断，未把该外部错误计入本轮结果。

## 发布/部署方式

本次未执行发布。改动进入源码后，开发态通过 `pnpm dev start` 生效；生产包需随下一次 NextClaw CLI/前端统一构建发布。

## 用户/产品视角的验收步骤

1. 运行 `pnpm dev start`。
2. 观察前端应在 2 秒内进入可访问状态。
3. 在启动早期持续请求 `/api/auth/status` 和 `/api/runtime/bootstrap-status`，应在 2 秒级首次返回 200。
4. 在插件持续加载期间继续请求 status 接口，接口不应再出现 5 秒级飘红或超时。
5. 运行 `node scripts/smoke/startup-waterfall.mjs --duration-ms 20000`，查看 `sortedWaterfall`，确认最大头不再是插件加载阻塞 status。

## 可维护性总结汇总

- 本次已尽最大努力优化可维护性：是。Extension Host 按 client / child / snapshot / proxy registry / protocol types 拆分，避免把 IPC、snapshot、proxy、runtime stream 全塞进一个大文件。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”：是。实现前删除了同进程 warmup 启动依赖，并将新逻辑压到明确 owner class；但由于新增进程隔离与常态化探针属于新增基础能力，代码量净增长不可避免。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：代码量净增长，原因是最小必要地新增 Extension Host IPC/proxy 与瀑布流脚本；同步偿还了“无量化启动指标”和“插件同进程阻塞 status”的维护债。
- 抽象、模块边界、class / helper / service / store 职责划分是否更合适、更清晰：是。`ExtensionHostClient` 负责主进程 IPC，`ExtensionHostChildRuntime` 负责子进程调度，`ExtensionHostProxyRegistryService` 负责代理 registry，`ExtensionHostSnapshotService` 负责可序列化 snapshot。
- 目录结构与文件组织是否满足当前项目治理要求：Extension Host 新增文件满足 direct service/type 路径要求；但 `packages/nextclaw/src/cli/shared/services/gateway/`、`plugin/`、`runtime/` 仍属于既有嵌套目录历史债，范围化 governance 会继续提示 module-structure drift，本次未跨问题域搬迁。
- 本次涉及代码可维护性评估，已基于 `post-edit-maintainability-review` 与 maintainability guard 复核：功能和定向测试已通过，但非功能改动净新增非测试代码仍为正值，守卫未完全转绿；同时 `runtime-command.service.ts` 仍接近文件预算，后续继续动 runtime orchestration 时应优先拆 owner。

## NPM 包发布记录

不涉及 NPM 包发布。
