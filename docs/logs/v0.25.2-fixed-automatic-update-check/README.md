# v0.25.2 固定周期自动检查更新

## 迭代完成说明

本次把 Desktop 与 NPM runtime 的更新行为统一为固定产品策略：进程启动后按最近一次检查时间计算剩余间隔，此后每两小时自动检查，用户不能关闭；自动检查发现新版本后固定停在 `update-available`，永远不自动下载，只有用户明确点击后才下载和应用。`automaticChecks`、`autoDownload`、整个 `UpdatePreferences` 合同及其配置入口、持久化字段和自动下载分支全部删除。

根因有四层：Desktop 原先用“一小时唤醒、五小时限流”的不一致策略且允许用户关闭；NPM host 只在构造或首次读取状态时检查一次，没有运行期 timer；共享 preference 把产品可靠性策略扩散成跨层持久化合同；NPM 安装态还默认开启 `autoDownload`，使自动检查可能未经用户确认便消耗网络和磁盘。该结论通过端到端检查 Kernel/Shared、Desktop manager/coordinator、NPM host、Server API、SDK、UI 和两个状态文件确认，并由同进程周期发现的真实 smoke 复现，而不是从单个 UI 状态外推。

修复由 Kernel 持有两小时间隔和到期计算的唯一事实，Desktop/NPM 各自在既有生命周期 owner 中管理递归 timer。Desktop 内嵌 runtime 固定禁用第二套 NPM updater，避免双 owner。检查与下载保持单向边界：所有自动检查、手动检查和通道切换都只能更新候选状态，只有显式 `downloadUpdate` 动作能进入下载。旧状态中的整个 `updatePreferences` 读取时被忽略，下一次写入自然移除；旧 HTTP 偏好接口不再存在。

真实 Desktop smoke 还暴露并修复了验证机制的五个长期问题：Electron CommonJS 不能加载整个 ESM Kernel，因此新增窄 CJS 策略子入口；fixture 版本不再硬编码，而是从实际 seed 推导下一个 patch；运行期间隔离并恢复可能陈旧的 release metadata；结束时关闭 relaunch 实例并清理临时资产；临时覆盖仓库 seed bundle 前先备份，成功或失败后均原样恢复。重复 smoke 还捕获了 Desktop/NPM 共通的通道切换竞争：新通道可能复用旧通道的在途检查。两个 host 现在都先等待旧任务收口，再写入新通道并为新通道单独检查。

## 测试/验证/验收方式

- Kernel 自动检查策略：4 项通过，覆盖固定两小时、生产忽略覆盖值、验证模式校验、剩余时间边界。
- NPM runtime update host/manager：19 项通过，覆盖纯 `getState`、显式 start/dispose、同进程周期检查、旧偏好整体迁移、周期检查绝不调用下载，以及通道切换不会复用旧通道的在途检查。
- Desktop coordinator/source：19 项通过，覆盖固定到期检查、旧偏好整体迁移、自动发现只停在 `update-available`、显式下载后等待用户应用、通道切换不自动下载，以及在途检查与新通道检查的串行边界。
- Server 更新接口与 CORS：10 项通过；其中旧 `PUT /api/runtime/update/preferences` 即使发送 `autoDownload:true` 也返回 404，证明配置入口已经删除。
- UI：11 项通过，证明自动检查和自动下载开关均已移除，两小时自动检查、手动下载和手动应用的静态说明存在。
- 七个受影响工作区的 `tsc` 均通过：shared、kernel、service、server、client-sdk、UI、Desktop。
- 受影响 package lint 均无 error；历史 warning 未由本次引入；所有触达的更新验证脚本定向 ESLint 通过。
- `pnpm dev:verify-update -- --no-open --port 56144`：从最终源码构造 `0.23.0-dev.0 -> 0.23.0`，fixture 重建 40.0 秒。同一 PID `63842` 连续两轮自动检查，`lastCheckedAt` 从 `13:18:57` 更新到 `13:19:42`，状态均为 `update-available` 且 `downloadedVersion=null`；显式下载后才进入 `downloaded`，应用后 PID 切到 `78251`，版本和 `current.json` 均为 `0.23.0`。Ctrl+C 后隔离目录和 56144 端口清理完成。
- `pnpm -C apps/desktop smoke:update`：真实 Electron 从 seed `0.20.4` 启动，初次 beta manifest 不存在；同一运行实例在 manifest 发布后自动发现 `0.20.5`，快照为 `update-available` 且 `downloadedVersion=null`；随后 smoke 显式触发下载和应用，切换到 `0.20.5`，再切回 stable 得到 `up-to-date` 且不降级。manifest 验签、窗口 `ready-to-show` / `did-finish-load`、runtime 健康与临时端口清理全部通过；仓库 seed bundle 运行前后 SHA-256 均为 `35172a36c1777c6546c0d1eaa147e68908a848c29e24561a79edc6a408efa60c`。

