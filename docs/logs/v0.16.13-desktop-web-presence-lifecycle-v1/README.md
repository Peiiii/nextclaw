# v0.16.13-desktop-web-presence-lifecycle-v1

## 迭代完成说明

- 本次按“一次性完整 v1”交付 Desktop / Web 统一 presence 生命周期方案，设计依据见 [Unified Desktop and Web Presence Lifecycle Design](../../plans/2026-04-14-unified-desktop-web-presence-lifecycle-design.md)。
- Desktop 已完成一条完整产品语义链路：
  - 关闭窗口默认隐藏到后台，不停止内嵌 runtime。
  - 只有应用菜单或托盘菜单里的 `Quit NextClaw` 才真正退出应用并停止 runtime。
  - 增加托盘常驻入口，可从托盘恢复主窗口、切换登录自启、显式退出应用。
  - 新增 presence 偏好持久化：`closeToBackground`、`launchAtLogin`。
  - 新增主进程 presence owner：负责托盘、关窗拦截、显式退出放行、登录自启设置读写、presence IPC。
- 同批次验收修正补上了一个关键桌面生命周期缺陷：
  - 真实安装态排查发现，主窗口关闭后虽然先被正确拦截并隐藏到托盘，但随后又会落入 `before-quit -> stopRuntime()` 链路，导致内嵌 runtime 被 `SIGTERM` 终止，所以定时任务只会多跑一次，之后全部停止。
  - 本次把“隐式 quit”和“显式 Quit NextClaw”彻底分开：启用后台运行时，普通 `before-quit` 会被 presence owner 拦回后台；只有托盘菜单或应用菜单里的 `Quit NextClaw`，以及 restart / update 等明确退出路径，才会先标记 `quitting` 再放行停服务。
  - 修复后桌面端的真实合同收紧为：`关闭窗口 = 隐藏到托盘并继续后台运行`，`Quit NextClaw = 退出应用并停止 runtime`。
- Desktop renderer / UI 已完成对应接线：
  - preload bridge 新增 `getPresenceState()`、`updatePresencePreferences()`。
  - runtime 配置页新增 `Runtime Presence` 卡片。
  - 在 `desktop-embedded` 环境下展示“关闭窗口时继续后台运行”“登录系统时自动启动 NextClaw”两个开关。
- Web 侧本次完成的是统一语义和文案落地，而不是宿主级自启动编排：
  - `managed-local-service`、`self-hosted-web`、`shared-web` 三类环境统一展示“浏览器只是控制面，关闭页面不影响服务主体”的说明。
  - 没有把“网页端自启动”错误实现成浏览器能力，而是明确归属宿主/部署层。
- 同批次续改进一步把 `Runtime Control` 收敛成统一的 `Service Management`：
  - 现有 `RuntimeControlView` 已扩展为 `serviceState + canStartService + canRestartService + canStopService + canRestartApp` 的最小合同。
  - server route 已补齐 `start-service / restart-service / stop-service` 三条控制路由。
  - `managed-local-service` 现在使用统一的 backend owner 输出服务状态、可用动作、宿主提示，而不是继续把启停能力分散在另一套页面语义里。
  - Desktop 继续保留 `Restart Service / Restart App`，不额外暴露普通用户 `Stop Service`，避免破坏既定的 `Quit App` 语义。
  - `remote access` 现有快捷动作保留，但已与同一套 managed-service owner 对齐，不再形成另一套独立控制逻辑。
- 本轮又顺手做了一次最小目录收敛，解决 `runtime-support / service-support/runtime` 的角色混乱：
  - 新增 `packages/nextclaw/src/cli/commands/service-support/ui/`，把 UI host、控制面装配和 remote access UI 协调都收回同一边界。
  - 原 `packages/nextclaw/src/cli/commands/runtime-support/runtime-control-host.ts` 已迁到 `packages/nextclaw/src/cli/commands/service-support/ui/runtime-control-host.service.ts`。
  - 原 `packages/nextclaw/src/cli/commands/service-support/runtime/service-ui-hosts.ts` 已迁到 `packages/nextclaw/src/cli/commands/service-support/ui/service-ui-hosts.service.ts`。
  - 原 `packages/nextclaw/src/cli/commands/service-support/runtime/service-remote-access.ts` 已迁到 `packages/nextclaw/src/cli/commands/service-support/ui/service-remote-access.service.ts`。
  - `service-support/runtime` 重新收窄为 runtime 基础设施边界，不再混放 UI host；孤立的 `runtime-support` 角色目录被收空。
