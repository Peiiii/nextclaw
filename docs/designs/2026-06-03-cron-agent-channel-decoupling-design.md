# Cron 与渠道投递解耦设计

## 背景

2026-06-03 的 `cron:a9e2ee22` 暴露了一个结构性问题：定时任务声称已经把晚间新闻发送到微信，但用户实际没有收到。落盘数据和服务日志显示，问题不是微信延迟，而是 cron job 保存了一个已经失效的微信账号实例：

- `~/.nextclaw/cron/jobs.json` 中 `a9e2ee22.payload.accountId = 4a159cbcaaec@im.bot`
- 当前 `~/.nextclaw/config.json` 中微信默认账号是 `13b53ae8a7a1@im.bot`
- `~/.nextclaw/logs/service.log` 多次报错：`weixin send failed: account "4a159cbcaaec@im.bot" is not logged in`
- cron 状态为 `lastStatus = error`，`lastError = Error: 400 Param Incorrect`

用户进一步澄清：真正的问题不是“旧 accountId 应该动态换新”，而是 cron 和渠道本来就不该绑定。cron 是调度 owner，只负责按时间触发 AI 任务；如果任务需要发微信，应该由 AI 在任务执行过程中调用 `message` 工具，由 message/channel owner 处理当前渠道状态。

## 现状证据

当前实现中，cron 合同已经混入渠道投递概念：

- [packages/nextclaw-core/src/features/cron/types/cron.types.ts](../../packages/nextclaw-core/src/features/cron/types/cron.types.ts)
  - `CronPayload` 包含 `deliver`、`channel`、`to`、`accountId`
- [packages/nextclaw-core/src/features/cron/services/cron.service.ts](../../packages/nextclaw-core/src/features/cron/services/cron.service.ts)
  - `addJob` 接收并持久化 `deliver/channel/to/accountId`
- [packages/nextclaw-service/src/shared/services/gateway/utils/cron-job-handler.utils.ts](../../packages/nextclaw-service/src/shared/services/gateway/utils/cron-job-handler.utils.ts)
  - cron handler 先执行 agent turn，再根据 `job.payload.deliver` 调用 `bus.publishOutbound`
- [packages/nextclaw-core/src/features/agent/tools/cron.tools.ts](../../packages/nextclaw-core/src/features/agent/tools/cron.tools.ts)
  - `CronTool` 从当前会话继承 `channel/chatId/accountId`，并写入 job
- [packages/nextclaw/src/cli/app/index.ts](../../packages/nextclaw/src/cli/app/index.ts)
  - `nextclaw cron add` 暴露 `--deliver --to --channel --account`
- [packages/nextclaw-server/src/features/cron/controllers/cron.controller.ts](../../packages/nextclaw-server/src/features/cron/controllers/cron.controller.ts)
  - API 接收并透传 `deliver/channel/to/accountId`
- [packages/nextclaw-ui/src/shared/lib/cron/cron-job-view.utils.ts](../../packages/nextclaw-ui/src/shared/lib/cron/cron-job-view.utils.ts)
  - UI 展示 `describeCronDelivery`

真正的消息发送能力已经存在于独立 owner：

- [packages/nextclaw-core/src/features/agent/tools/message.tools.ts](../../packages/nextclaw-core/src/features/agent/tools/message.tools.ts)
  - `message` 工具负责把 AI 的显式发送意图转成 `OutboundMessage`
- [packages/nextclaw-core/src/features/channels/services/extension-channel.service.ts](../../packages/nextclaw-core/src/features/channels/services/extension-channel.service.ts)
  - channel owner 负责把 outbound message 交给具体 extension

所以当前不是缺能力，而是 cron 额外复制了一条“任务完成后投递最终回复”的平行路径。

2026-06-03 后续真实冒烟又暴露出第二层问题：即使 cron 已经解耦，微信 channel 也不能把 HTTP 200 或 extension accepted 当成用户收到。对当前微信账号和用户 `to_user_id` 做直连发送时，微信 API 返回：

```json
{"ret":-2}
```

该请求已经具备当前 bot 账号 token 与目标用户 ID，但 `context_token` 为空。这证明“能解析账号 ID”不等于“微信允许发送”。微信 `sendmessage` 的真实发送合同还需要 `context_token`；缺失时必须返回真实失败，而不是继续把内部调用完成展示成成功。

