# v0.15.77-cron-ncp-cutover-remove-legacy

## 迭代完成说明

- 将 `packages/nextclaw/src/cli/commands/service-support/gateway/service-cron-job-handler.ts` 从 `runtimePool.processDirect(...)` 旧入口切到新 NCP 链路：cron 现在通过 live `UiNcpAgentHandle.runApi.send(...)` 执行，不再走 legacy 直驱。
- cron 执行上下文收敛为稳定的 NCP session：固定使用 `sessionId = cron:<jobId>`，并把 `agentId`、`accountId`、`channel/chatId`、`cron_job_*` 等 metadata 正式写入 NCP 请求；`deliver` 仅负责是否把最终回复转发到 bus。
- 删除了 cron 对 legacy fallback 的依赖：当 NCP agent 尚未 ready 时，cron 显式失败，不再偷偷回落到旧链路。
- 第二轮续改继续删减：移除了 “run stream 没给 `MessageCompleted` 时再回读 persisted session history” 的 fallback。cron 现在只认本次 NCP run 流里的最终 assistant 消息；拿不到就直接失败，不再偷偷补救。
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
- 定向治理：
  - `pnpm lint:new-code:governance -- packages/nextclaw/src/cli/commands/service-support/gateway/service-cron-job-handler.ts packages/nextclaw/src/cli/commands/service-support/gateway/tests/service-cron-job-handler.test.ts packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-startup.ts packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-context.ts packages/nextclaw/src/cli/commands/service-support/gateway/tests/service-gateway-startup.test.ts packages/nextclaw/src/cli/commands/service-support/session/tests/service-deferred-ncp-agent.test.ts packages/nextclaw/src/cli/commands/ncp/runtime/ui-ncp-agent-handle.ts`
  - 结果：通过
- 定向可维护性守卫：
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw/src/cli/commands/service-support/gateway/service-cron-job-handler.ts packages/nextclaw/src/cli/commands/service-support/gateway/tests/service-cron-job-handler.test.ts packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-startup.ts packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-context.ts packages/nextclaw/src/cli/commands/service-support/gateway/tests/service-gateway-startup.test.ts packages/nextclaw/src/cli/commands/service-support/session/tests/service-deferred-ncp-agent.test.ts packages/nextclaw/src/cli/commands/ncp/runtime/ui-ncp-agent-handle.ts`
  - 结果：通过（`Errors: 0`, `Warnings: 0`, `No maintainability findings.`）
- 第二轮删减后的真实功能冒烟（`2026-04-10`）：
  - 启动隔离环境 service：`NEXTCLAW_HOME=/tmp/nextclaw-cron-smoke-rlbL35/home pnpm -C packages/nextclaw dev serve --ui-port 19321`
  - 等待日志：`✓ UI NCP agent: ready`
  - 真实创建任务：`NEXTCLAW_HOME=/tmp/nextclaw-cron-smoke-rlbL35/home pnpm -C packages/nextclaw dev:build cron add -n smoke-ncp-cutover -m 'Ping from cron smoke' -e 60 --agent engineer`
  - 真实触发任务：`NEXTCLAW_HOME=/tmp/nextclaw-cron-smoke-rlbL35/home pnpm -C packages/nextclaw dev:build cron run 42be0c8a --force`
  - 观测结果：
    - CLI 返回 `✓ Job executed`
    - 真实 session 文件存在：`/tmp/nextclaw-cron-smoke-rlbL35/home/sessions/cron_42be0c8a.jsonl`
    - session metadata 含 `agent_id=engineer`、`cron_job_id=42be0c8a`、`cron_job_name=smoke-ncp-cutover`、`session_origin=cron`、`session_type=native`
  - 结果：通过。已验证 cron 的真实执行入口确实写入 NCP session，而不是 legacy 直驱。
  - 环境备注：当前临时 provider 代理对 Responses API 返回 `404 Not Found`，所以 job state 最终记录为 provider 运行时错误；这不影响本次要验证的“cron 是否进入 NCP 主链路并写出正确 session/metadata”结论。
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
  - 本次顺手减债点：先删掉 cron 对 legacy 直驱入口的依赖，再删掉 “stream 不完整时回读 session history” 的隐式补救，让 cron 对 NCP 的依赖关系变成单一路径、单一真相源、显式失败。
  - 下一步维护性切入口：这个链路里低风险、同问题域的删除空间已经不大；如果后续继续收敛，应该优先看 [service-gateway-context.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-context.ts) 和 [service-gateway-startup.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-startup.ts) 的装配边界，而不是在 handler 里继续堆细碎 helper 调整。
- 可维护性复核结论：通过
- 本次顺手减债：是
- 代码增减报告：
  - 新增：15 行
  - 删除：60 行
  - 净增：-45 行
- 非测试代码增减报告：
  - 新增：12 行
  - 删除：36 行
  - 净增：-24 行
- 可维护性总结：
  - 本次是否已尽最大努力优化可维护性：是。本次核心决策不是继续保留“双轨都能跑”，而是直接让 cron 收敛到 NCP 主链路，并在未 ready 时 fail-fast。
  - 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。这轮续改没有补任何兜底，反而继续删除了 history fallback，并把 handler 上下文依赖收窄到 `runApi` 单一入口。
  - 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。相对上一轮提交，本轮总计净删 `45` 行，非测试代码净删 `24` 行；没有新增文件，也没有再引入新的分支或 fallback。
  - 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。`service-cron-job-handler` 现在只保留“构造 metadata + 调用 NCP run + 处理最终事件”三件事，不再跨到 session history 补救逻辑，也不再依赖额外 `sessionApi`。
  - 目录结构与文件组织是否满足当前项目治理要求：基本满足。本次仅在既有 gateway/session test 目录新增一条定向测试文件，没有再引入新的扁平热点目录；但 [service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/service.ts) 仍是历史红区文件，本次已做到不继续增长。
  - 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。本结论基于独立复核，而不是只复述守卫；本轮复核结论为 `no maintainability findings`，仅保留一个后续观察点：若 service gateway 装配链路继续膨胀，应转去处理 startup/context 边界，而不是再往 cron handler 塞逻辑。
  - no maintainability findings
