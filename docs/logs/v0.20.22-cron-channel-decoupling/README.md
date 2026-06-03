# v0.20.22 Cron Channel Decoupling

## 迭代完成说明

本轮修复 cron 定时任务和渠道投递耦合导致的微信“看起来发送成功但用户未收到”问题。

根因分两层：

- cron job 旧合同持久化了 `deliver/channel/to/accountId`，导致 `cron:a9e2ee22` 继续使用已失效账号 `4a159cbcaaec@im.bot`。
- 旧 handler 在 agent 完成后通过 `MessageBus.publishOutbound` 做后处理投递，语义上只能表示入队，不能表达微信扩展/API 的真实发送结果。
- 微信 `sendmessage` 还需要 `context_token`。真实复测中，当前账号和目标 `to_user_id` 都存在，但空 `context_token` 时微信 API 返回 `{"ret":-2}`；此前把工具/extension accepted 当成“用户收到”是错误验收口径。

修复方式：

- cron 合同收敛为纯调度任务，只保留 `message/agentId/sessionId/kind`。
- `CronTool`、CLI、API、UI 删除 delivery 字段，API/工具对旧字段返回明确错误。
- cron store 加载时 normalize 旧 job，删除旧 delivery 字段，避免失效账号继续落盘。
- cron handler 删除后处理投递路径，通知必须由 AI 在任务执行中调用 `message` 工具。
- `message` 工具改为经 `ChannelManager.deliver` await 实际 channel owner，通道缺失或微信账号未登录会作为工具失败返回。
- cron handler 扫描最终 assistant message 中的 `message` 工具结果，若工具失败则把 job `lastStatus` 写成 `error`，`lastError` 写入真实失败原因。
- 微信 channel 保存入站消息携带的 `context_token`，后续 message 工具/cron 主动发送由微信 channel 动态解析账号并复用该 token。
- 缺少 `context_token` 时微信 channel 直接失败，错误包含 `missing context_token`，不再用空 token 继续调用微信 API。
- 微信 API 返回 `ret != 0` 或 `errcode != 0` 时继续作为真实失败暴露，例如 `weixin sendmessage failed: ret=-2`。

## 测试/验证/验收方式

已通过验证：

- `pnpm -C packages/nextclaw-core exec vitest run src/features/agent/tools/cron.tools.test.ts src/features/cron/services/cron.service.test.ts src/features/agent/tools/message.tools.test.ts`
- `pnpm -C packages/nextclaw-kernel exec vitest run src/contributions/tool-provider/providers/messaging-tool.provider.test.ts`
- `pnpm -C packages/nextclaw-service exec vitest run src/shared/services/gateway/utils/cron-job-handler.utils.test.ts src/cli/commands/cron/services/cron-local.service.test.ts`
- `pnpm -C packages/nextclaw-server exec vitest run src/app/router.cron.test.ts`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-core lint`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-service lint`
- `pnpm -C packages/nextclaw-server lint`
- `pnpm -C packages/nextclaw lint`
- `pnpm -C packages/nextclaw-ui exec eslint src/shared/components/cron-config.tsx src/shared/lib/api/types.ts src/shared/lib/cron/cron-job-view.utils.ts src/features/chat/components/workspace/session-cron-job-content.tsx`
- `pnpm -C packages/extensions/nextclaw-channel-extension-weixin exec vitest run src/tests/weixin-extension-runtime.test.ts src/tests/weixin-api.service.test.ts`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`

真实冒烟复盘：

- 早先正向微信冒烟 token `NC-SMOKE-20260603-204602` 只证明系统侧曾返回 accepted，不证明用户真实收到。用户明确反馈未收到后，该验收应判定为失败。
- 直连微信 API 复测 token `NC-DIRECT-20260603-215308` 返回 HTTP 200，但响应体为 `{"ret":-2}`。这证明网络层成功不等于微信业务发送成功。
- cron/message 链路复测 token `NC-CHAIN-20260603-215347` 的 journal 中 `message` 工具结果为 `ok:false`，错误为 `weixin sendmessage failed: ret=-2`，最终 assistant 也说明消息未发送。
- 修复后负向 smoke token `NC-MISSING-CTX-20260603-221606` 使用无 `context_token` 的测试收件人。临时 job `9538ac17` 运行后 `lastStatus = error`，`lastError = cron message delivery failed: weixin send failed: missing context_token ...`，journal 中 message 工具结果同样为 `ok:false`。该临时 job 已删除。
- 负向微信冒烟 job `79e3419f` 使用不存在账号 `missing-smoke-account@im.bot`。工具结果返回 `weixin send failed: account "missing-smoke-account@im.bot" is not logged in`，job `lastStatus = error`，`lastError` 包含同一真实失败原因。
- 用户重新向当前微信 bot 发送消息后，channel 已保存 `context_token`：`accountId = 13b53ae8a7a1@im.bot`，`conversationId = o9cq804svxfyCCTIqzddDqRBeMC0@im.wechat`，`updatedAt = 2026-06-03T14:47:49.029Z`。
- 正向 cron/message 复测 token `NC-WEIXIN-REAL-20260603-224814` 使用临时 job `c33fef31`。cron `lastStatus = ok`，journal 显示 `message` 工具参数为 `channel=weixin`、`to=o9cq804svxfyCCTIqzddDqRBeMC0@im.wechat`、`content=NC-WEIXIN-REAL-20260603-224814`，工具结果为 `Message sent to weixin:...`。该临时 job 已删除；用户确认真实微信已收到该 trace，正向用户可见送达验收通过。

## 发布/部署方式

未发布线上包。本地通过 `pnpm -C packages/nextclaw dev:build restart --ui-port 55667 --start-timeout 60000` 重启源码服务并完成真实冒烟。

提交记录：本批次已提交，提交信息为 `Decouple cron delivery from channel accounts`。

## 用户/产品视角的验收步骤

- 创建新 cron job 时不再能配置 `deliver/channel/to/accountId`。
- 定时任务如果需要发微信，任务文本中必须要求 AI 调用 `message` 工具。
- 微信账号不存在、未登录或通道不可用时，工具结果和 cron `lastError` 都应显示真实失败。
- 当前旧早晚新闻 job 的 payload 已删除旧 delivery 字段，不再绑定旧微信账号。

## 可维护性总结汇总

本次遵守删除优先和 owner 收敛原则：删除 cron delivery 平行路径，把投递责任收回 message/channel owner，并把旧 `types.ts` 命名债收敛为 `cron.types.ts`。

scoped maintainability guard 结果：非测试代码 `+90 / -143 / net -53`。仍有既有目录预算 warning：`packages/nextclaw-server/src/app`、`packages/nextclaw-ui/src/shared/lib/api`、`packages/nextclaw/src/cli/app/index.ts`，本轮未新增这些目录的文件数量。

## NPM 包发布记录

本轮涉及用户可见的 cron、CLI/API/UI、message 工具和微信 channel 行为变化，已添加 changeset：`.changeset/cron-channel-delivery-decoupling.md`。

待统一发布的 patch 包：

- `nextclaw`
- `@nextclaw/core`
- `@nextclaw/kernel`
- `@nextclaw/service`
- `@nextclaw/server`
- `@nextclaw/ui`
- `@nextclaw/channel-extension-weixin`