- 本次实现尽量复用既有结构，没有新开独立配置页或新存储：
  - Desktop 偏好复用 `DesktopLauncherStateStore`。
  - UI 侧复用既有 runtime control host / manager / route 链路，只在原有合同上做最小扩展，没有新造第三套 service-management 系统。

## 测试/验证/验收方式

- 已通过：`pnpm -C apps/desktop exec tsc -p tsconfig.json --noEmit`
- 已通过：`pnpm -C packages/nextclaw-ui exec tsc --noEmit`
- 已通过：`pnpm -C packages/nextclaw-server exec tsc --noEmit`
- 已通过：`pnpm -C packages/nextclaw exec tsc --noEmit`
- 已通过：`pnpm -C packages/nextclaw-ui exec vitest run src/components/config/runtime-presence-card.test.tsx src/components/config/runtime-control-card.test.tsx`
- 已通过：`pnpm -C packages/nextclaw-server exec vitest run src/ui/router.runtime-control.test.ts`
- 已通过：`pnpm -C packages/nextclaw exec vitest run src/cli/commands/service-support/ui/tests/runtime-control-host.service.test.ts`
- 已通过：`pnpm lint:new-code:governance -- apps/desktop/package.json apps/desktop/src/main.ts apps/desktop/src/preload.ts apps/desktop/src/utils/desktop-ipc.utils.ts apps/desktop/src/services/desktop-presence.service.ts apps/desktop/src/launcher/stores/launcher-state.store.ts apps/desktop/src/launcher/__tests__/launcher-foundation.test.ts apps/desktop/src/launcher/__tests__/launcher-test.utils.ts packages/nextclaw-ui/src/components/config/RuntimeConfig.tsx packages/nextclaw-ui/src/components/config/runtime-presence-card.tsx packages/nextclaw-ui/src/components/config/runtime-presence-card.test.tsx packages/nextclaw-ui/src/desktop/managers/desktop-presence.manager.ts packages/nextclaw-ui/src/desktop/stores/desktop-presence.store.ts packages/nextclaw-ui/src/desktop/desktop-update.types.ts packages/nextclaw-ui/src/lib/i18n.runtime-control.ts`
- 已通过：`pnpm lint:new-code:governance -- packages/nextclaw-server/src/ui/runtime-control.types.ts packages/nextclaw-server/src/ui/ui-routes/types.ts packages/nextclaw-server/src/ui/ui-routes/runtime-control.controller.ts packages/nextclaw-server/src/ui/router.ts packages/nextclaw-server/src/ui/router.runtime-control.test.ts packages/nextclaw-ui/src/api/runtime-control.types.ts packages/nextclaw-ui/src/api/runtime-control.ts packages/nextclaw-ui/src/api/types.ts packages/nextclaw-ui/src/runtime-control/runtime-control.manager.ts packages/nextclaw-ui/src/hooks/use-runtime-control.ts packages/nextclaw-ui/src/lib/i18n.runtime-control.ts packages/nextclaw-ui/src/components/config/runtime-control-card.tsx packages/nextclaw-ui/src/components/config/runtime-control-card.test.tsx packages/nextclaw-ui/src/components/config/runtime-presence-card.test.tsx packages/nextclaw/src/cli/commands/service.ts packages/nextclaw/src/cli/commands/service-support/ui/runtime-control-host.service.ts packages/nextclaw/src/cli/commands/service-support/ui/tests/runtime-control-host.service.test.ts packages/nextclaw/src/cli/commands/service-support/ui/service-ui-hosts.service.ts packages/nextclaw/src/cli/commands/service-support/ui/service-remote-access.service.ts docs/plans/2026-04-14-unified-desktop-web-presence-lifecycle-design.md`
- 已通过：`pnpm check:governance-backlog-ratchet`
- 已执行：`pnpm lint:maintainability:guard`
  - 结果：本次相关实现没有新增阻断 error。
  - 当前命令仍失败，原因是工作区里另两条未纳入本次交付范围的改动仍在守卫上报错：
    - `apps/competitive-leaderboard/server/leaderboard-products.data.ts`
    - `apps/desktop/scripts/prepare-manual-update-validation.mjs`
  - 本次自身相关变更只留下 warning，没有新增同范围 error；其中最值得继续关注的是 `packages/nextclaw-ui/src/components/config/runtime-control-card.tsx` 在本次收敛后增长较多，后续可再切一刀 presenter / action model。
