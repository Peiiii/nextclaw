# v0.18.64 Local UI Stale State Diagnostics

## 迭代完成说明

本轮处理的是本地 `nextclaw status` 指向旧 URL，页面打不开后缺少旧服务退出证据链的问题。

已确认的现场链路：

- `service.json` 指向旧 managed service PID / 旧 UI URL。
- 旧 PID 已退出，旧 URL health 不可达。
- 另一个 Desktop runtime 仍可用，但旧 managed service 为什么退出，现有日志没有 exit code / signal / expected stop 证据。

根因未完全定位：旧 managed service 退出的直接原因无法从现有日志恢复。已定位到的系统缺口是 runtime 生命周期日志不足，导致只能证明“旧进程退出且 state stale”，不能证明“为什么退出”。

本轮已落地 Phase 2 证据链增强：

- foreground `serve-process` 记录 `runtime.process.started`、`runtime.process.ready`、`runtime.process.exited`。
- managed service 启动、state 写入、ready、stop 请求和 state 清理记录稳定事件。
- Desktop embedded runtime 子进程启动、ready、stop 请求和退出记录稳定事件，并带 PID、端口、URL、exit code、signal、expected 与 suppress restart 信息。
- 将 managed startup service 中的纯路由 / ready snapshot 解析逻辑移到 `utils/managed-service-routing.utils.ts`，避免继续膨胀已超预算文件。

暂未落地：

- `nextclaw status` 主输出区分 stale URL 与 available Desktop UI。
- `status --fix` stale state 归档。
- `doctor ui` 或 UI 诊断入口。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C apps/desktop tsc`
- `pnpm -C packages/nextclaw-service test -- src/shared/services/runtime/tests/service-managed-startup.service.test.ts`
- `pnpm -C packages/nextclaw-service lint`
- `pnpm -C apps/desktop lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-service/src/shared/services/runtime/runtime-command.service.ts packages/nextclaw-service/src/shared/services/runtime/service-managed-startup.service.ts packages/nextclaw-service/src/shared/services/runtime/utils/managed-service-routing.utils.ts apps/desktop/src/runtime-service.ts`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `git diff --check -- docs/plans/2026-05-15-local-ui-stale-state-diagnostics-plan.md packages/nextclaw-service/src/shared/services/runtime/runtime-command.service.ts packages/nextclaw-service/src/shared/services/runtime/service-managed-startup.service.ts packages/nextclaw-service/src/shared/services/runtime/utils/managed-service-routing.utils.ts apps/desktop/src/runtime-service.ts`

结果：

- TypeScript 通过。
- 定向 service 测试通过，1 个测试文件 / 3 个测试。
- lint 无 error；`packages/nextclaw-service` 仍有既有 warning。
- maintainability guard 无 error，1 个 warning：`service-managed-startup.service.ts` 已从 625 行降到 583 行，但仍接近 600 行预算。
- governance 新代码检查通过。
- governance backlog ratchet 通过。
- diff whitespace 检查通过。

Desktop 包没有 `test` script；本轮 Desktop 覆盖到 `tsc` 与 lint，未运行单独 Desktop node:test。

## 发布/部署方式

未发布，未部署。

本轮是源码与诊断方案落地，不涉及 NPM 包发布、runtime update channel 或 Desktop 安装包发布。后续若要让用户拿到能力，需要进入统一发布闭环。

## 用户/产品视角的验收步骤

当前可验收的是“下一次类似问题有证据链”：

1. 启动 managed service 或 Desktop runtime。
2. 查看 `~/.nextclaw/logs/service.log`，应能看到 `runtime.process.started` 与 `runtime.process.ready`。
3. 主动停止 managed service，应能看到 `runtime.process.stop_requested` 与 `service_state.cleared`。
4. Desktop embedded runtime 异常退出时，应能从日志看到 `runtime.process.exited`，并带 exit code / signal / PID / uiPort / uiUrl / 最近输出。

尚不能验收的是“status 自动推荐当前可用 URL”，因为 Phase 1 尚未实现。

## 可维护性总结汇总

本轮没有新增独立 lifecycle recorder / store / jsonl，也没有为单个事件族创建新抽象；日志直接放在已有生命周期 owner 中，复用现有 logger。

可维护性动作：

- 删除/迁移：从 `service-managed-startup.service.ts` 移出 96 行纯解析逻辑，使该文件从 625 行降到 583 行。
- 复用：复用 `@nextclaw/core` logging runtime 与既有 Desktop logger。
- 职责收敛：runtime 生命周期事实留在 `RuntimeCommandService`、`ManagedServiceCommandService`、`RuntimeServiceProcess` 这些现有 owner 中。

代码增减报告：

- 生产代码净增约 149 行。
- 文档新增方案与落地状态说明。

维护性结论：

- 本轮是诊断能力增强，生产代码有必要增长。
- 同时已对超预算 startup service 做同域减债，避免在最大风险文件里继续堆日志。
- 剩余 watchpoint：`service-managed-startup.service.ts` 仍接近预算，下一步若继续触达，应优先拆分 orchestration、IO 和 state transition。

## NPM 包发布记录

不涉及 NPM 包发布。
