# v0.18.16 Startup Ready Unblock

## 迭代完成说明

本次修复 NextClaw 服务启动过程中 `Deferred startup` 被非关键派生能力拖慢的问题。

根因：

- `NextclawApp.warmDerivedCapabilities()` 在启动链路末尾 `await runtimeWarmupTask`，导致 `session_search` 初始化和 MCP server 预热成为 deferred startup 完成条件。
- `hydrateServiceCapabilities()` 前置了 3 秒 `ui_shell_grace_window` 固定等待；当后台 SQLite 同步索引占用 event loop 时，这个 timer 还会被放大成十几秒级延迟。

修复：

- NCP 派生能力 warmup 改为 deferred startup 完成后通过 timer 后台启动，不再阻塞 `startChannels` 和 ready。
- 删除 `service-ui-shell-grace.ts` 及其调用，移除固定 3 秒等待。
- 补充测试证明 `NextclawApp.start()` 不等待派生能力 warmup 完成。
- 追加将 `session_search` 的会话扫描、SQLite FTS 索引和查询迁移到 worker thread；主进程只保留轻量 controller 和 NCP tool facade。
- worker 启动后先开放旧索引查询，再后台执行增量 reconcile：未变化会话跳过、变化会话重建、删除会话清理索引。

## 测试/验证/验收方式

- `pnpm --filter nextclaw test -- --run src/cli/shared/services/gateway/tests/nextclaw-app.service.test.ts src/cli/shared/services/gateway/tests/service-capability-hydration.service.test.ts`
- `pnpm --filter nextclaw tsc`
- `pnpm --filter nextclaw test -- session-search`
- `pnpm --filter nextclaw build`
- `node --import tsx -e '... SessionSearchWorkerController ...'`
- `pnpm lint:new-code:governance -- --paths ...`
- `pnpm check:governance-backlog-ratchet`
- `pnpm --filter @nextclaw/openclaw-compat tsc`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- `pnpm lint:new-code:file-role-boundaries -- ...`
- `pnpm check:governance-backlog-ratchet`
- 启动冒烟：`NEXTCLAW_STARTUP_TRACE=1 pnpm -C packages/nextclaw dev:build serve --ui-port 18893`

冒烟观察：

- `✓ Deferred startup: plugin gateways and channels settled` 在 `+156ms` 输出。
- `service.deferred_startup.warm_ncp_capabilities` 在 `+12642ms` 后台完成，证明它不再阻塞 ready。
- worker controller 开发态真实冒烟可启动，输出 `indexing`，说明 `.ts` worker host 能通过 tsx bootstrap 正常加载。
- package build 产物包含 `dist/cli/commands/ncp/session-search/worker/session-search-worker-host.service.js`，主 app bundle 内的候选路径能解析到该文件。
- 隔离启动冒烟：临时 `NEXTCLAW_HOME` 预置 800 个 session 文件后启动 `serve --ui-port 18894`，`Deferred startup` 在 `+106ms` 完成，`warm_ncp_capabilities` 后台 `150ms` 完成，`/api/health` 返回 `200` 且耗时 `0.010633s`。

## 发布/部署方式

仅本地代码改动，尚未发布。无需 migration、远程 deploy 或线上冒烟。

## 用户/产品视角的验收步骤

1. 启动 NextClaw 服务并开启 startup trace。
2. 观察 UI API 和 deferred startup 是否先 ready。
3. 观察 `warm_ncp_capabilities` 是否允许稍后后台完成。
4. 确认没有 `service.ui_shell_grace_window` 固定等待日志。

## 可维护性总结汇总

本次后续追加的 `session_search` worker 属于启动响应性能能力落地，生产代码有必要净增；已通过目录拆分和复杂度拆分压低维护风险。

正向减债动作：

- 删除无明确必要性的固定 grace window 文件与调用。
- 将派生能力从 ready 阻塞条件中移出，启动 owner 仍保持在 `NextclawApp`。
- 未新增开关、fallback 或平行启动路径。
- 将 session search 文档构建从旧 index manager 中抽出复用，旧主线程 feature 保留为测试/兼容路径，运行时主路径改为 worker。
- 新增 worker 子目录，避免 `session-search` 根目录直接文件数越过预算。

`post-edit-maintainability-review` 结论：通过；no maintainability findings。保留关注点：`create-ui-ncp-agent.service.ts` 仍接近 600 行预算，后续触达时优先继续拆出启动/能力预热编排。

## NPM 包发布记录

不涉及 NPM 包发布。
