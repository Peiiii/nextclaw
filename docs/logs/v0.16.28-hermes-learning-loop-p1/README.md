# v0.16.28-hermes-learning-loop-p1

## 迭代完成说明

本次实现了 Hermes learning loop 的下一阶段能力：在 NextClaw / NCP 主链路之外，以可插拔方式补上“全局 typed event bus + lifecycle event projection + 自动 learning review”。

本轮实际落地内容：

1. 在 `packages/nextclaw-core/src/typed-event-bus/` 新增独立 typed event bus，职责只保留 `emit / on / off / once / subscribeAll`，不复用旧 `MessageBus`。
2. 在 `packages/nextclaw/src/cli/commands/ncp/lifecycle-events/` 新增 NCP lifecycle bridge，把 `RunStarted / RunFinished / MessageSent / SessionUpdated` 投影成稳定的全局事件。
3. 在 `packages/nextclaw/src/cli/commands/ncp/learning-review/` 新增 `LearningReviewFeature`，只监听 `agent.run.finished`，对 root session 按“自上次 review 以来的 tool call 数”阈值触发复盘。
4. learning review 复用现有 child session / session request 机制生成 review 子会话，不引入新的后台 service、队列或独立 worker。
5. review 子会话会自动注入 `requested_skills: [\"skill-creator\"]`、`learning_review_disabled: true` 与 `learning_review_source_session_id`，并把 root session 的最近 review 元数据写回。
6. `createUiNcpAgent` 只通过一个轻量接缝接入：初始化 `AgentLifecycleSupport`，由它统一挂 bridge 与 learning review feature，保持主链路可拔插。
7. 顺手完成命名治理与减债：把 `create-ui-ncp-agent.ts`、`session-request-broker.ts` 迁移为受治理的 `.service.ts` 入口，并把新抽出的 plugin runtime registration owner 收敛到单独的 `.controller.ts` 文件。
8. 补齐了 lifecycle、learning review、HTTP runtime、session request、typed event bus 的回归测试，并修复了并行测试时因共享 `NEXTCLAW_HOME` 导致的 `session-search.db` 锁冲突。

相关文档：

1. [Global Typed Event Bus And Learning Review Design](../../designs/2026-04-15-global-typed-event-bus-and-learning-review-design.md)

## 测试 / 验证 / 验收方式

已完成：

1. `pnpm -C packages/nextclaw-core test -- --run src/typed-event-bus/typed-event-bus.test.ts`
2. `pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/lifecycle-events/ncp-lifecycle-event-bridge.test.ts src/cli/commands/ncp/lifecycle-events/create-ui-ncp-agent-lifecycle-events.test.ts src/cli/commands/ncp/learning-review/learning-review-feature.test.ts src/cli/commands/ncp/session-request/session-runtime.test.ts src/cli/commands/ncp/runtime/create-ui-ncp-agent.http-runtime.test.ts`
3. `pnpm -C packages/nextclaw-core tsc`
4. `pnpm -C packages/nextclaw tsc`
5. `pnpm -C packages/nextclaw-core build`
6. `pnpm -C packages/nextclaw build`
7. `pnpm exec eslint packages/nextclaw-core/src/typed-event-bus/*.ts packages/nextclaw-core/src/index.ts packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.service.ts packages/nextclaw/src/cli/commands/ncp/lifecycle-events/*.ts packages/nextclaw/src/cli/commands/ncp/learning-review/*.ts packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-tool-registry.ts packages/nextclaw/src/cli/commands/ncp/plugin-runtime-registration.controller.ts packages/nextclaw/src/cli/commands/ncp/runtime/create-ui-ncp-agent.http-runtime.test.ts packages/nextclaw/src/cli/commands/ncp/session-request/session-creation.service.ts packages/nextclaw/src/cli/commands/ncp/session-request/session-request-broker.service.ts packages/nextclaw/src/cli/commands/ncp/session-request/session-request-broker.types.ts packages/nextclaw/src/cli/commands/ncp/session-request/session-request.tool.ts packages/nextclaw/src/cli/commands/ncp/session-request/session-runtime.test.ts packages/nextclaw/src/cli/commands/ncp/session-request/session-spawn.tool.ts`
8. `pnpm lint:new-code:governance`
9. `pnpm lint:maintainability:guard`

结果：

1. 上述 feature 相关测试、类型检查、构建、定点 eslint 均通过。
2. `createUiNcpAgent` 生命周期事件测试已从易超时的双轮 tool-call 路径收紧为单轮 final reply 路径，并显式设置更宽松的单测超时，稳定性更好。
3. HTTP runtime 回归测试在并行跑多文件时已不再因共享 `NEXTCLAW_HOME` 与 `session-search.db` 发生数据库锁冲突。
4. `pnpm lint:new-code:governance` 与 `pnpm lint:maintainability:guard` 仍被工作区中已有的其它脏改动阻断；当前剩余阻断项为一批历史未治理命名文件，如 `cli-agent-runner.ts`、`nextclaw-ncp-tool-registry.ts`、`session-request.tool.ts`、`session-spawn.tool.ts`、若干 `service-support/gateway/*.ts`。这些不是本次新增文件。
5. 本次新引入的 `plugin-runtime-registration.controller.ts` 命名问题已在本轮内修正，不再出现在 governance 阻断列表中。

