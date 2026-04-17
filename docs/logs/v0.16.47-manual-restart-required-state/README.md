# v0.16.47-manual-restart-required-state

## 迭代完成说明

本次把“配置改动触发自动重启”的行为，收敛成“仅登记待重启，由用户手动触发重启”。

- 配置热重载链路命中 `restartRequired` 时，不再自动调用重启执行器，而是改为登记一条内存态 `pending restart`。
- 新增独立的重启请求 owner 与待重启 store：
  - [runtime-restart-request.service.ts](../../../packages/nextclaw/src/cli/runtime-restart-request.service.ts)
  - [pending-restart.store.ts](../../../packages/nextclaw/src/cli/runtime-state/pending-restart.store.ts)
- `runtime control` 服务端 / 前端契约新增 `pendingRestart` 字段，用于明确告诉 UI“当前有改动待重启”。
- Runtime 页面新增显式的“待重启”提示块：
  - 不会再把“需要重启”藏成自动动作。
  - 会明确说明“系统不会自动重启”“请手动重启”“重启完成后提示自动清空”。
  - 若可判定出具体配置路径，会显示如 `plugins`、`ui` 这类待生效项。
- 左上角品牌区新增轻量状态入口：
  - 圆点挂在版本号右侧，正常为绿色，待重启为黄色。
  - 点击圆点会弹出轻量浮层，展示“待重启”原因与待生效项。
  - 浮层内提供文本式 `立即重启` 动作，不再要求用户先知道要去 `Runtime` 页面。
- 本轮续改进一步补齐了 gateway tool 真实链路：
  - `gateway config.apply` / `config.patch` 不再无条件自动重启。
  - 会先复用现有 reload plan，对支持热应用的配置立即生效。
  - 对热应用之外的配置，返回 `pendingRestart` 合同，并把状态挂到统一的待重启入口。
  - 不再为 `config.apply` / `config.patch` 写出“已重启”的 restart sentinel，也不再返回 `restart.scheduled`.
- 为了避免继续把逻辑堆进 `runtime.ts`，本次顺手把重启请求分发收敛到独立 service，减掉了 `runtime.ts` 的一部分 orchestration 行数。

相关代码：

- [runtime-control-host.service.ts](../../../packages/nextclaw/src/cli/commands/service-support/ui/runtime-control-host.service.ts)
- [service-gateway-context.ts](../../../packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-context.ts)
- [runtime-control-card.tsx](../../../packages/nextclaw-ui/src/components/config/runtime-control-card.tsx)
- [runtime-status-entry.tsx](../../../packages/nextclaw-ui/src/components/layout/runtime-status-entry.tsx)
- [BrandHeader.tsx](../../../packages/nextclaw-ui/src/components/common/BrandHeader.tsx)
- [runtime-control.types.ts](../../../packages/nextclaw-server/src/ui/runtime-control.types.ts)
- [runtime-control.types.ts](../../../packages/nextclaw-ui/src/api/runtime-control.types.ts)

## 测试 / 验证 / 验收方式

已执行：

```bash
pnpm -C packages/nextclaw exec vitest run src/cli/gateway/controller.test.ts src/cli/gateway/manual-restart-contract.integration.test.ts src/cli/commands/service-support/ui/tests/runtime-control-host.service.test.ts
pnpm -C packages/nextclaw exec vitest run src/cli/commands/service-support/ui/tests/runtime-control-host.service.test.ts
pnpm -C packages/nextclaw-ui exec vitest run src/components/config/runtime-control-card.test.tsx
pnpm -C packages/nextclaw-ui exec vitest run src/components/layout/runtime-status-entry.test.tsx src/components/layout/sidebar.layout.test.tsx
pnpm -C packages/nextclaw-core exec tsc -p tsconfig.json --noEmit
pnpm -C packages/nextclaw exec tsc -p tsconfig.json --noEmit
pnpm -C packages/nextclaw-ui exec tsc -p tsconfig.json --noEmit
pnpm lint:maintainability:guard
```

结果：

- `controller.test.ts` 通过，确认 gateway config 写入会复用 reload plan，不再直接自动重启。
- `manual-restart-contract.integration.test.ts` 通过，确认真实链路已收口为：
  - `GatewayTool.execute("config.get")`
  - `GatewayTool.execute("config.patch")`
  - `GatewayControllerImpl`
  - `ConfigReloader.applyReloadPlan`
  - `RuntimeRestartRequestService`
  - `pendingRestartStore`
  并验证：
  - `agents.context.bootstrap.perFileChars` 这类支持热应用的配置不会自动重启，也不会进入待重启
  - `remote.deviceName` 这类热应用之外的配置不会自动重启，而是进入待重启
  - 显式执行 `gateway restart` 后待重启状态会清空
- `runtime-control-host.service.test.ts` 通过，确认后端会暴露 `pendingRestart`，而不是收到配置变更后直接自动重启。
- `runtime-control-card.test.tsx` 通过，确认 Runtime 页面会显示“待重启”提示和待生效项。
- `runtime-status-entry.test.tsx` 与 `sidebar.layout.test.tsx` 通过，确认左上角版本号右侧的状态圆点可打开轻量浮层，并展示待重启原因与 `立即重启` 动作。
- `packages/nextclaw-core` 的 `tsc --noEmit` 通过。
- `packages/nextclaw` 的 `tsc --noEmit` 通过。
- `packages/nextclaw-ui` 的 `tsc --noEmit` 通过。
- `pnpm lint:maintainability:guard` 未完全通过，但本次新增 error 已清零。
  - 当前阻断点来自工作区中与本次无关的其它已修改文件：
    - `packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.service.ts`
    - `packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.test.ts`
  - 本次状态入口相关的新目录预算问题已收敛；剩余报红不属于本次这组改动引入。

