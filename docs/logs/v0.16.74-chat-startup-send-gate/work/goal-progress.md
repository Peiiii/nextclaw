当前目标
- 先建立“从启动开始到最终可用”的可量化指标，再基于指标决定优化顺序。

明确非目标
- 不在没有测量证据前直接改产品启动实现。
- 不把单个猜测当成结论直接优化。

冻结边界 / 不变量
- 先有基线，再谈优化。
- 指标必须可重复、可多轮跑、可比较。
- 测量默认走隔离 `NEXTCLAW_HOME`，避免历史状态污染。

已完成进展
- 已撤回上一轮未经量化支撑的前端启动改动。
- 已确认可复用的观测点有 `/api/auth/status`、`/api/health`、`/api/runtime/bootstrap-status`、`NEXTCLAW_STARTUP_TRACE=1`。
- 已新增可重复冷启动基线脚本 `pnpm smoke:startup-readiness`。
- 已跑出最新真实基线：`auth/status`、`health`、`ncpAgent.ready` 均约 `1.8s~2.4s`，`bootstrap ready` 约 `24.7s~27.9s`。

当前下一步
- 先提交本轮监测机制，再结合 `NEXTCLAW_STARTUP_TRACE=1` 去拆 `ncpAgent.ready -> bootstrap ready` 这段约 `22.9s~25.8s` 的大头，并继续用同一脚本复测。

锚点计数器
- 0/20
