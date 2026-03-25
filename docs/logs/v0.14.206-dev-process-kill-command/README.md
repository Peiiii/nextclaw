# v0.14.206-dev-process-kill-command

## 迭代完成说明

- 在现有本地进程巡检脚本上新增 `--kill` 模式，用同一套识别逻辑定位所有本地 `pnpm dev start` 与独立 `serve` 实例。
- 根 `package.json` 新增 `pnpm dev:kill`，用于一条命令停止所有匹配到的本地开发实例。
- 杀进程策略为：先按目标 `pgid` 发送 `SIGTERM`，等待后再次扫描；若仍有残留，再补 `SIGKILL`，最后输出剩余数量。
- 将表格/详细输出逻辑拆到 `scripts/dev-process-report.mjs`，避免主脚本继续膨胀并满足可维护性预算。

## 测试/验证/验收方式

- 执行 `PATH=/opt/homebrew/bin:$PATH pnpm dev:status`，确认状态命令仍正常输出
- 执行 `PATH=/opt/homebrew/bin:$PATH node scripts/dev-process-status.mjs --json` 并用 Python 解析，确认 JSON 可读
- 执行 `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths scripts/dev-process-status.mjs scripts/dev-process-report.mjs package.json`
- 本次未直接执行 `pnpm dev:kill` 冒烟：原因是当前机器上已有大量真实本地实例，直接验证会立即终止用户现场中的全部开发进程

## 发布/部署方式

- 不涉及远程部署、数据库 migration 或线上发布。
- 合并后在仓库根目录直接执行 `pnpm dev:kill` 即可使用，无需额外安装步骤。

## 用户/产品视角的验收步骤

1. 在仓库根目录执行 `pnpm dev:status`，确认待清理实例列表符合预期
2. 执行 `pnpm dev:kill`
3. 观察输出中的 `remaining after SIGTERM` 与 `remaining after SIGKILL`
4. 再次执行 `pnpm dev:status`，确认残留实例已经清空，或仅剩个别无法回收的异常目标
