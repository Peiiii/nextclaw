# v0.25.2 固定周期自动检查更新

## 迭代完成说明

本次把 Desktop 与 NPM runtime 的自动检查统一为固定产品策略：进程启动后按最近一次检查时间计算剩余间隔，此后每两小时自动检查，用户不能关闭，也不再持久化 `automaticChecks`。`autoDownload` 仍是独立用户偏好，原有默认值、配置入口、持久化和检查后自动下载行为保持不变；更新仍不会自动应用。

根因有三层：Desktop 原先用“一小时唤醒、五小时限流”的不一致策略且允许用户关闭；NPM host 只在构造或首次读取状态时检查一次，没有运行期 timer；共享 preference 又把产品可靠性策略和真实用户偏好混在同一个持久化合同里。该结论通过端到端检查 Kernel/Shared、Desktop manager/coordinator、NPM host、Server API、UI 和两个状态文件确认，并由同进程周期发现的真实 smoke 复现，而不是从单个 UI 状态外推。

修复由 Kernel 持有两小时间隔和到期计算的唯一事实，Desktop/NPM 各自在既有生命周期 owner 中管理递归 timer。Desktop 内嵌 runtime 固定禁用第二套 NPM updater，避免双 owner。旧状态里的 `automaticChecks` 读取时被忽略，下一次写入自然移除；HTTP 即使收到旧字段也只投影 `autoDownload`。

真实 Desktop smoke 还暴露并修复了验证机制的四个长期问题：Electron CommonJS 不能加载整个 ESM Kernel，因此新增窄 CJS 策略子入口；fixture 版本不再硬编码，而是从实际 seed 推导下一个 patch；运行期间隔离并恢复可能陈旧的 release metadata；结束时关闭 relaunch 实例并清理临时资产。

## 测试/验证/验收方式

- Kernel 自动检查策略：4 项通过，覆盖固定两小时、生产忽略覆盖值、验证模式校验、剩余时间边界。
- NPM runtime update host/manager：18 项通过，覆盖纯 `getState`、显式 start/dispose、同进程周期检查、旧偏好迁移与自动下载分支。
- Desktop coordinator/source：18 项通过，覆盖固定到期检查、旧偏好迁移、`autoDownload=false/true` 两条路径和通道切换。
- Server 更新接口：3 项通过；额外证明旧请求发送 `automaticChecks:false` 时被忽略，`autoDownload:false` 仍生效。需要本机监听的 Server CORS 7 项在沙箱外通过。
- UI：11 项通过，证明自动检查开关已移除、两小时静态说明存在、自动下载开关保留。
- 七个受影响工作区的 `tsc` 均通过：shared、kernel、service、server、client-sdk、UI、Desktop。
- 受影响 package lint 均无 error；历史 warning 未由本次引入；所有触达的更新验证脚本定向 ESLint 通过。
- `pnpm dev:verify-update -- --no-open --port 56144`：从最终源码构造 `0.23.0-dev.0 -> 0.23.0`。同一 PID `81754` 在 15.4 秒后自动发现 candidate，无 restart、无手动 check；手动下载后 `autoDownload=false` 保持不变，apply 后 PID 切到 `93364`，版本和 `current.json` 均为 `0.23.0`。源码变更后的 fixture 重建为 41.0 秒；紧接着第二次复测命中缓存，准备耗时降到 4.2 秒，同一 PID `4305` 在 15.3 秒后再次自动发现。两次 Ctrl+C 后隔离服务均清理。
- `pnpm -C apps/desktop smoke:update`：真实 Electron 从 seed `0.20.4` 启动，初次 beta manifest 不存在；同一运行实例在 manifest 发布后自动发现 `0.20.5`，保持 `autoDownload=false`，随后下载、apply、relaunch 到 `0.20.5`，切回 stable 不降级。临时目录、seed 副本和后台进程清理完成。

## 发布/部署方式

本次只完成源码、设计、自动化验证与本地产品级验收，未执行 NPM publish、runtime update channel、Desktop installer/manifest 发布、GitHub release、远程部署或数据库 migration。要交付给用户，需要后续进入统一 NPM 发布和 Desktop 发布闭环；数据库 migration 与独立后端部署不适用。

## 用户/产品视角的验收步骤

1. 保持 Desktop 或 NPM 安装态 NextClaw 连续运行，不执行 restart。
2. 发布一个高于当前版本、且匹配当前 channel/platform/arch 的更新 manifest。
3. 最迟在两小时后确认版本区出现可用更新；用户界面不再提供“关闭自动检查”的开关。
4. 关闭“自动后台下载”时只出现下载入口，不自动下载；开启后检查到更新会自动下载，但仍等待用户应用。
5. 本地开发时运行 `pnpm dev:verify-update`，等待命令报告同 PID 自动发现，再亲自完成下载和应用；无需等待下一次真实发版。

## 可维护性总结汇总

使用 `post-edit-maintainability-guard` 对本任务 32 个源码/脚本/测试文件做 scoped 检查：0 error、6 warning；总代码 `+550/-191`、净增 359 行，非测试代码 `+393/-152`、净增 241 行。警告均为既有目录预算或文件接近预算；本次没有新增超预算目录文件，新增的 Kernel 策略是跨宿主唯一事实源，Desktop 通过窄 CJS 子入口复用，不复制两小时间隔。生产 owner 从“构造/getState 隐式触发 + 用户配置”收敛为显式 start/dispose 生命周期；验证 fixture 的版本读取也从三处重复/硬编码收敛到同一个服务。

这是新增用户能力，代码增长来自运行期调度和两个真实产品链路验收，而不是兼容 wrapper 或平行 updater；主观复核未发现新的 owner、抽象或重复链路问题。后续观察位点是 `apps/desktop/scripts/smoke-product-update.mjs` 与 `scripts/dev/verify-update.mjs` 已接近 500 行预算；若继续扩展场景，应把进程/fixture 编排下沉到现有 update service 子目录，而不是继续拉长顶层脚本。

## NPM 包发布记录

- `@nextclaw/kernel`：需要 patch，新增固定策略与 Desktop 可加载的窄 CJS 子入口；待统一发布。
- `@nextclaw/shared`：需要 patch，`UpdatePreferences` 只保留 `autoDownload`；待统一发布。
- `@nextclaw/service`：需要 patch，NPM 安装态新增运行期两小时调度；待统一发布。
- `@nextclaw/server`：需要 patch，偏好接口忽略退役字段；待统一发布。
- `@nextclaw/ui`：需要 patch，移除自动检查开关并保留自动下载配置；待统一发布。
- `nextclaw`：需要 patch，承载 NPM 安装态的完整用户行为与验证产物；待统一发布。
- Desktop 不是本次 NPM 包发布项，但需要随下一次 Desktop installer/launcher 发布才能进入已安装桌面应用。
