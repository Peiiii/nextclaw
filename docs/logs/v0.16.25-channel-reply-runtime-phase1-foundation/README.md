# v0.16.25-channel-reply-runtime-phase1-foundation

## 迭代完成说明

本批次已经把 reply 新链从“讨论方案”推进到“微信首条真实链路可运行”的状态，并且把中间态重新收敛回更简单的模型：

- 继续沿用现有 `registerChannel(...) -> createChannel(...) -> Channel instance` 生命周期
- `Channel` 实例可选实现 `consumeNcpReply(...)`
- 共享层只保留 `chat.types.ts` 和 `ncp-reply-consumer.ts` 这两个核心协议/语义文件
- `Channel` 初始化时可以持有一个长期存活的 `NcpReplyConsumer` 实例，由它在每次消费时创建内部 reply session state owner
- 平台只负责把属于该 channel 的 NCP event stream 定向交给对应的 channel instance
- 微信成为首个切到新链的渠道

本批次最终落地的核心文件：

- `packages/ncp-packages/nextclaw-ncp-toolkit/src/chat/chat.types.ts`
- `packages/ncp-packages/nextclaw-ncp-toolkit/src/chat/ncp-reply-consumer.ts`
- `packages/ncp-packages/nextclaw-ncp-toolkit/src/chat/index.ts`
- `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-chat.ts`
- `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-channel.ts`
- `packages/nextclaw/src/cli/commands/ncp/runtime/runner/channel-reply-router.service.ts`
- `packages/nextclaw/src/cli/commands/ncp/runtime/runner/nextclaw-ncp-runner.service.ts`
- `packages/nextclaw/src/cli/commands/ncp/runtime/nextclaw-ncp-dispatch.ts`

本批次关键结果：

- 删除了上一版 `message-channel` 公共结构，不再把 `consumer / translator / endpoint / delivery` 暴露成一堆顶层概念
- 微信 reply 现在可以在稳定的 text-part 边界上及时发送，而不是只能等整条消息结束
- `message.completed` 到来时只补发尚未输出的最终尾巴，不会把已发送文本整条重复发送
- 微信不再依赖旧 `typing-stop control` 才能结束 typing
- reply 消费逻辑从“散函数 + 传 state”收成了“长期 `NcpReplyConsumer` + 内部 `NcpReplySession` state owner”
- `nextclaw-ncp-dispatch.ts` 顺手删除了一套已经多余的 slash command fallback，避免新链把 dispatch 文件继续撑大
- 验收排查期间一度加过临时结构化调试日志，并在根因定位后移除了这些临时诊断代码
- 同批次续改继续清理了已无实际价值的 reply 协议残留：
  - 删除了 `blockId` 这层没有真实消费方的过渡概念
  - `NcpReplySession` 内部删除了仅为 `blockId` 服务的 `activeMessageId` / `blockCount`
  - 一批只剩 `void payload`、`void reason`、`void params.kind` 的过渡参数被删掉
  - `ChannelReplyRouterService` 删除了未使用的 `sessionKey` 过渡字段
  - 在用户指出“协议不能被错误收窄成纯文本”后，`Chat` 共享协议从文本专用重新提升回 `NcpMessagePart` 级别：现在由 `sendPart(target, part)` 统一承接文本、文件、卡片等 part，而不是把公共协议限制死在 `sendTextPart(...)`
  - `NcpReplyConsumer` 在 `message.completed` 时会补发尚未输出的非文本 part；微信侧 `WeixinChat` 开始在自身内部承担 part 到微信消息能力的映射逻辑

相关设计文档：

- [Channel consumeNcpReply Midstate Design](../../designs/2026-04-16-channel-consume-ncp-reply-midstate-design.md)
- [Directed NCP Event Channel Protocol Design](../../designs/2026-04-16-directed-ncp-event-channel-protocol-design.md)

## 测试 / 验证 / 验收方式

已执行：