## 设计原则

命中的原则：

- `single-domain-owner`：渠道投递只能有 message/channel owner，cron 不能同时成为投递 owner。
- `responsibility-surface-minimization`：cron 的职责表面应只暴露调度与任务输入，不暴露渠道、账号和收件人。
- `fact-source-ownership`：当前可用微信账号、登录状态、收件人 route 属于 channel owner，不属于 cron store。
- `truthful-external-delivery`：外部渠道发送结果必须以渠道业务返回值和用户可见验证为准，不能把 HTTP 200、队列入队或 extension accepted 当成送达。
- `data-flow-locality`：任务需要发微信时，信息应在 AI 执行阶段通过 `message` 工具流向 channel，而不是先存进 cron 再由 handler 后处理。
- `deletion-first`：这次应删除 cron delivery 路径，而不是补“过期 accountId 自动恢复”。

## 目标

本轮目标是把 cron 恢复为纯调度能力：

```text
cron -> 到点触发 AI 任务 -> AI 按任务内容执行 -> AI 可选择调用 message 工具 -> channel runtime 发送
```

cron job 持久化合同应收敛为：

```ts
type CronPayload = {
  kind?: "system_event" | "agent_turn";
  message: string;
  agentId?: string | null;
  sessionId?: string | null;
};
```

其中：

- `message` 是到点交给 AI 的完整任务指令。
- 如果需要通知用户，通知要求必须写在 `message` 中，例如“整理完成后用 message 工具通过微信发送给我”。
- `agentId/sessionId` 仍属于调度目标和会话连续性，可以保留。
- `deliver/channel/to/accountId` 从 cron owner 删除。

## 非目标

本方案不做这些事：

- 不给 cron 增加“动态解析微信默认账号”的逻辑。
- 不让 cron 知道 Weixin、Feishu、Discord 等渠道细节。
- 不保留“执行完再把最终回复投递出去”的第二条发送路径。
- 不改变 `message` 工具作为 AI 主动发消息入口的定位。
- 不在本轮重做所有 channel route 语义。

## 微信 `context_token` 发送合同

微信渠道的发送 owner 是 [WeixinChannelAdapter](../../packages/extensions/nextclaw-channel-extension-weixin/src/services/weixin-channel-adapter.service.ts)。它的出站合同必须是：

```text
message 工具/渠道回复 -> 微信 channel 动态解析账号 -> 读取目标用户 context_token -> 调用 sendmessage -> 按 ret/errcode 判定结果
```

其中：

- 账号 ID 可以动态解析：优先使用 message 显式传入的 `accountId`，其次使用当前配置的 `defaultAccountId`，再退到唯一已登录账号。
- cron 不保存账号 ID，也不负责解析账号 ID。
- `context_token` 来自微信入站消息的 `context_token` 字段，由微信 channel 在处理入站消息时保存。
- 出站时如果没有 `context_token`，必须直接失败：`weixin send failed: missing context_token ...`。
- 出站时如果微信 API 返回 `ret != 0` 或 `errcode != 0`，必须失败并暴露真实业务返回，例如 `weixin sendmessage failed: ret=-2`。
- 只有微信 API 业务返回成功，才能认为系统侧发送成功；真实用户可见冒烟仍必须以用户确认收到 trace 文本为准。

本设计不把 `context_token` 写进 cron payload，也不让 cron 理解微信上下文。`context_token` 是微信 channel 的渠道私有发送资格数据。

## 推荐方案

### 1. 删除 cron delivery 持久化合同

修改范围：

- `CronPayload`
- `CronService.addJob`
- server `CronCreateRequest/CronPayloadView`
- `UiCronHost.addJob`
- CLI `CronCreateRequest`
- client/UI API types

移除字段：

- `deliver`
- `channel`
- `to`
- `accountId`

保留字段：

- `message`
- `agentId`
- `sessionId`
- `kind`

### 2. 删除 cron handler 的后处理投递

当前 `createCronJobHandler` 中这段逻辑应删除：

```ts
if (job.payload.deliver && job.payload.to) {
  await params.bus.publishOutbound(...);
}
```

handler 只负责：

