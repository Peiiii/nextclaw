# Startup Readiness Baseline

## 当前主口径

- 主口径：`bootstrap-ready`
- 辅助口径：
  - `ui-api`
  - `auth-status`
  - `frontend-server`
  - `frontend-auth-status`
  - `health`
  - `ncp-agent-ready`
  - `plugin-hydration-ready`
  - `channels-ready`

## 当前长期目标

- 把“启动慢不慢”变成可重复、可比较、可长期复用的治理机制，而不是一次性判断。
- 任何启动优化都先有基线，再有排序，再做实现。
- 优先压缩最大阶段差值，避免只优化小头。

## 当前基线命令

```bash
pnpm smoke:startup-readiness -- --runs 3 --timeout-ms 90000 --criterion bootstrap-ready
pnpm smoke:startup-readiness -- --runs 1 --timeout-ms 60000 --criterion ncp-agent-ready
pnpm smoke:startup-readiness -- --runs 1 --timeout-ms 60000 --criterion auth-status
pnpm smoke:startup-readiness -- --runs 1 --timeout-ms 90000 --criterion plugin-hydration-ready
pnpm smoke:startup-readiness -- --dev-runner --home /Users/peiwang/.nextclaw --runs 1 --timeout-ms 90000 --criterion frontend-auth-status
```

## 最新基线结果

日期：`2026-04-23`

### bootstrap-ready 三轮

- `uiApiReachableMs`: `2439 / 1616 / 2020`
- `authStatusOkMs`: `2439 / 1616 / 2020`
- `healthOkMs`: `2439 / 1616 / 2020`
- `ncpAgentReadyMs`: `2439 / 1616 / 2020`
- `bootstrapReadyMs`: `2439 / 1616 / 2020`
- `pluginHydrationReadyMs`: `未等待，后台继续加载`
- `channelsReadyMs`: `未等待，后台继续加载`

聚合：

- `uiApiReachableMs`: `median=2020ms`, `mean=2025ms`, `p95=2439ms`
- `authStatusOkMs`: `median=2020ms`, `mean=2025ms`, `p95=2439ms`
- `healthOkMs`: `median=2020ms`, `mean=2025ms`, `p95=2439ms`
- `ncpAgentReadyMs`: `median=2020ms`, `mean=2025ms`, `p95=2439ms`
- `bootstrapReadyMs`: `median=2020ms`, `mean=2025ms`, `p95=2439ms`

### ncp-agent-ready 单轮补充

- `uiApiReachableMs`: `2243ms`
- `authStatusOkMs`: `2243ms`
- `healthOkMs`: `2243ms`
- `ncpAgentReadyMs`: `2243ms`

### auth-status 单轮补充

- `uiApiReachableMs`: `2440ms`
- `authStatusOkMs`: `2440ms`
- `healthOkMs`: `2440ms`
- `ncpAgentReadyMs`: `2440ms`

### plugin-hydration-ready 单轮补充

- `uiApiReachableMs`: `1835ms`
- `authStatusOkMs`: `1835ms`
- `healthOkMs`: `1835ms`
- `ncpAgentReadyMs`: `1835ms`
- `bootstrapReadyMs`: `1835ms`
- `pluginHydrationReadyMs`: `25080ms`
- `channelsReadyMs`: `25080ms`

### pnpm dev start + 默认 HOME 前端链路补充

命令：

```bash
pnpm smoke:startup-readiness -- --dev-runner --home /Users/peiwang/.nextclaw --runs 1 --timeout-ms 90000 --criterion frontend-auth-status
```

结果：

- `frontendServerReadyMs`: `4841ms`
- `frontendAuthStatusOkMs`: `32870ms`
- `frontendAuthStatusFailureCount`: `11`
- `uiApiReachableMs`: `31073ms`
- `authStatusOkMs`: `32870ms`
- `healthOkMs`: `31073ms`
- `ncpAgentReadyMs`: `31073ms`
- `bootstrapReadyMs`: `31073ms`
- `pluginHydrationReadyMs`: `31073ms`
- `channelsReadyMs`: `31073ms`
- 前端 server ready 到 `/api/auth/status` OK 的红色窗口约 `28029ms`。

### 插件延迟激活后复测

主可用口径：

```bash
pnpm smoke:startup-readiness -- --dev-runner --home /Users/peiwang/.nextclaw --runs 1 --timeout-ms 90000 --criterion frontend-auth-status
```

结果：

- `uiApiReachableMs`: `2241ms`
- `authStatusOkMs`: `2241ms`
- `healthOkMs`: `2241ms`
- `ncpAgentReadyMs`: `2241ms`
- `bootstrapReadyMs`: `2241ms`
- `frontendServerReadyMs`: `2458ms`
- `frontendAuthStatusOkMs`: `2458ms`
- `frontendAuthStatusFailureCount`: `0`
- 前端 server ready 到 `/api/auth/status` OK 的红色窗口约 `0ms`。

后台插件完成口径：

```bash
pnpm smoke:startup-readiness -- --dev-runner --home /Users/peiwang/.nextclaw --runs 1 --timeout-ms 90000 --criterion plugin-hydration-ready
```

结果：

- `uiApiReachableMs`: `2039ms`
- `authStatusOkMs`: `2039ms`
- `healthOkMs`: `2039ms`
- `ncpAgentReadyMs`: `2039ms`
- `bootstrapReadyMs`: `2039ms`
- `frontendServerReadyMs`: `2475ms`
- `frontendAuthStatusOkMs`: `2475ms`
- `frontendAuthStatusFailureCount`: `0`
- `pluginHydrationReadyMs`: `23646ms`
- `channelsReadyMs`: `23646ms`

瀑布流：

- `0ms~2.5s`: UI API、`/api/auth/status`、health、NCP agent、bootstrap status、前端 server 全部 ready。
- `99ms~10099ms`: UI 启动场景 post-ready delay，插件/渠道激活刻意延后。
- `10100ms~17240ms`: `warm_ncp_capabilities`，约 `7140ms`。
- `10106ms~21484ms`: `hydrate_capabilities`，约 `11378ms`。
- `21484ms~21498ms`: plugin gateways / channels / restart sentinel 收尾，约 `14ms`。

## 当前判断

- 隔离 HOME 下，当前最大耗时不在最开始的 UI/API bring-up。
- 默认 HOME 的真实 `pnpm dev start` 链路中，原先 `/api/auth/status` 明显晚于 frontend server ready，红色窗口约 `28.0s`；插件延迟激活后，该红色窗口已在单轮复测中降到约 `0ms`。
- 已完成第一刀架构调整：`bootstrap-ready` 改为 core app 可用口径，不再等待插件水合；三轮中位数约 `2.0s`。
- 已完成第二刀：UI 启动场景下插件水合改为 core ready 后延迟激活，不再阻塞 `/api/auth/status` 与主前端可用性。
- 当前剩余大头已经转移到后台插件激活本身：`pluginHydrationReady/channelsReady` 仍约 `23.6s`，其中 `hydrate_capabilities` 是主要 owner。

## 当前下一步优先级

1. 继续以 `pnpm dev start + --home /Users/peiwang/.nextclaw + frontend-auth-status` 防回归，确保 status 红色窗口不反弹。
2. 下一步优化后台插件激活：减少 `hydrate_capabilities` 的串行动态加载耗时，并评估按需 activation event。
3. 保持主链路不依赖 channelId；静态 `packageName -> pluginId/channelId` 只作为后台跳过禁用渠道的减负优化。
4. 中长期评估 worker / 子进程 extension host，让插件 discovery、activation 与运行隔离不再占用主 API 事件循环。