```bash
pnpm --filter @nextclaw/ncp-toolkit test -- ncp-reply-consumer
pnpm --filter @nextclaw/channel-plugin-weixin test -- weixin-channel.test.ts
pnpm --filter nextclaw test -- nextclaw-ncp-runner.test.ts
pnpm --filter nextclaw test -- stream-encoder-order.test.ts
pnpm --filter @nextclaw/ncp-toolkit tsc
pnpm --filter @nextclaw/channel-plugin-weixin tsc
pnpm --filter nextclaw tsc
pnpm lint:maintainability:guard
pnpm lint:new-code:governance
pnpm check:governance-backlog-ratchet
```

结果：

- `@nextclaw/ncp-toolkit` 的 `ncp-reply-consumer` 测试通过，`4` 条测试通过
  - 后续提升为 `5` 条测试通过，其中新增了一条“completed non-text part 通过共享 part 协议下发”的回归测试
- `@nextclaw/channel-plugin-weixin` 的 `weixin-channel.test.ts` 通过，`3` 条测试通过
- `nextclaw` 的 `nextclaw-ncp-runner.test.ts` 通过，`8` 条测试通过
- `nextclaw` 的 `stream-encoder-order.test.ts` 通过，`3` 条测试通过
- 三个相关包的定向 `tsc` 都通过
- `@nextclaw/ncp-toolkit`、微信插件与 `nextclaw` 的定向测试复跑通过，说明 reply 新链在去掉临时诊断代码后仍然成立
- 同批次续改再次复跑：
  - `pnpm --filter @nextclaw/ncp-toolkit test -- ncp-reply-consumer`
  - `pnpm --filter @nextclaw/channel-plugin-weixin test -- weixin-channel.test.ts`
  - `pnpm --filter nextclaw test -- nextclaw-ncp-runner.test.ts`
  - `pnpm --filter @nextclaw/ncp-toolkit tsc`
  - `pnpm --filter @nextclaw/channel-plugin-weixin tsc`
  - `pnpm --filter nextclaw tsc`
  结果全部通过，说明删掉 `blockId` 和相关内部死状态后，这条微信新链仍然成立；随后又把共享协议重新提升回 `NcpMessagePart` 级别并复跑通过，确认这条链没有被错误收窄成“只支持纯文本”

治理/维护性命令结果说明：

- `pnpm lint:maintainability:guard` 未通过，但这次直接相关的硬错误已经清掉；`packages/nextclaw/src/cli/commands/ncp/runtime/nextclaw-ncp-dispatch.ts` 已从超预算错误降为 `332 / 400` 的 near-budget 预警
- 后续 class 收敛本身没有再引入新的维护性硬错误；`packages/ncp-packages/nextclaw-ncp-toolkit/src/chat/ncp-reply-consumer.ts` 与 `packages/nextclaw/src/cli/commands/ncp/runtime/nextclaw-ncp-dispatch.ts` 当前都只剩 near-budget 预警
- `pnpm lint:maintainability:guard` 剩余硬错误都来自当前工作区里其它无关改动，例如 `packages/extensions/nextclaw-ncp-runtime-adapter-hermes-http/*` 和 `packages/extensions/nextclaw-ncp-runtime-http-client/*`
- `pnpm lint:new-code:governance` 仍未通过；本轮直接相关的阻塞来自当前仓库的 file-role-boundary 规则与既有 touched 文件命名债务，外加若干无关改动
- `pnpm check:governance-backlog-ratchet` 未通过，原因是仓库当前 tracked doc 命名债务计数为 `13`，高于 baseline `11`；直接涉及的 tracked 文档包括 `docs/logs/TEMPLATE.md` 与 `docs/logs/v0.6.34-multi-agent-gateway-research/SOURCE.md`

未执行：

- 未做真实微信账号在线冒烟，因为当前回合没有可安全复用的在线账号与环境上下文

## 发布 / 部署方式

本批次不建议单独发布。

原因：

- 微信已经切到新链，但其它聊天渠道还没有迁移完成
- 旧的全局 outbound/final-string reply 路径还在系统里，尚未进入最终删除阶段
- 当前更适合作为“首渠道切链 + 协议收口”的基础批次，而不是对外宣告“全渠道 reply 主链切换完成”

