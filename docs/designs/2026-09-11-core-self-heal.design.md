# 最小核心自愈服务（PR-3）设计

> 日期：2026-09-11
> 上位方向：[最小核心（阿米巴模型）设计](./2026-09-06-core-minimum-amoeba-model.design.md)（wip 分支）
> 前置：PR-1 `2026-09-10-core-health-check-contract.design.md`（core-health 契约）；PR-2 `2026-09-10-core-degrade-switch.design.md`（降级开关）
> 状态：设计完成

## 1. 闭环定位（环节③④）

```
① 感知（PR-1：coreHealth 快照）     ✓ 已合并
  │
② 降级（PR-2：autoDegrade 开关）   ✓ 已合并
  │
③ 排查（本 PR：心跳计时 + 连续失败定位故障部件）
  │
④ 修部件（本 PR：按检查 id 执行修复动作）
  │
⑤ 调优（PR-4：快照历史 → 自动调整运行参数）
```

**输入**：PR-1 的 `CoreHealthCheckService.evaluate()` 快照 + 既有 config。
**输出**：`CoreSelfHealStatus`（状态机 + 修复记录），暴露给 `/api/health` 和 `nextclaw status`。
**消费方**：`/api/health`（可观测）、`nextclaw status`（人工诊断）、PR-4（历史数据，暂不实现）。

## 2. 目标与范围

### 最小完整结果

kernel 提供 `coreSelfHeal` 能力：周期性调用 `evaluate()` 快照、按检查 id 记录连续失败次数、超过阈值时执行修复动作（配置重载 / 目录创建）；修复动作有速率限制（最多 3 次/小时）；状态机暴露给 `/api/health` 供 `nextclaw status` 可观测。

### 非目标

- **进程级重启**：进程重启是 service 层（daemon shell）的 owner，kernel 无法自行重启自身。本 PR 不触发进程重启；修复失败后保持 degraded，由 PR-2 的降级开关保证最小核心继续运行。
- **精细部件→功能映射**：PR-2 已确定"核心不健康就整体关停外部能力"的规则；更细粒度的映射留待 PR-3 积累真实故障分布后再扩展（加映射，不加机制）。
- **历史快照持久化**：PR-4 的 owner，本 PR 不引入磁盘存储。
- **UI 展示**：当前无消费者；展示归 UI 侧需求驱动。
- **doctor 接入**：`nextclaw doctor` 改为消费 kernel 契约是后续优化，本 PR 不动 doctor。
- **provider 连通性探测**：网络往返有副作用和超时语义，不属于"核心部件可用"判定。

## 3. 设计

### 3.1 状态机

```
           ┌─────────── evaluate() ───────────┐
           │                                  │
           ▼                                  ▼
    healthy (所有检查通过)            failing (任一检查连续失败)
       │                                  │
       │ 连续失败 < 阈值                 │ 连续失败 ≥ 阈值
       │ 重置计数器                     ▼
       │                          degraded (确认故障)
       │                                  │
       │ 自动修复已启用 &&               │ 执行修复动作
       │ 速率限制未触发                  ▼
       │                          repairing (修复中)
       │                                  │
       │      修复成功 ←──────────────────┤
       │         │                        │ 修复失败 / 速率限制
       │         ▼                        ▼
       └─── healthy                repair-exhausted (等待下次心跳重试)
```

- **healthy**：所有检查通过，或修复后恢复健康。
- **degraded**：至少一个检查连续失败达到阈值（默认 3 次），确认故障。
- **repairing**：正在执行修复动作（异步，通常毫秒级）。
- **repair-exhausted**：修复动作执行后仍未恢复，或速率限制触发，等待下次心跳重试。

### 3.2 修复动作（固定集合，不做开放 registry）

| 检查 id | 修复动作 | 幂等 | 描述 |
| --- | --- | --- | --- |
| `config` | `config-reload` | 是 | `configManager.applyLiveConfigReload()`：从磁盘重新读取配置并应用 |
| `provider` | `config-reload` | 是 | 同上——provider 配置的重载是 `applyReloadPlan` 的一部分 |
| `workspace` | `directory-ensure` | 是 | `fs.mkdirSync(workspacePath, {recursive: true})`：确保工作区目录存在 |
| `sessions` | `directory-ensure` | 是 | `fs.mkdirSync(sessionsDir, {recursive: true})`：确保会话目录存在 |

- 所有修复动作都是幂等的——重复执行不产生副作用。
- 修复动作在内核进程内执行，不触发进程重启。
- 如果修复动作抛出异常（如权限不足），异常被捕获并记录为修复失败，不传播——健康检查自身不能成为新的崩溃点。
- 修复后立即重新 `evaluate()` 一次以验证恢复效果。

### 3.3 速率限制

