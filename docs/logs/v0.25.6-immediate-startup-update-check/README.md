# v0.25.6 启动立即检查更新

## 迭代完成说明

本次纠正 Desktop 与 NPM runtime 的自动更新调度：每次进程启动或重启都会立即检查一次，之后由唯一 timer 每两小时检查；手动检查和切换通道仍立即执行，并从动作结束后重新安排 timer。`lastUpdateCheckAt` 只保留为展示和诊断事实，不再参与检查资格判断；自动检查仍不会下载、应用或重启。

根因是此前把“两小时运行期调度”和“基于持久化时间戳的检查节流”叠加成两套控制逻辑。检查开始前写入的 `lastUpdateCheckAt` 即使对应一次网络失败，也会让重启后的新进程误判为近期已完成检查并跳过请求。真实日志中的 TLS 失败、状态文件时间戳和重启后 `idle` 快照共同确认了该链路。

修复直接删除两个宿主对剩余延迟的读取与判断：NPM host 启动后直接进入现有 `startCheck`，Desktop manager 启动后直接进入 coordinator 的检查主路径；timer 固定在检查结束两小时后再次触发。桌面端同时删除窗口聚焦和系统恢复监听，避免移除节流后产生高频请求；并发请求继续由已有 active task/promise 合并。公开 Kernel 延迟函数为避免 patch 版本破坏外部调用方暂时保留，但产品运行路径不再使用。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-service exec vitest run src/services/runtime/npm-runtime-update-host.service.test.ts`：8 项通过；在 `lastUpdateCheckAt` 为当前时间时，`start()` 仍立即检查，之后按注入间隔再次检查，且不调用下载。
- `env TMPDIR=/tmp pnpm -C packages/nextclaw-service exec tsx --test ../../apps/desktop/src/launcher/__tests__/update-coordinator.service.test.ts`：12 项通过；最近一小时已有检查记录时，自动入口仍立即检查，且自动检查永不下载。
- `pnpm -C packages/nextclaw-service tsc`、`pnpm -C apps/desktop tsc`：均通过。
- `pnpm -C packages/nextclaw-service lint`：0 error、9 个既有 warning；触达文件无 warning。`pnpm -C apps/desktop lint`：通过。
- `pnpm -C apps/desktop smoke:update`：通过。隔离 Electron 以 `0.20.4` 启动后立即检查，随后同一运行实例自动发现 `0.20.5`，状态为 `update-available` 且未自动下载；显式下载后进入 `downloaded`，应用后切换到 `0.20.5`，再切回 stable 得到 `up-to-date`。临时 runtime、端口和更新资产均由 smoke 清理。
- `pnpm dev:verify-update`：已执行，但隔离 fixture 构建在进入检查/下载/apply 前被打包环境阻断。首次缺少全局 pnpm store 中的 `express-rate-limit@8.6.0` 且 registry TLS 重置；改用已补齐的项目 store 后，构建工具仍错误报告已存在的 `packages/nextclaw-core/dist/skills` 缺失。NPM runtime 完整功能冒烟未完成，Host 定向生命周期测试是本轮最贴近链路的替代证明。

## 发布/部署方式

本次完成源码、测试、设计与发布说明准备，尚未执行 commit、NPM publish、runtime update channel、Desktop installer/manifest 发布或 GitHub release。数据库 migration、后端部署不适用。NPM 安装态需要后续发布新的 `nextclaw` patch 与 stable runtime；桌面端需要随下一次 Desktop 发布交付。

## 用户/产品视角的验收步骤

1. 安装低于最新版本的 NextClaw，并确保状态文件中存在近期 `lastUpdateCheckAt`。
2. 启动或重启 NextClaw，确认更新页无需等待两小时即可出现最新版本或新的检查时间。
3. 保持进程运行，确认后续仍按两小时周期检查。
4. 确认检查只显示可用版本，不会自动下载、应用或重启。
5. 连续触发检查时确认同一时刻只执行一个在途请求。

## 可维护性总结汇总

本次是非新增能力修复，生产逻辑通过删除时间戳节流、剩余延迟计算调用和 Desktop 聚焦/恢复监听收敛为单一生命周期调度。未新增 owner、helper、wrapper、状态源或兼容分支；公开 helper 仅因已发布 API 兼容保留。

`post-edit-maintainability-guard --non-feature` 检查 5 个触达代码文件：0 error、1 个既有目录预算 warning；总代码 `+18/-67`、净减 49 行，非测试代码 `+14/-60`、净减 46 行。正向减债动作是删除重复调度判断、事件监听和参数传递，不是压缩表达式或把复杂度移出统计范围。`pnpm lint:new-code:governance`、backlog ratchet 与 generated-clean 均通过。`packages/nextclaw-service/src/services/runtime` 仍有 15 个直接代码文件且缺少目录豁免，但本次文件数未增长；后续若继续扩展，应按 bundle、update、managed-service 生命周期拆分子目录。

## NPM 包发布记录

- `@nextclaw/service`：当前工作区版本 `0.3.10`，需要 patch，包含 NPM runtime 启动立即检查与固定 timer 调度；尚未发布，待统一发布。
- `nextclaw`：当前已发布版本 `0.25.3`，需要 patch，向 NPM 安装用户交付修复后的 runtime 行为；尚未发布，待统一发布。
- Desktop：当前工作区 launcher 版本 `0.0.226`，不是 NPM 发布项；本次修复尚未发布，需要随下一次 Desktop installer/launcher 发布。
