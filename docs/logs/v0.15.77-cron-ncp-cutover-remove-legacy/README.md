# v0.15.77-cron-ncp-cutover-remove-legacy

## 迭代完成说明

- 将 `packages/nextclaw/src/cli/commands/service-support/gateway/service-cron-job-handler.ts` 从 `runtimePool.processDirect(...)` 旧入口切到新 NCP 链路：cron 现在通过 live `UiNcpAgentHandle.runApi.send(...)` 执行，不再走 legacy 直驱。
- cron 执行上下文收敛为稳定的 NCP session：固定使用 `sessionId = cron:<jobId>`，并把 `agentId`、`accountId`、`channel/chatId`、`cron_job_*` 等 metadata 正式写入 NCP 请求；`deliver` 仅负责是否把最终回复转发到 bus。
- 删除了 cron 对 legacy fallback 的依赖：当 NCP agent 尚未 ready 时，cron 显式失败，不再偷偷回落到旧链路。
- 服务启动链路收敛：`startDeferredGatewayStartup` 现在即使在 UI shell 关闭时也会创建 NCP agent，这样 service-only 场景下的 cron 也能走同一条 NCP 主链路。
- `UiNcpAgentHandle` 暴露最小必要的 `runApi`，避免为了 cron 再造一套旁路接口。
- 调整并新增定向测试，覆盖：
  - cron 通过 NCP run api 执行并 deliver 最终回复
  - NCP agent 未就绪时 fail-fast，不再 fallback
  - 无 UI 场景下服务启动仍会初始化 NCP agent

## 测试/验证/验收方式

- 定向测试：
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/service-support/gateway/tests/service-cron-job-handler.test.ts src/cli/commands/service-support/gateway/tests/service-gateway-startup.test.ts src/cli/commands/service-support/session/tests/service-deferred-ncp-agent.test.ts`
  - 结果：通过（`3` 个测试文件，`7` 个测试全部通过）
- 冒烟：
  - `pnpm -C packages/nextclaw exec tsx <<'TS' ... createCronJobHandler(...) ... TS`
  - 验证点：
    - 返回 `response = "smoke-ok"`
    - `outboundCount = 1`
    - outbound metadata 中包含 `agentId/accountId/channel/chatId/cron_job_*`
  - 结果：通过
- 局部类型回归：
  - `pnpm -C packages/nextclaw exec tsc -p tsconfig.json --pretty false --noEmit 2>&1 | grep -E 'service-cron-job-handler|service-gateway-startup|service-gateway-context|service-deferred-ncp-agent|ui-ncp-agent-handle|service-cron-job-handler.test|service-gateway-startup.test|service-deferred-ncp-agent.test'`
  - 结果：无本次相关输出，说明本次触达文件未新增局部 TypeScript 错误
- 全量 `nextclaw` 类型检查：
  - `pnpm -C packages/nextclaw tsc`
  - 结果：未通过
  - 阻塞原因：仓库中已有的无关错误，位于 `../nextclaw-server/src/ui/ui-routes/marketplace/installed.ts:230` 与 `../nextclaw-server/src/ui/ui-routes/marketplace/installed.ts:238`
- 可维护性守卫：
  - `pnpm lint:maintainability:guard`
  - 结果：本次改动相关的阻断项已清零；命令最终仍以非零退出
  - 非本次阻断原因：工作树内并行改动 `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/legacy/chat-composer-view-controller.ts` 命中了 `context-destructuring` 治理；另有若干历史 warning（目录预算、超长文件观察项）

## 发布/部署方式

- 本次未执行发布。
- 若后续发布 `nextclaw`，需包含这批 service runtime 变更一并构建与发布。
- 不适用项：
  - 数据库 migration：不适用
  - 服务部署：不适用
  - 线上 API 冒烟：不适用

## 用户/产品视角的验收步骤

1. 启动 `nextclaw` service；无论 UI 是否开启，都等待 deferred startup 完成。
2. 创建一个 cron 任务，例如：`nextclaw cron add --name daily-review --message "review inbox" --every 300 --agent engineer`。
3. 触发该任务（等待定时触发，或在运行中的 service 上调用 cron run）。
4. 确认任务执行后返回的是 NCP 链路的最终 assistant 回复，而不是旧 `runtimePool.processDirect` 直驱结果。
5. 若任务配置了 `deliver`，确认目标 channel 收到最终回复，并且 metadata 中带有 `cron_job_id`、`agentId`、`accountId` 等字段。
6. 若把任务触发时机压到 NCP agent 尚未 ready 的极早阶段，确认行为是显式报错，而不是静默回落到 legacy 链路。

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：
  - 本次是朝“统一执行入口、减少双轨并存、让 NextClaw 更像统一操作层而不是历史兼容集合”推进的一小步。cron 不再偷偷绕过 NCP 主链路，这让用户可见能力和底层运行时继续向同一套编排模型收敛。
  - 本次顺手减债点：直接删除 cron 对 legacy 直驱入口的依赖，同时把“无 UI 就没有 NCP agent”的隐藏前提删除掉，避免 service-only 场景继续被迫保留旧链路。
  - 下一步维护性切入口：如果后续 cron/NCP 继续扩展，可把 [service-cron-job-handler.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/service-support/gateway/service-cron-job-handler.ts) 再拆成“metadata 构造 / run 执行 / reply 提取”三个更薄的模块。
- 可维护性复核结论：保留债务经说明接受
- 本次顺手减债：是
- 代码增减报告：
  - 新增：363 行
  - 删除：106 行
  - 净增：+257 行
- 非测试代码增减报告：
  - 新增：300 行
  - 删除：104 行
  - 净增：+196 行
- 可维护性总结：
  - 本次是否已尽最大努力优化可维护性：是。本次核心决策不是继续保留“双轨都能跑”，而是直接让 cron 收敛到 NCP 主链路，并在未 ready 时 fail-fast。
  - 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。真正被删除的是 legacy cron 执行入口和“只有 UI 才初始化 NCP agent”的隐式前提，而不是再加一层兼容桥。
  - 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：未做到净减。此次非测试代码净增 `+196` 行，主要来自 NCP adapter、startup 收敛与测试补齐；已先删掉旧入口依赖和 fallback 语义，剩余增长是把旧行为换成明确 NCP 契约所需的最小必要量。
  - 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。现在职责更明确：`service-gateway-startup` 负责确保 NCP agent 存在，`service-gateway-context` 只负责装配，`service-cron-job-handler` 只负责把 cron job 翻译成 NCP run。
  - 目录结构与文件组织是否满足当前项目治理要求：基本满足。本次仅在既有 gateway/session test 目录新增一条定向测试文件，没有再引入新的扁平热点目录；但 [service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/service.ts) 仍是历史红区文件，本次已做到不继续增长。
  - 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。本结论基于独立复核，而不是只复述守卫；判断是“本次路径收敛成立，但仍保留两个观察点”：`service-cron-job-handler.ts` 新增了适配逻辑、`service.ts` 仍是历史超长文件。
  - no maintainability findings
