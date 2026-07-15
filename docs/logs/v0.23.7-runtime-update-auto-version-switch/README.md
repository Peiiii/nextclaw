# v0.23.7 runtime update auto version switch

## 迭代完成说明

本次修复 managed service 在应用运行时更新后自动恢复成旧版本，导致刷新页面仍显示旧版本号、只有手动执行一次 `restart` 才切换到新版本的问题。

根因：更新应用阶段已经正确激活 `launcher/runtime-bundles/current.json` 的新版本指针，但 self-relaunch helper 直接执行当前进程的 `dist/cli/app/index.js`。当前进程属于旧运行包，因此自动恢复时绕过了会读取新指针的 `dist/cli/launcher/index.js`，重新启动的仍是旧版本 app。页面刷新只是再次请求旧进程的 `/api/app/meta`，所以旧版本号是运行事实的真实反映，并非前端缓存错误。

确认方式：本机真实服务日志记录到更新应用后旧 PID 退出，自动 helper 随后重新执行 `versions/0.22.4/.../cli/app/index.js`；手动 `restart` 才经 launcher 启动 `versions/0.23.0/.../cli/app/index.js`。这也解释了历史修复为何没有覆盖本问题：`v0.18.83` 只证明 self-relaunch 能从错误的 service package index 改为真实 CLI app 并恢复服务，没有验证已激活运行包的版本切换。

修复方式：发行元数据用真实 `launcherEntrypoint` 替换无人消费的 `packageRoot`，`ServiceRestartManager` 在 self-relaunch 时统一重新进入 launcher。launcher 是运行包指针的唯一读取 owner，会根据已激活的 `current.json` 选择新 app；不增加 UI 版本覆盖、fallback 或平行重启路径。

该修复直接落在第一个违约边界——激活新指针后的进程交接，因此解决的是运行时没有切换的根因，而不是让前端提前显示一个尚未运行的版本号。

同一批次新增 `pnpm dev:verify-update`，把此前只能等真实版本发布、再手工碰运气的更新验收，变成可随时在本地执行的双版本人工验证入口。它从当前工作树构建 baseline 与 candidate，复用生产 runtime update builder、真实签名合同、真实 update API、launcher 和 managed service，并使用隔离 home/run/端口。隔离基线启动后由产品 automatic check 自动发现 candidate，开发者直接看到下载入口，再亲自下载和应用并观察自动重连后的真实版本。

该入口首次进行真实浏览器点击时又发现一条只靠 API 冒烟无法暴露的竞态：check/download 命令先返回过渡状态，最终状态只通过 WebSocket 事件更新；如果页面刚打开、实时连接尚未就绪，事件会丢失，页面停在“检查中”，刷新后才显示后端早已完成的结果。修复后 check/download 命令会等待当前任务完成并返回最终 snapshot，同时继续发布实时进度；页面不再把 WebSocket 作为最终状态的唯一到达路径，也没有新增前端 fallback 或第二事实源。

命令参数、完整开发命令作用和 owner 边界已记录在 `docs/workflows/developer-commands.md`；设计依据记录在 `docs/designs/2026-07-15-local-update-verification.design.md`。

失败复盘已落到 `.agents/skills/nextclaw-validation-workflow/SKILL.md`：后续触达 updater、launcher、restart 或更新后版本展示时，会自动要求运行 `pnpm dev:verify-update` 并核对 baseline/candidate、PID、pointer 与清理合同，避免机制只存在于本次讨论或人类记忆中。

## 测试/验证/验收方式

