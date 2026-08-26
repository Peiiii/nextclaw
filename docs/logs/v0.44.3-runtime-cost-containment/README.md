# v0.44.3 运行时成本失控治理

## 迭代完成说明

- 本批关闭三条会共同放大长任务额度消耗的根因：共享数据目录的多个进程可重复执行同一 session/cron slot；`maxToolIterations` 只存在于配置而未进入 native runtime；context compaction 用 legacy message 估算并重复计算工具结果。
- 根因由真实会话与本地进程证据确认：cron 任务在约 3 分钟内产生 21 个 run；另一长任务产生 1371 次工具启动和 13 次压缩，而配置上限为 1000；压缩 checkpoint 的原始估算约 64 万至 69 万 token，真实模型输入可用面约 19 万。
- 修复落在三个唯一 owner：共享本地 execution claim 负责跨进程领取；冻结的 run spec 与 execution manager 负责整次 run 工具预算；compaction preflight 复用 provider message converter。没有在 UI、模型输出或下游会话增加症状性去重。
- 稳定设计见 [运行时成本失控三项治理设计](../../designs/2026-08-26-runtime-cost-containment.design.md)。原单进程 cron 设计保留热重载根因，并已标注由本设计扩展。

## 测试/验证/验收方式

- Core：相关 3 个测试文件 26 项通过，覆盖双实例 cron 计划槽、completed marker 恢复、死 owner/malformed claim、非 owner 释放、既有 compaction 预算和 cron cadence。
- Native runtime：全量 5 个测试文件 25 项通过；上限为 2 时第三个串行或并行工具均不会启动，跨模型轮共享同一预算并产生 terminal `RunError`。
- Kernel：compaction/model-input 与 request/queue/metadata/diagnostics 两组共 60 项通过；覆盖重复 `resultContentItems` 不再二次估算、旧 checkpoint 再压缩、第二进程在消息持久化和 runtime start 前被拒绝；其中 request 组在 Review 返工后又单独重跑 25 项并通过。
- `@nextclaw/core`、`@nextclaw/ncp-agent-runtime-next`、`@nextclaw/kernel` TypeScript 检查通过；触达文件 targeted ESLint、doc naming 与 `git diff --check` 通过。
- scoped maintainability guard 为 0 error、4 warning。全工作区 governance 仍被另一批 extension-runtime WIP 的 5 个既有文件角色命名阻塞，本批未修改这些文件。
- 未重启用户当前安装态或开发实例；constructor/object graph 改动使用隔离组装测试验收，避免打断真实任务或继续消耗模型额度。

## 发布/部署方式

- 本批已形成一次本地提交；未 push、发布、部署或重启 NextClaw。
- 新增 patch changeset，覆盖 `@nextclaw/core`、`@nextclaw/kernel` 与 `@nextclaw/ncp-agent-runtime-next`；随后续正常版本批次发布后才会进入安装态。

## 用户/产品视角的验收步骤

1. 同时运行两个共享同一 NextClaw home 的进程，触发同一 cron 计划槽，确认只产生一个 session run，并能在诊断中看到另一领取被 suppressed。
2. 向另一个进程发送同一 session 的新 run，确认 active owner 存在时不会写入第二条用户消息或启动第二个模型请求；原 run settle 后可再次发送。
3. 把测试 Agent 的 `maxToolIterations` 设为小值，确认达到上限后出现明确错误，且不会多执行一个并行工具。
4. 打开含大工具结果的长会话，确认窗口统计不再同时计算持久化结果与 provider tool result，连续压缩后仍保留旧摘要并继续运行。

## 可维护性总结汇总

- 一个共享 claim service 承担 cron 与 session 两个真实消费者共同需要的原子获取、owner 校验和死进程恢复，删除 cron 的进程内平行执行 owner。
- 工具预算归已有 execution manager；native runtime 主循环本次保持零净增长。压缩预检删除 legacy bridge 估算路径，provider converter 成为输入形状事实源。
- `CronService`、compaction preflight 与 request manager 接近文件预算线，guard 给出 warning；主观复核确认新增状态均服务当前不变量，没有新增 factory、registry、通用 lease DSL 或无消费者配置。
- 组合文件 `nextclaw-kernel.ts` 的超预算 error 来自同工作区另一批 capability-grant/extension WIP（总增量 78 行）；本批只增加现有 manager 的依赖装配，未改写或混入那批实现。

## NPM 包发布记录

- `@nextclaw/core`：需要 patch 发布，changeset 已添加，状态为待统一发布。
- `@nextclaw/kernel`：需要 patch 发布，changeset 已添加，状态为待统一发布。
- `@nextclaw/ncp-agent-runtime-next`：需要 patch 发布，changeset 已添加，状态为待统一发布。
- 本任务未查询或修改 registry、tag、GitHub Release 与 runtime channel。
