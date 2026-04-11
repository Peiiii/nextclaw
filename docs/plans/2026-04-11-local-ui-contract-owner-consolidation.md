# Local UI Contract Owner Consolidation Plan

**Goal:** 把本地 UI 的“启动成功判定 / 发现 / ownership”边界重新收口，做一轮真正的整体性删除，而不是继续在多处状态文件和 fallback 上补分支。

**Problem:** 当前问题域的复杂度不只来自端口探测，而是来自 owner 分裂：

- `service.ts` 负责 `start` 的 preflight / reuse / spawn
- `service.json` 同时被拿来表达 managed ownership 和桌面端启动成功判定
- 桌面端 `runtime-service.ts` 还在自己解析 `service.json`
- `local-ui-discovery.service.ts` 又维护一套本地发现入口

这导致同一事实被多个模块共同解释，修一个地方时很容易另一边没适配。

## 长期目标对齐 / 可维护性推进

- 这次不是新增能力，而是收口 owner、删除重复职责。
- 优先目标不是“保留兼容 + 再补一个分支”，而是删掉一整层不该存在的依赖。
- 这次要完成的最小结构性删减：
  - 删除桌面端对 `service.json` 的读取和解析
  - 删除桌面端基于 `service.json` 的地址推导辅助函数和对应测试
  - 让 `service.json` 回到“只表达 managed ownership”的单一职责

## Recommended Approach

推荐方案：把“`nextclaw start` 成功后，桌面端该访问哪个地址”收敛成**配置目标地址合同**。

- CLI `start` 的合同已经被收敛为：成功返回时，目标 UI 地址健康可达。
- 对桌面端来说，这个目标地址不需要再从 `service.json` 反推，只需要从 `config.json` 的 `ui.port` 推导本地访问地址并做健康检查。
- `service.json` 应继续只服务于 CLI 的 `stop/restart/status` 这类 managed ownership 语义，不能同时充当桌面端的启动真相源。

为什么这是推荐方案：

- 它能直接删掉桌面端一整段状态解析逻辑，而不是把解析逻辑搬去别的文件。
- 它让“成功判定”和“ownership”各回到单一职责，减少后续联动适配面。
- 它比“再抽一个跨包 helper 让桌面也去读 service state”更简单，因为后者只是共享了复杂度，没有删掉复杂度。

## Scope

### 1. 桌面端改为只依赖配置目标地址合同

- 删除 `runtime-service.ts` 中：
  - `ServiceState`
  - `readServiceState()`
  - `resolveManagedUiBaseUrlFromState()`
  - 与 `service.json` 相关的 URL/host/port 解析逻辑
- 保留：
  - `readRuntimeConfig()`
  - `resolveManagedUiBaseUrlFromConfig()`
  - `waitForHealth()`

### 2. CLI 边界保持诚实

- `service.json` 不再承担桌面端成功判定职责，只保留 managed ownership 语义。
- `service.ts` 继续负责 preflight / reuse / spawn，但不再需要照顾桌面端去解析 `service.json`。

### 3. 顺手删掉无价值冗余

- 如果 `local-ui-discovery.service.ts` 中存在已无调用价值的接口，本轮顺手删除。
- 不新增新的中间抽象层；目标是边界更少，而不是文件更多。

## Validation

- `pnpm -C packages/nextclaw test -- --run src/cli/commands/service-support/runtime/tests/service-port-probe.test.ts`
- `pnpm -C packages/nextclaw exec tsx --test ../../apps/desktop/src/runtime-service.test.ts`
- `pnpm -C apps/desktop tsc -p tsconfig.json --noEmit`
- `pnpm -C packages/nextclaw exec eslint src/cli/commands/service.ts src/cli/commands/service-support/runtime/service-port-probe.ts src/cli/runtime-state/local-ui-discovery.service.ts src/cli/utils.ts`
- `pnpm -C apps/desktop exec eslint src/runtime-service.ts src/runtime-service.test.ts`

## Expected Deletion Outcome

- 目标不是把复杂度移动到新 helper，而是让桌面端少一整层状态真相源。
- 若本轮仍有净增，必须主要来自 CLI 合同本身而不是桌面端适配层；桌面端侧应实现净删除。
- 本轮收尾时必须在迭代 README 明确回答：
  - 这次整体删掉了哪一层职责
  - 还有哪一层 owner 尚未完全收口
  - 为什么剩余代码仍是当前最小必要量
