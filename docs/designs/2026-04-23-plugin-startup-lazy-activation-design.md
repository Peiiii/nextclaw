# Plugin Startup Lazy Activation Design

## 背景

真实口径 `pnpm dev start + /Users/peiwang/.nextclaw` 曾复现启动红色窗口：

- `frontendServerReadyMs`: 约 `4.8s`
- `frontendAuthStatusOkMs`: 约 `32.9s`
- 前端 server ready 到 `/api/auth/status` OK 的窗口约 `28.0s`
- `plugin.loader.total`: 约 `22.1s`
- `service.deferred_startup.hydrate_capabilities`: 约 `29.4s`

关键结论：`/api/auth/status` 的业务语义不需要等待插件和渠道 ready；问题是插件水合、bundled channel plugin 动态加载、能力刷新仍在启动主链路中执行，挤占同一个 Node 进程和事件循环，导致前端已经起来后 status 很晚才打通。

相关代码路径：

- `packages/nextclaw/src/cli/shared/services/gateway/nextclaw-app.service.ts`
- `packages/nextclaw/src/cli/shared/services/gateway/service-capability-hydration.service.ts`
- `packages/nextclaw-openclaw-compat/src/plugins/progressive-plugin-loader/progressive-bundled-plugin-loader.ts`
- `packages/nextclaw-openclaw-compat/src/plugins/loader.ts`

## 设计原则

主应用可用性优先。NextClaw 作为个人操作层，核心入口、基础 API、前端 shell 和 `/api/auth/status` 必须先可用。

插件和渠道是生态扩展能力，应该热插拔、延迟激活、最终一致。它们可以在应用已经可用后继续注册能力、启动 gateway、启动渠道。

启动主链路不应该为了插件预发现而阻塞。第一阶段不要求在启动一开始知道所有 channelId、activation metadata 或完整 manifest。

## 方案对比

### 方案 A：只在插件之间 yield

在每个插件加载之间让出事件循环。

优点：改动很小。

缺点：每个插件 import / tsx 编译仍然在主进程执行，总耗时不下降，只是缓解 API 饥饿。

### 方案 B：核心 ready 后延迟激活插件

启动顺序改为：

1. 启动 UI API / 前端代理。
2. bootstrap kernel，恢复必要状态。
3. 立即把 bootstrap status 标记为 core ready，让 `/api/auth/status`、`/api/health` 和前端 shell 可用。
4. 后台延迟执行 capability hydration、plugin gateways、channels、restart sentinel。

优点：直接命中主问题；不需要完整 manifest；不需要启动时知道 channelId；最接近 Chrome/VSCode 的“核心先起，扩展后激活”行为。

缺点：插件相关能力会在启动后稍晚生效，需要 UI 或调用方容忍插件能力的最终一致。

### 方案 C：静态 gate 作为后台减负

维护极薄的 bundled package metadata，让 loader 在后台激活阶段可以跳过明确禁用的 bundled channel plugin。

优点：减少后台水合工作量，避免禁用渠道仍 import。

缺点：它不是主可用性前置条件；如果为了它把 channelId 重新放回启动主链路，就违背本次目标。

### 方案 D：完整 extension host / activation event

类似 Chrome/VSCode，把插件安装发现、activation event、运行隔离、RPC、权限和生命周期全部拆出来。

优点：长期最正确，插件真正热插拔且不会阻塞主进程。

缺点：改造大，不适合作为当前第一刀。

## 推荐方案

第一阶段采用方案 B，辅以方案 C。

核心判断：

- 不需要在启动一开始知道 `channelId`。
- 只要插件不是核心入口依赖，就不应该阻塞 status。
- `channelId` 只在后台激活阶段作为“是否跳过未启用渠道插件”的优化信息存在。
- 长期演进到方案 D，但不能让长期架构改造阻塞当前启动体验修复。

## 当前实现合同

`NextclawApp.start()` 的合同：

1. `bootstrapKernel()` 成功后立即激活 NCP session service 和 UI NCP agent。
2. `recoverDurableState()` 完成后立即 `bootstrapStatus.markReady()`。
3. 对 UI 启动场景，默认延迟 `120s` 后后台执行 `warmDerivedCapabilities()`，避免插件水合在用户刚进入前端时再次抢占主事件循环。
4. 后台阶段依次完成能力水合、plugin gateways、channels 和 restart sentinel。
5. 后台阶段失败时只标记 plugin hydration error，不反向阻塞 core ready。

可调参数：

- `NEXTCLAW_POST_READY_CAPABILITY_DELAY_MS`: 覆盖 UI 启动后的插件激活延迟；非 UI 启动默认不延迟。

## 瀑布流口径

真实 dev-runner 口径：

```bash
pnpm smoke:startup-readiness -- --dev-runner --home /Users/peiwang/.nextclaw --runs 1 --timeout-ms 90000 --criterion frontend-auth-status
```

后台插件完成口径：

```bash
pnpm smoke:startup-readiness -- --dev-runner --home /Users/peiwang/.nextclaw --runs 1 --timeout-ms 90000 --criterion plugin-hydration-ready
```

优化后实测：

- 主链路：`uiApi/authStatus/health/ncpReady/bootstrapReady` 约 `2.4s`，`frontendAuthStatus` 约 `2.7s`，失败次数 `0`。
- 后台链路：`pluginHydrationReady/channelsReady` 约 `23.8s-28.1s`。
- 后端 trace：core ready 约 `0.1s`，随后 `120s` post-ready delay；插件能力水合仍是后台大头，后续应通过 worker / 子进程化或按需 activation event 继续治理。

这说明当前最大用户可见问题已经从“前端红色窗口”转移为“后台插件激活仍然慢”。下一步优化应该针对后台插件激活的并行化、按需激活和隔离，而不是重新把插件发现放回启动主链路。

## 验收方式

单测：

```bash
pnpm -C packages/nextclaw test -- --run src/cli/shared/services/gateway/tests/nextclaw-app.service.test.ts
pnpm -C packages/nextclaw-openclaw-compat test -- --run src/plugins/loader.bundled-enable-state.test.ts
```

类型检查：

```bash
pnpm -C packages/nextclaw exec tsc -p tsconfig.json --noEmit
pnpm -C packages/nextclaw-openclaw-compat exec tsc -p tsconfig.json --noEmit
```

启动冒烟：

```bash
pnpm smoke:startup-readiness -- --dev-runner --home /Users/peiwang/.nextclaw --runs 1 --timeout-ms 90000 --criterion frontend-auth-status
pnpm smoke:startup-readiness -- --dev-runner --home /Users/peiwang/.nextclaw --runs 1 --timeout-ms 90000 --criterion plugin-hydration-ready
```