推荐的后续发布方式：

1. 继续按同一协议迁移下一个聊天渠道。
2. 每迁完一个渠道，就顺手删除它对应的旧 reply 依赖。
3. 当聊天渠道都完成迁移后，再把旧 reply 主链整体删除并做一次统一发布。

## 用户 / 产品视角的验收步骤

1. 阅读 [../../designs/2026-04-16-channel-consume-ncp-reply-midstate-design.md](../../designs/2026-04-16-channel-consume-ncp-reply-midstate-design.md)，确认顶层模型已经收敛成 `Channel + consumeNcpReply(...) + Chat + ChatTarget`。
2. 阅读 `packages/ncp-packages/nextclaw-ncp-toolkit/src/chat/chat.types.ts` 与 `packages/ncp-packages/nextclaw-ncp-toolkit/src/chat/ncp-reply-consumer.ts`，确认共享层只保留最小协议与最小消费逻辑，并且 reply state 已被收回到内部 class owner。
3. 阅读 `packages/nextclaw/src/cli/commands/ncp/runtime/runner/channel-reply-router.service.ts`，确认平台只做定向路由，不再引入第二套插件注册协议。
4. 阅读 `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-channel.ts` 与 `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-chat.ts`，确认微信链路已经内聚成 `WeixinChannel + WeixinChat`。
5. 运行上面的定向测试，确认微信在 text-part 边界会逐块发送，且 `message.completed` 不会重复整条文本。
6. 查看 `packages/nextclaw/src/cli/commands/ncp/runtime/nextclaw-ncp-dispatch.ts`，确认 dispatch 仍然清晰，并且没有为了接新链继续叠加一套 fallback 解析逻辑。
7. 在真实微信链路中验证“先说话 -> 调工具 -> 再说话”场景，确认微信能按稳定 text-part 分段输出，而不是重新退回整条最终输出。

## 可维护性总结汇总

### 长期目标对齐 / 可维护性推进

是。

这次不是在旧链外面再包一层新 runtime，而是把 reply 主链压回了更接近最终态的形状：`Channel` 直接消费 NCP 事件流，平台只做定向路由，共享层只提供最小协议和一个长期存活的 `NcpReplyConsumer`。它确实顺着“代码更少、边界更清晰、抽象更本质”的长期方向推进了一步。

### 可维护性复核结论

保留债务经说明接受。

没有发现新的抽象层污染，但还保留两处明确后续入口：

1. 其它聊天渠道尚未切到新链，所以旧 reply 主链还没有进入总删除阶段。
2. `packages/nextclaw/src/cli/commands/ncp/runtime/nextclaw-ncp-runner.test.ts` 在本批次增长较多，后续如果继续扩测试，应优先拆 fixtures/builders。

### 本次是否已尽最大努力优化可维护性

是。

本批次已经顺手做了两次主动删减，而不是只把新能力接进去：

- 删除了上一版 `message-channel` 公共层
- 删除了 `nextclaw-ncp-dispatch.ts` 里已无必要的 slash command fallback 解析
- 为了避免“加日志反而把主函数重新撑爆”，又把新增调试逻辑做了一次内部收敛，把主流程中的大分支拆回了更小 helper

### 本次顺手减债

是。

- 微信对旧 `typing-stop control` 的依赖被删掉了
- 旧 `message-channel` 顶层命名和公开结构被删掉了
- `nextclaw-ncp-dispatch.ts` 的死 fallback 被删掉了
- 现有 `Channel` 生命周期被保留，没有再裂出第二套插件注册协议
- `sendBlock + blockId` 这层过渡抽象被删掉了，协议更贴近“text-part”真实语义
- 文本专用的共享协议又被拉回 `NcpMessagePart` 级别，避免把“当前微信先做文本”误写成“长期协议只能发文本”
- `NcpReplySession` 内部为 `blockId` 服务的死状态和空参数被删掉了

### 代码增减报告

