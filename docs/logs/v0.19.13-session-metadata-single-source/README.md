# v0.19.13-session-metadata-single-source

## 迭代完成说明

- 设计文档落在 `docs/designs/2026-05-23-session-metadata-single-source-of-truth.md`，明确 session metadata 只有 metadata store 一个持久 owner。
- 删除 `LiveSession.metadata` 与 `LiveSession.createdAt`，live session 只保留运行态、runtime、state manager 和 active execution。
- 收敛 `appendSessionEvent` 合同：外部只传 `sessionId` 和 `event`，不再夹带 metadata、`createdAt`、`updatedAt`、`agentId` 或 session record 快照。
- journal store 内部生成 append timestamp，并只在新增事件时推进 session `updatedAt`；metadata set/update 不推进会话 activity time。
- summary index 不再存 metadata，列表读取时从 metadata sidecar 合成 metadata，避免 summary projection 和 metadata sidecar 双持有。
- 补充回归覆盖：后续 `run.finished` 等事件追加不得覆盖 `message.completed` 已写入的 `last_activity_preview.replyText`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/kernel test -- src/stores/ncp-agent-session-journal.store.test.ts src/managers/__tests__/session-run.manager.test.ts src/managers/__tests__/agent-run-request.manager.test.ts src/utils/session-run.utils.test.ts`
- `pnpm --filter @nextclaw/kernel test`
- `pnpm --filter @nextclaw/kernel lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- 真实接口冒烟：用 `NEXTCLAW_HOME=/tmp/nextclaw-metadata-smoke-src-*` 和 `tsx --tsconfig scripts/dev/dev-runtime.tsconfig.json` 启动源码服务到 `127.0.0.1:18795`，发送“查看一下系统信息”，确认最终 session summary 保留 `last_activity_preview.replyText`，且 metadata 写入没有推进 `updatedAt`。

## 发布/部署方式

- 未发布。
- 未执行数据库 migration、远程 deploy、桌面包构建或 NPM release。
- 已确认普通 `packages/nextclaw dev:build` 可能走旧 dist；真实源码冒烟必须使用 dev runtime tsconfig 或先构建相关 workspace package。

## 用户/产品视角的验收步骤

1. 打开 chat，发送“查看一下系统信息”。
2. 等 AI 回复完成后，左侧会话列表应展示最终回复预览，而不是回退成 agent ID 加消息数。
3. 工具调用中间态可以展示“工具调用完成”，但最终 `message.completed` 的回复预览必须被保留。
4. 仅修改 metadata，例如已读时间或 preview metadata，不应改变会话列表的 activity 排序时间。

## 可维护性总结汇总

- 正向减债动作：删除 live metadata 副本、删除 append event 的 session record 快照通道、删除 summary index metadata 副本，统一到 metadata store + append-only journal 两个职责清晰的 owner。
- `appendSessionEvent` 合同变小，调用方无法再传旧 metadata、旧 `createdAt` 或旧 `updatedAt` 覆盖持久事实。
- maintainability guard：检查 13 个文件，Errors 0，Warnings 1；生产代码新增 60 行、删除 132 行、净减 72 行。
- 当前剩余观察点：`ncp-agent-session-journal.store.ts` 仍接近 400 行预算，后续再次触达时应优先拆分 journal replay、metadata sidecar 与 summary projection。

## NPM 包发布记录

- 不涉及 NPM 包发布。
