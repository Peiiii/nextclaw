# Runtime Live Apply and Consented Restart Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 NextClaw 的运行时配置与宿主变更默认收敛为“主进程尽量不中断、能热生效就热生效、实在必须中断时先明确告知用户并由用户一键确认重启”。

**Architecture:** 以单一的 `runtime change coordinator` 作为配置/宿主变更的 owner，统一决定一次变更应该是热应用、局部模块重建、仅登记 `pending restart`，还是在用户确认后执行进程级重启。已有 `ConfigReloader`、`ChannelManager`、`RemoteServiceModule`、插件/MCP 热重载能力继续复用，但不再允许各入口各自直接 `requestRestart()` 或静默杀掉当前服务。

**Tech Stack:** TypeScript、Node.js、Hono、React、Zustand、NextClaw CLI runtime、`@nextclaw/core` 配置重载能力、`@nextclaw/remote` 远程运行时、Vitest。

---

## 长期目标对齐 / 可维护性推进

- 这项工作直接服务 NextClaw 的产品愿景：统一入口必须足够可靠，不能让用户在“改一项设置”后失去当前对话、页面和控制权。
- 这次优先推进的不是“更聪明地自动重启”，而是删掉多条互相打架的重启分支，把“如何应用变更”收敛成一个可预测合同。
- 长期方向应该是：
  - 热应用优先于进程重启
  - 局部模块 owner 重建优先于全进程中断
  - 用户确认优先于静默破坏当前会话
  - 单一变更协调器优先于 `config` / `remote` / `channels` / `gateway tool` 各自为政

## 现状分析

当前仓库已经具备大量“无需主进程重启”的能力，但入口并不统一，导致体验不一致：

1. 已有的热应用能力
- UI 配置路由保存后会发布 `config.updated` 并调用 `applyLiveConfigReload()`，多数 `providers.*`、`channels.*`、`plugins.*`、`mcp.*`、`agents.*` 已经能在运行中生效。
- `ConfigReloader` 已经支持 provider reload、channel manager in-process rebuild、agent runtime config apply、plugin reload、MCP reload。
- `RemoteServiceModule` 已经是一个可 `start/stop/restart` 的独立 owner，不天然要求重启整个服务进程。

2. 仍然会直接破坏主进程的入口
- `gateway controller` 的 `config.apply` / `config.patch` 在保存后无条件 `requestRestart()`，即使改动本可热应用。
- CLI `config`、`secrets`、`channels login/add` 仍会在某些分支里请求 restart。
- `RemoteRuntimeActions.enable/disable` 在 managed service 运行时会重启整个后台服务，而不是在进程内启停 remote runtime。
- 运行中 config watcher 命中 `restartRequired` 时会直接请求 restart，而不是把“需要重启”作为产品态暴露给用户。

3. 当前判定表本身还有两个重要问题
- `remote.*` 没有进入 `buildReloadPlan()` 的显式规则，因此目前会落入默认 `restartRequired`。
- 文档说 `ui` 端口变更需要 restart，但 `buildReloadPlan()` 目前把 `ui` 记成 `none`，与产品语义不一致。

## 方案备选

### 方案 A：继续保留当前自动重启，只把提示做得更明显

优点：
- 改动最小
- 风险低

缺点：
- 核心问题没有解决，主进程仍会被破坏
- 用户即使看到了提示，也已经丢了当前对话连续性
- 代码层面的 owner 仍然分裂

结论：不推荐。

### 方案 B：所有入口都各自补一个“尽量热生效，否则别重启”

优点：
- 不需要先抽统一层

缺点：
- 会把现在的分裂继续扩散
- `config`、`remote`、`channels`、UI route、CLI route 会继续各自维护一套语义
- 后续很难证明“为什么这次改动会中断，那次不会”

结论：不推荐。

### 方案 C：引入单一 `runtime change coordinator`，把所有变更入口统一接入

优点：
- 行为可预测
- 现有热重载能力可以复用，而不是重写
- 用户提示、UI banner、CLI 输出、agent tool 结果都能共享同一套语义
- 后续如果要做更强的“零中断模块切换”也有清晰 owner

缺点：
- 第一期需要补一层协调器和统一结果类型

结论：推荐，并作为本计划的唯一实施方案。

## 目标产品合同

实施后，NextClaw 的运行时变更必须遵守下面这份固定合同：

1. 默认合同
- 用户修改配置、启停 remote、登录 channel、应用 runtime 变更时，主进程默认继续存活。
- 当前正在进行的对话、会话列表、UI 页面尽量不被打断。

