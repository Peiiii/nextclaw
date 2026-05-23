# v0.19.18 Desktop Kernel Branch Refactor

## 迭代完成说明

本轮按 `kernel-branch-owner-architecture` 收敛 desktop main 的主干/分支关系：

- 新增 `apps/desktop/src/managers/` 作为 Electron shell 的稳定 manager 根目录，并更新 module-structure 治理契约。
- 删除 `DesktopBundleServicesFactory`，改为 `DesktopBundleManager` 直接持有 bundle layout/state store/service/lifecycle/update source/update service/bootstrap。
- 将 command surface 迁移为 `DesktopCommandSurfaceManager`，删除 `createDesktopCommandSurfaceService()`。
- 将 update shell 迁移为 `DesktopUpdateManager`，由它直接依赖 `DesktopBundleManager`、`DesktopWindowManager`、`DesktopPresenceService`。
- 新增 `DesktopWindowManager` 持有 BrowserWindow 生命周期，main 不再直接散落窗口状态。
- 收紧 `DesktopBundleBootstrapService`，删除私有 `createXxx` fallback，只消费 bundle manager 提供的真实协作者。
- 将 desktop main 的长期 owner 从 `ensureXxx()` 懒创建改为 constructor 阶段确定性创建，仅保留 command surface 运行结果缓存。

## 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop tsc`：通过。
- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop lint`：通过。
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec tsx --test ../../apps/desktop/src/managers/desktop-command-surface.manager.test.ts ../../apps/desktop/src/utils/desktop-command-bridge.utils.test.ts ../../apps/desktop/src/services/runtime-process.service.test.ts ../../apps/desktop/src/services/desktop-bundle-bootstrap.service.test.ts ../../apps/desktop/src/launcher/__tests__/update-coordinator.service.test.ts ../../apps/desktop/src/services/desktop-runtime-command.service.test.ts`：通过，25 项测试通过。
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec tsx --test ../../apps/desktop/src/launcher/__tests__/update-coordinator.service.test.ts ../../apps/desktop/src/services/desktop-bundle-bootstrap.service.test.ts`：通过，16 项测试通过。
- `PATH=/opt/homebrew/bin:$PATH pnpm lint:new-code:governance`：通过。
- `PATH=/opt/homebrew/bin:$PATH pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：通过。

## 发布/部署方式

本轮未发布。改动为 desktop main 端源码、测试和治理契约重构；需要随下一次 desktop 构建/发布进入包体。

## 用户/产品视角的验收步骤

- 桌面启动后应仍能完成 bundle bootstrap、runtime 启动和窗口加载。
- 桌面 update 菜单、IPC 查询、下载、应用更新路径保持原行为。
- AI command tool 环境仍能通过 command surface 命中桌面安装提供的 `nextclaw` 命令。

## 可维护性总结汇总

- 本轮是非功能重构，非测试代码净变化为 `+435 / -454 / net -19`，满足非功能改动净增长门槛。
- 删除了无语义 factory/create wrapper，减少 main 对内部 service/store 的平铺依赖。
- manager/store/service 归属更清晰：main 持有业务分支 manager，manager 持有自己的 service/store 协作者。
- maintainability guard 通过；保留两个接近预算的警告：`update-coordinator.service.ts` 接近 600 行预算，`lint-new-code-module-structure.test.mjs` 接近 900 行预算。

## NPM 包发布记录

不涉及 NPM 包发布。
