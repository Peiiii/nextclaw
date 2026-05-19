# v0.18.88 NCP Session Metadata Sidecar

## 迭代完成说明

本次修复 NCP agent 会话 metadata patch 会触发全量 session 替换的问题。

根因是 metadata 投影更新和 message journal 事实流共用同一个写入文件，并且旧的 `replaceSession` 合同会把 assistant/tool snapshot 物化成可 replay 的消息事件。工具调用流式事件追加期间，metadata 更新可能重写 journal，让临时 tool call 状态在 reload 后变成真实 assistant message。

修复方式：

- 删除 `AgentSessionStore` 的通用 `replaceSession` 合同。
- 新增 `updateSessionMetadata`，metadata patch 只更新 metadata sidecar 和 summary index。
- 将 journal store 拆成 event journal、metadata sidecar、summary index 三个 owner。
- legacy materialization 收窄为 `NcpAgentSessionJournalStore.materializeSession`，snapshot event 使用内部 `session.snapshot.message`，不再伪装成 `message.sent`。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel test src/stores/ncp-agent-session-journal.store.test.ts src/services/ncp-session-api.service.test.ts src/services/ncp-agent-session-store-adapter.service.test.ts`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit test src/agent/in-memory-agent-backend.test.ts src/agent/__tests__/agent-backend-append-session-event.test.ts src/agent/agent-backend-finalize-status.test.ts`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit build`
- `pnpm -C packages/nextclaw-kernel build`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit lint`
- `pnpm -C packages/nextclaw-kernel lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`

定向验收点：

- metadata-only update 后 `.jsonl` 内容保持不变。
- metadata sidecar 正确保存 `last_activity_preview` 等 metadata。
- materialized legacy messages 使用 `session.snapshot.message`，不写 `message.sent` snapshot。
- backend `updateSession` 调用 `updateSessionMetadata`，不再依赖全量替换。

## 发布/部署方式

本次未发布、未部署。需要用户重启当前本地 dev backend 后，`http://127.0.0.1:5174` 才会加载新的 kernel/toolkit 构建产物。

## 用户/产品视角的验收步骤

1. 重启本地 NextClaw dev backend/frontend。
2. 新建或打开 NCP agent 会话。
3. 发送会触发工具调用的消息，例如“随便读取一个文件测试一下。”
4. 工具调用期间 reload 页面。
5. 会话消息列表不应新增 `toolName = "unknown"`、`state = "call"` 的孤立 assistant 工具消息。

## 可维护性总结汇总

本次遵循单一路径原则：metadata patch 只走 `updateSessionMetadata`，message facts 只走 append-only journal。

正向减债：

- 删除通用 `replaceSession` 合同，避免调用方继续把 metadata patch 写成全量替换。
- 删除 backend metadata update 的 full snapshot 构造逻辑。
- 将原本膨胀的 journal store 从 400 行预算外拉回预算内，并拆出 metadata sidecar 与 summary index owner。

默认 maintainability guard 通过；`--non-feature` 口径会因新增 sidecar 存储能力产生非测试净增，不作为本批次关闭口径。

## NPM 包发布记录

不涉及 NPM 包发布。