- 未执行：真实 GUI 冒烟
  - 原因：当前轮次先完成代码与配置链路落地，未在本机桌面环境里额外启动 Electron 进行人工点击式验证。
  - 后续建议最小冒烟：启动桌面端后验证“关窗隐藏到托盘”“托盘恢复窗口”“托盘 Quit 才退出”“开启登录自启后重新读取状态正确”；网页端验证 `Service Management` 在 `managed-local-service` 下显示统一的服务状态与动作按钮。
- 已补做：桌面端真实生命周期冒烟与排查复现
  - 复现证据：`~/Library/Application Support/@nextclaw/desktop/launcher/main.log` 在 `2026-04-14T11:01:13Z` 记录 `Desktop window close intercepted. Hiding window to tray.`，但随后又在 `2026-04-14T11:01:15Z` 记录 `before-quit received. stopping=false`，并紧接着出现 runtime `signal=SIGTERM` 退出日志，和“关窗后只再跑一次定时任务”现象一致。
  - 修复后已通过：`pnpm -C apps/desktop exec tsc -p tsconfig.json --noEmit`
  - 修复后已通过：`pnpm lint:new-code:governance -- apps/desktop/src/main.ts apps/desktop/src/services/desktop-presence.service.ts apps/desktop/src/services/desktop-update-shell.service.ts`
  - 修复后已通过：源码态桌面端真实冒烟。使用 `pnpm -C apps/desktop dev` 启动桌面端后，发送一次真实关窗操作（`Command+W`），`main.log` 在 `2026-04-14T11:28:48Z` 只记录 `Desktop window close intercepted. Hiding window to tray.`，没有再出现新的 `before-quit`。
  - 修复后已通过：关窗后再次检查进程，Electron 主进程 `pid=59377` 与内嵌 runtime `pid=59662` 仍同时存活。
  - 修复后已通过：窗口隐藏到托盘后直接请求本地 API，`curl http://127.0.0.1:53277/api/config` 与 `curl http://127.0.0.1:53277/api/ncp/sessions?limit=20` 都返回 `ok:true`，说明不是“窗口隐藏了但服务已失效”的假存活。
  - 已重新构建安装包：`pnpm desktop:package`

## 发布/部署方式

- Desktop：
  - 正常走现有桌面端构建与发布链路。
  - 由于托盘依赖打包资源，本次已将 `apps/desktop/build/icons/icon.png` 纳入桌面打包文件清单，发布时继续使用标准 desktop build 即可。
  - 发布后建议补做安装包级冒烟，重点看 macOS / Windows 的托盘与登录自启行为。
- Web / UI：
  - 按既有前端构建与部署流程发布，无需额外服务迁移。
  - 本次 Web 变化同时包含 presence 语义说明与 `Service Management` 合同升级，需要一并发布 UI、server route 与 CLI host。
  - 不要求新增独立部署组件，继续沿用现有 NextClaw UI / server / CLI 打包链路即可。

## 用户/产品视角的验收步骤

- Desktop 验收：
  - 启动桌面端，进入运行时配置页，确认出现 `Runtime Presence` 卡片。
  - 保持“关闭窗口时继续后台运行”为开启，关闭主窗口，确认应用未退出、runtime 未停止。
  - 在保持后台运行开启的前提下等待至少 2 分钟，确认 cron / 定时任务仍继续执行，而不是只在关窗后额外跑一条就停止。
  - 从托盘点击 `Open NextClaw`，确认主窗口可恢复。
  - 从托盘点击 `Quit NextClaw`，确认桌面应用退出，内嵌 runtime 跟随停止。
  - 若已有“每分钟发送问候”之类的真实定时任务，验证“关闭窗口后继续发送；点击 `Quit NextClaw` 后停止发送”的完整对照语义。
  - 打开“登录系统时自动启动 NextClaw”，重启应用后再次进入设置页，确认状态能正确回显。
- Web 验收：
  - 在 `managed-local-service`、`self-hosted-web` 或 `shared-web` 环境进入运行时配置页。
  - 确认 presence 区块显示的是说明文案而不是桌面专属开关。
  - 在 `managed-local-service` 环境确认 `Service Management` 卡片出现统一服务状态，并展示 `Start / Restart / Stop` 语义范围内的按钮或不可用原因。
  - 在桌面端环境确认 `Service Management` 只展示 `Restart Service / Restart App`，不会额外冒出普通用户 `Stop Service`。
  - 关闭浏览器标签页再重新进入，确认产品语义上仍以“连接到现有服务主体”为准，而不是把页面当服务 owner。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。除了 Desktop presence owner 之外，本次又把 Web 侧零散的服务控制能力收回到统一的 runtime control owner，并顺手把 `runtime-support` 这类假角色目录收掉，没有继续放任“runtime 页面一套、remote access 页面一套、support 目录再分一套”的多头蔓延。
