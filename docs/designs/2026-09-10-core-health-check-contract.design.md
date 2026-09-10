# 最小核心健康检查契约（PR-1）设计

> 日期：2026-09-10
> 上位方向：[最小核心（阿米巴模型）设计](./2026-09-06-core-minimum-amoeba-model.design.md)
> 状态：设计完成，本 PR 只实现 PR-1（契约 + 固定 seed 检查 + 只读暴露）

## 1. 问题与目标

阿米巴模型要求"即使所有高级功能崩溃，最小核心仍跑通基础功能，并能自我修复"。自我修复的前提是**先能判定最小核心是否健康**——而当前系统没有这个判定契约：

- `GET /api/health` 只返回服务器存活与 bootstrap 阶段状态（`ncpAgent`/`cronService`），反映的是"启动过程走到哪一步"，不是"核心能力现在能不能用"；
- `FeatureControlsService` 只报告 `desktopAutomation` 一项静态可用性；
- `nextclaw doctor` 是 service 层的独立诊断入口，直接探测端口、日志和 provider 配置，不经过 kernel，无法被运行时自愈逻辑复用。

PR-1 只交付最小稳定的健康判定契约和它的第一个真实消费面，让 PR-2（降级开关）和 PR-3（自愈重启）有可依赖的 owner。

**最小完整结果**：kernel 提供 `coreHealth` 能力，评估核心层四项检查并给出带原因的状态快照；`GET /api/health` 在保持现有 200+`ok` 存活语义不变的前提下，附带该快照。

## 2. 现状证据

- `/api/health` 消费者：Nginx 反向代理探测、`nextclaw status/doctor`（`probeApiHealth`）、remote relay（`ensureLocalUiHealthy`）、service 启动探测（`probeHealthEndpoint`）。它们依赖"HTTP 200 且 `data.status === "ok"`"，**该语义不可改变**。
- kernel 已有 `feature-controls` feature（`FeatureControlsService`）作为"kernel 组装 + server 只读端点"的既有接线模板（`kernel.featureControls` → `GET /api/feature-controls`）。
- kernel 构造函数中 `llmProviders`、`configManager` 在组装期可用；workspace 路径经 `getWorkspacePath(config.agents.defaults.workspace)` 解析。
- `LlmProviderManager` 暴露 `listProviderSpecs()`（配置快照，不发网络请求），可安全用于"配置可解析"判定。

## 3. Owner 与主链路

```
kernel.coreHealth (CoreHealthCheckService)
  ├── 核心层检查定义（本 feature 内的固定集合，内核语义，归 kernel）
  ├── evaluate(): 逐检查执行 -> CoreHealthStatus 快照（纯读，无副作用）
  │
  └── 消费方（本 PR 只有一个真实消费者）
        └── server GET /api/health 附带 coreHealth 快照
```

- **主干归属**：核心能力集合与判定语义是产品行为，归 `nextclaw-kernel` 主干 feature，不做 contribution 分支。
- **唯一事实 owner**：`CoreHealthCheckService.evaluate()` 是唯一产生"核心健康快照"事实的地方。`/api/health` 只投影视图，不复制判定逻辑；`doctor` 不在本 PR 接入（见非目标）。
- **直接依赖**：`CoreHealthCheckService` 只依赖 `configManager`（配置解析）、`llmProviders`（provider 配置快照）、`getWorkspacePath`（路径解析）。构造函数建立对象图，`evaluate()` 无 load/start 副作用。
- **不做开放 registry**：核心检查集合是内核固定的（对应阿米巴模型"核心层"四项），不建插件式注册 API——当前没有第二个消费者需要注册检查，开放闭集会固化无消费者的通用性。

## 4. 契约形状

```ts
type CoreHealthCheckId = "config" | "provider" | "workspace" | "sessions";

type CoreHealthCheckResult = {
  id: CoreHealthCheckId;
  ok: boolean;
  /** 失败原因；ok 时省略 */
  detail?: string;
  checkedAt: string; // ISO
};

type CoreHealthStatus = {
  /** 全部核心检查通过 */
  healthy: boolean;
  checks: CoreHealthCheckResult[];
  evaluatedAt: string; // ISO
};
```

