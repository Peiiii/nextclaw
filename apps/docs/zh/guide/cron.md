# Cron 与 Heartbeat

这页讲“如何让助手自动做事”。

## Cron：按计划触发任务

你可以创建：

- 一次性任务（到点执行一次）
- 周期任务（每天/每周等重复执行）

常见用途：

- 每天生成日报草稿
- 固定时间提醒
- 周期巡检与汇总

周期任务的重启语义：

- 重启或热重载后，已有 interval 任务不会补跑停机期间错过的触发点。
- 服务恢复后，会沿原有 interval 节奏对齐到下一次触发，而不是从重启时刻重新开始计时。
- 如果服务已经在运行中（包括前台 `nextclaw serve` / `pnpm -C packages/nextclaw dev serve`），`nextclaw cron add / enable / disable / remove / run` 会优先通过当前服务 API 立即生效，而不是依赖本地文件 watcher 之后再被动看见。

## 推荐使用顺序（UI 优先）

1. 先建一个一次性任务，确认链路可用。
2. 再建一个周期任务（例如每天一次）。
3. 最后再加复杂规则（渠道投递、禁用后强制运行等）。

## Heartbeat：周期检查工作区任务

网关运行时会定期检查工作区里的 `HEARTBEAT.md`。
如果文件中有可执行任务，Agent 会自动处理。

如果你暂时不需要 Heartbeat，保持文件为空即可。

## 进阶入口（可选）

如果你需要脚本化管理任务，可使用 `nextclaw cron` 子命令。
详细参数与示例见：[命令](/zh/guide/commands)。