- 修前真实证据：`~/.nextclaw/logs/service.log` 显示更新后自动恢复到 `0.22.4` app，手动 restart 后才启动 `0.23.0` app。
- `pnpm -C packages/nextclaw-service tsc`：通过。
- `pnpm -C packages/nextclaw tsc`：通过。
- `pnpm -C packages/nextclaw-service lint`：通过，0 error；9 条既有 warning 与本次改动无关。
- `pnpm -C packages/nextclaw lint`：通过。
- service 定向测试：`service-restart.manager.test.ts`、`npm-runtime-update-host.service.test.ts`、`npm-runtime-update-command.service.test.ts` 共 8 项通过；新增用例证明 check/download 不依赖实时事件也会返回最终 snapshot。
- distribution 定向测试：`nextclaw-distribution.test.ts` 1 项通过，同时覆盖 packaged `.js` 与 source `.ts` launcher 入口。
- `pnpm -C packages/nextclaw-service build`、`pnpm -C packages/nextclaw build`：通过；随后执行 `pnpm clean:generated` 与 `pnpm check:generated-clean`，生成物已恢复干净。
- 隔离真实链路 smoke：在临时 `NEXTCLAW_HOME`、临时 `NEXTCLAW_RUN_HOME` 和端口 `56144` 上以 `0.22.4` 运行包启动 managed service，并预置已下载的 `0.23.0` 运行包。调用页面“应用更新”对应的真实 `POST /api/runtime/update/apply` 后，接口返回 `restart-required/currentVersion=0.23.0`；旧 PID `50515` 自动退出，新 PID `51257` 接管，`/api/app/meta.productVersion` 从 `0.22.4` 变为 `0.23.0`，`ps` 显示新进程来自 `versions/0.23.0/runtime/dist/cli/app/index.js`。
- 新命令真实人工环境验收：运行 `pnpm dev:verify-update -- --no-open --port 56144`，命令从当前工作树构建 `0.23.0-dev.0` baseline 与签名 `0.23.0` candidate。初始 `/api/app/meta.productVersion=0.23.0-dev.0`、PID `79750`；真实调用 check 后状态为 `update-available`，download 后为 `downloaded/canApplyInApp=true`，apply 后返回 `restart-required`；随后无需手动 restart，PID `89895` 自动接管，`productVersion=0.23.0`，`current.json.version=0.23.0`。命令自己的 observer 同时输出 `Update verified successfully`。
- 清理合同真实验收：第三次完整启动新命令得到 baseline PID `61788` 后，向 `pnpm dev:verify-update` 发送一次 `Ctrl+C`；脱离 pnpm 进程组的 cleanup watchdog 完成 owned PID 停止与 `tmp/nextclaw-update-verification-*` 目录删除，端口不再监听。
- 真实浏览器点击验收：修复后在端口 `56148` 从全新 `0.23.0-dev.0` 页面依次点击“检查更新”“下载更新”“立即更新”。检查完成后页面直接显示可用版本 `0.23.0`，下载完成后直接启用“立即更新”，全程没有刷新；应用后 PID 从 `98660` 切换为 `6354`，更新页自动显示宿主/内核版本 `0.23.0`，返回主界面后页头显示 `v0.23.0`。`current.json.version=0.23.0`，随后一次 `Ctrl+C` 已确认新 PID 与临时目录均清理完成。
- 验证入口性能与缓存验收：原始冷启动准备为 136.3 秒；两级复用落地后，源码变化并命中 runtime deployment cache 的实测为 35.7–77.5 秒，无源码变化的最终 fixture 命中为 7.5–14.2 秒；显式 `--rebuild` 绕过两级缓存并完成一次 production deploy，准备耗时 84.6 秒。区间差异来自同时变化的 package 数和本机并行构建负载。
- 两级路径真实更新验收：最终 runtime cache 路径完成 check/download/apply 后，版本从 `0.23.0-dev.0` 切为 `0.23.0`、PID 从 `24613` 切为 `27775`；无缓存 `--rebuild` 路径对应 PID 从 `75392` 切为 `79335`。两轮均由 observer 同时确认 `productVersion`、新 PID 与 `current.json.version`，退出后临时目录和 owned service 均清理。
- 缓存 owner 拆分后的真实复验：默认路径命中 runtime deployment cache，38.1 秒准备出隔离页面；真实 check/download/apply 分别返回 `update-available`、`downloaded`、`restart-required`，PID 从 `52113` 切为 `59734`，随后 `/api/app/meta.productVersion` 与 `current.json.version` 均为 `0.23.0`。两次紧随其后的运行因另一批本地开发在运行之间继续修改 runtime/UI 源码而产生新的源码指纹，按合同重新构建；这不是 fixture 热缓存退化。
- 默认入口无更新提示复现与修复：新隔离会话初始 `automaticChecks=false`，`GET /api/runtime/update` 一直返回 `idle`、`availableVersion=null`，主界面因此没有新版本或下载入口。修正为 `automaticChecks=true/autoDownload=false` 后，全新端口 `59290` 的源码实例在未人工调用 check API 前已经返回 `update-available/availableVersion=0.23.0`；浏览器确认主界面页头显示“下载”。点击后后端进入 `downloaded/canApplyInApp=true`，页头进一步显示“更新”，证明不是仅渲染一个假提示。该复验实例退出后 PID `54559` 与临时目录均清理；下载和应用仍不会自动执行。
- `--rebuild` 缺陷复现与修复：首次强制重建完成 43 秒源码构建后，因绕过缓存时没有显式创建 run-local fixture 根目录，写入临时签名 key 报 `ENOENT`。修复后由 `buildFixture` 统一创建输出目录，同一条无缓存链路及真实更新复验通过。
- `pnpm dev:verify-update -- --help`、新脚本 ESLint 与 `node --check`：通过。
- 产品修复生产文件按 `--non-feature` 运行 maintainability guard：0 error；非测试代码 `+47/-49，净减 2`。最终验证脚本按新增开发者能力口径运行：7 个文件、`+1227/-87`、0 error、0 warning。
- 新脚本 `node --check` 与定向 ESLint 通过；`pnpm check:governance-backlog-ratchet` 通过。最终全工作区 `pnpm lint:new-code:governance` 在验证器相关规则全部通过后，被并行项目开发中的 `server-path-picker-dialog.tsx` 4 处 React effect owner 违规阻断；未越界修改该批无关代码。
- 最终 `pnpm check:generated-clean` 检出 `packages/nextclaw/ui-dist` 漂移：真实验证会构建并复制当前 UI，同时工作区仍有另一批 UI 源码开发与一个用户启动的旧验证进程。为避免覆盖并行任务现场，本轮没有执行 generated restore；这属于当前脏工作区的剩余收口项，不影响已完成的隔离更新功能验收。

