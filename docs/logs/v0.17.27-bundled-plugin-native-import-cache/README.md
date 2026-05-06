## 迭代完成说明

- 将 `packages/nextclaw-openclaw-compat/src/plugins/progressive-plugin-loader/progressive-bundled-plugin-loader.ts` 中 bundled 渠道插件的 progressive 加载路径改为：
  - 生产态 `.js/.mjs/.cjs` 入口走原生 `import()`
  - 仅保留 `ts` 等非原生入口继续走 `jiti`
- 延续同批次优化，将开发态插件默认路径收敛为“优先吃生产态 dist，再由后台 watch build 保持自动更新”：
  - 不再把 repo 内一方插件默认切到 `development source`
  - `pnpm dev start` 会在后端启动前补齐陈旧 dist，并为支持 `dev:build` 的一方插件启动后台 watch build
  - backend `tsx watch` 明确排除这些插件的 dist 目录，避免初始 build 触发整进程重启
  - backend 在启动 settle 窗口后再挂载插件级热重载 watcher，并通过 progressive plugin reload 使 dist 更新热生效
- 根因：
  - bundled 渠道插件虽然多数只是薄 wrapper，但原先每个插件都会再次走无缓存加载路径，重复付出重型 `channel-runtime` 依赖图解释成本。
  - 开发态一方插件默认走源码入口，启动时把运行时转译成本直接放进冷启动；同时 dist 写入又会误伤 backend watcher，导致“快启动优化”被初始 build 抵消。
- 根因确认方式：
  - 变更前启动 trace 显示多数 bundled 渠道插件单个加载耗时约 `1.4s-1.6s`，总插件加载约 `17.5s`。
  - 变更后同一路径 trace 显示多数 bundled `.js` 渠道插件下降到 `1ms-12ms`，插件总加载约 `2.5s`。
  - `pnpm dev start` 在旧链路下插件总加载约 `10s`，deferred startup 约 `13.3s`，重头集中在 `feishu` / `weixin` 的开发态 TS 插件。
  - 收敛后干净冒烟里 `plugin.loader.total` 已降到约 `0.5s-2.4s`，deferred startup 约 `3.8s-6.1s`；启动期不再被首轮 plugin dist 写入误触发热重载。
- 为什么这是根因修复而不是症状修补：
  - 这次没有增加新 fallback，也没有额外补丁分支，而是直接替换掉 bundled 生产态插件的模块加载机制，让 Node 共享原生模块缓存。
  - 开发态部分也没有回到“改完后手动 build”这种旁路，而是保留自动更新，只把触发点从 backend 被动重启收敛为显式的插件级 reload。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-openclaw-compat tsc`
- `pnpm -C packages/nextclaw-openclaw-compat build`
- `pnpm -C packages/nextclaw-openclaw-compat test -- loader.bundled-enable-state.test.ts`
- `pnpm -C packages/nextclaw tsc`
- `pnpm -C packages/nextclaw test -- src/cli/commands/plugin/dev-first-party-plugin-load-paths.test.ts src/cli/commands/plugin/dev-first-party-plugin-load-paths.path-install.test.ts src/cli/shared/services/plugin/service-plugin-dev-hot-reload.service.test.ts`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-openclaw-compat/src/plugins/progressive-plugin-loader/progressive-bundled-plugin-loader.ts`
- 真实启动 trace：
  - `NEXTCLAW_STARTUP_TRACE=1 node packages/nextclaw/dist/cli/app/index.js serve --ui-port 55702`
  - `NEXTCLAW_STARTUP_TRACE=1 pnpm dev start`
  - 启动后手动 `touch packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/dist/index.js`，确认出现 `Plugin dist updated` / `Plugin hot reload applied`，且 reload trace 显示 `plugin.loader.total duration_ms=41`

## 发布/部署方式

- 不适用。
- 本次仅为本地源码级性能优化验证，未执行发布或部署闭环。

## 用户/产品视角的验收步骤

1. 在工作区构建 `@nextclaw/openclaw-compat`。
2. 用 `NEXTCLAW_STARTUP_TRACE=1` 启动 `nextclaw serve`。
3. 观察 `plugin.loader.bundled_plugin` 日志。
4. 确认 bundled `.js` 渠道插件不再出现每个 `1s+` 的冷加载。
5. 确认 `plugin.loader.total` 明显下降，且 Feishu 这类 `ts` 入口仍可正常注册。
6. 运行 `pnpm dev start`。
7. 确认服务先起来后不会因为后台 plugin build 的首轮产物写入而自动重启。
8. 等待日志打印 `Plugin hot reload watcher`。
9. 修改一方插件源码，或最小化触发一次对应 dist 更新。
10. 确认出现 `Plugin dist updated` 和 `Plugin hot reload applied`，且期间没有 backend restart。

## 可维护性总结汇总

- 本次是否尽力改善可维护性：是。
- 正向减债动作：简化。
- 说明：
  - 只收敛了一个真实 owner 点：`progressive-bundled-plugin-loader.ts` 的模块加载分支。
  - 没有新增 fallback、兼容兜底或额外抽象层。
  - 开发态自动更新部分把“快启动、构建 watcher、插件热重载”三段职责拆开了，没有继续把逻辑堆在 `runtime-command.service.ts`。
  - `post-edit-maintainability-guard` 当前已通过；仍有预算预警，但没有新增超预算文件。
- 未闭合项：
  - `pnpm lint:new-code:governance` 仍会因为该历史文件名 `progressive-bundled-plugin-loader.ts` 不符合当前 role-suffix 白名单而失败。
  - 同类历史治理债还包括 `first-party-plugin-load-paths.ts`；二者都不是这次逻辑引入的新问题。
  - `pnpm check:governance-backlog-ratchet` 仍会因为仓库现存 `docFileNameViolations` 计数高于 baseline 而失败。
  - `pnpm -C packages/nextclaw-openclaw-compat test -- loader.bundled-enable-state.test.ts` 仍可能在 regular loader 路径上超时；本次已把开发态启动与热更新主链路切到更快的 progressive 路径，但未继续扩 scope 改造同步 regular loader。
- `post-edit-maintainability-review`：已在本次交付收尾中进行人工复核。

## NPM 包发布记录

- 不涉及 NPM 包发布。
