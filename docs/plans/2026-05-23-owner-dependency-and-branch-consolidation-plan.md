# Owner Dependency And Branch Consolidation Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `executing-plans` style task-by-task execution. Before code changes, also use `nextclaw-clean-implementation`, `classic-software-design-principles`, and `nextclaw-validation-workflow`.

**Goal:** 对 NextClaw 当前代码库做一次统一排查与改造，清理“没必要的可选分支”“没必要的回调函数切片”“假 owner / 空心 owner / 双链路 mutation”等结构性问题，让核心链路回到直接 owner 依赖和单一路径。

**Architecture:** 以 owner 边界为主线排查，不按单个报错打补丁。真实 owner 直接依赖真实 owner；跨 owner 事实通知走已有 `EventBus` / `Ingress` / 协议事件；配置、session、runtime、metadata、context compaction 等领域只保留一个标准 mutation 链路。

**Tech Stack:** TypeScript monorepo、NCP runtime/session、NextClaw kernel managers、shared `EventBus`、Vitest、ESLint、governance scripts、maintainability guard。

---

## 背景

这次问题从 `sessions_spawn`、子会话、metadata 覆盖、左侧 session preview 闪烁一路暴露出来。表层症状是某些会话状态一会儿有一会儿没，或者错误参数仍然创建了普通会话；深层问题是系统里存在多条平行链路：

- owner 构造参数里传入 `getConfig`、`isLiveSessionRunning`、`onSessionUpdated`、`setSessionMetadata`、`updateSessionMetadata` 这类函数切片。
- 一些 manager 接收 optional dependency，然后用 `if (this.xxxManager)` 分支表达“可能存在”的主路径。
- metadata 既能由 runtime factory 写，也能由 session manager 写，还能由 live session snapshot 间接覆盖。
- context compaction 曾经返回一组结果让调用方代写 metadata，而不是自己调用真正 owner 完成领域动作。

这些不是单点代码风格问题，而是系统自感知和自治能力的基础结构问题。NextClaw 要成为统一入口，必须能稳定知道“谁是事实 owner、哪条链路改变了状态、哪个事件代表真实事实”，否则后续自进化、学习、复盘、session continuity 都会被不一致状态拖住。

## 目标原则

1. **直接依赖 owner**：同一进程、同一对象图、同一生命周期内，业务 owner 应直接依赖对方 owner 对象，不把能力拆成 `getXxx` / `onXxx` / `setXxx` / `isXxx` 回调函数传来传去。
2. **单一路径优先**：同一事实、状态变更、事件或 mutation 语义只保留一条标准主链路。
3. **必需依赖不 optional**：如果某个 manager 是主路径必需对象，构造参数必须必填，调用处不得留 `if (this.manager)` 分支。
4. **metadata mutation 统一语义**：`setMetadata` 表示整体替换；`updateMetadata` 表示 merge patch。删除 `patchMetadata`、runtime callback 写回、event append snapshot 覆盖等平行入口。
5. **事件只表达事实**：跨 owner 通知使用标准事件，不用回调挂钩；事件 payload 必须是领域事实本体，不混入临时展示上下文。
6. **例外必须有边界**：只有真实插件扩展点、外部协议适配、异步观察者、测试替身或明确策略注入，才允许 callback/function dependency。

## 非目标

- 不为了追求形式统一，把所有函数参数都改成 class。
- 不删除真实外部扩展点，例如插件 provider 注册、HTTP/stdio runtime 的协议回调、测试替身。
- 不把 `undefined` 全部机械消灭；只有主路径必需依赖和伪 optional 分支需要收敛。
- 不在本轮顺手重写无关 UI 或 legacy channel 兼容路径。

## 排查清单

### Callback / Function Slice

重点搜索：

```bash
rg "get[A-Z][A-Za-z0-9]*:|set[A-Z][A-Za-z0-9]*:|update[A-Z][A-Za-z0-9]*:|is[A-Z][A-Za-z0-9]*:|on[A-Z][A-Za-z0-9]*:" packages/nextclaw-kernel/src packages/nextclaw-core/src packages/nextclaw-server/src
rg "=> this\\.[A-Za-z0-9_]+\\.[A-Za-z0-9_]+\\(" packages/nextclaw-kernel/src packages/nextclaw-server/src
```

分类规则：

- 如果 callback 只是把已有 owner 的方法切下来传入，默认改为直接传 owner。
- 如果 callback 是跨进程、插件、事件订阅或 provider protocol 所需，保留，但必须命名为真实边界能力。
- 如果 callback 用于测试替身，生产代码不应因此退化成 callback contract。

### Optional Main Path Branch

重点搜索：

```bash
rg "if \\(this\\.[A-Za-z0-9_]+Manager\\)|if \\(this\\.[A-Za-z0-9_]+Service\\)|\\?\\." packages/nextclaw-kernel/src packages/nextclaw-server/src
```

分类规则：

