# v0.15.80-heartbeat-ncp-cutover-remove-legacy

## 迭代完成说明

- 将 `heartbeat` 的执行入口从 legacy `runtimePool.processDirect(...)` 切到 NCP 主链路：`HeartbeatService` 仍负责定时轮询 `HEARTBEAT.md`，但真正执行时改为通过 live `UiNcpAgentHandle.runApi.send(...)` 发送标准 NCP message。
- 删除了 `service-gateway-context.ts` 中 heartbeat 对旧 direct path 的直驱依赖，不再让 heartbeat 作为“后台自动执行”里的例外路径继续残留。
- 将 heartbeat NCP 执行逻辑并回既有 `service-cron-job-handler.ts`，避免为 heartbeat 再新增一份重复 handler 文件；固定将 heartbeat 收敛到稳定的 NCP session：
  - `sessionId = heartbeat`
  - metadata 显式写入 `agentId/agent_id`
  - 保留 legacy 语义所需的 `channel=cli`、`chatId=direct`
  - 标记 `session_origin=heartbeat`
- heartbeat 的 NCP 行为与此前 cron cutover 一致：只认本次 run stream 里的最终 assistant message；若 NCP agent 未 ready 或 stream 中没有最终 assistant message，则显式失败，不保留 legacy fallback。
- 相关实施计划见 [Heartbeat NCP Cutover Implementation Plan](../../plans/2026-04-10-heartbeat-ncp-cutover-plan.md)。

## 测试/验证/验收方式

- 定向测试：
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/service-support/gateway/tests/service-cron-job-handler.test.ts src/cli/commands/service-support/gateway/tests/service-gateway-startup.test.ts`
  - 结果：通过（`2` 个测试文件，`5` 个测试全部通过）
- 轻量冒烟：
  - `pnpm -C packages/nextclaw exec tsx <<'TS' ... createHeartbeatJobHandler(...) ... TS`
  - 验证点：
    - 返回 `response = "HEARTBEAT_OK"`
    - 发送 envelope 的 `sessionId = "heartbeat"`
    - metadata 中包含 `agentId/agent_id = main`、`channel = cli`、`chatId/chat_id = direct`、`session_origin = heartbeat`
  - 结果：通过
- 定向治理：
  - `pnpm lint:new-code:governance -- packages/nextclaw/src/cli/commands/service-support/gateway/service-cron-job-handler.ts packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-context.ts packages/nextclaw/src/cli/commands/service-support/gateway/tests/service-cron-job-handler.test.ts packages/nextclaw/src/cli/commands/service-support/gateway/tests/service-gateway-startup.test.ts docs/plans/2026-04-10-heartbeat-ncp-cutover-plan.md`
  - 结果：通过
- 局部类型回归：
  - `pnpm -C packages/nextclaw exec tsc -p tsconfig.json --pretty false --noEmit 2>&1 | rg "service-cron-job-handler|service-gateway-context|service-gateway-startup|service-cron-job-handler.test|service-gateway-startup.test"`
  - 结果：无输出，说明本次触达文件未新增局部 TypeScript 错误
- 全量 `nextclaw` 类型检查：
  - `pnpm -C packages/nextclaw tsc`
  - 结果：未通过
  - 阻塞原因：仓库中已有无关错误，位于 `../nextclaw-server/src/ui/ui-routes/marketplace/installed.ts:230` 与 `../nextclaw-server/src/ui/ui-routes/marketplace/installed.ts:238`
- 可维护性守卫：
  - `pnpm lint:maintainability:guard`
  - 结果：命令仍以非零退出
  - 非本次阻断原因：
    - `packages/extensions/nextclaw-channel-plugin-weixin/src` 目录预算错误
    - `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-adapter.ts` 文件预算错误
    - `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/lexical/chat-input-bar-tokenized-composer.tsx` 复杂度错误
  - 结论：本次 heartbeat 触达文件未新增守卫阻断

## 发布/部署方式

- 本次未执行发布。
- 若后续发布 `nextclaw`，需包含这批 service runtime 变更一并构建与发布。
- 不适用项：
  - 数据库 migration：不适用
  - 服务部署：不适用
  - 线上 API 冒烟：不适用

## 用户/产品视角的验收步骤

1. 启动 `nextclaw` service，并等待 deferred startup 完成，使 live NCP agent ready。
2. 在当前 workspace 写入带实际待办的 `HEARTBEAT.md`。
3. 等待 heartbeat 触发，或在代码侧调用 `heartbeat.triggerNow()` 做一次即时触发。
4. 确认 heartbeat 走的是 NCP session `heartbeat`，而不是旧的 `runtimePool.processDirect(...)` 直驱。
5. 确认该次执行保留 legacy 语义所需的 `channel=cli`、`chatId=direct`，避免后台自动执行意外变成 UI channel 语义。
6. 在 NCP agent 未 ready 的极早阶段触发时，确认行为为显式失败，而不是静默回落到旧链路。

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：
  - 本次继续沿着“统一入口、统一体验、统一能力编排”的长期方向推进，把 heartbeat 也从 legacy 直驱收敛到了 NCP 主链路。这样后台自动执行不再分成 cron 一套、heartbeat 一套两种执行哲学，符合 NextClaw 作为统一操作层而不是兼容集合的方向。
  - 本次顺手减债点：删除 heartbeat 在 gateway 装配层对 `runtimePool.processDirect(...)` 的依赖，不再保留双轨执行入口。
  - 下一步维护性切入口：如果后续还要继续统一后台自动执行，应优先看 cron/heartbeat 之间是否需要抽出稳定共享 core，而不是重新引入第三种后台执行旁路。
- 可维护性复核结论：通过
- 本次顺手减债：是
- 代码增减报告：
  - 新增：174 行
  - 删除：23 行
  - 净增：151 行
- 非测试代码增减报告：
  - 新增：94 行
  - 删除：16 行
  - 净增：78 行
- 可维护性总结：
  - 本次是否已尽最大努力优化可维护性：是。heartbeat 原先只有一段很短的 legacy 直驱闭包，但要切到 NCP 主链路，最小必要新增就是一层明确的 NCP handler 与定向测试；除此之外已直接删除旧入口，没有再保留双轨兜底。
  - 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。先删旧 direct path，再补最小必要的 NCP 封装；没有加兼容分支、没有保留 fallback，也没有让 heartbeat 继续借旧链路“偷偷成功”。
  - 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到。总代码仍净增，但已经进一步删除了原本新增出来的 heartbeat 独立 handler 文件和独立测试文件，避免同一类 NCP 执行逻辑再复制一份；当前非测试代码净增 `78` 行，主要来自在既有 cron handler 内补齐 heartbeat 所需的最小 NCP 分支。
  - 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。`HeartbeatService` 继续只承担调度职责，heartbeat 与 cron 共用同一个 gateway handler 模块，没有把更多执行细节继续塞回 gateway context，也避免了新增第二个几乎同构的 handler 文件。
  - 目录结构与文件组织是否满足当前项目治理要求：基本满足。本次只在既有 gateway 目录新增一个 handler 和一条定向测试文件，没有新建额外平铺子目录。
  - 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。本结论基于独立复核，不是只复述守卫；当前无额外 maintainability findings。
  - no maintainability findings
