# v0.19.9 Managed Service Supervisor

## 迭代完成说明

本次修复 NextClaw 托管服务 ready 后失去生命周期观察的问题。

根因是 `nextclaw start/restart` 在托管服务 ready 后将后台进程 `unref()`，父进程退出后没有 supervisor 继续维护运行合同；`service.json` 只在启动前失败或显式 stop/fix 时清理，所以后台进程后续死亡会留下 stale state。原有退出记录也主要依赖普通 `process.exit` 路径，对 `SIGTERM/SIGINT/SIGHUP` 和外部强杀后的状态可信度表达不足。

确认方式是读取本机近两日服务状态与日志，并对照 `service-managed-startup.service.ts`、`runtime-command.service.ts` 的 ready/unref/exit 写入路径。修复不是只在 `status` 读端补救，而是新增 `ManagedServiceSupervisor` 作为生命周期 owner，将启动、ready state、lease heartbeat、退出记录和 liveness 判断收敛到同一个合同。

新增设计文档：`docs/designs/2026-05-23-managed-service-supervisor-design.md`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/service test -- src/shared/services/runtime/tests/service-managed-startup.service.test.ts`
- `pnpm --filter @nextclaw/service test -- src/cli/commands/diagnostics/services/diagnostics-commands.service.test.ts`
- `pnpm --filter @nextclaw/service test -- src/shared/services/runtime src/commands/remote/services/remote-access-host.service.test.ts`，5 个文件 21 个测试通过。
- `pnpm --filter @nextclaw/service tsc`
- `pnpm --filter @nextclaw/service lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
- `pnpm dlx knip --workspace packages/nextclaw-service --include files,exports --reporter compact --no-exit-code --max-show-issues 120`
- `pnpm --filter nextclaw build`
- 临时 `NEXTCLAW_HOME` 真实 dist smoke：启动托管服务，确认 `service.json` 写入 `lease`，等待并确认 heartbeat 推进，发送 `SIGTERM`，再用 `status --json` 确认 `running=false`、`staleState=true`、`staleReason=process-not-running`、`lastExit.reason=signal`、`lastExit.signal=SIGTERM`。

## 发布/部署方式

未发布、未部署。本次只完成本地源码、设计文档、测试和真实 dist 冒烟验证。

## 用户/产品视角的验收步骤

1. 使用临时 `NEXTCLAW_HOME` 执行构建后的 `nextclaw start --ui-port <port>`。
2. 查看 `run/service.json`，应包含 `lease.ownerPid`、`lease.heartbeatAt`、`lease.ttlMs`。
3. 等待超过一次 heartbeat interval 后再次读取，`lease.heartbeatAt` 应更新。
4. 对托管服务 PID 发送 `SIGTERM`。
5. 执行 `nextclaw status --json`，应看到服务不再被误报为正常运行，并包含 stale 原因和最后退出信息。

## 可维护性总结汇总

本次把托管服务生命周期从启动 helper、state store、diagnostics、remote service control 的分散判断收敛到 `ManagedServiceSupervisor` owner，删除了 `service-managed-startup.service.ts` 中大段 free function 启动逻辑，减少重复 stale 判断，并让 status/doctor/start/remote control 复用统一 liveness 合同。

可维护性 guard 结果：检查 9 个相关生产文件，错误 0、警告 0；生产代码增减为新增 688 行、删除 246 行、净增 442 行。`pnpm lint:new-code:governance` 通过，其中 `managed-service-state.store.ts` 仍被报告为 legacy shared drift 警告，但本次没有继续把编排逻辑塞进 store，只扩展了状态合同类型。

删除/收窄项：旧 `spawnManagedService` free function 已删除；remote control 的裸 PID 存活判断已删除并改用 supervisor liveness；不再写入的 `unhandledRejection` / `unknown` 退出 reason 预留值已删除；`ManagedServiceStartup`、`ManagedServiceLiveness`、`ManagedServiceExitReason` 和 `createLease` 从公共表面收窄为内部实现细节。

本次属于新增用户可观察的可靠性能力：NextClaw 能表达托管服务是否仍有有效租约、最后一次 heartbeat 何时发生、可处理信号退出原因是什么。因此没有按纯非功能改动使用 `--non-feature` 行数闸门；实际生产代码净增来自新增生命周期 owner 与诊断状态合同。

## NPM 包发布记录

不涉及 NPM 包发布。
