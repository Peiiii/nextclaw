# Startup Readiness Debug Working Notes

## 症状定义

- 用户感知问题：服务进程已经起来，但“启动后真正可用”仍然很晚。
- 当前可验证信号：`bootstrap-ready` 约 `24.7s~27.9s`，显著晚于 `auth/status`、`health`、`ncpAgent.ready` 的约 `1.8s~2.4s`。
- 用户真实链路补充：`pnpm dev start` + 默认 `~/.nextclaw` 下，frontend server 约 `4.8s` ready，但 `/api/auth/status` 约 `32.9s` 才 OK，红色窗口约 `28.0s`。
- 正确目标：把最大耗时 owner 缩到可明确负责的阶段，再决定是否做架构改造。

## 黄金复现

- 命令：`pnpm smoke:startup-readiness -- --runs 3 --timeout-ms 90000 --criterion bootstrap-ready`
- 环境：隔离 `NEXTCLAW_HOME`
- 观测点：`ui-api`、`auth-status`、`health`、`ncp-agent-ready`、`bootstrap-ready`
- 后续补充：在同一入口下叠加 `NEXTCLAW_STARTUP_TRACE=1`
- 用户真实口径：`pnpm smoke:startup-readiness -- --dev-runner --home /Users/peiwang/.nextclaw --runs 1 --timeout-ms 90000 --criterion frontend-auth-status`

## 链路地图

- `serve startup`
- `UI API reachable`
- `/api/auth/status ok`
- `/api/health ok`
- `ncpAgent.ready`
- `hydrate capabilities`
- `start plugin gateways`
- `start channels`
- `wake restart sentinel`
- `bootstrap ready`

## 观察点计划

- 优先读取 `startup-trace` 输出，按阶段切分后半段耗时。
- 重点观察 `service-gateway-bootstrap.service.ts`、`service-capability-hydration.service.ts` 与 plugin/channel 启动链。
- 只在阶段边界补观察，不在整条链路泛滥加日志。

## 当前假设与缩圈实验

- 假设 A：最大耗时主要落在 `hydrate capabilities`。
  - 已支持。两次样本分别观察到 `service.deferred_startup.hydrate_capabilities` 约 `23.0s` / `22.4s`。
- 假设 B：plugin gateways 或 channels 启动存在串行大头。
  - 已排除。`start_plugin_gateways` 约 `210ms / 3ms`，`start_channels` 与 `wake_restart_sentinel` 基本为 `0ms~1ms`。
- 假设 C：`wake restart sentinel` 或其它后置动作把 `markReady` 推迟了。
  - 已排除。真正拖住 `bootstrap ready` 的不是最后几个尾段，而是更早的 plugin hydration。
- 假设 D：plugin hydration 内部是 bundled channel plugins 串行加载。
  - 已支持。现场 `service.log` 显示 `plugin.loader.total duration_ms=19379 plugin_count=11`，并且 11 个 bundled channel package 基本串行，每个约 `1.5s~2.1s`。
- 假设 E：当前实现会在启动期加载明明未启用的 channel plugins。
  - 已支持。隔离 `config.json` 中 `channels.whatsapp/telegram/discord/feishu/... .enabled` 均为 `false`，但 `resolveEnableState()` 在 `plugins.entries` 缺省时默认返回 `enabled=true`，导致 bundled plugin loader 仍完整加载这些包后才再决定后续行为。
- 假设 F：默认 HOME 下插件水合即使语义上后置，仍会饿住 `/api/auth/status`。
  - 已支持。`pnpm dev start` + `/Users/peiwang/.nextclaw` 样本中，`frontendServerReadyMs=4841ms`、`frontendAuthStatusOkMs=32870ms`、`frontendAuthStatusFailureCount=11`；同时 trace 显示 `plugin.loader.total duration_ms=22060 plugin_count=13`，`service.deferred_startup.hydrate_capabilities duration_ms=29371`。
- 假设 G：UI 启动场景下，插件/渠道可以延迟激活，不需要阻塞主前端和 `/api/auth/status`。
  - 已支持。`NextclawApp.start()` 在 core ready 后立即 `bootstrapStatus.markReady()`，再后台延迟执行 `warmDerivedCapabilities()`。真实 `pnpm dev start` 复测中，`frontendAuthStatusOkMs=2475ms`、失败次数 `0`，而 `pluginHydrationReadyMs=23646ms` 继续作为后台口径完成。

## 根因与修复位点

- 已定位到首个超长 owner：`packages/nextclaw/src/cli/shared/services/gateway/service-capability-hydration.service.ts`
  - 具体重耗时子 owner：`packages/nextclaw-openclaw-compat/src/plugins/progressive-plugin-loader/progressive-bundled-plugin-loader.ts`
- 当前根因判断：
  - 启动后半段被“bundled channel plugins 启动期全量串行加载”拖慢，而不是前端首屏、`/api/auth/status`、plugin gateways 或 channels 启动拖慢。
  - 现有 bundled plugin 启用判定依赖运行时加载模块后再拿到 `pluginId`，导致即使 channel 在用户配置里明确 `enabled=false`，启动阶段仍要把所有 bundled packages 逐个 `load + register` 一遍。
  - `service.ui_shell_grace_window` 固定再吃 `3s`，但这是次级大头；真正第一优先级仍是砍掉 19s 左右的全量 bundled plugin hydration。
  - 默认 HOME 下还会加载外部开发源插件并增加到 `plugin_count=13`；这些动态 import/tsx 编译虽然被标记为后台水合，但仍在主 Node 事件循环内运行，实际会让轻量 API 请求被延迟到水合结束附近。
- 当前建议修复位点：
  - 优先保证 core ready / `/api/auth/status` / 前端 shell 不等待插件和渠道。
  - 插件水合、plugin gateway、channels、restart sentinel 作为 post-ready 后台阶段执行。
  - 静态 bundled channel metadata 只作为后台减负优化，不能成为启动主链必须先知道 channelId 的理由。
  - 若后台插件激活仍影响交互流畅度，下一刀应考虑 worker thread / 子进程化插件 discovery 与 activation，而不是把插件发现重新放回主链路。
  - 第二优先级再评估是否缩短或条件化 `service.ui_shell_grace_window`。
- 已完成第一刀：
  - `bootstrap-ready` 现在代表 core app 可用，不再等待插件水合。
  - 插件水合与 channels 启动继续作为后台子状态记录，不再把整体 phase 从 `ready` 拉回 `hydrating-capabilities`。
  - 真实三轮复测：`bootstrapReadyMs` 为 `2439 / 1616 / 2020`，中位数约 `2.0s`。
  - 后台插件完成单轮复测：`pluginHydrationReadyMs=25080ms`、`channelsReadyMs=25080ms`。
- 已完成第二刀：
  - UI 启动场景默认在 core ready 后等待 `10s` 再启动插件/渠道后台激活，避免动态 import / hydration 抢占主可用窗口。
  - 真实 dev-runner 复测：`uiApi/authStatus/health/ncpReady/bootstrapReady=2039ms`，`frontendServer/frontendAuthStatus=2475ms`，`frontendAuthStatusFailureCount=0`。
  - 后台插件完成复测：`pluginHydrationReady/channelsReady=23646ms`。
  - 当前瀑布流最大后台 owner：`hydrate_capabilities=11378ms`，其次 `warm_ncp_capabilities=7140ms` / `service.ui_shell_grace_window=7095ms`。

## 同链路验收

- 每次改动后复跑同一条 `smoke:startup-readiness` 命令。
- 若涉及阶段 owner 改动，必须比较 `bootstrap-ready` 主口径与阶段差值是否同步下降。