## 发布/部署方式

本次未发布、未部署，也未改动本机 `~/.nextclaw` 中的实际运行包。源码修复需要随下一次 `@nextclaw/service` 与 `nextclaw` NPM/runtime bundle 统一发布后进入用户环境。

`dev:verify-update`、开发命令文档和设计文档属于仓库维护者能力，不进入 `nextclaw` 发布包，也不单独触发 NPM 版本升级。

数据库 migration、远程服务部署不适用：本次只修改本地 NPM 运行时的 launcher 交接链路。

## 用户/产品视角的验收步骤

1. 在页面发现新版本后点击下载并更新。
2. 等待页面短暂断开并自动恢复，不执行手动 `restart`。
3. 刷新页面，页头版本号应显示刚更新的新版本。
4. 通过 `/api/app/meta` 或进程命令确认正在运行的 app 来自新版本运行包，而不是只观察更新状态中的目标版本。

后续开发者无需等待真实发版，可在仓库根运行 `pnpm dev:verify-update`，进入命令打印的 `/updates` 页面完成同一套人工验收；完成后按 `Ctrl+C`，确认隔离服务停止。

## 可维护性总结汇总

已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 口径复核，无阻塞性 maintainability findings。

- 代码增减报告：产品修复生产代码 `+47/-49，净减 2`；新增开发者验证能力的 7 个脚本 `+1227/-87，净增 1140`。后者是用户明确要求的新开发者能力，不适用非功能改动净增不得大于 0 的约束。
- 增长性质：新增行属于本地双版本构建、增量构建与缓存、真实运行观察、进程清理合同，不进入 shipped runtime 产品链路；production builder 的缓存参数默认关闭。
- 正向减债动作：产品修复删除无人消费的 `NextclawDistribution.packageRoot` 和冗余默认参数，运行包选择重新收敛到 launcher 唯一 owner；验证准备删除重复 baseline production deploy，并直接复用生产 update builder、真实 updater 与 launcher，没有复制签名、下载、安装或版本选择实现。
- 结构收敛：生命周期主干保持在 387 行 harness；artifact preparation 收敛到 330 行 fixture manager；production bundle 主干为 329 行 builder，deployment cache/refresh/prune 收敛到 294 行 manager；参数、清理 watchdog 和无状态命令工具独立落位。所有文件均低于对应预算，最终 maintainability guard 为 0 error、0 warning。
- 质量与可维护性提升证明：以后更新链路可以在发布前被重复、真实地人工验收；产品代码没有增加 dev 特判、第二套版本事实源、平行 updater 或 fallback。
- 为何不是单纯压缩行数：新增生命周期代码均对应实际构建、启动、观察与清理责任；在真实 `Ctrl+C` 复验发现异步清理失效后，才引入独立 watchdog，而不是预先堆防御抽象。
- 后续边界：故障注入或多场景编排不能继续堆入主 harness；fixture manager 只负责开发态候选材料，production deployment cache manager 只负责显式启用的 deploy 模板复用，不能把产品 update 状态机或发布默认行为搬入二者。

## NPM 包发布记录

待统一发布：

- `@nextclaw/service`：本地版本与当前 NPM 已发布版本均为 `0.3.5`；需要 patch 发布，使 self-relaunch 使用 launcher 入口。
- `nextclaw`：本地版本与当前 NPM 已发布版本均为 `0.23.0`；需要 patch 发布，使发行元数据携带正确 launcher 入口并进入 runtime bundle。

已新增 `.changeset/runtime-update-auto-version-switch.md`。本次未执行 NPM publish、runtime update channel 发布或 GitHub release。

本地更新验证命令不新增 changeset：它只服务仓库维护者，不改变最终用户安装包行为；现有 changeset 继续只描述用户会感知的自动版本切换修复。