状态是**瞬时快照**：`evaluate()` 每次现查，不缓存、不轮询。心跳/计时/故障判定（连续失败计数）是 PR-3 的 owner，PR-1 不引入 timer。

### Seed 检查（四项，与阿米巴模型核心层一一对应）

| id | 判定 | 证据 |
| --- | --- | --- |
| `config` | `configManager.config` 可解析且 agents 配置存在 | 配置读取（纯内存，config 由 ConfigManager 持有） |
| `provider` | 存在至少一个已启用且 API key 已配置的 provider（`listProviderSpecs()`） | 纯内存快照，**不发网络请求**——连通性归 doctor/PR-3，这里只判"核心调用有配置可用" |
| `workspace` | 工作区路径存在且可写（`fs.access` 探测，不建目录） | 文件读写能力是核心层基础工具调用的前提 |
| `sessions` | 会话目录存在或可创建父目录下可写探测成功 | 会话管理是核心层能力 |

判定失败只记录 `detail`，`evaluate()` 本身不抛异常（单项检查的异常被捕获并转为失败结果）——健康检查自身不能成为新的崩溃点。

## 5. 暴露面

`GET /api/health` 响应在 `data` 内新增 `coreHealth` 字段：

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "services": { "ncpAgent": "ready", "cronService": "ready" },
    "coreHealth": {
      "healthy": true,
      "checks": [ { "id": "config", "ok": true, "checkedAt": "…" } ],
      "evaluatedAt": "…"
    }
  }
}
```

- **不变量**：HTTP 状态码、`data.status === "ok"`、`data.services` 形状全部保持不变；核心检查失败**不**让 `/api/health` 返回非 ok——现有消费者（代理探测、status 命令）语义不变，"服务器活着"与"核心健康"是两个事实。
- 实现路径与 `feature-controls` 同模板：`AppRoutesController` 经 `options.kernel.coreHealth` 调用。`evaluate()` 是纯内存探测（`fs.access` 为同步快速调用），放在请求内联执行，不加缓存层。

## 6. 非目标（切给后续 PR）

- **降级开关**：config schema 扩展、按检查 id 关闭高级功能 → PR-2。
- **自愈**：心跳计时、连续失败判定、自动重启、恢复重试 → PR-3（届时消费 `evaluate()`，在其外层加状态机）。
- **doctor 接入**：`nextclaw doctor` 改为消费 kernel 契约（去重）→ 观察 PR-1 落地后是否值得做，本 PR 不动 doctor。
- **provider 连通性探测**：需要网络往返，有副作用和超时语义，不属于"核心配置可用"判定。
- **UI 展示**：无 UI 消费者，不做。

## 7. 目录与公共入口

```
packages/nextclaw-kernel/src/features/core-health/
├── index.ts                              # re-export
├── types/core-health.types.ts            # 契约类型
└── services/core-health-check.service.ts # 固定 seed 检查 + evaluate
```

- 导出：`@nextclaw/kernel` 根入口增加 `features/core-health/index.js`（与 `feature-controls` 同级惯例）；kernel class 增加 `readonly coreHealth`。
- server 侧不新增 controller 文件：`/api/health` 已存在于 `AppRoutesController`，原位扩展。
- 不新增 store/presenter：快照无持久化、无视图投影需求。

## 8. 验证标准

- 单测：四类检查各一个通过/失败分支；单项检查抛异常时转为失败结果而非向上传播；`evaluate()` 不产生缓存（两次调用时间戳独立）。
- 类型：`pnpm --filter @nextclaw/kernel exec tsc --noEmit`、server 同范围 tsc 通过。
- 契约回归：`/api/health` 现有断言（router.auth.test.ts 等）不变仍绿；新增断言 `data.coreHealth` 形状。
- 治理：`pnpm lint:new-code:governance --base origin/master`。

## 9. 完成标准

- `kernel.coreHealth.evaluate()` 可通过 kernel 根入口访问，返回上述快照；
- 真实服务器 `GET /api/health` 返回 `data.coreHealth`，且代理探测语义（200 + ok）不变；
- 后续 PR-2/PR-3 可以只依赖本契约类型推进，不需要改 PR-1 的 owner 形状。
