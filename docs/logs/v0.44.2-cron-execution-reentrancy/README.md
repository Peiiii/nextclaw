# v0.44.2 定时任务执行重入修复

## 迭代完成说明

- 修复同一个定时任务在一次执行尚未完成时，因为任务内部更新其它定时任务而被热重载重复触发的问题。
- 根因位于 `CronService`：owner 自己写入 `jobs.json` 后，文件 watcher 仍重新载入相同快照；执行中的一次性任务尚未结算，reload 又把它识别为到期任务并立即运行，形成反馈环。
- 根因确认来自真实会话 API：会话 `ncp-mt8yjtiz-70rq3wln` 的一次性任务 `1707a266` 在约 3 分钟内产生 21 个不同 run。所有 run 都显示 `modelSource=session`、模型为 `codex-sub/gpt-5.6-sol`，并产生实际工具调用，排除了模型继承和 skill runtime 未启动是第一个错误边界。
- 修复落在唯一 Cron owner：相同持久化快照不再 reload；执行中的 job id 不可再次领取；若外部 reload 替换了 store，完成时按稳定 job id 结算当前权威对象。没有在会话、UI 或工具层增加症状性去重。
- 稳定设计见 [Cron 执行领取与热重载安全设计](../../designs/2026-08-26-cron-execution-claim-and-reload-safety.design.md)。

## 测试/验证/验收方式

- 修前定向回放：同一个一次性 job 在首轮 `onJob` 阻塞期间更新 cron store 并 reload，断言期望 1 次时实际得到 2 次。
- 修后 `packages/nextclaw-core/src/features/cron/services/cron.service.test.ts`：9/9 通过，覆盖 self-write reload、外部 reload、同 job 并发领取、一次性删除、past-due reload、周期 cadence 和 timer 失败恢复。
- `packages/nextclaw-service/src/utils/gateway-cron-job-handler.utils.test.ts`：4/4 通过，并锁定 cron run payload 不指定 model，由目标会话继承。
- `@nextclaw/core` 与 `@nextclaw/service` TypeScript 检查通过；触达文件 targeted ESLint、`git diff --check` 通过。
- `lint:new-code:governance` 的文件名、目录名和文档名阶段通过；全仓随后被 5 个与本任务无关的 extension-runtime WIP 文件角色命名阻塞，本任务未修改这些文件。

## 发布/部署方式

- 本任务未提交、推送、发布、部署或重启当前 NextClaw 实例。
- 已新增 `@nextclaw/core` patch changeset；后续随正常版本批次发布并在实例更新后生效。

## 用户/产品视角的验收步骤

1. 创建一个绑定已有会话、未单独指定模型的一次性定时任务。
2. 让任务运行时启用或修改另一条定时任务。
3. 确认当前任务只产生一个输入消息和一个 run，完成后一次性任务被正常删除或禁用。
4. 查看 run 详情，确认 `modelSource` 为 `session`，实际模型与目标会话绑定模型一致。
5. 确认任务仍可正常调用技能与工具，并留下 assistant 终态。

## 可维护性总结汇总

- 复用 `CronService` 的 store、timer 和执行生命周期 owner，只增加执行中 job id 集合与一个结算方法，没有新增 manager、service、配置字段或平行队列。
- 结算逻辑从旧对象直接修改收敛为按稳定 id 更新当前 store，owner 与 reload 生命周期边界更清晰。
- 回归测试按 scheduling、reload safety、persistence/diagnostics 拆分，关闭新增的测试函数预算 finding。
- scoped maintainability guard 最终为 0 error、1 个未恶化 warning；warning 是 `packages/nextclaw-service/src/utils` 既有目录文件数超预算，本次没有新增文件或扩大目录职责。

## NPM 包发布记录

- `@nextclaw/core`：需要 patch 发布；npm registry 当前版本为 `0.17.9`，本地工作区清单为 `0.17.8`，本任务未发布，changeset 状态为待统一发布。
- `@nextclaw/service`：没有生产代码变化，不单独发布。