- 主路径 owner 必需时，构造参数改为必填，并删除分支。
- 真实运行态可能缺失时，保留显式状态或错误语义，不用 no-op fallback 掩盖。
- 测试为了少造对象而把生产依赖改 optional，必须回退。

### Metadata Mutation

重点搜索：

```bash
rg "setSessionMetadata|updateSessionMetadata|patch.*Metadata|metadata.*=" packages/nextclaw-kernel/src packages/ncp-packages
rg "session\\.metadata|runtimeSessionMetadata|metadataPatch" packages/nextclaw-kernel/src
```

目标链路：

- `NcpSessionManager.setSessionMetadata()`：整体替换。
- `NcpSessionManager.updateSessionMetadata()`：merge patch。
- `SessionRunManager.updateSessionMetadata()`：live session + persisted session 同步入口。
- runtime factory 不再拿 metadata 写回调。
- context compaction 不返回让别人代写的 mutation result，而是通过 `SessionRunManager` owner 执行更新。

### Event / Summary / Preview

重点搜索：

```bash
rg "sessionSummaryUpsert|sessionUpdated|sessionMetadataChanged|last_activity_preview|publishSessionChange" packages/nextclaw-kernel/src packages/nextclaw-ui/src
```

目标链路：

- metadata 更新成功后，由 session owner 发布 session updated / summary upsert。
- live running 状态通过标准 run-status 事实投影，不通过 `isLiveSessionRunning` 回调。
- 左侧 session preview 不允许由旧 live snapshot 或 append event 覆盖掉 metadata sidecar 中的新值。

## 执行计划

### Task 1: 建立排查基线

**Files:**
- Read: `packages/nextclaw-kernel/src/app/nextclaw-kernel.ts`
- Read: `packages/nextclaw-kernel/src/managers/*.ts`
- Read: `packages/nextclaw-kernel/src/features/**/services/*.ts`
- Read: `packages/nextclaw-kernel/src/features/**/managers/*.ts`
- Read: `packages/nextclaw-core/src/features/**/managers/*.ts`

**Steps:**

1. 运行 callback/function slice 搜索命令，保存命中列表。
2. 运行 optional main path 搜索命令，保存命中列表。
3. 运行 metadata mutation 搜索命令，保存命中列表。
4. 把命中分成三类：必须改、允许保留、需要进一步证据。
5. 先不改代码，写出每类的 owner 判断依据。

**Validation:**

```bash
git diff --check
```

Expected: no whitespace errors.

### Task 2: 收敛必需 owner 依赖

**Files:**
- Modify as needed: `packages/nextclaw-kernel/src/app/nextclaw-kernel.ts`
- Modify as needed: `packages/nextclaw-kernel/src/managers/*.ts`
- Modify as needed: `packages/nextclaw-kernel/src/features/**/services/*.ts`
- Test: relevant `__tests__` files beside touched managers.

**Steps:**

1. 对每个“只是切 owner 方法传入”的 constructor option，改成传 owner 对象。
2. 在 owner 内部调用语义方法，例如 `configManager.loadConfig()`、`sessionSearch.handleSessionUpdated()`。
3. 删除对应 callback option 类型。
4. 更新构造点和测试 fixture。
5. 搜索旧 option 名，确认无残留。

**Validation:**

```bash
pnpm --filter @nextclaw/kernel tsc
pnpm --filter @nextclaw/kernel test -- <touched-test-files>
```

Expected: all pass.

### Task 3: 删除伪 optional 分支

**Files:**
- Modify: touched managers/services with `if (this.xxxManager)` or optional main-path owner.
- Test: relevant manager tests.

**Steps:**

1. 判断 optional dependency 是否真实可能缺失。
2. 对主路径必需依赖改为必填 constructor option。
3. 删除 `if (this.xxx)` / `?.` / no-op fallback。
4. 若确实可能缺失，改为明确状态或明确错误，不隐藏失败。
5. 更新测试，让 fixture 提供真实最小 owner 替身。

**Validation:**

```bash
pnpm --filter @nextclaw/kernel tsc
pnpm --filter @nextclaw/server tsc
```

Expected: all pass.

### Task 4: 统一 metadata mutation 链路

**Files:**
- Modify as needed: `packages/nextclaw-kernel/src/managers/ncp-session.manager.ts`
- Modify as needed: `packages/nextclaw-kernel/src/managers/session-run.manager.ts`
- Modify as needed: `packages/nextclaw-kernel/src/features/runtime-registry/services/agent-runtime-registry.service.ts`
- Modify as needed: `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-backend.types.ts`
- Test: `packages/nextclaw-kernel/src/managers/__tests__/session-run.manager.test.ts`
- Test: `packages/nextclaw-kernel/src/managers/__tests__/ncp-session.manager.test.ts`

**Steps:**