- 是否优先遵循删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好：是。本次没有新建 `service-management` 独立后端系统，而是直接扩展现有 `RuntimeControlView`、现有 server route 与现有 manager；同时把 UI host / remote access 协调统一收进 `service-support/ui`，避免继续保留意义模糊的 support 层级。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到。为了把 Desktop presence + Web service management 一次交付完成，总代码量净增不可避免；但这次增长主要集中在最小必要的 contract、owner 与测试上，没有新增第三套产品入口或第三套协议模型，同时目录平铺度较上一版有所收敛。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。Desktop 生命周期由 `DesktopPresenceService` 统一 owner；Web 服务动作由 `RuntimeControlHost` 统一 owner；UI 侧通过 `runtimeControlManager` 和 `desktopPresenceManager` 分别承接 service management 与 presence，不再把两类语义混在一张对象里。
- 目录结构与文件组织是否满足当前项目治理要求：比上一版更接近目标。`service-support/runtime` 现在只承担 runtime 基础设施，`service-support/ui` 承担 UI host / 控制面装配，旧的 `runtime-support` 目录已不再承载职责；剩余已知旧债仍主要在 `packages/nextclaw-ui/src/components/config` 与 `packages/nextclaw-ui/src/api` 两处 legacy 平铺目录。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行独立复核，结论如下。
- 针对本次关窗误停服务的续改复核：本次增量只触达 3 个桌面主进程文件，代码增减为 `+33 / -2`，且全部围绕既有 `DesktopPresenceService` 与桌面退出链路收口，没有新增第四类 lifecycle owner、没有引入状态兜底分支、也没有再造一套“退出原因枚举 + 中间适配层”的补丁结构；这是当前问题下更小、更可预测的修法。

可维护性复核结论：保留债务经说明接受

本次顺手减债：是

代码增减报告：
- 新增：1635 行
- 删除：184 行
- 净增：1451 行

非测试代码增减报告：
- 新增：1207 行
- 删除：174 行
- 净增：1033 行

可维护性总结：
- no maintainability findings
- 本次净增明显，原因是这是一个真实的新产品能力批次：既包含 Desktop presence，也包含 Web service management；但这批增长已经尽量压缩在单一主进程 owner、单一 runtime control owner、单一卡片与单一 bridge/store/manager 链路内，没有再复制一套运行时环境或配置体系。
- 已额外顺手偿还的债务是：把 Web 服务动作从分裂入口收回到统一 contract，把 UI host 从混乱的 `runtime-support / service-support/runtime` 假层级收敛到 `service-support/ui`，并把 `main.ts` 的启动编排从超预算函数里收了一步，避免 presence 接入继续把主入口堆成补丁式巨函数。
- 当前保留债务主要有两处：
  - `packages/nextclaw-ui/src/components/config/RuntimeConfig.tsx` 仍是 legacy 长文件，后续最自然的切缝是继续把其它 runtime 面板逐步拆成独立装配块。
  - `packages/nextclaw-ui/src/components/config/runtime-control-card.tsx` 经过这次统一收敛后增长较多，后续最自然的切缝是把动作模型与只读展示块再拆成独立 presenter / view helper。
  - 工作区里未纳入本次交付范围的 `apps/desktop/scripts/prepare-manual-update-validation.mjs` 与 `apps/competitive-leaderboard/server/leaderboard-products.data.ts` 仍命中维护性守卫，需要在各自批次单独收敛。
- 长期目标对齐 / 可维护性推进：这次实现让“Desktop 是可常驻宿主、Web 是控制面而不是 service owner”“服务管理必须有统一入口”以及“runtime 基础设施与 UI host 需要明确分层”三件事都从讨论变成了代码里的明确边界，向“统一入口、统一心智、行为可预测”的长期目标推进了一步。下一步最值得继续切的 seam 是把 `RuntimeConfig` / `runtime-control-card` 再拆薄，并在后续独立批次补做 desktop GUI 冒烟与宿主级自启动验证。
