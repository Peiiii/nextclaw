# v0.23.7 runtime update auto version switch

## 迭代完成说明

本次修复运行时更新过程中的两个用户可见问题：应用更新后自动恢复成旧版本，以及检查或下载已经完成但页面仍停在处理中。

第一个问题的根因是更新阶段虽然已经把 `launcher/runtime-bundles/current.json` 激活为新版本，但 self-relaunch helper 直接执行了旧运行包的 `dist/cli/app/index.js`，绕过了负责读取版本指针的 launcher。修复后发行元数据显式提供 `launcherEntrypoint`，managed service 自恢复统一重新进入 launcher，由 launcher 选择当前已激活的运行包。该修复落在版本选择的真实 owner，没有通过前端覆盖版本号或增加平行重启路径掩盖问题。

第二个问题的根因是 check/download 命令立即返回 `checking`/`downloading`，最终状态只依赖 WebSocket 事件送达；页面刚打开、实时连接尚未就绪时可能错过事件，因此刷新后才能读到后端已经完成的状态。修复后 check/download 会等待当前任务完成并返回最终 snapshot，同时保留实时进度事件。命令响应和实时事件共享同一个 runtime update snapshot owner，没有新增第二事实源或 UI fallback。

根因通过实际运行日志、旧/新进程入口、`current.json`、`/api/app/meta` 以及真实页面状态变化交叉确认：更新前后版本指针已经变化，但旧 self-relaunch 仍执行旧 app；检查完成后后端 snapshot 已是 `update-available`，页面却因未收到最终事件停在“检查中”。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-service tsc`：通过。
- `pnpm -C packages/nextclaw tsc`：通过。
- `pnpm -C packages/nextclaw-service lint`：0 error；既有 warning 与本次改动无关。
- `pnpm -C packages/nextclaw lint`：通过。
- service 定向测试：`service-restart.manager.test.ts`、`npm-runtime-update-host.service.test.ts`、`npm-runtime-update-command.service.test.ts` 共 8 项通过。
- distribution 定向测试：`nextclaw-distribution.test.ts` 1 项通过。
- 隔离运行态验收：应用更新后旧 PID 退出，新 PID 经 launcher 接管；`/api/app/meta.productVersion` 和 `current.json.version` 均变为新版本，主界面页头自动显示新版本，无需手动执行 restart。
- 页面操作验收：检查完成后直接显示可用版本，下载完成后直接启用应用操作，不需要刷新页面补偿实时事件竞态。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`：通过。

## 发布/部署方式

本次只完成源码修复和提交，不执行 NPM publish、runtime update channel 发布、GitHub release 或远程部署。

数据库 migration 不适用：本次修改的是本地 NPM runtime 的更新命令完成语义与 launcher 进程交接链路。

## 用户/产品视角的验收步骤

1. 在更新页面点击检查更新，完成后页面应直接显示可用版本。
2. 点击下载更新，完成后页面应直接允许应用更新。
3. 点击应用更新并等待服务自动恢复，不手动执行 restart。
4. 确认更新页和主界面页头显示新版本。
5. 通过 `/api/app/meta` 和运行包指针确认实际运行的也是新版本，而不是只改变展示状态。

## 可维护性总结汇总

已按 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 口径复核，无阻塞性问题。

- 本次产品修复生产代码新增 47 行、删除 49 行，净减 2 行，满足非功能改动净增长门槛。
- 删除无人消费的 `NextclawDistribution.packageRoot`，改为真实 launcher 入口；版本选择继续由 launcher 单一 owner 负责。
- check/download 复用现有 `activeTask` 和 snapshot，不增加轮询器、前端 fallback、重复状态或新的 service/manager 抽象。
- `packages/nextclaw-service/src/services/runtime` 的既有目录预算 warning 仍存在，但直属文件数修改前后均为 15，本次没有扩大目录。

## NPM 包发布记录

待后续统一发布：

- `@nextclaw/service`：本地版本与当前 NPM 已发布版本均为 `0.3.5`；需要 patch 发布，使 update 命令可靠返回最终 snapshot，并使 self-relaunch 重新进入 launcher。
- `nextclaw`：本地版本与当前 NPM 已发布版本均为 `0.23.0`；需要 patch 发布，使发行元数据携带正确 launcher 入口并进入 runtime bundle。

本次已新增 `.changeset/runtime-update-auto-version-switch.md`，未执行 NPM publish 或 runtime channel 发布。