2. 可热生效合同
- 如果某项变更可以通过已有 owner 在进程内完成，就必须返回 `live-applied`，而不是提示重启。
- 允许的 in-process 形式包括：
  - provider reload
  - channel manager rebuild
  - plugin / MCP 热重载
  - agent runtime config apply
  - remote runtime module start / stop / reconfigure

3. 必须重启合同
- 如果某项变更确实不能在当前进程内完成，只能返回 `pending-restart`，不得静默执行 restart。
- 返回内容至少要包含：
  - 原因
  - 影响范围
  - 是否会短暂断开当前 UI / 对话
  - 用户确认入口

4. 用户确认合同
- 只有在用户点击确认后，系统才允许执行真正的进程级 restart。
- restart 入口必须尽量复用现有 restart coordinator，而不是再造一套停止/启动逻辑。

5. 非目标
- 本计划不承诺第一期就做到“所有二进制更新、所有端口切换完全零中断”。
- UI bind 端口切换、桌面 bundle 更新、自升级后的新二进制替换，仍可保留“确认后重启”语义。

## 目标技术设计

### 1. 单一 owner：`RuntimeChangeCoordinator`

新增一个清晰的 class owner，负责回答两个问题：

- 这次变更能否在当前进程内应用？
- 如果不能，如何把它记录成 `pending restart` 而不是直接打断服务？

它不替代 `ConfigReloader`，而是站在更上一层编排：

- `ConfigReloader` 继续负责“怎么热应用”
- `RemoteServiceModule` 继续负责 remote runtime 的生命周期
- `RestartCoordinator` 继续负责“确认后怎么 restart”
- 新协调器负责“何时调用谁，以及给用户返回什么结果”

### 2. 统一结果类型

所有运行时变更入口都收敛到统一结果，例如：

```ts
type RuntimeChangeResult =
  | {
      kind: "live-applied";
      changedPaths: string[];
      reloadSummary: string[];
    }
  | {
      kind: "pending-restart";
      changedPaths: string[];
      restartRequired: string[];
      impact: "ui-disconnect" | "service-restart" | "manual-followup";
      reason: string;
    };
```

关键点：
- `pending-restart` 是产品态，不是报错
- CLI、server API、UI、agent tool 都返回同一语义

### 3. 持有一份运行中 `pending restart` 状态

为了让多个页面、CLI、agent tool、远程入口共享同一状态，当前 service 进程需要持有一个明确的 `pending restart` store。

建议第一期采用：
- 进程内 owner class：`PendingRestartStateStore`
- 服务内 API 查询：`GET /api/runtime/status`
- Realtime 事件：
  - `runtime.restart-required`
  - `runtime.restart-cleared`

第一期没必要上复杂持久化文件；只要当前服务进程不重启，这份状态就足够服务 UI banner 和多入口提示。后续如果发现需要跨进程保留，再评估是否持久化到 `run/` 目录。

### 4. 明确区分三类变更

1. 热应用
- `providers.*`
- `channels.*`
- `plugins.*`
- `mcp.*`
- `agents.defaults.*`
- `agents.context.*`
- `bindings`
- `session`
- `search`
- `tools.*`

2. 进程内局部模块切换
- `remote.*`
  - 不是全进程 restart
  - 是 `RemoteServiceModule` 的 `start/stop/reconfigure`

3. 需要用户确认后 restart
- `ui.host`
- `ui.port`
- 任何当前单进程模型下无法在不丢监听 socket 的前提下热切换的宿主级项
- `update.run` / 桌面更新这类二进制替换路径

## 分阶段实施

### Phase 1: 把“自动重启”收缩为“登记待重启”

目标：
- 不再因为 config watcher / gateway config apply / CLI config path 直接打断当前服务

交付标准：
- 命中 `restartRequired` 只会登记 `pending restart`
- UI 和 CLI 都能看到明确提示
- 现有显式 `nextclaw restart` 仍保持可用

### Phase 2: 把 `remote.*` 从进程重启改成模块级切换

目标：
- remote 开关、设备名、平台地址等改动不再重启 managed service

交付标准：
- `remote enable/disable` 和 Remote Access UI 保存设置后，主进程继续存活
- remote runtime 在进程内完成启停/重连

### Phase 3: 把用户确认重启产品化

目标：
- 所有必须重启的变更都变成显式、可理解、可一键确认的动作