- **窗口**：滑动 1 小时窗口，每个检查 id 独立计数。
- **限制**：每个检查 id 每小时最多执行 `maxRepairsPerHour` 次（默认 3）。
- **触发时机**：在 `degraded`（首次确认故障的下一心跳）或 `repair-exhausted`（上轮修复未恢复/限速后的重试）状态下，且距离上次修复超过 `repairCooldownMs`（默认 60 秒）时才触发修复。首次达到阈值的心跳只确认故障（degraded），不执行修复。
- **修复后**：重新 `evaluate()`，若恢复则重置计数；若未恢复则等待下次心跳。

### 3.4 心跳计时器

- 使用 `setInterval` 周期性调用 `evaluate()`。
- **默认间隔**：30 秒（与阿米巴模型设计对齐）。
- `start()` 在 `kernel.start()` 中调用，`dispose()` 在 `kernel.dispose()` 中调用。
- 计时器调用 `unref()`，不影响进程退出（重要：CLI 命令构造 kernel 但不长时间运行）。
- 每次心跳的 `evaluate()` 是纯内存探测（2 次 `accessSync` + 内存读取），微秒级，相对 30 秒间隔可忽略。
- **运行时 config 动态切换**：每次心跳 tick 读取 `getConfig()` 获取最新配置（`enabled`、`intervalMs`、`failureThreshold` 等），因此用户通过 `nextclaw config` 修改参数后，下一个 tick 自动生效，无需重启。`enabled` 从 `true` 变为 `false` 时，下一次 tick 检测到后立即停止计时器；反之亦然。

### 3.5 契约形状

```ts
type CoreSelfHealPhase =
  | "disabled"      // selfHeal.enabled = false
  | "healthy"       // 所有检查通过
  | "failing"       // 有检查连续失败，但未达阈值（早期信号）
  | "degraded"      // 故障已确认（连续失败 ≥ 阈值）
  | "repairing"     // 正在执行修复
  | "repair-exhausted"; // 修复后仍未恢复或速率限制

type CoreSelfHealRepairRecord = {
  at: string;                    // ISO 时间戳
  checkId: CoreHealthCheckId;    // 被修复的检查 id
  action: "config-reload" | "directory-ensure";
  recovered: boolean;            // 修复后是否恢复
  detail?: string;               // 稳定 reason code（public 面脱敏）
};

type CoreSelfHealCheckState = {
  id: CoreHealthCheckId;
  consecutiveFailures: number;
  lastFailureAt?: string;
  repairCount: number;           // 当前窗口内的修复次数
  lastRepairAt?: string;
};

type CoreSelfHealStatus = {
  phase: CoreSelfHealPhase;
  healthy: boolean;              // 最近一次快照的 healthy 值
  failedCheckIds: CoreHealthCheckId[];
  consecutiveFailures: number;   // 全局连续失败次数（所有检查中最长）
  lastHeartbeatAt?: string;
  lastRepair?: CoreSelfHealRepairRecord;
  checks: CoreSelfHealCheckState[];
};
```

### 3.6 配置扩展

`CoreHealthConfigSchema` 新增 `selfHeal` 节点：

```ts
coreHealth: {
  autoDegrade: boolean;     // PR-2，default false
  selfHeal: {
    enabled: boolean;       // default true（核心能力，开箱即用）
    intervalMs: number;     // default 30_000（30 秒心跳）
    failureThreshold: number; // default 3（连续 3 次失败 → 确认故障）
    maxRepairsPerHour: number; // default 3（每检查 id 每小时最多 3 次修复）
    repairCooldownMs: number; // default 60_000（两次修复之间的最小间隔）
  }
}
```

**默认值设计依据**：
- `enabled: true`：自愈是阿米巴模型的核心承诺（"自我修复"），且修复动作（配置重载、目录创建）都是幂等低风险操作，默认开启符合产品愿景。与 PR-2 的 `autoDegrade: false` 不同——降级会改变用户可见行为（禁用外部功能），而修复只是在故障时尝试恢复，默认开启不影响健康状态下的行为。
- `intervalMs: 30_000`：与阿米巴模型设计对齐。
- `failureThreshold: 3`：与阿米巴模型设计对齐（"连续 3 次心跳失败 → 判定为故障"）。
- `maxRepairsPerHour: 3`：与阿米巴模型设计对齐（"自动重启：故障服务自动重启，最多 3 次/小时"）。

## 4. 暴露面

### `/api/health`（公共端点，未鉴权也可访问）