统计口径：仅统计本批次相关源码、测试与运行链路配置，不含文档。

- 新增：1391 行
- 删除：226 行
- 净增：+1165 行

说明：

- 这次增长主要来自新增的共享 `chat` 协议/消费实现、微信 `WeixinChat` 适配，以及平台薄路由
- 现有非测试实现文件本身并没有继续单向膨胀，`weixin-channel.ts` 和 `nextclaw-ncp-dispatch.ts` 反而都有明显删减

### 非测试代码增减报告

统计口径：仅统计本批次相关源码与运行链路配置，排除 `*.test.*`。

- 新增：834 行
- 删除：214 行
- 净增：+620 行

说明：

- 修改过的既有非测试文件合计是净减少的
- 当前净增长基本都来自“把新主链真正落库”所必须的新共享文件与新微信发送抽象
- 这已经比“继续在旧链外叠加兼容层”更接近最小必要增长

### 删减优先 / 简化优先判断

是。

本批次优先选择的是：

- 复用现有 `Channel` 生命周期，而不是新建注册体系
- 删除旧公共层，而不是保留新旧双套 public protocol
- 删除 dispatch 里的死 fallback，而不是把复杂度转移到别的 helper

### 代码量 / 分支数 / 函数数 / 文件数 / 目录平铺度判断

部分改善，部分仍保留债务。

- 共享层顶层概念明显减少了
- 既有实现文件的复杂度没有继续恶化，`nextclaw-ncp-dispatch.ts` 甚至净减了 `67` 行
- 但 `packages/nextclaw/src/cli/commands/ncp/runtime` 目录仍处于 near-budget 状态，后续若继续增长，需要进一步按职责拆稳

### 抽象 / 模块边界 / class / helper / service / store 等职责划分判断

更合适、更清晰。

- `WeixinChannel` 回到“插件生命周期 owner”
- `WeixinChat` 专注“把回复发到微信聊天世界”
- `NcpReplyConsumer` 专注“消费 NCP reply event stream 并驱动 chat 输出”
- `NcpReplySession` 作为内部 state owner，专注“维护一次 reply 消费过程中的文本块状态与 flush 边界”
- `ChannelReplyRouterService` 只保留平台层定向路由职责

本次没有再引入 `orchestrator / translator / endpoint / delivery` 这类会污染顶层心智模型的公开角色。

### 是否避免了过度抽象或补丁式叠加

是。

这次最重要的结构判断就是：不为了迁移再造一套中间态插件协议。新链直接挂在现有 `Channel` 上，这让中态和最终态基本同构。

### 目录结构与文件组织是否满足当前项目治理要求

部分满足，部分保留已知债务。

- 新增共享协议文件与微信适配文件的命名、边界和位置是清晰的
- 但工作区当前存在无关的治理阻塞项，导致全局 `lint:new-code:governance` 与 `check:governance-backlog-ratchet` 仍无法整体通过
- 本批次没有去碰那两处无关 UI 文件与历史 doc 命名债务，避免把 scope 扩散到当前 reply 主链之外

### 基于独立可维护性复核的总结

本次独立复核结论是：新主链本身没有再引入额外层次，反而删掉了一层旧公共结构和一段 dead fallback，方向是对的。后续最值得继续推进的 seam 很明确，就是按同一协议迁移其它聊天渠道，并在迁移过程中把旧 reply 主链一段段删掉。

同批次续改后的补充结论是：这条新协议又往“概念更少、协议更直白”推进了一小步。我们删掉了没有真实消费方的 `blockId`，也删掉了一组只为过渡存在的空字段和空参数，但没有再把共享协议错误缩窄成“只能发文本”。
同批次后续再修正的补充结论是：共享协议不能为了微信当前实现方便而被缩窄成“纯文本协议”。最终收口后的方向是：共享层使用 `NcpMessagePart` 作为公共输出单位，文本只是其中一种；渠道是否支持文件、卡片、动作等，由各自的 `Chat` 实现内部决定，而不是由共享协议预先禁止。