交付标准：
- 全局 banner / modal 可见
- 用户点击确认后再调用 restart coordinator
- UI 若短暂断开，行为与文案都诚实

## Task 1: 修正并扩展 `buildReloadPlan()` 的判定合同

**Files:**
- Modify: `packages/nextclaw-core/src/config/reload.ts`
- Modify: `packages/nextclaw-core/src/config/reload.test.ts`
- Modify: `docs/USAGE.md`
- Modify: `packages/nextclaw/resources/USAGE.md`

**Step 1: 明确把 `remote` 收进判定表**
- 为 `remote` 增加显式 kind，例如 `reload-remote`，不再让它隐式落入 `restartRequired`。

**Step 2: 修正 `ui` 的语义**
- 把 `ui` 从 `none` 改为显式 `restart-required`。
- 保证代码和文档对 `ui host/port` 的语义一致。

**Step 3: 为 reload plan 增加更细的分类结果**
- 不要只返回 boolean；新增明确的可消费字段，便于协调器区分：
  - 热应用项
  - 局部模块切换项
  - 必须确认重启项

**Step 4: 用测试固定判定边界**
- 覆盖 `remote.*`、`ui.*`、`channels.*`、`providers.*`、`plugins.*`、未知路径。

## Task 2: 引入 `RuntimeChangeCoordinator` 作为单一编排 owner

**Files:**
- Create: `packages/nextclaw/src/cli/runtime-change/runtime-change-coordinator.ts`
- Create: `packages/nextclaw/src/cli/runtime-change/pending-restart-state.store.ts`
- Modify: `packages/nextclaw/src/cli/runtime.ts`
- Modify: `packages/nextclaw/src/cli/types.ts`
- Test: `packages/nextclaw/src/cli/runtime-change/runtime-change-coordinator.test.ts`

**Step 1: 新建协调器 class**
- owner 负责：
  - 接收变更前后 config
  - 基于 `buildReloadPlan()` 得到判定
  - 调用 `ConfigReloader`
  - 调用 `RemoteServiceModule`
  - 写入 / 清除 `pending restart`
  - 产出统一 `RuntimeChangeResult`

**Step 2: 新建 `PendingRestartStateStore`**
- 保存：
  - `restartRequired`
  - `changedPaths`
  - `reason`
  - `impact`
  - `updatedAt`

**Step 3: 让 `CliRuntime` 持有这个 owner**
- 与 `RestartCoordinator` 并列初始化。
- 禁止其它入口再各自直接拼装 restart 语义。

**Step 4: 固定最小可维护边界**
- 协调器只做“变更应用决策与编排”，不直接读写 UI，不直接做页面文案。

## Task 3: 停止 watcher / gateway config apply 自动重启

**Files:**
- Modify: `packages/nextclaw/src/cli/config-reloader.ts`
- Modify: `packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-context.ts`
- Modify: `packages/nextclaw/src/cli/gateway/controller.ts`
- Test: `packages/nextclaw/src/cli/gateway/controller.test.ts`

**Step 1: 把 `onRestartRequired` 从“直接 requestRestart”改成“登记 pending restart”**
- `ConfigReloader` 命中 `restartRequired` 时，不再直接导致服务 stop/start。

**Step 2: 改 `gateway controller` 的返回合同**
- `config.apply`
- `config.patch`
- `update.run` 之外的运行时配置动作

对可热应用的改动：
- 返回 `live-applied`

对必须重启的改动：
- 返回 `pending-restart`
- 不执行 `requestRestart()`

**Step 3: 保留显式 `restart()` 动作**
- 用户或 agent 明确请求 restart 时，继续走现有 restart coordinator。
- “显式 restart” 和 “因配置变更隐式中断”必须彻底分开。

## Task 4: 把 CLI `config` / `secrets` / `channels` 入口接入统一协调器

**Files:**
- Modify: `packages/nextclaw/src/cli/commands/config.ts`
- Modify: `packages/nextclaw/src/cli/commands/secrets.ts`
- Modify: `packages/nextclaw/src/cli/commands/channels.ts`
- Modify: `packages/nextclaw/src/cli/commands/service.ts`
- Test: `packages/nextclaw/src/cli/commands/config-tests/config.test.ts`
- Test: `packages/nextclaw/src/cli/commands/channels.test.ts`

**Step 1: `config` 命令改为返回 apply 结果，不自动 restart**
- 当后台 service 在运行时：
  - 热应用项直接生效
  - 必须重启项打印明确提示

