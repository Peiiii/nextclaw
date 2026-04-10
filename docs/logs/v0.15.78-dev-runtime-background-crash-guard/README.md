# v0.15.78-dev-runtime-background-crash-guard

## 迭代完成说明

- 修复 dev/runtime 后台异步任务在 Node 22 下因未处理 Promise 拒绝直接打死 `nextclaw serve` 进程的问题。
- 为 `HeartbeatService` 增加后台 tick 安全包装：heartbeat 调用模型失败时改为记录明确日志，不再让未处理拒绝直接退出进程。
- 为 `CronService` 增加后台定时器安全包装：定时执行链路出现意外异常时记录日志并继续重挂定时器，避免 scheduler 因一次后台异常停摆。
- 为 session realtime bridge 增加 fire-and-forget 发布失败日志：会话变更的后台推送失败时改为显式记录 `[session-realtime] ...`，不再把异常悬空到进程级。
- 补充回归测试，覆盖 heartbeat 后台失败、cron 定时器后台失败、session realtime fire-and-forget 失败三条链路。

## 测试/验证/验收方式

- 定向测试：
  - `pnpm -C packages/nextclaw-core exec vitest run src/heartbeat/service.test.ts src/cron/service.test.ts`
  - `pnpm -C packages/nextclaw exec vitest run src/cli/commands/service-support/session/tests/service-ncp-session-realtime-bridge.test.ts src/cli/commands/service-support/session/tests/service-ncp-session-realtime-bridge.fire-and-forget.test.ts`
- 类型检查：
  - `pnpm -C packages/nextclaw-core tsc -p tsconfig.json`
  - `pnpm -C packages/nextclaw tsc -p tsconfig.json`
    - 命中仓库既有无关失败：`packages/nextclaw-server/src/ui/ui-routes/marketplace/installed.ts` 中 `Set<string | undefined>` 到 `Set<string>` 的类型不兼容，本次未改该文件。
- 可维护性守卫：
  - `pnpm lint:maintainability:guard`
    - 本次新增/修改文件相关治理规则通过。
    - 命中工作区既有无关失败：`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/legacy/chat-composer-view-controller.ts` 的 `context-destructuring` 治理问题，不在本次改动文件内。

## 发布/部署方式

- 本次触达 `@nextclaw/core` 与 `nextclaw` 开发态/运行态链路。
- 若正式发布，按常规 changeset / version / publish 闭环发出受影响包，并在发布包环境复验：
  - 后台 heartbeat 出错时服务进程仍存活。
  - cron 定时执行异常时后续调度仍继续。
  - 正常聊天/会话更新期间，session realtime 发布失败只记日志，不会杀进程。
- 本次不涉及数据库、远程 migration 或额外部署脚本。

## 用户/产品视角的验收步骤

1. 在仓库根目录运行 `pnpm dev start`。
2. 正常进入聊天、设置、会话切换等页面，确认前端可持续请求 `/api/*`，不会因后台一次异常突然全部变成 `ECONNREFUSED 127.0.0.1:18792`。
3. 若故意制造 heartbeat / cron / session realtime 后台异常，确认终端出现明确错误日志，但 dev 后端进程仍继续存活，Vite 代理不再失联。
4. 当后端记录后台异常后，继续发送消息或刷新会话列表，确认服务仍可继续响应而不是必须手动重启 `pnpm dev start`。

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：
  - 本次顺着“行为更可预测、后台异常边界更清晰、不要让隐藏异步路径杀主进程”的方向推进了一小步。
  - 这是非新增用户能力的稳定性修复；核心目标不是加功能，而是把 surprise failure 收敛成显式日志。
- 本次是否已尽最大努力优化可维护性：是。
  - 选择在三个真实后台入口补最小必要错误边界，没有引入新的全局兜底层或 incident-specific fallback。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。
  - 没有新增抽象层或通用框架，只在 heartbeat / cron / session realtime 各自本地增加最小安全包装与日志。
  - 曾评估提取跨包共享 helper，但这会引入新的公共抽象与跨包耦合；当前局部封装更小、更直接。
- 代码增减报告：
  - 新增：182 行
  - 删除：13 行
  - 净增：+169 行
- 非测试代码增减报告：
  - 新增：55 行
  - 删除：13 行
  - 净增：+42 行
  - 说明：这是非功能稳定性修复，但非测试净增仍控制在最小必要范围；增长主要来自三个后台入口的错误边界与日志。为避免无测试修复继续留下回归风险，同步偿还了“后台未处理拒绝无回归覆盖”的测试债务。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 总代码量与文件数有小幅净增长，原因是新增两份定向回归测试与三处最小错误边界。
  - 本次没有新增目录平铺，也没有新增补丁式服务层；增长集中且边界明确。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：
  - 更清晰。错误边界仍留在各自后台入口处，heartbeat 负责 heartbeat，cron 负责 cron，session realtime bridge 负责 fire-and-forget 发布，不把复杂度转移到全局 runtime。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 本次新增文件组织满足当前命名与分层要求。
  - 仓库内仍有既有治理债务：`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar` 目录预算超限，且存在无关的 `context-destructuring` 治理失败；已在守卫中记录，但不属于本次问题域。
- 基于独立 `post-edit-maintainability-review` 的复核结论：
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - no maintainability findings
  - 可维护性总结：本次没有把问题藏到全局异常兜底或环境分支里，而是把后台危险入口收成显式、局部、可测的错误边界。非测试代码净增已压到最低可行规模，剩余增长主要用于防止 dev/runtime 因一次后台异常直接死亡。