1. 保留 `setSessionMetadata` 和 `updateSessionMetadata` 两个语义入口。
2. 删除 `patchMetadata`、runtime factory metadata callback、live writer 注入等平行入口。
3. 让 runtime metadata resolve 只返回必要 patch，不整体覆盖已有 metadata。
4. 让 context compaction 通过 `SessionRunManager.updateSessionMetadata()` 更新 checkpoint。
5. 补测试：并发 metadata patch 不互相覆盖；context compaction checkpoint 不清掉 `last_activity_preview`。

**Validation:**

```bash
pnpm --filter @nextclaw/ncp-toolkit tsc
pnpm --filter @nextclaw/kernel test -- src/managers/__tests__/session-run.manager.test.ts src/managers/__tests__/ncp-session.manager.test.ts
```

Expected: all pass.

### Task 5: 排查 session preview 闪烁链路

**Files:**
- Read/Modify as needed: `packages/nextclaw-kernel/src/contributions/session-activity-preview/**`
- Read/Modify as needed: `packages/nextclaw-kernel/src/managers/session-run.manager.ts`
- Read/Modify as needed: `packages/nextclaw-kernel/src/managers/ncp-session.manager.ts`
- Read/Modify as needed: UI session list consumers if backend evidence points there.

**Steps:**

1. 复现或构造测试：写入 `last_activity_preview` 后 append run event。
2. 验证 stored metadata、live metadata、summary upsert 三者是否一致。
3. 如果 summary 闪回，沿 `producer -> owner/state -> persistence/event -> consumer` 找到覆盖者。
4. 修复只能落在 owner 链路，不能在 UI cache 加兜底。
5. 补测试证明旧 snapshot 不再覆盖新 preview。

**Validation:**

```bash
pnpm --filter @nextclaw/kernel test -- src/managers/__tests__/session-run.manager.test.ts src/contributions/session-activity-preview/**/*.test.ts
```

Expected: preview metadata remains stable after run events.

### Task 6: 全量验证与可维护性收口

**Files:**
- All touched files.
- Update: relevant `docs/logs/<latest-related>/README.md` if code changes are made.

**Steps:**

1. 跑 touched package `tsc`。
2. 跑 touched package lint；若包级 lint 只有既有 warning，记录 warning 与本次无关。
3. 跑最贴近链路的 tests。
4. 跑 governance。
5. 跑 maintainability guard。
6. 非新增用户能力时，确保非测试代码净增 `<= 0`。
7. 更新迭代记录，记录根因、验证、可维护性和 NPM 发布状态。

**Validation:**

```bash
pnpm --filter @nextclaw/shared tsc
pnpm --filter @nextclaw/core tsc
pnpm --filter @nextclaw/kernel tsc
pnpm --filter @nextclaw/server tsc
pnpm lint:new-code:governance
pnpm check:governance-backlog-ratchet
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature
```

Expected: all pass; maintainability guard has no errors.

## 允许保留 callback 的判断标准

允许保留的 callback 必须满足至少一个条件：

- 外部协议要求，例如 HTTP client / stdio runtime / provider SDK callback。
- 插件扩展点要求，例如 runtime provider registration 的 `createRuntimeForEntry`。
- 事件订阅语义，例如 `eventBus.on(key, handler)`。
- 测试替身局部使用，但生产 contract 不因此变成 callback 注入。
- 明确策略注入，且策略本身不是被注入 owner 应该拥有的领域职责。

不允许保留的 callback：

- `getConfig: this.configManager.loadConfig`
- `onSessionUpdated: this.sessionSearch.handleSessionUpdated`
- `isLiveSessionRunning: (id) => this.sessionRunManager.isRunning(id)`
- `setSessionMetadata` / `updateSessionMetadata` 作为 runtime factory params。
- 任何只为绕开 constructor dependency、初始化顺序或测试夹具而出现的 function slice。

## 验收标准

- 关键 kernel owner 构造参数不再接收同进程同生命周期的 owner 方法切片。
- 主路径 manager 不再通过 optional dependency 分支表达必需链路。
- session metadata mutation 只有 `set` 与 `update` 两个语义入口。
- context compaction、runtime metadata resolve、session preview 更新都通过 owner API 修改状态。
- 左侧 session preview 不再因为 run event append 或 live snapshot 持久化而闪回。
- 全量 changed-file governance 通过。
- 非新增用户能力的非测试代码净增 `<= 0`。

## 风险与防线

- **风险：误删真实扩展点。** 防线：每个 callback 先分类，插件/provider/协议边界允许保留。
- **风险：为了消灭 optional 把真实未就绪状态变成假默认值。** 防线：真实缺失用明确状态或明确错误。
- **风险：测试为了省事继续要求生产 contract 可选。** 防线：测试 fixture 构造最小 owner 替身。
- **风险：只改 constructor，状态链路仍双写。** 防线：必须沿 producer -> owner -> persistence/event -> consumer 做链路证据。

## 后续执行入口

后续开工时，从 Task 1 的三组搜索命令开始，不要直接按记忆改某个局部点。每完成一个问题域，先做定向测试，再进入下一域；不要等最后才发现 owner 链路仍不闭合。
