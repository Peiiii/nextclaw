# 迭代完成说明

本次迭代聚焦一件事：把“桌面正常用着用着突然不可用，而且前端只剩一个 `network error`”这类问题先从两个最有杠杆的位置收紧。

本次实际落地了四类改动：

- 桌面端加入本地 runtime 自动恢复能力：
  - [`runtime-service.ts`](/Users/peiwang/Projects/nextbot/apps/desktop/src/runtime-service.ts)
  - 现在会复用稳定端口、缓存最近输出、在异常退出后按指数退避自动重启，并把恢复结果写入日志。
- 前端请求层尽量透出原始错误，不再把底层失败压扁成模糊提示：
  - [`raw-client.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/api/raw-client.ts)
  - [`ncp-app-client-fetch.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/ncp/ncp-app-client-fetch.ts)
  - [`local.transport.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/transport/local.transport.ts)
  - 现在会尽量保留 `method`、`url/path`、原始错误名、原始错误消息，以及可用时的 HTTP 信息。
- crash log 补齐 `unhandledRejection`：
  - [`logging-runtime.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/logging/logging-runtime.ts)
  - 这样“进程没直接崩，但 promise 未处理导致链路坏掉”的情况也能进 crash log。
- 补齐对应测试：
  - [`runtime-service.test.ts`](/Users/peiwang/Projects/nextbot/apps/desktop/src/runtime-service.test.ts)
  - [`logging-runtime.test.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/logging/logging-runtime.test.ts)
  - [`raw-client.test.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/api/raw-client.test.ts)
  - [`ncp-app-client-fetch.test.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/ncp/ncp-app-client-fetch.test.ts)

这次没有把问题误缩成 “skills 会不会触发重启”。从代码和链路看，`skills` 变动本身不是自动重启源头；更深层的问题是 runtime 可用性治理不足，以及错误透出太差。

相关方案文档：

- [2026-04-12-runtime-live-apply-and-consented-restart-plan.md](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-12-runtime-live-apply-and-consented-restart-plan.md)
- [2026-04-12-desktop-runtime-resilience-and-graceful-recovery-plan.md](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-12-desktop-runtime-resilience-and-graceful-recovery-plan.md)
- [2026-04-12-runtime-unavailability-elimination-plan.md](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-12-runtime-unavailability-elimination-plan.md)

# 测试/验证/验收方式

已执行：

- `pnpm -C packages/nextclaw-ui exec vitest run src/api/raw-client.test.ts src/components/chat/ncp/ncp-app-client-fetch.test.ts`
- `pnpm -C packages/nextclaw-core exec vitest run src/logging/logging-runtime.test.ts`
- `pnpm -C packages/nextclaw-core exec tsx --test ../../apps/desktop/src/runtime-service.test.ts`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C apps/desktop tsc`
- `pnpm lint:maintainability:guard`
- `pnpm -C apps/desktop smoke`

结果说明：

- 上述验证均已通过。
- 桌面冒烟输出为 `desktop runtime smoke passed`，说明桌面拉起本地 runtime 的主链路仍正常。
- 维护性守卫通过，但仓库中仍有与本次无关的既有目录预算 warning；本次没有越界处理这些历史债务。

# 发布/部署方式

本次无需额外迁移步骤。

- 合入后按常规构建/发布桌面端与相关包即可。
- 本次没有新增配置项，也没有引入新的手动开关。
- 用户升级到包含本次改动的版本后，桌面端本地 runtime 异常退出将尝试自动恢复；若请求层再次失败，日志和界面上的错误信息也会更接近原始原因。

# 用户/产品视角的验收步骤

1. 启动桌面端并确认可以正常进入聊天页面。
2. 发起一次正常对话，确认主链路可用。
3. 制造一次本地 runtime 请求失败或断联场景，确认错误里会带出更完整的原始信息，而不是只有一个模糊 `network error`。
4. 查看日志命令输出，确认可以定位到日志目录，并在需要时检查 `service.log` / `crash.log`。
5. 在桌面端模拟 runtime 异常退出，确认应用不会立刻变成永久不可用，而是会尝试自动恢复。

# 可维护性总结汇总

本次是否已尽最大努力优化可维护性：是。

本次是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。虽然这次是净增代码，但主要把恢复逻辑收敛在已有 owner class [`runtime-service.ts`](/Users/peiwang/Projects/nextbot/apps/desktop/src/runtime-service.ts) 内，没有把恢复状态散落到更多入口，也没有为了“统一”过早抽出跨层公共错误工具。

是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到。本次新增 1 个测试文件、扩充了 4 个现有 owner 文件与 3 个测试文件，总体净增代码；但没有额外引入新的运行时抽象层、service 层或目录层次，增长集中在真正承接职责的 owner 上。

抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：更清晰。桌面恢复职责仍在 [`runtime-service.ts`](/Users/peiwang/Projects/nextbot/apps/desktop/src/runtime-service.ts) 这个单一 owner 内，前端错误透传分别留在各自 transport/client 边界，没有再加一个“万能错误翻译层”制造隐藏耦合。

目录结构与文件组织是否满足当前项目治理要求：满足。本次新增文件 [`raw-client.test.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/api/raw-client.test.ts) 命名合规；其余均为在原有 owner 文件内扩展。仓库里仍有既有目录预算 warning，但不属于本次新增问题。

若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已基于独立复核填写。

可维护性复核结论：通过

本次顺手减债：是

代码增减报告：

- 新增：358 行
- 删除：43 行
- 净增：315 行

非测试代码增减报告：

- 新增：289 行
- 删除：41 行
- 净增：248 行

可维护性总结：

- no maintainability findings
- 这次代码增长主要来自“自动恢复 + 原始错误透传 + crash log 补齐”这三项可靠性基础设施，已经收敛在现有 owner 边界里，属于当前最小必要增量。
- 我刻意没有把不同层的错误格式化强行抽成一个共享 helper，因为它们的职责边界并不相同；当前保持层内局部实现，反而比引入一层跨包抽象更可控。
- 后续最值得继续推进的 seam 不是再补更多前端提示，而是把 runtime 可用性状态产品化，让前端能区分“正在恢复”“聊天平面失效”“必须用户确认重启”。
