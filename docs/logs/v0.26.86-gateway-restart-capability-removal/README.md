# Gateway Restart Agent 能力移除

## 迭代完成说明

本次删除 agent `gateway` tool 的 `restart` action、对应 schema 参数、controller 入口和无用依赖，同时保留 CLI、宿主控制及 `update.run` 所需的内部重启基础设施。

根因是 agent 在当前会话内请求 gateway 重启时，原运行会先因进程退出而中断；进程恢复后，NCP 会话又没有可解析的 channel/chat route，restart wake 无法把结果投递回原会话。因此工具虽然先返回 `Restart scheduled`，但从未形成可完成的端到端用户闭环。该结论由真实非开发运行 journal/service 日志与代码链路共同确认，不是只依据 mocked 单测推断。

修复针对根因收缩能力边界：不再让活跃 agent 会话拥有会主动切断自身传输的 restart action；配置变更需要重启时，统一指导用户从外部终端运行顶层 `nextclaw restart`。同时修正 native context、自管理 skill、CLI 提示和 USAGE，明确 `nextclaw gateway` 是前台启动命令，没有 `start/status/restart/stop` 子命令。历史迭代记录保留为当时事实，没有回写。

## 测试/验证/验收方式

- `@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/service` 定向 TypeScript 检查通过。
- gateway controller/manual-restart/restart-manager/restart-command 定向测试通过，共 10 个测试。
- native context provider 合同测试通过，共 4 个测试；覆盖顶层生命周期命令和外部终端 restart 指导。
- 受影响源码与测试的 targeted ESLint 无 error；native context 既有大测试保留 2 条 `max-lines-per-function` warning。
- `git diff --check` 通过，官方 USAGE 同步脚本已运行。
- 未实际重启当前 NextClaw 实例：本次目标是删除不可闭环能力，真实重启会中断当前会话且不提供额外证明。

## 发布/部署方式

本次只完成源码提交，不执行发布、部署、push 或真实服务重启。后续由统一 NPM 发布流程消费 changeset。

## 用户/产品视角的验收步骤

1. 查看 agent `gateway` tool schema，确认 action 列表不再包含 `restart`。
2. 传入旧的 `restart` action，确认返回 `Unknown action: restart`，且不会清除 pending-restart 状态或触发进程退出。
3. 触发一项需要重启的配置变更，确认提示要求在外部终端运行 `nextclaw restart`。
4. 查看 native agent context 与自管理文档，确认只列出顶层 `nextclaw status/start/restart/stop`，不再推荐不存在的 `nextclaw gateway restart`。

## 可维护性总结汇总

已按删除优先原则收缩公开能力和 service controller：没有新增兼容 wrapper、fallback 或第二条重启路径，内部重启 owner 继续只服务 CLI、宿主控制和 update relaunch。本次非测试代码净减 67 行，owner 与生命周期边界更清楚。

自动可维护性守卫检查 13 个源码/测试文件，0 error；两条目录预算 warning 均为既有状态，文件数 delta 为 0。因跨 core/kernel/service 收缩 owner 且守卫有 warning，已按条件完成主观复核，结论为无可维护性发现。

## NPM 包发布记录

需要后续 patch 发布，当前改动均尚未发布并标记为 `待统一发布`：

- `@nextclaw/core`：当前 workspace 版本 `0.15.21`。
- `@nextclaw/kernel`：当前 workspace 版本 `0.6.23`。
- `@nextclaw/service`：当前 workspace 版本 `0.3.24`。
- `nextclaw`：当前 workspace 版本 `0.30.0`。

本次未执行 NPM 发布；发布触发条件是后续统一 release 批次消费 `.changeset/remove-gateway-agent-restart.md`。
