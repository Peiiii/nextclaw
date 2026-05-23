# Desktop Kernel Branch Refactor Plan

## 背景

桌面 command surface 已经跑通，但上一轮为压住 `main.ts` 体积引入了 `DesktopBundleServicesFactory`，并保留了 `createDesktopCommandSurfaceService()` 这种 create wrapper。它们解决了局部行数问题，却没有符合 kernel 主干/分支架构：主干应该直接持有稳定业务分支，分支应是有闭环的 manager，细分 service/store 由 manager 自己创建和管理。

本轮目标是按 `kernel-branch-owner-architecture` skill，把 desktop 主入口收敛成更像 kernel 的结构，并删除无语义装配壳。

## 成功标准

- `apps/desktop/src` 允许 `managers/` 作为 Electron shell 的一级职责目录。
- 删除 `DesktopBundleServicesFactory`。
- 删除 `createDesktopCommandSurfaceService()`。
- 桌面主干只持有长期 manager 分支，不再把 service/store 平铺成一级装配事实。
- `DesktopBundleManager` 自己持有 update source/service/store/lifecycle，不再由 main 传入一串 `resolveXxx` 函数。
- `DesktopUpdateManager` 直接依赖 `DesktopBundleManager` / `DesktopWindowManager` / `DesktopPresenceService` owner，不再由 main 拆字段、拆回调传递。
- 长期 manager/service owner 在 `DesktopApplication` 创建时确定性创建，不再通过 `ensureXxx()` 随调用顺序懒创建。
- manager 命名和职责符合：
  - manager：业务 branch owner、流程编排、生命周期 owner。
  - service：外部连接、协议适配、IO 协作等细分能力。
  - store：数据存储、缓存、持久化 owner。
- 保持 command surface、runtime bootstrap、update shell、presence、window 行为不变。
- 完成 TypeScript、定向测试、lint、governance、maintainability 验证。

## 设计

### 1. 治理入口

更新 module-structure 规则，让 Electron shell L1 根目录允许：

```text
apps/desktop/src/managers/
```

文件角色规则已经支持 `managers/*.manager.ts`，只需要补 module-structure contract 和测试。

### 2. DesktopBundleManager

新增：

```text
apps/desktop/src/managers/desktop-bundle.manager.ts
```

职责：

- 持有 bundle layout/store/service/lifecycle/update service。
- 创建并持有 `DesktopBundleBootstrapService`。
- 向 update manager 提供 bundle update coordinator 所需的稳定依赖。
- 统一暴露 bundle bootstrap 意图级能力。

它替代 `DesktopBundleServicesFactory`，但不是 factory：它是 desktop bundle 分支 owner。

### 3. DesktopCommandSurfaceManager

将 `DesktopCommandSurfaceService` 重命名/迁移为：

```text
apps/desktop/src/managers/desktop-command-surface.manager.ts
```

职责：

- 从 desktop installation profile 推导 command surface 目录。
- 写入 manifest、POSIX shim、Windows shim。
- 解析 bridge script 和 packaged runtime script。
- 返回 runtime env patch。

删除 `createDesktopCommandSurfaceService()`，主干直接持有并调用 manager。

### 4. Main 主干收敛

`DesktopApplication` 本轮先保留为 Electron 主干，不做大规模拆分为多个 manager，避免一次改动跨太多行为面。

本轮收敛重点：

- 主干持有 `DesktopBundleManager`。
- 主干持有 `DesktopCommandSurfaceManager`。
- 主干在 constructor 中确定性创建长期 owner，包括 window、presence、runtime command、runtime control、update 等分支。
- 新增 `DesktopWindowManager` 持有窗口生命周期，main 不再直接保存 `BrowserWindow`。
- 将 `DesktopUpdateShellService` 迁移为 `DesktopUpdateManager`，对外承接 update IPC、菜单、弹窗与 snapshot 发布，对内直接依赖稳定 owner。
- `DesktopPresenceService` 保留为 presence 细分 service，但窗口动作改为依赖 `DesktopWindowManager`，退出动作直接调用 Electron app 能力。
- 删除所有无语义 create wrapper 和 factory 装配壳。

### 5. 验证

最小充分验证：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop tsc
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec tsx --test ../../apps/desktop/src/managers/desktop-command-surface.manager.test.ts ../../apps/desktop/src/utils/desktop-command-bridge.utils.test.ts ../../apps/desktop/src/services/runtime-process.service.test.ts
PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop lint
PATH=/opt/homebrew/bin:$PATH pnpm lint:new-code:governance
PATH=/opt/homebrew/bin:$PATH pnpm check:governance-backlog-ratchet
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <touched files>
```

如果路径重命名影响 smoke，重跑 command surface smoke。

## 非目标

- 本轮不改变 desktop update 行为。
- 本轮不改变 runtime bundle 更新协议。
- 本轮不改 Linux release smoke；Linux command surface 安装包级闭环单独处理。
- 本轮不把所有 desktop service 都改名为 manager；只有已经具备业务分支 owner 语义的 update/window/command-surface/bundle 进入 `managers/`。
