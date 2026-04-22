# Startup Readiness Debug Working Notes

## 症状定义

- 用户感知问题：服务进程已经起来，但“启动后真正可用”仍然很晚。
- 当前可验证信号：`bootstrap-ready` 约 `24.7s~27.9s`，显著晚于 `auth/status`、`health`、`ncpAgent.ready` 的约 `1.8s~2.4s`。
- 正确目标：把最大耗时 owner 缩到可明确负责的阶段，再决定是否做架构改造。

## 黄金复现

- 命令：`pnpm smoke:startup-readiness -- --runs 3 --timeout-ms 90000 --criterion bootstrap-ready`
- 环境：隔离 `NEXTCLAW_HOME`
- 观测点：`ui-api`、`auth-status`、`health`、`ncp-agent-ready`、`bootstrap-ready`
- 后续补充：在同一入口下叠加 `NEXTCLAW_STARTUP_TRACE=1`

## 链路地图

- `serve startup`
- `UI API reachable`
- `/api/auth/status ok`
- `/api/health ok`
- `ncpAgent.ready`
- `hydrate capabilities`
- `start plugin gateways`
- `start channels`
- `wake restart sentinel`
- `bootstrap ready`

## 观察点计划

- 优先读取 `startup-trace` 输出，按阶段切分后半段耗时。
- 重点观察 `service-gateway-bootstrap.service.ts`、`service-capability-hydration.service.ts` 与 plugin/channel 启动链。
- 只在阶段边界补观察，不在整条链路泛滥加日志。

## 当前假设与缩圈实验

- 假设 A：最大耗时主要落在 `hydrate capabilities`。
- 假设 B：plugin gateways 或 channels 启动存在串行大头。
- 假设 C：`wake restart sentinel` 或其它后置动作把 `markReady` 推迟了。

## 根因与修复位点

- 尚未定位。
- 当前目标是先找到第一个超长阶段 owner，而不是提前决定 UI 或接口层补丁。

## 同链路验收

- 每次改动后复跑同一条 `smoke:startup-readiness` 命令。
- 若涉及阶段 owner 改动，必须比较 `bootstrap-ready` 主口径与阶段差值是否同步下降。