在 `data` 内新增 `coreSelfHeal` 字段：

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "services": { "ncpAgent": "ready", "cronService": "ready" },
    "coreHealth": { "…" },
    "coreSelfHeal": {
      "phase": "healthy",
      "healthy": true,
      "failedCheckIds": [],
      "consecutiveFailures": 0,
      "lastHeartbeatAt": "…"
    }
  }
}
```

- **不变量**：HTTP 状态码、`data.status === "ok"`、`data.services` 形状全部保持不变；自愈状态不影响 `/api/health` 的 ok 语义。
- **脱敏**：公共快照只暴露检查 id（固定枚举）、计数、时间戳和稳定 phase 名——不暴露绝对路径、原始异常或修复细节。

### `nextclaw status`

状态行增加核心自愈状态（一行文本），供人工快速诊断。实现路径：`runtime.commands.diagnostics.status()` 已 fetch `/api/health`，从响应中提取 `coreSelfHeal` 字段即可。

## 5. Owner 与主链路

```
kernel.coreSelfHeal (CoreSelfHealService)
  ├── 依赖：coreHealth（evaluate 快照）、configManager（配置重载）、路径函数
  ├── 心跳计时器：setInterval → evaluate() → 状态机 → 修复动作
  ├── 唯一事实源：CoreSelfHealService 的内部状态（不缓存到磁盘）
  │
  └── 消费方
        └── server GET /api/health 附带 coreSelfHeal 快照（脱敏）
```

- **主干归属**：自愈状态机是内核语义，归 `nextclaw-kernel` 主干 feature，不做 contribution 分支。
- **唯一事实 owner**：`CoreSelfHealService` 是唯一产生"自愈状态"事实的地方。`/api/health` 只投影视图，不复制判定逻辑。
- **直接依赖**：
  - `CoreHealthCheckService`（evaluate 快照）
  - `ConfigManager.applyLiveConfigReload`（配置重载修复动作）
  - `fs.mkdirSync`（目录创建修复动作）
  - `Config`（读取 selfHeal 配置参数）

## 6. 目录与公共入口

```
packages/nextclaw-kernel/src/features/core-self-heal/
├── index.ts                              # re-export
├── types/core-self-heal.types.ts         # 契约类型
└── services/
    ├── core-self-heal.service.ts         # 状态机 + 心跳计时器 + 修复动作
    └── core-self-heal.service.test.ts    # 单测
```

- 导出：`@nextclaw/kernel` 根入口增加 `features/core-self-heal/index.js`（与 `core-health`、`feature-controls` 同级惯例）；kernel class 增加 `readonly coreSelfHeal`。
- server 侧不新增 controller 文件：`/api/health` 已存在于 `AppRoutesController`，原位扩展（同 PR-1 模板）。
- 不新增 store/presenter：自愈状态无持久化需求。

## 7. 验证标准

### 单测矩阵

| 场景 | 验证点 |
| --- | --- |
| `enabled: false` | 不启动计时器；`evaluate()` 不被周期调用；状态 phase 为 `disabled` |
| 心跳间隔 | 修改 `intervalMs` 后，心跳按新间隔触发（fake timer） |
| 连续失败 < 阈值 | `consecutiveFailures` 递增，phase 为 `failing`（早期信号，3.5 状态机定义） |
| 连续失败 ≥ 阈值 | phase 转为 `degraded`，`failedCheckIds` 包含对应 id |
| 修复动作（config/provider） | `configManager.applyLiveConfigReload()` 被调用；修复后 `evaluate()` 返回 healthy → phase 转为 `healthy` |
| 修复动作（workspace/sessions） | `fs.mkdirSync` 被调用（路径正确、recursive: true） |
| 修复后未恢复 | phase 保持 `degraded` 或转为 `repair-exhausted` |
| 速率限制 | 同一检查 id 修复 `maxRepairsPerHour` 次后，下一次修复被跳过 |
| 修复动作异常 | 异常被捕获；记录为修复失败；不传播；状态机继续运行 |
| 恢复后计数重置 | 修复成功后 `consecutiveFailures` 重置为 0 |
| `dispose()` | 计时器被清除；不再有后续心跳 |
| `/api/health` 响应 | `data.coreSelfHeal` 字段存在且形状正确 |
| `/api/health` 不变量 | `ok: true`、`data.status: "ok"`、`data.services` 形状不变 |

### 类型与治理

- `pnpm --filter @nextclaw/kernel exec tsc --noEmit` 通过
- `pnpm --filter @nextclaw/server exec tsc --noEmit` 通过
- `pnpm lint:new-code:governance --base origin/master` 通过
- 既有 feature-controls / router.auth.test 全绿

## 8. 完成标准

- `kernel.coreSelfHeal.evaluate()` 可通过 kernel 根入口访问，返回上述快照；
- 真实服务器 `GET /api/health` 返回 `data.coreSelfHeal`，且现有语义（200 + ok）不变；
- `nextclaw status` 显示核心自愈状态行；
- 配置 `coreHealth.selfHeal.enabled = false` 可完全禁用心跳和修复；
- 配置 `coreHealth.selfHeal.failureThreshold = 1` 可让故障立即触发修复（用于测试和紧急场景）；
- 后续 PR-4 可以基于本契约的 `CoreSelfHealStatus` 构建历史快照和调优逻辑。
