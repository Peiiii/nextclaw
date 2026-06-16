# v0.20.76 Codex Desktop Visibility Patch

## 迭代完成说明

本次实现了 Codex NARP runtime 的 Codex Desktop 会话可见性自动补丁。根因是 Codex Desktop sidebar 不直接展示所有 Codex thread，而是先按已知 workspace root、projectless thread 或显式 project assignment 分组；NextClaw fallback workspace `/Users/peiwang/.nextclaw/workspace` 之前没有注册进 Codex Desktop 的 workspace root 状态，因此对应 thread 虽然存在于 Codex sqlite/rollout 中，但可能不会在 Codex Desktop UI 中出现。

修复方式是在 Codex NARP runtime extension 边界新增 `CodexDesktopVisibilityPatchService`。wrapper 构建最终 runtime config 时，会把最终 `workingDirectory` 交给该 service；service 优先调用 Codex Desktop 自己的 `codex://new?path=...` 活入口，让 Desktop 主进程同步更新 globalState 与 UI 通知；只有 deep link 不可用或验证超时时才兜底写入 `electron-saved-workspace-roots`。kernel、service 和通用 NARP stdio client 没有感知 Codex Desktop 私有状态。

追加修正：本次补齐 Codex app-server runtime 的 Desktop thread index 同步。新的复现会话 `ncp-mqgrv8ag-ac4896f2` 证明 NextClaw journal 和 Codex rollout jsonl 都已有三轮消息，但 Codex Desktop sqlite `threads` 行仍停在第一轮的 `updated_at/tokens_used/has_user_event`。因此根因不是 session/thread 绑定丢失，而是 Desktop thread index 缓存没有跟随 app-server 后续 turn 刷新。

再次追加修正：会话 `ncp-mqgwsfik-b7bbdbc4` / Codex thread `019ed173-c070-7ca3-812c-f8dad15fb373` 证明还有第三类问题。NextClaw metadata 已绑定 Codex thread，Codex rollout 文件存在且包含两轮用户消息，但排查时 Codex Desktop `threads` sqlite 表没有对应 row。同一 workspace root `/Users/peiwang/.nextclaw/workspace` 下，Desktop sqlite 当时只索引 40 个 active thread，而 Codex rollout 事实源已有 43 个 thread。因此这不是 stale index，而是 Desktop index row 未 materialize。

追加修复方式是在 `@nextclaw/nextclaw-ncp-runtime-codex-sdk` 内新增并扩展 `CodexDesktopThreadIndexSyncService`，并让 `CodexAppServerNcpAgentRuntime` 在 `turn/completed` 发出 NCP 完成事件后调用可插拔 `CodexDesktopThreadIndexSync` 接口。默认实现优先从 Codex Desktop `threads.rollout_path` 指向的 Codex rollout 文件推导 `updated_at`、`updated_at_ms`、`tokens_used` 和 `has_user_event`；当 row 缺失时，按 thread id 在 Codex `sessions` 目录查找 rollout，并从 rollout `session_meta` 与 `event_msg.user_message` materialize 最小完整 `threads` 索引 row。不读取 NextClaw journal，不修改 Codex app-server runtime，也不污染 kernel / NARP stdio 主链路。

设计文档：[2026-06-16-codex-desktop-visibility-patch.design.md](../../designs/2026-06-16-codex-desktop-visibility-patch.design.md)。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/nextclaw-narp-runtime-codex-sdk test`
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-codex-sdk tsc`
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-codex-sdk lint`
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-codex-sdk build`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm clean:generated`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-codex-sdk tsc`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-codex-sdk test`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-codex-sdk lint`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-codex-sdk build`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/extensions/nextclaw-ncp-runtime-codex-sdk/src/services/codex-desktop-thread-index-sync.service.ts packages/extensions/nextclaw-ncp-runtime-codex-sdk/src/utils/codex-rollout-thread-summary.utils.ts packages/extensions/nextclaw-ncp-runtime-codex-sdk/src/services/codex-desktop-thread-index-sync.service.test.ts packages/extensions/nextclaw-ncp-runtime-codex-sdk/src/services/codex-app-server-ncp-agent-runtime.service.ts packages/extensions/nextclaw-ncp-runtime-codex-sdk/src/types/codex-app-server-runtime.types.ts packages/extensions/nextclaw-ncp-runtime-codex-sdk/src/index.ts packages/extensions/nextclaw-ncp-runtime-codex-sdk/src/services/codex-sdk-runtime-thread-metadata.service.test.ts packages/extensions/nextclaw-ncp-runtime-codex-sdk/package.json`
- 真实本地验收：调用 `open codex://new?path=%2FUsers%2Fpeiwang%2F.nextclaw%2Fworkspace` 后，确认 `/Users/peiwang/.codex/.codex-global-state.json` 中 `electron-saved-workspace-roots` 包含该 root；随后 Codex Desktop 改写 `active-workspace-roots` 时，该 root 仍保留在 saved roots 中。这证明正在运行的 Codex Desktop 主进程已接收该 workspace，而不是只被 NextClaw 外部写了一份 JSON 快照。
- thread index 单测验收：临时 sqlite `threads` 行初始停在第一轮，rollout 文件包含后续 timestamp/token/user message；执行 sync 后 `updated_at`、`updated_at_ms`、`tokens_used`、`has_user_event` 均更新为 rollout 最新事实。
- thread index materialize 单测验收：临时 sqlite 没有 `threads` row，Codex `sessions` 目录存在对应 thread rollout；执行 sync 后插入包含 `rollout_path`、`created_at`、`updated_at`、`source`、`model_provider`、`cwd`、`title`、`first_user_message`、`preview`、`tokens_used`、`has_user_event` 的完整索引 row，并且优先使用 `event_msg.user_message` 作为标题，避免把 NARP 注入上下文写成 title。
- app-server runtime 单测验收：`turn/completed` 会调用注入的 `desktopThreadIndexSync`，证明该能力可替换、可关闭，不绑死默认 sqlite 实现。
- 真实本地 thread index 验收：使用最新 dist 对 `019ed172-8ac1-7371-91aa-4a1809d5063f`、`019ed173-2b51-7ac3-b313-d5481065fe9a`、`019ed173-c070-7ca3-812c-f8dad15fb373` 执行 sync 后，`/Users/peiwang/.codex/sqlite/state_5.sqlite` 中 `/Users/peiwang/.nextclaw/workspace` active thread 数为 `43`；目标 thread `019ed173-c070-7ca3-812c-f8dad15fb373` 的 `title/first_user_message/preview` 为 `你好`，`tokens_used=50184`，`has_user_event=1`。