1. 构造 cron session metadata
2. 调用 `agentRunClient.sendAndWaitForReply`
3. 检查最终 assistant message 中的 `message` 工具结果
4. 返回 agent final reply 用于 cron 状态

`MessageBus` 不再是 `createCronJobHandler` 的依赖。

如果最终 assistant message 中存在失败的 `message` 工具结果，例如：

```json
{
  "ok": false,
  "error": {
    "message": "weixin send failed: account \"missing@im.bot\" is not logged in"
  }
}
```

cron handler 必须抛出错误，让 job 的 `lastStatus = error`，`lastError` 写入真实原因。否则 UI/API 仍会把“agent 跑完了”误导成“微信发送成功”。

### 3. 缩小 cron session metadata

当前 metadata 会从 `payload.channel/to/accountId` 推导：

- `channel`
- `chatId`
- `accountId`

这些字段应从 cron metadata 删除，避免把 cron session 伪装成某个渠道会话。

推荐保留：

- `agentId`
- `label`
- `cron_job_id`
- `cron_job_name`
- `session_origin = "cron"`

可选保留：

- `session_type/runtime` 等运行时字段，如果现有 run owner 需要。

### 4. 调整 CronTool 语义

`CronTool` 不再继承当前会话的 `channel/chatId/accountId`，也不再暴露 `deliver/accountId` 参数。

工具描述应明确：

- cron 只创建定时任务。
- 如果用户要求“到点发微信/通知我”，必须把这个要求写入 `message`。
- 不要把最终要发出的文本当成整个 `message`，除非任务本身就是“到点发送这句原文”。

示例：

```json
{
  "action": "add",
  "name": "晚间新闻",
  "cron": "0 20 * * *",
  "message": "搜索并整理今日中文科技新闻和全球技术热点，生成简洁摘要。完成后调用 message 工具通过微信发送给我。"
}
```

### 5. 调整 CLI/API/UI

CLI：

- `nextclaw cron add` 删除或废弃 `--deliver --to --channel --account`
- 对旧参数短期可选择直接报错，提示“请把投递要求写入 --message”

API：

- `POST /api/cron` 不再接收 delivery 字段
- 如果请求带旧字段，推荐返回 400，避免静默保存错误语义

UI：

- 定时任务列表不再展示 `Deliver to`
- 搜索条件不再包含 `payload.channel/payload.to`
- 会话侧“本会话定时任务”仍可按 `payload.sessionId` 关联，这个能力和渠道无关，可以保留

文档：

- 更新 `docs/USAGE.md`
- 运行 `sync-usage-resource` 更新 `packages/nextclaw/resources/USAGE.md`
- 更新自管理 skill 中 cron 使用指导，如果存在对应片段

## 旧数据迁移

现有 `~/.nextclaw/cron/jobs.json` 可能已经保存旧字段。推荐迁移策略：

1. 加载 cron store 时做一次 normalize：
   - 删除 `deliver/channel/to/accountId`
   - 保留原 `message`
2. 如果旧 job 是 `deliver=true`，不要自动把投递目标拼进 message。
   - 原因：无法可靠判断“把最终回复投到 channel”是否等价于“AI 应该调用 message 工具发送摘要”。
   - 自动改写可能造成重复发送或错误发送。
3. 在迁移日志或 job state 中标注一次性提示：
   - `lastError = "Legacy cron delivery fields were removed; put notification instructions in the task message."`
   - 是否标 error 需要权衡，推荐不标 error，只在服务日志 warning。

对于当前 `a9e2ee22` 这种任务，应人工或通过用户确认后把 `message` 改成：

```text
现在是晚上 8 点，帮我做今日晚间新闻速览：
1. 搜索今天的中文科技新闻和全球技术热点
2. 整理成简洁的新闻摘要（中文）
3. 调用 message 工具通过微信发送给我
```

然后删除 delivery 字段。这样 cron 只触发任务，微信发送由 AI 正常工具调用完成。

## 风险评估

### 风险 1：旧命令兼容

有人可能仍在使用：

```bash
nextclaw cron add ... --deliver --to ... --channel ...
```

推荐处理：

- 不做长期兼容。
- 短期在 CLI 层报清晰错误，告诉用户把通知要求写进 `--message`。
- 文档给出新写法。

