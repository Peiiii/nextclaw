# v0.21.24 Session Activity Preview False Error

## 迭代完成说明

修复会话明明已正常完成，却在聊天页显示“出错了”的假阳性。

根因：activity preview 是持久化的派生缓存。`message.completed` 之前使用 assistant message 的创建时间作为完成时间，导致它比最后一次 tool result 更早，无法覆盖 `running` preview；随后服务端把 `idle + running` 的 session 兜底归一化为 failed，于是 UI 显示“运行中断”。真实 journal 中该会话存在 `message.completed` 和 `run.finished`，所以这不是模型或工具真实失败。

修复：`message.completed` 改用完成事件时间写入 completed preview；服务端读取 idle session 时，如果 running preview 已有最终回复，则归一化为 completed 而不是 failed。顺手删除同一 controller 中不再需要的 `void _removed` no-op。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel exec vitest run src/contributions/session-activity-preview/utils/session-activity-preview-ncp-event.utils.test.ts src/contributions/session-activity-preview/utils/session-activity-preview-metadata.utils.test.ts`
- `pnpm -C packages/nextclaw-server exec vitest run src/app/__tests__/router-ncp-session-list-route.test.ts`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-server lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-kernel/src/contributions/session-activity-preview/utils/session-activity-preview-ncp-event.utils.ts packages/nextclaw-kernel/src/contributions/session-activity-preview/utils/session-activity-preview-ncp-event.utils.test.ts packages/nextclaw-server/src/features/sessions/controllers/sessions.controller.ts packages/nextclaw-server/src/app/__tests__/router-ncp-session-list-route.test.ts`
- `pnpm lint:new-code:governance -- packages/nextclaw-kernel/src/contributions/session-activity-preview/utils/session-activity-preview-ncp-event.utils.ts packages/nextclaw-kernel/src/contributions/session-activity-preview/utils/session-activity-preview-ncp-event.utils.test.ts packages/nextclaw-server/src/features/sessions/controllers/sessions.controller.ts packages/nextclaw-server/src/app/__tests__/router-ncp-session-list-route.test.ts`
- `pnpm check:governance-backlog-ratchet`
- 真实 session API 验收：`/api/ncp/sessions/ncp-mr7gosqn-49312ed9` 返回 `previewState=completed`。
- 页面冒烟：`/chat/sid_bmNwLW1yN2dvc3FuLTQ5MzEyZWQ5` 当前会话区域不再出现“出错了”；左侧列表仍可能显示其他历史会话的“运行中断”预览。

## 发布/部署方式

本次仅修改 workspace 包源码与测试，未执行部署。

## 用户/产品视角的验收步骤

1. 打开受影响会话。
2. 确认 assistant 回复正常显示。
3. 确认当前会话底部不再出现“出错了 / 运行中断”错误卡。
4. 若确有未完成运行且没有最终回复，仍应显示“运行中断：上一轮请求没有完成，请重新发送。”。

## 可维护性总结汇总

已使用 `post-edit-maintainability-review` 规则做收尾复核。本次是非功能 bugfix，非测试代码净减 7 行；正向减债动作是简化，删除同一 controller 中无业务意义的 no-op，并把错误归一化约束收敛到更准确的展示语义。未新增文件组织风险、目录膨胀或新抽象。

## NPM 包发布记录

需要进入后续统一 NPM 发布批次。

- `@nextclaw/kernel`：patch，修复 activity preview 完成事件时间语义。
- `@nextclaw/server`：patch，修复 idle session preview 假失败归一化。
