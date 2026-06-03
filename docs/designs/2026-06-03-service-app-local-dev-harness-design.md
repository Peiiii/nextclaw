# 2026-06-03 Service App 本地等效运行方案

## 背景

`nextclaw app check` 第一版解决的是静态合同问题：目录、manifest、资源路径、capability、action allowlist、脚本语法等。它能在 AI 交付前挡住一批低级错误，但它不能回答另一个更接近真实开发的问题：

> 这个 Service App 能不能真的被拉起来？MCP handshake 能不能成功？`tools/list` 是否和 manifest 对齐？某个 action 用样例输入能不能跑通？

用户对这个能力的期待更接近 Cloudflare Wrangler 这类本地开发体验：在合理成本内，尽量模拟真实运行场景，让 AI 能看到启动失败、协议失败、工具缺失、调用失败和日志，然后修到可用。

## 核心原则

### 不能有两套运行逻辑

本地 dev harness 不是第二套 Service App runtime。它必须复用真实运行链路，不能在 CLI 里重写一套 MCP stdio 启动、handshake、`tools/list`、`tools/call` 和结果解析。

禁止形态：

- production path 用 `McpServiceAppRuntimeService`；
- `nextclaw app dev` 里另写一套 MCP client 和 JSON-RPC；
- 协议或 result shape 变更时两边都要同步改。

正确形态：

```text
McpServiceAppRuntimeService
  - 启动/复用 MCP stdio server
  - tools/list
  - tools/call
  - stop/restart/dispose
  - runtime status

ServiceAppManager
  - workspace 发现
  - manifest -> record
  - 授权与 allowlist
  - production invoke/list/discover

CLI app dev / app call
  - 读取用户传入目录
  - 构造 dev record / manifest
  - 调用同一个 McpServiceAppRuntimeService
  - 输出诊断、日志和结果
```

`app dev` 是 dev context adapter，不是 runtime 复制品。

## 现有代码证据

当前真实链路已经有比较清楚的 owner：

- `packages/nextclaw-kernel/src/utils/service-app-manifest.utils.ts`
  - 读取和解析 `service-app.json`；
  - 校验 `id`、`protocol`、`command`、`args`、`actions`、`risk`。
- `packages/nextclaw-kernel/src/services/mcp-service-app-runtime.service.ts`
  - 持有 `McpServerLifecycleManager`；
  - `listActions()` 走 MCP warm server 和 tools/list；
  - `invokeAction()` 走 MCP callTool；
  - `restart()` / `dispose()` 做清理。
- `packages/nextclaw-kernel/src/managers/service-app.manager.ts`
  - 负责 workspace 服务应用发现；
  - 负责 Service Action grant / allowlist / caller；
  - `discoverServiceAppActions()` 调 runtime `listActions()` 并合并 manifest/runtime mismatch；
  - `invokeServiceAction()` 做授权后调用 runtime `invokeAction()`。

因此第一版本地 dev harness 不应新建 runtime owner，而应复用 `McpServiceAppRuntimeService`。

## 目标

第一阶段目标是让 AI 能对 Service App 做贴近真实的本地运行验收：

```bash
nextclaw app dev ~/.nextclaw/workspace/service-apps/foo
nextclaw app call ~/.nextclaw/workspace/service-apps/foo listFiles --input '{}'
```

成功标准：

- 能按 `service-app.json.command + args` 和真实 cwd 拉起 Service App；
- 能完成 MCP `tools/list`；
- 能把 runtime tools 与 manifest actions 对齐；
- 能显示 matched / missing / undeclared；
- 能显示启动失败、handshake 失败和 runtime `lastError`；
- 能显式调用单个 action；
- 能在命令结束时清理子进程；
- 不复制 MCP runtime 逻辑。

## 非目标

第一阶段不做：

- 不做 Panel App browser preview host；
- 不注入完整 `window.nextclaw`；
- 不模拟授权弹窗；
- 不默认调用所有 actions；
- 不自动修复；
- 不保存长期健康状态；
- 不让 CLI 直接依赖 server HTTP API。

## 命令设计

### `nextclaw app dev <service-app-dir>`

用于拉起 Service App 并验证基础 runtime。

行为：

1. 读取 `<service-app-dir>/service-app.json`；
2. 校验 manifest id 与目录名一致；
3. 构造 `ServiceAppRecord`；
4. 创建 `McpServiceAppRuntimeService`；
5. 调用 `listActions({ app, manifest })`；
6. 复用 `ServiceAppManager` 的 manifest/runtime merge 规则，或把 merge 规则抽成共享 utils；
7. 输出：
   - app id；
   - command / cwd；
   - runtime status；
   - matched actions；
   - missing manifest actions；
   - undeclared runtime tools；
   - last error；
   - last error；
8. dispose runtime。

建议输出：

```text
NextClaw Service App dev: notes
Command: node server.mjs
CWD: /Users/.../.nextclaw/workspace/service-apps/notes

Runtime: running
Tools:
- notes.read matched
- notes.write missing
- notes.extra undeclared
```

### `nextclaw app call <service-app-dir> <action-name> --input <json>`

用于显式调用单个 action。它只调用用户指定 action，不默认扫全量 action。

行为：

1. 读取 manifest；
2. 校验 `action-name` 在 manifest actions 中存在；
3. 解析 `--input` JSON，默认 `{}`；
4. 复用 `McpServiceAppRuntimeService.invokeAction()`；
5. 输出业务结果；
6. dispose runtime。

可选：

```bash
nextclaw app call service-apps/notes read --input '{"path":"notes/today.md"}' --json
```