## 发布/部署方式

本次未执行发布或部署。改动影响 `@nextclaw/nextclaw-narp-runtime-codex-sdk` 与 `@nextclaw/nextclaw-ncp-runtime-codex-sdk`，后续若进入 beta/NPM 发布批次，需要随相关 package 正常 build/prepack 发布。

## 用户/产品视角的验收步骤

1. 在 NextClaw 中创建或使用 Codex 会话。
2. 确认 Codex NARP runtime 使用的 `workingDirectory` 已通过 Codex Desktop deep link 注册为 workspace root。
3. 使用相同 cwd 创建的 Codex thread 应能按 workspace root 被归入 Codex Desktop 项目列表，不再成为 orphan thread。

说明：直接改 `.codex-global-state.json` 只能修改磁盘快照；如果 Codex Desktop 已经运行，它可能用旧内存态再次写回并覆盖外部补丁。因此当前实现优先使用 Desktop 自己的 `codex://new?path=...` 入口，兜底磁盘补丁只用于 deep link 不可用的场景。

thread index 同步追加验收：

1. 在 NextClaw 中继续一个已经绑定 `codex_thread_id` 的 Codex app-server 会话。
2. 完成第二轮或后续 turn 后，检查 Codex rollout jsonl 中已有后续消息。
3. 如果 Codex Desktop sqlite `threads` 行已存在，预期 `updated_at`、`updated_at_ms`、`tokens_used` 和 `has_user_event` 已跟随 rollout 更新。
4. 如果 Codex Desktop sqlite `threads` 行缺失，预期 sync 从 Codex rollout materialize 一条索引 row，Desktop 侧不再完全缺少该 thread。
5. Codex Desktop 侧同一 thread 不再因为 stale index 或 missing index 表现为只停留在第一轮或完全不可见。

## 可维护性总结汇总

本次遵守了边界补丁原则：新增逻辑只在 Codex 专属 extension service 中出现，没有污染 kernel、service 或通用 NARP stdio client。新增抽象不是通用平台抽象，而是具体外部私有状态边界 owner；wrapper 只依赖一个窄接口，测试可注入 no-op patch，避免单测写真实用户目录。

维护性检查结果：`No maintainability findings`。治理检查、文件命名、角色边界、module-structure、package public imports 均通过。

thread index sync 追加维护性结果：

- scoped maintainability guard 默认模式通过，`Errors: 0`。
- 代码增减：总计 `+1053 / -0 / net +1053`，非测试 `+645 / -0 / net +645`。
- `--non-feature` 模式会被非测试净增拦截；本次按新增用户可见同步能力处理，因为它引入的是隔离的外围可见性 owner，而不是纯内部重构。
- 警告：`src/index.ts` 370 行，接近 400 行预算；`codex-app-server-ncp-agent-runtime.service.ts` 567 行，接近 600 行预算。后续拆分缝是把旧 SDK runtime 从 `index.ts` 移出独立 service，并继续把 app-server runtime 的外围集成动作保持在小接口后。
- 正向维护动作：没有把 sqlite 细节塞进 runtime 主流程，而是收敛为 `CodexDesktopThreadIndexSync` 可插拔接口；默认实现单独拥有 schema guard、stale row 更新、missing row materialize 和安全降级。rollout 查找与 jsonl 解析已拆到纯 `utils/codex-rollout-thread-summary.utils.ts`，避免新 service 一出生就贴近文件预算红线。

## NPM 包发布记录

本次未发布 NPM 包。涉及 package：

- `@nextclaw/nextclaw-narp-runtime-codex-sdk`：状态为待后续统一发布批次处理，原因是 workspace visibility patch。
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk`：状态为待后续统一发布批次处理，原因是 app-server turn 完成后的 Codex Desktop thread index sync。
