# v0.23.12 桌面端后台更新检查

## 迭代完成说明

本次修复桌面端只有重启应用后才会检查更新的问题。

根因是桌面主进程只在 runtime 启动完成后调用一次 `runStartupCheck()`；更新偏好虽然默认开启自动检查，运行期间却没有任何定时器、窗口重新聚焦或系统恢复事件继续触发检查。该结论通过追踪 `apps/desktop/src/main.ts`、`DesktopUpdateManager` 和 `DesktopUpdateCoordinatorService` 的真实调用链确认，不是从 UI 状态推断。

修复后由 `DesktopUpdateManager` 统一拥有运行期间的调度生命周期：启动时立即判断一次，每小时评估一次，并在窗口重新获得焦点或系统恢复时补充评估。`DesktopUpdateCoordinatorService` 拥有产品策略与持久状态判断：距离上次真实检查不足 5 小时时不访问更新源，关闭自动检查时不执行，已有 active promise 继续防止并发重复检查。手动检查、下载与应用链路保持不变。

设置页文案同步从“启动时检查”改为“应用运行期间定期检查”，避免界面合同继续描述旧行为。

## 测试/验证/验收方式

- `pnpm -C apps/desktop lint`：通过。
- `pnpm -C apps/desktop tsc`：通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C apps/desktop build:main`：通过。
- `node --test apps/desktop/dist/src/launcher/__tests__/update-coordinator.service.test.js`：10 项通过；新增用例证明上次检查后 4 小时不重复访问更新源，6 小时时自动检查并持久化时间，关闭自动检查后不再请求。
- `pnpm -C packages/nextclaw-ui test -- src/features/system-status/components/__tests__/desktop-update-config.test.tsx`：4 项通过。
- `post-edit-maintainability-guard --non-feature`：0 error、1 warning；非测试代码 `+89/-89`，净增 `0`。warning 为 coordinator 当前 529 行、仍低于 600 行预算。
- `pnpm lint:new-code:governance` 与 `pnpm check:governance-backlog-ratchet`：通过。
- 未等待真实 5 小时做打包 GUI 长时验收；最小替代证明为同一 coordinator 的可控时钟行为测试、主进程构建以及真实事件接线的类型检查。桌面发布前仍应在打包应用中完成焦点恢复与系统睡眠恢复冒烟。

## 发布/部署方式

本轮只提交源码、测试、用户文案、changeset 与迭代记录；创建 ready PR 后等待维护者合入。未执行自动合并、桌面打包发布、update manifest 发布、部署或数据库 migration。

## 用户/产品视角的验收步骤

1. 保持桌面应用运行并开启“自动检查更新”。
2. 在最近一次检查未满 5 小时时反复切回窗口，确认不会重复访问更新源。
3. 到期后等待每小时调度，或重新聚焦窗口、从系统睡眠恢复，确认无需重启应用即可发现更新。
4. 关闭自动检查并再次触发上述事件，确认后台不再检查；手动“检查更新”仍可正常使用。

## 可维护性总结汇总

- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 口径复核，无阻塞性 maintainability finding。
- 本次属于非功能 bugfix，非测试代码 `+89/-89`、净增 `0`，满足仓库净增长门槛；全部代码与测试合计 `+131/-90`、净增 `41`，增长来自新增回归测试。
- 调度生命周期归桌面 manager，检查频率与持久状态归 coordinator，没有新增第二套 updater、状态源或 fallback。
- 正向减债包括合并重复更新菜单构造、统一简单消息框、复用同一 IPC cleanup owner，并删除只做转发的时钟包装；这些删减抵消了后台调度所需生产代码增长。
- coordinator 当前 529 行，接近但未超过 600 行预算；后续继续增长时，优先把状态转换与持久化编排从更新动作主流程拆开，而不是继续堆分支。
- 文件命名、目录角色、class arrow method 与生命周期 cleanup 均通过现有治理检查。

## NPM 包发布记录

- 本轮未执行 NPM 发布。
- `@nextclaw/ui`：用户可见自动检查说明发生变化，已由 `.changeset/desktop-background-update-checks.md` 记录 patch，待统一发布。
- `@nextclaw/desktop` 为 private 应用包，不通过 NPM Changesets 发布；主进程行为需要随下一次 desktop release 进入安装包和 update channel。
