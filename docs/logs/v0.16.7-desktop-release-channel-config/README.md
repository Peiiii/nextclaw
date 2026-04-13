# v0.16.7-desktop-release-channel-config

## 迭代完成说明

本次把桌面端已有但底层化的 `stable | beta` 更新能力，正式收敛成了用户可配置的 `Release channel` 产品能力，并补齐了真实可下载、可应用的升级验证链路。

- 新增方案设计文档：[桌面端 Release Channel 配置设计](../../plans/2026-04-13-desktop-release-channel-config-design.md)
- 桌面端更新状态新增 `channel`，并通过 launcher state 持久化
- 更新源解析改为优先读取应用内已持久化的 channel，其次才回退到打包 metadata / env override
- 设置页新增 `Release channel` 选择器、当前通道展示、Beta 风险提示，以及“切回 Stable 不会强制降级”的说明
- 主进程 / preload / renderer bridge 新增切换通道能力
- 切换通道后会立即刷新一次更新状态，但显式禁止借这次切换自动后台下载
- 切换通道时会清理旧通道遗留的“已下载待应用”状态，避免把错误通道的更新继续应用
- 新增 `apps/desktop/scripts/smoke-product-update.mjs`，可在本地真实完成“检查更新 -> 下载更新 -> 应用更新 -> 重启后确认版本变化 -> 切回 stable 验证不降级”的整链路 smoke
- 新增 `apps/desktop/scripts/prepare-manual-update-validation.mjs` 与 `apps/desktop/scripts/run-local-update-server.mjs`，可生成一套给人工验收用的本地验证目录，里面直接包含验证版 `.app`、本地更新源、启动脚本与重置脚本
- 更新源额外支持 `NEXTCLAW_DESKTOP_UPDATE_MANIFEST_BASE_URL`，用于本地 channel-aware 更新源与真实冒烟
- 为了让真实 Electron 运行时的 preload bridge 可用，本次窗口配置暂时改为 `sandbox: false`

## 测试/验证/验收方式

本次已真实执行并通过：

- `pnpm -C apps/desktop smoke:update`
- `pnpm -C apps/desktop validation:prepare-manual-update`
- `pnpm -C apps/desktop tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui exec vitest run src/components/config/desktop-update-config.test.tsx`
- `node --test apps/desktop/dist/src/services/desktop-update-source.service.test.js apps/desktop/dist/src/launcher/__tests__/update-coordinator.service.test.js`

其中最关键的真实升级冒烟结果如下：

- 以已安装桌面版自带的稳定 seed bundle 启动，初始版本为 `0.17.7`
- 在 `stable` 通道执行真实检查更新，结果为 `up-to-date`
- 切到 `beta` 通道后执行真实检查更新，发现可更新版本 `0.17.11`
- 真实下载更新成功，状态进入 `downloaded`，下载版本为 `0.17.11`
- 真实应用更新并重启后，当前版本从 `0.17.7` 变为 `0.17.11`
- 再切回 `stable` 后，当前版本保持 `0.17.11`，状态仍为 `up-to-date`，没有发生强制降级

额外说明：

- 本次真实验证不是只切换通道，而是完整跑通了“检查、下载、应用、重启后确认版本”的真实桌面升级链路
- `validation:prepare-manual-update` 已真实生成本地人工验收目录：`apps/desktop/.local/manual-update-validation`
- 生成目录中包含 `1-start-local-update-server.command`、`2-open-validation-app.command`、`3-reset-validation-state.command` 与验证版 `NextClaw Desktop.app`，可供产品/用户本人亲手点击验证
- `pnpm lint:maintainability:guard` 本次尝试执行，但当前仓库的 `lint:new-code:governance` 仍指向缺失的 `scripts/lint-new-code-governance.mjs`；这是工作区现存治理脚本断链，不是本次桌面更新链路的真实升级失败

## 发布/部署方式

本次未直接发布。

如需随桌面端版本发布，按现有标准流程执行：

- `pnpm -C packages/nextclaw-ui build`
- `pnpm -C apps/desktop dist`

如需本地复验真实更新链路，可直接执行：

- `pnpm -C apps/desktop smoke:update`
- `pnpm -C apps/desktop validation:prepare-manual-update`

## 用户/产品视角的验收步骤