## 发布 / 部署方式

本次未执行独立发布。

- Web / Desktop 只要带上当前代码即可获得新行为。
- 无需额外迁移数据；`pending restart` 为进程内状态，重启后天然清空。

## 用户 / 产品视角的验收步骤

1. 打开 NextClaw 的配置页面，修改一项会命中 `restartRequired` 的配置，例如 `plugins` 或 `ui` 相关配置。
2. 保存配置。
3. 验收标准一：系统不会自动重启服务或应用。
4. 观察左上角品牌区，确认版本号右侧出现黄色状态圆点。
5. 点击该圆点。
6. 验收标准二：弹出轻量浮层，显示“待重启”、待生效项原因，以及文本式 `立即重启` 动作。
7. 点击 `立即重启`（或继续进入 `Runtime` 页面点击重启动作）。
8. 验收标准三：重启完成后，状态圆点恢复正常，待重启提示自动消失。

补充一条 gateway tool 验收：

1. 先执行 `gateway config.get` 读取当前 hash。
2. 对一个支持热应用的低风险字段执行 `gateway config.patch`，例如 `agents.context.bootstrap.perFileChars`。
3. 验收标准一：返回结果显示配置已保存并立即生效，不会自动重启，也不会进入待重启。
4. 再对一个热应用之外的低风险字段执行 `gateway config.patch`，例如 `remote.deviceName`。
5. 验收标准二：返回结果包含 `pendingRestart`，系统不会自动重启，左上角状态圆点出现待重启提示。
6. 手动执行重启。
7. 验收标准三：待重启状态被清空。

## 可维护性总结汇总

### 长期目标对齐 / 可维护性推进

是。

这次改动顺着 `docs/VISION.md` 里“统一入口、统一体验、足够可靠、自治但保留明确确认机制”的方向推进了一步。相比让系统在配置变更后偷偷替用户做决定，“显式待重启 + 用户手动确认”更符合可理解、可预测、可掌控的产品契约。

### 可维护性复核结论

保留债务经说明接受。

本次没有继续把“待重启”逻辑叠加进现有大文件，而是新增了独立的 request service 与 state store；同时把 `runtime.ts` 净减 21 行。gateway 续改阶段也没有再补一套独立的“哪些配置需要重启”判断，而是直接复用现有 reload plan，避免 UI / CLI / gateway 再次分叉。状态入口本身也没有继续堆到 `BrandHeader` 里，而是保持为独立的 layout 组件。当前守卫报红来自工作区里其它不相关改动，不是本次状态入口新增的结构性退化。

### 本次顺手减债

是。

新增逻辑没有直接堆回 `runtime.ts`，而是拆到独立 owner：

- `RuntimeRestartRequestService`
- `PendingRestartStore`

gateway 续改里则顺手删除了 `config.apply` / `config.patch` 里“保存后直接 requestRestart + 返回 restart.scheduled”的旧分支语义，改为统一走 reload plan。

### 本次是否已尽最大努力优化可维护性

是。

在不扩散需求范围的前提下，本次已经把“待重启 vs 执行重启”的语义分开，并避免让 `runtime.ts` 继续膨胀。若继续为通过治理守卫而重命名一串核心旧文件，收益与风险明显失衡，不适合作为本次顺手动作。

### 是否优先遵循删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好的原则

是。

虽然总代码净增长，但增长主要是为了把“自动重启”从隐式副作用改成显式状态合同，并补上 gateway tool 这条真实入口的回归保护。与此同时，本次删除了 `config.apply` / `config.patch` 里旧的“无条件自动重启 + restart.scheduled”语义，用统一 reload plan 替代继续追加特殊分支。

### 代码增减报告

- 新增：414 行
- 删除：32 行
- 净增：+382 行

说明：新增主要来自 `pending restart` 契约、独立 state/service owner、gateway 真实链路集成保护，以及左上角轻量状态入口与对应测试。

### 非测试代码增减报告

- 新增：275 行
- 删除：32 行
- 净增：+243 行

说明：非测试净增长主要是新增了 `RuntimeRestartRequestService`、`PendingRestartStore`、`RuntimeStatusEntry`，以及 UI / API / server 的 `pendingRestart` 合同字段。gateway 续改本身尽量保持为“删旧语义 + 复用 reload plan + 补少量合同代码”，没有再复制第二套路径判定。该增长已经是把行为从“自动动作”改为“显式状态 + 全局可见入口”所需的最小必要集。

### 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化

部分做到。

- `runtime.ts` 行数下降了。
- 但新增了 2 个非测试 owner 文件，所以 `packages/nextclaw/src/cli` 目录平铺度有小幅上升。
- 这次接受该增长，是因为它换来了更清晰的职责边界，并阻止“自动重启”逻辑继续散落在运行时主入口里。

### 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加

是。

- `RuntimeRestartRequestService` 负责“执行重启 vs 仅登记待重启”的分发。
- `PendingRestartStore` 负责待重启状态 owner。
- `RuntimeControlHost` 只负责把该状态投影给 UI。
- `RuntimeControlCard` 只负责产品展示。
- `RuntimeStatusEntry` 负责左上角品牌区的轻量状态入口。

这比继续把逻辑堆在 `runtime.ts` 或直接在 UI 里拼凑提示更清晰。

### 目录结构与文件组织是否满足当前项目治理要求

部分满足。

- 新增文件名全部遵循 kebab-case，且新增 owner 使用明确角色后缀。
- 但本次必须触达的若干历史核心文件本身不满足当前角色边界治理，导致守卫仍阻断；具体见上面的守卫结果。
- 本次未处理这些历史文件的系统性重命名，下一步整理入口应是一次独立的 CLI / config / governance debt 收敛迭代，而不是在这个行为修复里顺手推进。