### 为什么不放进 `check`

`check` 是静态合同校验。`dev/call` 是运行时执行，会启动进程、读取 stderr、进行协议交互，甚至调用用户 action。两者风险、语义和验证成本不同，应保持命令分离。

## action fixture 设计

不建议默认调用所有 action，因为 action 可能：

- 写文件；
- 删除文件；
- 访问外部 API；
- 执行本地命令；
- 产生费用或副作用。

未来可以为 manifest 增加显式测试样例：

```json
{
  "actions": {
    "listFiles": {
      "risk": "read",
      "test": {
        "input": {},
        "expect": { "type": "object" }
      }
    }
  }
}
```

然后支持：

```bash
nextclaw app test <service-app-dir> --all-fixtures
```

第一阶段先不引入 fixture 字段，避免扩大 manifest 设计。先提供显式 `app call`，让 AI 或用户自己指定要测的 action 和 input。

## 代码结构建议

### CLI 层

```text
packages/nextclaw/src/cli/app/controllers/
  app-dev-command.controller.ts
  app-call-command.controller.ts

packages/nextclaw/src/cli/app/services/
  service-app-dev.service.ts

packages/nextclaw/src/cli/app/types/
  service-app-dev.types.ts
```

职责：

- controller：解析 CLI 参数、stdout、exit code；
- `ServiceAppDevService`：构造 dev context，调用 kernel runtime service；
- types：dev report / call report。

### Kernel 层

优先不改 kernel。如果需要减少重复，允许小幅补充共享能力：

1. 从 `ServiceAppManager.mergeRuntimeActions()` 抽出纯 utils：
   - `mergeServiceAppRuntimeActions(record, manifest, runtimeActions)`；
   - production discover 和 CLI dev 都调用它。
2. 如果需要 stderr/log 摘要，必须在 `McpServiceAppRuntimeService` / `McpServerLifecycleManager` 这个真实 runtime owner 上增加观测字段，不能由 CLI 自己另起进程读取 stderr。

禁止：

- 在 CLI 里复制 `McpServerLifecycleManager` 交互；
- 在 CLI 里复制 tool result parsing；
- 在 CLI 里通过 server HTTP API 绕一圈。

## 复用边界

推荐第一版直接从 CLI 依赖 `@nextclaw/kernel` 的公开入口，使用：

- `readServiceAppManifest` 或公开等价 manifest reader；
- `McpServiceAppRuntimeService`；
- `ServiceAppRecord` / `ServiceAppManifest` / `ServiceAction` 类型；
- `mergeServiceAppRuntimeActions`，若抽出。

如果某些能力当前没有从 `@nextclaw/kernel` 根入口导出，应补公共出口，而不是 deep import kernel 内部路径。

## 与现有 `app check` 的关系

推荐 AI 开发顺序：

1. 写 Panel App / Service App 文件；
2. `nextclaw app check <dir>`；
3. 如果是 Service App，继续 `nextclaw app dev <dir>`；
4. 对关键 action，运行 `nextclaw app call <dir> <action> --input '{}'`；
5. 失败则根据诊断和日志修复；
6. 再交付用户。

`check` 负责结构正确，`dev/call` 负责运行可用。

## 未来阶段：Panel + Service Preview Host

第二阶段可以做：

```bash
nextclaw app preview panels/foo.panel --service service-apps/foo
```

能力：

- 起本地静态 host；
- 加载 Panel App；
- 注入接近真实的 `window.nextclaw.serviceActions`；
- 背后仍调用同一个 `McpServiceAppRuntimeService`；
- 第一版 Agent API 可 mock 或明确不支持；
- 输出浏览器 URL。

但这一阶段更重，涉及 browser、bridge、sandbox、授权 mock、日志汇聚。应在 Service App dev/call 稳定后再做。

## 验收建议

第一阶段实现后至少验证：

- 合法 Service App：`app dev` 输出 running 和 matched action；
- runtime 多一个 tool：输出 undeclared；
- manifest 多一个 action：输出 missing；
- command 脚本语法错：输出 failed 和错误摘要；
- `app call` 可调用 action 并输出结果；
- `app call` action 不存在时返回非零；
- 命令结束后子进程被清理；
- production `ServiceAppManager.discoverServiceAppActions()` 和 CLI `app dev` 的 matched/missing/undeclared 规则来自同一函数。

## 风险

- `McpServiceAppRuntimeService` 当前 `listActions()` 在失败时返回空数组并记录 status，CLI dev 需要把 status / lastError 一并输出，否则空数组会显得像“没有 tools”而不是“启动失败”。
- 如果 CLI 直接 new runtime service，需要构造 `getConfig`。第一版可用当前 config loader / runtime config manager 创建最小 config；不能在 CLI 里手写 workspace 之外的运行时事实。
- action call 有副作用，必须保持显式调用，不做默认全量调用。
- 当前 `McpServerLifecycleManager` 没有对外暴露 stderr 摘要；第一版只输出 runtime `lastError`。如果后续要输出 stderr，改真实 runtime owner，不改 CLI 私有逻辑。

## 推荐落地顺序

1. 抽出 production 和 dev 共用的 runtime action merge utils；
2. 实现 `ServiceAppDevService`，只调用 `McpServiceAppRuntimeService`；
3. 注册 `nextclaw app dev <dir>`；
4. 注册 `nextclaw app call <dir> <action> --input <json>`；
5. 补定向测试和真实 MCP fixture 冒烟；
6. 更新 app creator / service app creator skill，把 Service App 交付前 runtime 验收写成推荐步骤。