1. 打开 NextClaw Desktop，进入“设置 > 桌面端更新”。
2. 确认页面展示“当前更新通道”与 `Release channel` 选择器。
3. 保持 `Stable`，执行“检查更新”，确认当前版本保持稳定版且结果为“已是最新”。
4. 切换到 `Beta`，再次执行“检查更新”，确认页面出现新的可用 Beta 版本。
5. 执行下载，确认状态进入“已下载，等待应用”。
6. 执行应用更新并重启，确认应用重新启动后当前版本已经提升到新的 Beta 版本。
7. 再切回 `Stable`，确认不会立刻被强制降级；只有当稳定通道版本追平或超过当前版本后，才会继续收到 Stable 更新。

如需由产品/用户本人在本机直接手动验证，可使用：

1. 运行 `pnpm -C apps/desktop validation:prepare-manual-update`。
2. 打开 `apps/desktop/.local/manual-update-validation/1-start-local-update-server.command`。
3. 如需从稳定起点重测，先执行 `apps/desktop/.local/manual-update-validation/3-reset-validation-state.command`。
4. 打开 `apps/desktop/.local/manual-update-validation/2-open-validation-app.command`。
5. 在验证版桌面端里按上面的 stable -> beta -> apply -> switch back stable 流程亲手点击验收。

## 可维护性总结汇总

### 可维护性复核结论

- 可维护性复核结论：保留债务经说明接受
- 本次顺手减债：是

### 长期目标对齐 / 可维护性推进

- 是，本次沿着“同一桌面应用内用单一更新体系承载 stable / beta，而不是拆第二个 Beta App”的方向推进了一步
- 本次新增的真实升级冒烟没有另起一套临时更新实现，而是直接复用当前主进程、launcher state、bundle、manifest 与 bridge 链路，验证的是用户真实会走到的那条路径
- 这次仍有净增长，但增长主要用于把既有底层通道能力产品化，并把真实升级验证补齐到可重复执行；没有为了验证再堆一套只在测试里存在的并行机制

### 代码增减报告

- 新增：1324 行
- 删除：49 行
- 净增：+1275 行

说明：

- 该统计覆盖本次任务的源码、测试、真实 smoke 脚本与设计/迭代文档改动

### 非测试代码增减报告

- 新增：1035 行
- 删除：44 行
- 净增：+991 行

说明：

- 该统计排除了 `*.test.*` 与 `__tests__/` 后的实现、脚本与文档改动
- 这部分净增长主要来自 channel 持久化、UI 配置入口、更新源解析、IPC/bridge、以及真实升级 smoke 脚本
- 在接受这部分增长前，已经优先复用现有 `DesktopLauncherStateStore`、`DesktopUpdateSourceService`、`DesktopUpdateCoordinatorService`、`DesktopUpdateShellService` 与现有更新页，没有再引入第二套桌面应用、第二套更新系统或第二套产品入口

### 可维护性 findings

1. `apps/desktop/src/main.ts` 当前为了让真实 Electron 运行里的 preload bridge 正常可用，先接受了 `sandbox: false`
   这让真实升级链路得以跑通，但它是一笔明确的产品壳层债务；后续如果要恢复 `sandbox: true`，更合理的修法是把 preload 改成稳定的单文件 bundle，而不是继续叠补丁
2. `apps/desktop/scripts/smoke-product-update.mjs` 现在同时承担 seed bundle 准备、本地更新源搭建、Electron 启动、CDP 驱动与状态断言
   目前它仍是本次最小可行、可重复执行的真实 smoke，但如果后续再扩展更多更新场景，应把 bundle 构造、服务器、桌面控制与断言拆成更清晰的小模块
3. `apps/desktop/scripts/prepare-manual-update-validation.mjs` 当前还承担了本地人工验收包的资源准备、签名素材注入、打包与验收脚本生成
   这能最快把“开发验证”变成“产品本人可手测”的交付物，但如果未来人工验收场景继续扩展，应再把打包资源准备与验证目录生成拆开

### 结构与职责判断

- 抽象与模块边界仍然清晰：`channel` 的持久化 owner 仍是 launcher state；更新源选择 owner 仍是 `DesktopUpdateSourceService`；切换后的状态刷新 owner 仍是 `DesktopUpdateCoordinatorService`
- React 层只新增展示与事件转发，没有把通道切换、状态清理或下载/应用编排塞进组件
- 本次真实 smoke 直接驱动既有桌面更新主链路，而不是新增只服务测试的替身实现

### 是否已尽最大努力优化可维护性

- 是
- 当前仍需继续观察的 seam 主要有两个：一是 preload / sandbox 的恢复路径，二是真实更新 smoke 脚本在未来继续膨胀前尽早拆分