### 风险 2：AI 不一定调用 message 工具

这是解耦后的真实行为：如果任务要求不清楚，AI 可能只在 cron session 里回复。

推荐处理：

- `CronTool` 和文档强化 prompt 写法。
- 对“通知我/发给我/推送到微信”这类自然语言，由创建任务的 AI 把动作写进 `message`。
- 不由 cron 后处理兜底，因为兜底会重新制造双路径。

### 风险 3：message 工具当前仍可能需要 accountId

这不属于 cron owner。若 message/channel 的微信 route 解析不够稳定，应在 message/channel owner 内修，不要回流到 cron。

推荐后续专项：

- 让 `message` 工具支持“给当前用户/默认微信用户发消息”的稳定语义。
- 或由 `cross-channel-messaging` skill 在发送前读取 `nextclaw channels list --json` 获取当前 route。

### 风险 4：UI 里旧 job 的 delivery 展示消失

这是预期变化。delivery 展示本来就是错误心智模型。旧 job 的实际通知要求应体现在 `message` 文本里。

## 实施步骤

建议一次性执行，避免中间状态继续写入旧合同。

1. Core cron 合同收敛
   - 改 `CronPayload`
   - 改 `CronService.addJob`
   - 改 cron service tests

2. Gateway handler 删除投递路径
   - 改 `createCronJobHandler`
   - 删除 `MessageBus` 依赖
   - 改 handler tests，断言不会发布 outbound

3. Agent cron tool 收敛
   - 删除 `deliver/accountId` 参数
   - 删除 `setContext` 中 channel/chatId/accountId 状态
   - 更新工具描述和测试

4. Server/API/Client/UI 类型收敛
   - 改 `CronCreateRequest/CronPayloadView`
   - 改 `CronRoutesController`
   - 改 UI API types
   - 删除 `describeCronDelivery` 和相关展示/搜索

5. CLI 收敛
   - 删除 `--deliver --to --channel --account`
   - 或短期保留但报错，不写入 job
   - 改 CLI cron tests

6. 文档同步
   - 更新 `docs/USAGE.md`
   - 运行 usage resource 同步
   - 更新相关 skill 指导

7. 旧数据迁移
   - 增加 store normalize 或一次性迁移脚本
   - 对 `a9e2ee22` 修正文案并删除旧字段

## 验收标准

数据验收：

- 新建 cron job 后，`~/.nextclaw/cron/jobs.json` 的 job payload 不再出现：
  - `deliver`
  - `channel`
  - `to`
  - `accountId`

行为验收：

- 创建普通定时任务，到点只触发 AI turn，不直接发布 outbound。
- 创建“完成后通过微信发送给我”的定时任务，到点后只有当 AI 调用 `message` 工具时才发微信。
- 如果 AI 没调用 `message`，cron 不伪造发送成功。
- 如果 AI 调用了 `message` 但工具返回失败，cron job 的 `lastStatus` 必须是 `error`，`lastError` 必须包含真实工具错误。

回归验收：

- `cron list/remove/enable/disable/run` 正常。
- `sessionId` 绑定现有会话仍正常。
- UI 定时任务列表正常展示 schedule、status、last error。

建议命令：

```bash
pnpm -C packages/nextclaw-core exec vitest run src/features/cron/services/cron.service.test.ts src/features/agent/tools/cron.tools.test.ts
pnpm -C packages/nextclaw-service exec vitest run src/shared/services/gateway/utils/cron-job-handler.utils.test.ts src/cli/commands/cron
pnpm -C packages/nextclaw-server exec vitest run src/app/router.cron.test.ts
pnpm -C packages/nextclaw-ui exec vitest run src/shared/lib/cron src/shared/components/cron-config.test.tsx src/features/chat/components/conversation/chat-conversation-panel.test.tsx
```

若触达 TypeScript 合同边界，最终还必须跑相关 package 的 `tsc`。

## 决策建议

推荐采用“删除 cron delivery 合同”的结构性方案。

不推荐“动态修复 accountId”方案，因为它仍然承认 cron 有权理解渠道投递，只是把短期 bug 包成更复杂的路由推断。正确方向是让 cron owner 回到调度，message/channel owner 回到投递，AI 任务文本表达业务意图。
