# Startup Readiness Baseline

## 当前主口径

- 主口径：`bootstrap-ready`
- 辅助口径：
  - `ui-api`
  - `auth-status`
  - `health`
  - `ncp-agent-ready`

## 当前长期目标

- 把“启动慢不慢”变成可重复、可比较、可长期复用的治理机制，而不是一次性判断。
- 任何启动优化都先有基线，再有排序，再做实现。
- 优先压缩最大阶段差值，避免只优化小头。

## 当前基线命令

```bash
pnpm smoke:startup-readiness -- --runs 3 --timeout-ms 90000 --criterion bootstrap-ready
pnpm smoke:startup-readiness -- --runs 1 --timeout-ms 60000 --criterion ncp-agent-ready
pnpm smoke:startup-readiness -- --runs 1 --timeout-ms 60000 --criterion auth-status
```

## 最新基线结果

日期：`2026-04-23`

### bootstrap-ready 三轮

- `uiApiReachableMs`: `2043 / 1815 / 1815`
- `authStatusOkMs`: `2043 / 1815 / 1815`
- `healthOkMs`: `2043 / 1815 / 1815`
- `ncpAgentReadyMs`: `2043 / 1815 / 1815`
- `bootstrapReadyMs`: `27867 / 24707 / 24802`

聚合：

- `uiApiReachableMs`: `median=1815ms`, `mean=1891ms`, `p95=2043ms`
- `authStatusOkMs`: `median=1815ms`, `mean=1891ms`, `p95=2043ms`
- `healthOkMs`: `median=1815ms`, `mean=1891ms`, `p95=2043ms`
- `ncpAgentReadyMs`: `median=1815ms`, `mean=1891ms`, `p95=2043ms`
- `bootstrapReadyMs`: `median=24802ms`, `mean=25792ms`, `p95=27867ms`

### ncp-agent-ready 单轮补充

- `uiApiReachableMs`: `2243ms`
- `authStatusOkMs`: `2243ms`
- `healthOkMs`: `2243ms`
- `ncpAgentReadyMs`: `2243ms`

### auth-status 单轮补充

- `uiApiReachableMs`: `2440ms`
- `authStatusOkMs`: `2440ms`
- `healthOkMs`: `2440ms`
- `ncpAgentReadyMs`: `2440ms`

## 当前判断

- 当前最大耗时不在最开始的 UI/API bring-up。
- `/api/auth/status` 已提升为正式监测节点；最新基线显示它与 `health`、`ncpAgent.ready` 一样，通常在 `1.8s~2.4s` 内就可用，不是当前最长的大头。
- 当前最大耗时在 `ncpAgent.ready -> bootstrap ready` 之间，最新三轮差值约 `22.9s~25.8s`。
- 因此下一阶段应继续拆能力水合链路，而不是优先微调前面约 `2s` 的 UI/API 建立。

## 当前下一步优先级

1. 用同一脚本继续测 `bootstrap-ready`，并结合 `NEXTCLAW_STARTUP_TRACE=1` 拆 `hydrate capabilities / start plugin gateways / start channels / wake restart sentinel`。
2. 找出 `ncpAgent.ready -> bootstrap ready` 之间最大的单段耗时。
3. 只在确认最大耗时 owner 后，再进入实现优化。
