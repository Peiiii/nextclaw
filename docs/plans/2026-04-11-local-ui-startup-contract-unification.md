# Local UI Startup Contract Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把本地 UI 的“发现 / 复用 / 启动”收敛成统一合同，修复 MAS 桌面端与 CLI 对健康现有实例识别不一致的问题，并顺手删除上一版依赖 CLI 文本输出的临时桥接。

**Architecture:** 以“`nextclaw start` 成功后，目标 UI 一定在目标地址健康可达”为唯一启动合同。CLI 侧把目标端口判断收敛为显式三态：可直接启动、可复用现有健康实例、必须失败。桌面端不再猜 `service.json` 或解析 `UI:` 文本，而是根据同一目标地址合同等待健康状态。

**Tech Stack:** TypeScript、Node.js、Electron、NextClaw CLI runtime、`@nextclaw/core` 配置/路径工具、Vitest、Node test。

---

## 长期目标对齐 / 可维护性推进

- 本次不是新增用户能力，而是修复统一入口的运行态一致性问题；默认目标应是减少分叉判断、减少状态真相源漂移，而不是继续补一层 incident-specific fallback。
- 这次优先推进的最小维护性改进：
  - 删除桌面端对 CLI 稳定输出文本的解析桥接
  - 把“目标 UI 本地地址”的求值收敛成可复用 helper
  - 让 `service.ts` 的启动前判断更多委托给 runtime-support 辅助模块，避免主命令继续膨胀
- 如果本次仍有净增代码，必须让增长集中在“统一合同”和“共享 helper”，而不是再新增一套并行状态分支。

### Task 1: 明确本地 UI 目标地址的共享合同

**Files:**
- Modify: `packages/nextclaw-core/src/utils/helpers.ts`
- Modify: `packages/nextclaw-core/src/index.ts`
- Modify: `packages/nextclaw/src/cli/utils.ts`
- Test: `apps/desktop/src/runtime-service.test.ts`

**Step 1: 在 core 中新增纯函数 helper**

- 新增一个纯函数，负责把 `ui.host/ui.port` 转成“本机客户端应该访问的 UI origin”。
- 规则：
  - `0.0.0.0` / `::` / `localhost` / `127.0.0.1` 统一收敛到 `http://127.0.0.1:<port>`
  - 其他显式 host 保持原样
- 这是共享合同，不允许桌面端和 CLI 各自复制一套 host 归一化逻辑。

**Step 2: 让 CLI utils 复用该 helper**

- `packages/nextclaw/src/cli/utils.ts` 里的 `resolveUiApiBase` 改为调用 core helper，而不是保留本地复制实现。

**Step 3: 为桌面端后续复用准备测试位点**

- `apps/desktop/src/runtime-service.test.ts` 保留和补充针对“目标 UI 地址解析”的纯函数测试。

### Task 2: 把 CLI start 的目标端口判断收敛为单一合同

**Files:**
- Modify: `packages/nextclaw/src/cli/commands/service-support/runtime/service-port-probe.ts`
- Modify: `packages/nextclaw/src/cli/commands/service-support/runtime/tests/service-port-probe.test.ts`
- Modify: `packages/nextclaw/src/cli/commands/service.ts`

**Step 1: 让 runtime-support 模块提供三态判断**

- 保留 `inspectUiTarget(...)` 作为统一探测入口，明确只返回三态：
  - `available`
  - `healthy-existing`
  - `occupied-unhealthy`
- 禁止在 `service.ts` 里再写第二套 bind + health 组合判断。

**Step 2: 让 `startService` 依赖这份三态合同**

- `available`：继续 spawn 托管后台
- `healthy-existing`：把 `start` 视为幂等成功，直接复用现有健康实例
- `occupied-unhealthy`：继续失败

**Step 3: 保持 stop/restart 语义诚实**

- 对 `healthy-existing` 的复用必须显式提示“当前实例未受 managed state 控制”，不要伪装成已经纳入托管。
- 不允许为了让桌面“看起来启动成功”而偷偷改写 `service.json` 冒充 managed ownership。

### Task 3: 删掉桌面端解析 CLI 输出的临时桥接

**Files:**
- Modify: `apps/desktop/src/runtime-service.ts`
- Modify: `apps/desktop/src/runtime-service.test.ts`

**Step 1: 让桌面端改为依赖启动合同而不是文本输出**

- `RuntimeServiceProcess.startManagedService()` 在执行 `nextclaw start` 成功后，先看 `service.json`。
- 如果 `service.json` 缺失，不再解析 `UI:` 文本输出。
- 改为根据共享 helper + 当前配置求出“目标 UI 地址”，然后等待健康检查。

**Step 2: 保持行为可预测**

- 桌面端允许的 fallback 只有一个：
  - `start` 成功但 managed state 缺失时，按统一目标地址合同等待健康
- 不允许再保留 incident-specific 的 stdout/stderr 文本识别逻辑。

**Step 3: 用测试固定该合同**

- 测试应覆盖：
  - 从配置求出的本地目标地址正确
  - `service.json` 缺失时仍能依赖目标地址合同工作
- 删除或替换上一版对 CLI 文本输出解析的测试。

### Task 4: 验证、可维护性复核、迭代留痕

**Files:**
- Modify: `docs/logs/v0.15.89-desktop-unmanaged-ui-port-reuse/README.md`

**Step 1: 运行最小充分验证**

- Run: `pnpm -C packages/nextclaw test -- --run src/cli/commands/service-support/runtime/tests/service-port-probe.test.ts`
- Run: `pnpm -C apps/desktop tsc -p tsconfig.json --noEmit`
- 如可行，运行桌面测试对应的可执行命令

**Step 2: 做一次独立维护性复核**

- 明确回答：
  - 这次删掉了什么
  - 还没删掉什么
  - 为什么剩余增长仍属最小必要
  - 下一步最值得继续拆哪条 seam

**Step 3: 更新同批次迭代记录**

- 本次仍属于 `v0.15.89-desktop-unmanaged-ui-port-reuse` 的连续收尾，不新建新迭代目录。
- README 必须更新为最终方案，而不是继续保留“解析 CLI 输出”的过渡设计描述。
