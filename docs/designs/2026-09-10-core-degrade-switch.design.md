# 核心降级开关（degrade switch）设计

> 状态：设计冻结，供 PR-2 实现
> 上游：`2026-09-06-core-minimum-amoeba-model.design.md`（wip 分支，待提 docs PR）
> 前置：PR-1 `2026-09-10-core-health-check-contract.design.md`（core-health 契约）

## 1. 闭环定位（环节②）

```
① 感知（PR-1：coreHealth 快照）
        │
        ▼
② 降级（本 PR：autoDegrade=true 且核心不健康 → 关闭外部多余功能，保住最小核心）
        │
        ▼
③④ 排查 + 修部件（PR-3）→ ⑤ 调优（PR-4）
```

输入：PR-1 的 `CoreHealthCheckService.evaluate()` 快照 + 既有 config。
输出：每个外部功能的 `active` 状态（单一事实源）。
消费方：工具 provider（执行位点）、`/api/feature-controls`（暴露）、`nextclaw status`（可观测）。

## 2. 规则（刻意只有一条，不做精细映射）

- `coreHealth.autoDegrade = false`（默认）：行为与现状完全一致，`active = available`。
- `autoDegrade = true` 且快照 `healthy = false`（任一核心部件失败）：所有外部功能 `active = false`。

不建「部件 → 功能」精细映射表：阿米巴语义是核心受损就整体关停外部能力；
PR-3 有了心跳与故障部件定位后，若需要更细粒度再扩展，届时是加映射而不是加机制。

## 3. owner 与执行位点（全部挂接既有系统，零新机制）

| 关注点 | 落点 | 依据 |
| --- | --- | --- |
| 降级状态事实 | `FeatureControlsService`（既有外部功能可用性 owner，现只报 `desktopAutomation`） | 单一 owner，不建新 service/registry/middleware |
| 降级执行 | `McpToolProvider` / `DesktopToolProvider` 的既有 `provide()`：`active = false` 时返回 `[]` | 每个外部功能已有唯一 ToolProvider 执行位点（`ToolProviderManager` 聚合），不建 gate 层 |
| 配置 | config schema 增加 `coreHealth: { autoDegrade: boolean }` | 沿用各 channel 既有的 `z.boolean().default()` toggle 模式 |
| 暴露 | `/api/feature-controls` 形状自然扩展（同端点） | 既有端点 + 既有 client-sdk mirror + UI hook，不建新端点 |
| 可观测 | `nextclaw status` 增加一行核心健康 | 该命令已 fetch `/api/health`（PR-1 已附带 `data.coreHealth`） |

kernel 装配：`featureControls` 构造改为接收 `{ desktopHost, coreHealth, config }`
（`coreHealth` 为 PR-1 已装配的兄弟字段，构造函数内调整装配顺序即可）。

## 4. 契约形状

```ts
type ExternalFeatureState = {
  available: boolean;        // 静态/平台能力（desktopAutomation 既有语义不变）
  active: boolean;           // available && 未被降级
  reason?: string;           // 降级原因（如 "core-degraded: provider,workspace"）
};

type ProductFeatureControls = {
  desktopAutomation: ExternalFeatureState;   // 既有字段 available 语义不变，增量加 active/reason
  mcp: ExternalFeatureState;                 // available = 已配置 MCP server；active 同规则
  core: {
    healthy: boolean;
    autoDegrade: boolean;
    failedCheckIds: CoreHealthCheckId[];
  };
};
```

client-sdk 的 `ProductFeatureControlsView` 增量同步（现有消费者只读
`desktopAutomation.available`，加字段不破坏）。

## 5. 性能

`provide()` 是每次 agent run 的热路径。降级判定 = `coreHealth.evaluate()`
（2 次进程内 `accessSync` + 内存 config 读），微秒级，相对一次 LLM 运行可忽略。
不缓存、不加 timer——与 PR-1「纯读快照、无缓存」契约一致。

## 6. 非目标

- 部件 → 功能精细映射（PR-3，等故障定位能力）。
- 自动恢复、心跳、连续失败判定（PR-3）。
- 逐功能手动开关（channel 等外部系统已有各自的 `enabled`，不重复建设）。
- UI 降级展示（当前无消费者；展示归 UI 侧需求驱动）。

## 7. 验证

- 单测：`FeatureControlsService`（autoDegrade 开/关 × 健康/不健康、
  `desktopAutomation.available` 语义回归）、`McpToolProvider`（inactive 返回 `[]`）。
- kernel/server `tsc`、定向 vitest、`pnpm lint:new-code:governance --base origin/master`。
- 默认配置下行为不变：既有 feature-controls / router 测试全绿。