**Step 2: `channels login/add` 不再请求全进程 restart**
- 对 `channels.*` 改动复用现有 live reload。
- 若某个 channel/plugin 的真实限制导致无法热切换，也必须通过 reload plan 明确声明，而不是命令里偷偷 restart。

**Step 3: `secrets` 路径接入同一语义**
- 即使第一期仍保留部分 no-op，也要确保：
  - 不再自动 restart
  - 命令输出对用户诚实

## Task 5: 把 `remote.*` 改造成进程内模块切换

**Files:**
- Modify: `packages/nextclaw-remote/src/remote-service-module.ts`
- Modify: `packages/nextclaw-remote/src/remote-runtime-actions.ts`
- Modify: `packages/nextclaw/src/cli/commands/remote.ts`
- Modify: `packages/nextclaw/src/cli/commands/remote-support/remote-access-host.ts`
- Modify: `packages/nextclaw/src/cli/commands/remote-support/remote-access-service-control.ts`
- Test: `packages/nextclaw/src/cli/commands/remote-support/remote-access-host.test.ts`
- Test: `packages/nextclaw/src/cli/commands/remote-support/remote-runtime-support.test.ts`

**Step 1: 为 `RemoteServiceModule` 增加明确的重配置入口**
- 例如：
  - `applyConfig()`
  - 或 `restartWithLatestConfig()`
- 语义是重读 config 并在进程内切换 connector，而不是重启整个服务。

**Step 2: 把 `RemoteRuntimeActions.enable/disable` 改成模块操作**
- service 正在运行时：
  - `enable` -> 写 config + 启动/重配置 remote module
  - `disable` -> 停止 remote module
- 不再调用 `restartBackgroundService()`

**Step 3: 让 Remote Access UI 宿主动作也复用这条链**
- `updateSettings()` 保存后不再强制 `restart/start` service。
- 只在 remote runtime 自身需要重连时做模块级切换。

## Task 6: 产品化 `pending restart` 状态与确认入口

**Files:**
- Modify: `packages/nextclaw-server/src/ui/types.ts`
- Modify: `packages/nextclaw-server/src/ui/ui-routes/types.ts`
- Create: `packages/nextclaw-server/src/ui/ui-routes/runtime.controller.ts`
- Modify: `packages/nextclaw-server/src/ui/router.ts`
- Modify: `packages/nextclaw-ui/src/api/types.ts`
- Create: `packages/nextclaw-ui/src/api/runtime.ts`
- Test: `packages/nextclaw-server/src/ui/router.runtime.test.ts`

**Step 1: 新增运行时状态 API**
- `GET /api/runtime/status`
- 返回：
  - 当前是否存在 `pendingRestart`
  - 原因
  - 影响范围
  - 可否确认执行

**Step 2: 新增确认重启 API**
- `POST /api/runtime/restart/confirm`
- 只有用户显式点击后才调用现有 restart coordinator。

**Step 3: 扩展 realtime 事件**
- 新增：
  - `runtime.restart-required`
  - `runtime.restart-cleared`

**Step 4: 保证入口一致**
- UI route、CLI route、agent gateway tool 触发的待重启都必须写到同一份状态里。

## Task 7: 在 UI 中做全局“待重启”提示，而不是把提示埋在单页面

**Files:**
- Create: `packages/nextclaw-ui/src/runtime/restart-consent.store.ts`
- Create: `packages/nextclaw-ui/src/runtime/restart-consent.manager.ts`
- Create: `packages/nextclaw-ui/src/components/ui/restart-required-banner.tsx`
- Modify: `packages/nextclaw-ui/src/api/types.ts`
- Modify: `packages/nextclaw-ui/src/transport/remote.transport.ts`
- Modify: `packages/nextclaw-ui/src/components/chat/chat-page-shell.tsx`
- Modify: `packages/nextclaw-ui/src/components/config/config-layout.ts`
- Modify: `packages/nextclaw-ui/src/components/remote/RemoteAccessPage.tsx`
- Modify: `packages/nextclaw-ui/src/lib/i18n.ts`
- Modify: `packages/nextclaw-ui/src/lib/i18n.remote.ts`
- Test: `packages/nextclaw-ui/src/components/ui/restart-required-banner.test.tsx`

**Step 1: 建立全局 store**
- 保存当前 `pending restart` 视图。
- 页面初次加载拉一次 `/api/runtime/status`。