## 发布/部署方式

本次只完成源码、设计、自动化验证与本地产品级验收，未执行 NPM publish、runtime update channel、Desktop installer/manifest 发布、GitHub release、远程部署或数据库 migration。要交付给用户，需要后续进入统一 NPM 发布和 Desktop 发布闭环；数据库 migration 与独立后端部署不适用。

## 用户/产品视角的验收步骤

1. 保持 Desktop 或 NPM 安装态 NextClaw 连续运行，不执行 restart。
2. 发布一个高于当前版本、且匹配当前 channel/platform/arch 的更新 manifest。
3. 最迟在两小时后确认版本区出现可用更新；用户界面不再提供“关闭自动检查”的开关。
4. 确认系统不会自行下载；只有点击“下载”后才出现下载进度，下载完成后仍等待用户点击应用。
5. 本地开发时运行 `pnpm dev:verify-update`，等待命令报告同 PID 自动发现，再亲自完成下载和应用；无需等待下一次真实发版。

## 可维护性总结汇总

使用 `post-edit-maintainability-guard --non-feature` 对本次策略纠偏的 38 个源码/脚本/测试文件做 scoped 检查：0 error、8 warning；总代码 `+178/-442`、净减 264 行，非测试代码 `+55/-292`、净减 237 行。警告均为既有目录预算或文件接近预算；本次没有新增目录文件，`update-coordinator.service.ts` 反而减少 43 行。`pnpm lint:new-code:governance`、backlog ratchet 与 generated-clean 均通过，唯一提示是已存在的 `npm-runtime-bundle.types.ts` 角色漂移 warning。

本轮最初的运行期调度属于新增用户能力；后续“永不自动下载、删除配置面”按非功能行为收敛执行，并通过删除共享合同、API/IPC/SDK/UI、持久化字段和两条自动下载分支取得真实净减，不靠压行或把复杂度外移。新增的通道竞争保护仍留在两个既有 host owner 内，没有引入 scheduler、adapter 或第二状态源。后续观察位点是 `apps/desktop/scripts/smoke-product-update.mjs` 已到 489 行、`scripts/dev/verify-update.mjs` 为 439 行；若继续扩展场景，应把进程/fixture 编排下沉到现有 update service 子目录，而不是继续拉长顶层脚本。

## NPM 包发布记录

- `@nextclaw/kernel`：需要 patch，新增固定策略与 Desktop 可加载的窄 CJS 子入口；待统一发布。
- `@nextclaw/shared`：需要 patch，删除 `UpdatePreferences` 以及快照中的 `preferences` / `canAutoDownload`；待统一发布。
- `@nextclaw/service`：需要 patch，NPM 安装态新增运行期两小时调度；待统一发布。
- `@nextclaw/server`：需要 patch，删除更新偏好接口；待统一发布。
- `@nextclaw/client-sdk`：需要 patch，删除已退役的 `updatePreferences` 方法和类型导出；待统一发布。
- `@nextclaw/ui`：需要 patch，删除自动检查与自动下载配置，仅保留更新通道选择；待统一发布。
- `nextclaw`：需要 patch，承载 NPM 安装态的完整用户行为与验证产物；待统一发布。
- Desktop 不是本次 NPM 包发布项，但需要随下一次 Desktop installer/launcher 发布才能进入已安装桌面应用。