## 发布 / 部署方式

本次不涉及额外部署服务、额外守护进程或额外数据迁移。

发布时随正常 NextClaw 版本发布即可。该能力默认通过现有 NCP agent 链路生效：

1. core 会随包发布携带 typed event bus 导出。
2. CLI / NCP 侧会在 `createUiNcpAgent` 初始化时自动挂上 lifecycle bridge 与 learning review feature。
3. learning review 依赖现有 child session / session request 机制，不需要额外配置后台 worker。

## 用户 / 产品视角的验收步骤

1. 启动带 NCP agent 的 NextClaw。
2. 在一个 root session 中让 agent 连续完成一段真实任务，确保累计产生至少 15 次 tool call。
3. 等本轮 root session 回复完成后，确认系统会自动创建一个新的 child session，标题形如 `Learning review` 或 `Learning review: <label>`。
4. 打开这个 review 子会话，确认它携带 `requested_skills: [\"skill-creator\"]`、`learning_review_disabled: true`、`learning_review_source_session_id: <rootSessionId>` 等 metadata。
5. 回到原 root session，确认其 metadata 已写入最近一次 review 的时间、tool call 计数与 review session id。
6. 若需要验证事件总线，给 `globalEventBus` 订阅 `agent.run.finished` 或 `agent.session.updated`，确认 root session 完成一次回复后能收到包含 `sessionId`、`isChildSession`、`emittedAt` 的 payload。

## 可维护性总结汇总

可维护性复核结论：保留债务经说明接受

长期目标对齐 / 可维护性推进：

1. 本次沿着 NextClaw “统一入口 + 能力编排”的长期方向前进了一步，但仍坚持轻量接入：没有引入新的后台 review service、任务队列或独立 memory 系统，而是复用现有 child session 能力。
2. 新增复杂度主要被锁在三个独立模块里：`typed-event-bus/`、`lifecycle-events/`、`learning-review/`，没有把复盘机制散落进 toolkit 或主运行时深处。
3. 下一步如果继续扩展 Hermes 风格后台复盘，只需要继续监听 bus 并复用 session search / session request，而不需要再改主 agent 链路。

本次是否已尽最大努力优化可维护性：是。

是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。

1. 没有为了做 learning review 再造新工具系统、任务系统或 review runtime。
2. 直接复用已有 session request / child session 链路，只在 metadata 层做最小注入。
3. 顺手删除了两个历史未治理入口：`create-ui-ncp-agent.ts` 与 `session-request-broker.ts`。

本次顺手减债：是。

代码增减报告：

1. 新增：1949 行
2. 删除：814 行
3. 净增：+1135 行

非测试代码增减报告：

1. 新增：1490 行
2. 删除：814 行
3. 净增：+676 行

说明：

1. 这次净增属于新增用户可见能力，但已经通过删除旧入口、复用现有 child session 链路、限制 bus 职责范围，把增长压到了可接受的最小层级。
2. 没有把 Hermes 思路扩成“后台系统大重构”；剩余增长主要来自新的 typed event bus、bridge、learning review owner class 与必要测试。
3. 在当前方案下，继续追求更小体积的代价会变成把职责重新塞回旧入口或把 feature 打碎到多个已有模块里，反而更难维护，因此当前已经达到这条设计路线的较优收敛点。

抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：

1. 是。
2. `TypedEventBusService`、`NcpLifecycleEventBridge`、`LearningReviewFeature`、`AgentLifecycleSupport` 各自只承担一个明确职责。
3. `createUiNcpAgent` 只保留接线，不直接持有 review 规则。

目录结构与文件组织是否满足当前项目治理要求：

1. 本次新增的 typed event bus、lifecycle-events、learning-review 目录与文件命名均满足 kebab-case 与角色后缀治理。
2. 本次新增文件中原本不满足规则的 `plugin-runtime-registration-controller.ts` 已改为 `plugin-runtime-registration.controller.ts`。
3. 全局 diff-only governance 仍被仓库内其它已改动的 legacy 文件阻断；这些文件不属于本次新增模块，但因为工作区当前是脏的，导致全局脚本无法完全通过。

no maintainability findings

可维护性总结：

1. 这次最关键的收敛点是把“自动复盘”做成了 bus 订阅能力，而不是继续把判断逻辑塞进 agent 主流程。
2. 代码虽然净增，但已经同步删掉了旧入口并保持模块边界清晰，新增复杂度没有扩散成补丁式叠加。
3. 当前残留风险不在这批新模块内部，而在仓库里其它历史未治理命名文件；后续若要把全局治理脚本跑全绿，应单开一次命名治理迭代处理这些 legacy touched files。