**Step 2: 通过 realtime 事件更新 UI**
- 收到 `runtime.restart-required` 时展示 banner。
- 收到 `runtime.restart-cleared` 时移除 banner。

**Step 3: 提供用户确认动作**
- banner / modal 展示：
  - 哪些改动已生效
  - 哪些改动必须重启
  - 预计影响
  - “稍后再说”
  - “立即重启”

**Step 4: 保持体验诚实**
- 若当前页面由被重启服务自身提供，明确提示“会短暂断开，随后自动恢复连接”。
- 不允许文案把“必定断开”伪装成“无感热更新”。

## Task 8: 让 agent/tool 路径也遵守同一合同

**Files:**
- Modify: `packages/nextclaw/src/cli/gateway/controller.ts`
- Modify: `packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-tool-registry.ts`
- Modify: `docs/USAGE.md`
- Modify: `packages/nextclaw/resources/USAGE.md`

**Step 1: agent 经 gateway tool 触发配置变更时，不再隐式重启**
- 返回结构化结果，让 agent 可以读到：
  - 已热应用
  - 仍待用户确认重启

**Step 2: 明确 self-management contract**
- 文档中把原先的 “auto-restart / manual restart required” 改成：
  - `hot-applied`
  - `pending user-confirmed restart`
  - `explicit restart`

## Task 9: 验证、冒烟、回滚预案

**Files:**
- Modify: `docs/USAGE.md`
- Modify: `packages/nextclaw/resources/USAGE.md`

**Step 1: 核心单元测试**
- `pnpm -C packages/nextclaw-core test -- --run src/config/reload.test.ts`
- `pnpm -C packages/nextclaw test -- --run src/cli/runtime-change/runtime-change-coordinator.test.ts`
- `pnpm -C packages/nextclaw test -- --run src/cli/commands/remote-support/remote-access-host.test.ts`
- `pnpm -C packages/nextclaw-server test -- --run src/ui/router.runtime.test.ts`
- `pnpm -C packages/nextclaw-ui test -- --run src/components/ui/restart-required-banner.test.tsx`

**Step 2: Service 级冒烟**
- 启动 `pnpm dev start`
- 在 UI 中修改：
  - provider
  - channel
  - remote settings
  - UI port
- 观察：
  - 前三类不打断当前会话
  - UI port 只出现待确认重启提示
  - 用户未点击前，主进程不退出

**Step 3: CLI 冒烟**
- `nextclaw config set providers.openrouter.apiKey ...`
- `nextclaw config set remote.enabled true`
- `nextclaw config set ui.port 55668`
- 观察：
  - 前两项不自动重启
  - 第三项输出明确 `pending restart`

**Step 4: 回滚策略**
- 若 Phase 2 的 remote 模块级切换不稳定，允许短期只保留：
  - 不自动重启
  - 返回 `pending restart`
- 禁止回滚到“静默自动重启”。

## 风险与处理

### 风险 1：某些历史路径依赖“保存后马上 restart”
- 处理：先把自动 restart 改成 `pending restart`，再逐条接入 live apply，不做一步到位的大爆炸替换。

### 风险 2：`remote.*` 模块级切换可能遗漏旧连接清理
- 处理：把 `RemoteServiceModule` 作为唯一 owner，测试覆盖 start -> apply -> stop -> apply 的完整序列。

### 风险 3：UI 看到 `pending restart` 但 CLI/agent 不知道
- 处理：统一通过 `RuntimeChangeResult` 和 `/api/runtime/status` 暴露，不允许只做 UI 私有状态。

### 风险 4：必须重启的范围被误判为可热应用
- 处理：reload plan 判定表必须先补测试，再接业务；`ui.*` 和其它宿主级项宁可保守为 `pending restart`，也不要误做“假热更”。

## 预期收益

- 用户修改大多数设置时，当前对话不断、页面不断、主进程不死。
- 运行态行为从“有时热更新、有时莫名重启”变成可理解的统一体验。
- 代码层从多入口各自 `requestRestart()` 收敛为单一 owner 协调。
- 未来若要继续推进更强的零中断能力，可以在现有协调器之上逐项把 `pending restart` 再收缩成模块级热切换。

## 本计划的建议执行顺序

1. 先做 Task 1-3，停止“静默自动重启”。
2. 再做 Task 5，把 `remote.*` 收成进程内模块切换。
3. 接着做 Task 6-7，把 `pending restart` 产品化。
4. 最后做 Task 8-9，收口 agent/self-management 语义并做完整验证。
