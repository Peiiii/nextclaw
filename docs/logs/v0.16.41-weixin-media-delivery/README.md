# v0.16.41-weixin-media-delivery

## 迭代完成说明

本批次把“微信附件只剩占位文本”和“AI 无法通过微信原生发图片/文件”这两个缺口一起补上了，并且继续沿用上一轮已经收好的 `Channel -> NcpReplyConsumer -> Chat` 主链，没有再长出第二套富媒体回复机制。

本次完成的核心结果：

- UI 现在会把 `NcpMessagePart.file.assetUri` 直接映射成 `/api/ncp/assets/content`，所以微信入站图片/文件在前端会显示真实资源，而不是只剩 `"[收到图片]"` 这类假文本。
- 微信入站消息在已经拿到真实附件时，不再把 `"[收到图片]"`、`"[收到文件]"` 这类合成占位文本继续发布给上游。
- 微信出站现在支持：
  - 原生微信图片发送
  - 稳定的微信文件附件发送
  - `contentBase64`
  - `assetUri`
  - `url`
  这三类 `file part` 都能被解析成真实字节，再走微信官方 `getuploadurl -> CDN upload -> sendmessage` 链路。
- 微信上“图片已过期或已被清理”这类问题，最终被收敛成了更可预测的行为：
  - 最终定位到的关键差异不是 asset store，也不是 consumer 投影，而是图片和文件在微信协议里的 `media.aes_key` 编码并不完全一致
  - 后续又对照官方微信 SDK，把图片发送 payload 进一步收回到更小的原生 `image_item` 形态，只保留 `media + mid_size`
  - 图片现在重新走回原生 `image_item` 路径，并按微信官方实现使用十六进制 key 的 base64 编码
  - 文件继续走稳定的 `file_item` 路径，不再和图片共用一套编码假设
- 微信长轮询里的 `errcode=-14, errmsg=session timeout` 现在会被识别成 `getupdates` 会话游标过期：
  - 自动清掉本地保存的 cursor
  - 下一轮静默恢复轮询
  - 不再把 UI 日志持续刷成一整屏 `polling failed`
- `ChatTarget` 新增了运行时级的 `resolveAssetContentPath`，平台在 reply 路由时把资产解析能力定向带给 channel，避免把这类宿主级细节硬塞进 NCP part 协议或 metadata 里。
- `NcpReplyConsumer` 现在会在 `chat.sendPart(...)` 前，把 `asset_put` 的工具结果统一投影成标准 `file part`：
  - 不再依赖前端单独对 `asset_put` 做 UI 特判才看得到附件
  - channel 侧继续只消费标准 `file part`
  - 微信这类渠道因此也能跟着吃到 `asset_put` 产出的附件，而不需要认识工具名
- 微信插件内部结构也做了顺手减债：
  - `weixin-api.client.ts` 收回基础 API 职责
  - `src/media/weixin-media.client.ts` 专注上传与微信媒体发送
  - `src/media/weixin-media-part-reader.ts` 专注把 `file part` 读成可发送字节
  - `weixin-chat.ts` 回到清晰的 chat owner 角色
- 在本地源码开发模式下，微信插件新增的 media 发送能力也已经修到可直接运行：
  - 把容易触发 source-mode runtime parse error 的混合 `type` import 收成更稳的分离写法
  - 避免出现“测试和 tsc 通过，但 first-party development source 加载失败”的假绿状态

相关基础设计仍然沿用上一轮 reply 主链设计：

- [Channel consumeNcpReply Midstate Design](../../designs/2026-04-16-channel-consume-ncp-reply-midstate-design.md)

## 测试 / 验证 / 验收方式

已执行：

```bash
pnpm --filter @nextclaw/channel-plugin-weixin test -- weixin-channel-attachments.test.ts weixin-channel.test.ts weixin-api.client.test.ts
pnpm --filter @nextclaw/channel-plugin-weixin tsc
pnpm --filter @nextclaw/ui test -- ncp-session-adapter.test.ts
pnpm --filter @nextclaw/ui tsc
pnpm --filter @nextclaw/ncp-toolkit test -- ncp-reply-consumer.test.ts
pnpm --filter @nextclaw/ncp-toolkit tsc
pnpm --filter nextclaw test -- nextclaw-ncp-runner.test.ts
pnpm --filter nextclaw tsc
pnpm lint:maintainability:guard
pnpm -C packages/nextclaw exec tsx --eval 'import("../../packages/extensions/nextclaw-channel-plugin-weixin/src/media/weixin-media.client.ts").then(() => console.log("media-client-ok"))'
pnpm -C packages/nextclaw exec tsx --eval 'import("../../packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-channel.ts").then(() => console.log("weixin-channel-ok"))'
```

结果：

- 微信插件定向测试通过，最新已扩展到 `15` 条测试并全部通过。
- `@nextclaw/ui` 的 `ncp-session-adapter.test.ts` 通过，`7` 条测试通过。
- `@nextclaw/ncp-toolkit` 的 `ncp-reply-consumer.test.ts` 通过，`5` 条测试通过。
- 补充后，`@nextclaw/ncp-toolkit` 的 `ncp-reply-consumer.test.ts` 已扩展到覆盖 `asset_put -> file part` 投影，当前 `7` 条测试通过。
- `nextclaw` 的 `nextclaw-ncp-runner.test.ts` 通过，`8` 条测试通过。
- 四个相关包的定向 `tsc` 都通过。
- `pnpm lint:maintainability:guard` 未通过，但本轮自己引入的 hard error 已经清掉；剩余 hard error 全部来自当前工作区里其它 Hermes / HTTP runtime 相关并行改动，不是本轮微信 media 改动造成的。
- source-mode 运行时 import 验证通过，`weixin-media.client.ts` 和 `weixin-channel.ts` 都能在本地源码模式下被真实加载。

真实微信在线冒烟：

- 使用真实微信账号 `61899606cc64@im.bot` 和真实会话 `o9cq804svxfyCCTIqzddDqRBeMC0@im.wechat` 完成在线发送。
- 先直接走底层媒体发送链，真实发出：
  - 文本文件 `nextclaw-smoke.txt`
  - 图片 `nextclaw-smoke.png`
- 微信官方接口返回的真实 `messageId`：
  - file: `b1968a30-835a-4bf5-a66a-8877dff17102`
  - image: `44bdf753-26e1-470c-85d5-5cdb6fd3248a`
- 随后再走产品实际新增链路 `WeixinChat.sendPart(target, filePart)` 复测一次：
  - 文本文件 `nextclaw-chat-smoke.txt`
  - 图片 `nextclaw-chat-smoke.png`
- 第二轮通过 `contentBase64 -> WeixinMediaPartReader -> WeixinChat -> media client -> 微信 API` 的实际链路完成，没有报错。
- 之后又补了一轮共享链路收口：`asset_put result -> NcpReplyConsumer projection -> file part -> WeixinChat.sendPart`。这轮是为了让渠道附件能力真正建立在标准 `file part` 上，而不是继续依赖前端侧的工具结果特判。
- 最新一轮又做了真实微信 smoke：直接通过 `WeixinChannel.consumeNcpReply(...)` 喂入两个 `asset_put` 工具结果（一个文本附件、一个图片附件），并由 `NcpReplyConsumer` 在发送前统一投影成标准 `file part`。脚本执行完成且未报错，验证了 `asset_put -> consumer projection -> 微信附件发送` 这条实际链路。
- 随后又追加了一轮回归修正：最近开发态发现图片仍可能显示“资源已被清理”，最终确认问题集中在微信原生图片消息的协议细节，而不是统一 reply 链本身。
- 最新修正把图片重新切回原生 `image_item` 路径，并单独改成图片专用的 `aes_key` 编码；文件附件仍维持现有文件路径。
- 当前收尾验证又补了两轮真实微信发送：
  - 直接发送了一条原生图片协议探针 `raw-aes-key`，微信接口返回真实 `imageMessageId: 70014da4-ae6b-43a7-9aab-68ec318a92bc`
  - 再通过当前源码链路 `WeixinChannel.consumeNcpReply(...)` 发送了一张 `nextclaw-native-image-fixed.jpg`，脚本返回 `mode: weixin-native-image-fixed-smoke`
  这两轮的目的都是确认“最近微信会话里的图片”已经重新回到原生图片消息链，而不是继续停留在附件降级路径
- 最新顺序验证也已完成：构造了 `文本 -> asset_put tool-call-result -> 等 2 秒 -> 后续文本` 的真实微信 smoke。记录到的本地时间顺序显示：
  - `17:40:24.220Z` 先发前置文本
  - `17:40:24.536Z` 开始发文本文件
  - `17:40:25.219Z` 紧接着开始发图片
  - `17:40:27.906Z` 才开始发后续文本
  说明附件已经在 `tool-call-result` 到达时按自然顺序发出，不再拖到 `message.completed` 才统一补发。
- 之后又补了一轮图片协议修正验证：
  - 定向测试现在会强校验 `sendmessage` 里的 `media.aes_key` 必须能解回 `getuploadurl` 使用的同一个十六进制 `aeskey`
  - 真实在线又发了一条文本提示和一张 1x1 PNG 冒烟图，微信接口接受成功：
    - text: `368d6f14-9bb5-4635-9a04-774c6917ba4d`
    - image: `56dc66aa-c81b-4ee2-9f7d-7c6d982a7ae5`
  - 同时再走了一次产品真实链路 `WeixinChat.sendPart(file:image)`，脚本执行成功，确认修正后的 media client 已被 chat owner 实际吃到。
- 最新补丁又补了一条轮询恢复回归：
  - `getupdates` 返回 `errcode=-14, errmsg=session timeout` 时，会自动清掉失效 cursor 并恢复下一轮轮询
  - 这条路径现在不会再持续 `console.warn`
  - 微信插件定向测试已经覆盖这条恢复逻辑

## 发布 / 部署方式

本批次不需要单独发布脚本。

如果要让本地服务吃到这轮最新微信能力：

1. 启动或重启本地开发服务。
2. 确认微信插件按 first-party development source 模式加载源码。
3. 用真实微信会话分别验证：
   - 用户发图片到 NextClaw
   - AI 在微信里回复标准图片
   - AI 在微信里回复文件
4. 若本地源码模式下渠道未启用，先检查新增的 source-mode import 写法是否再次被回退成混合 `type` import。

## 用户 / 产品视角的验收步骤

1. 在微信里向 bot 发送一张图片。
2. 打开前端对应会话，确认看到的是实际图片/文件预览，而不是单独的 `"[收到图片]"` 占位文本。
3. 让 AI 回复一张图片，确认微信侧收到的是标准图片消息，而不是“资源已被清理”的坏图片消息，也不是附件下载样式。
4. 让 AI 回复一个普通文件，确认微信侧收到的是可下载的附件，而不是 `[文件] xxx` 这样的文本替代。
5. 若需要单独验证渠道输出能力，可直接通过 `WeixinChat.sendPart(..., { type: "file", ... })` 发送一个文本文件和一个图片，看微信侧是否真实收到。
6. 再做一次混合场景：先文本、再工具、再图片/文件，确认文本渐进输出仍然成立，富媒体 part 也能在完成阶段正确发出。

## 可维护性总结汇总

### 长期目标对齐 / 可维护性推进

是。

这次不是为微信附件问题临时塞一层特判，而是继续沿用统一的 NCP event -> Chat 输出链，并把“资产内容如何从宿主读出来”收成了一个明确的运行时上下文字段。它让 NextClaw 作为统一入口在聊天渠道里对富媒体的承接能力更完整了一步，而不是继续停留在“文本能通、附件靠占位”的半成品状态。

### 可维护性复核结论

通过。

### 本次顺手减债

是。

- 删除了微信入站附件上的假文本占位语义。
- 没有把媒体发送逻辑继续塞回 `weixin-chat.ts` 或 `weixin-api.client.ts`，而是按职责拆成了更清楚的内部模块。
- 没有再新增一套富媒体 reply 协议，而是继续复用 `file part` 和现有 reply 主链。
- 又进一步删除了一层“只有前端才懂 `asset_put` 结果”的特殊语义，把它前移成共享 reply consumer 的标准输出投影。

### 代码增减报告

- 新增：962 行
- 删除：74 行
- 净增：+888 行

### 非测试代码增减报告

- 新增：631 行
- 删除：69 行
- 净增：+562 行

说明：

- 这次净增主要来自把“微信媒体发送”真正补齐所需的上传链、读取链和测试契约。
- 在接受这部分增长之前，已经先删除了微信入站 placeholder 语义，并把新增逻辑拆散到更清晰的角色边界，没有继续把复杂度堆在单一大文件里。
- 当前已经达到这轮需求的较优最小落点；如果再压缩，只会重新回到“把上传、读取、chat owner 混在一起”的坏状态。

### 删减优先 / 简化优先判断

是。

这轮没有通过新增兼容层去“补一条附件专线”，而是：

- 直接复用 `file part`
- 直接复用 `ChatTarget`
- 直接复用已有 `/api/ncp/assets/content`

新增代码主要是微信媒体发送必需的上传与读取能力，不是补丁式包装。

### 代码量 / 分支数 / 函数数 / 文件数 / 目录平铺度判断

部分改善，部分净增长经说明接受。

- 非测试代码净增长属实，而且新增了两个内部文件；这是本轮补齐真实媒体发送能力的最小必要代价。
- 但通过把 media 逻辑收进 `src/media/` 子目录，避免了继续污染微信插件顶层目录平铺度。
- `weixin-api.client.ts` 和 `weixin-chat.ts` 都被压回预算线附近，没有继续让单文件失控。

### 抽象 / 模块边界 / class / helper / service / store 等职责划分判断

更清晰。

- `weixin-api.client.ts`：基础 API / 协议入口
- `media/weixin-media.client.ts`：上传与微信媒体发送
- `media/weixin-media-part-reader.ts`：把 `file part` 读成字节
- `weixin-chat.ts`：聊天发送 owner
- `channel-reply-router.service.ts`：只负责把资产解析能力和 reply 流一起定向交给 channel

这比把所有逻辑都继续堆回 `weixin-chat.ts` 明显更可维护。

### 是否避免了过度抽象或补丁式叠加

是。

本轮没有再引入新的公共 runtime/service/adapter 概念；新增的只是微信插件内部按职责拆分的两个小模块。共享层只加了一个最小必要的 `resolveAssetContentPath` 运行时钩子。

### 目录结构与文件组织是否满足当前项目治理要求

本轮触达范围内基本满足。

- 微信插件顶层目录没有再越过硬预算。
- 守卫里的剩余 hard error 全部来自当前工作区其它 Hermes / HTTP runtime 改动。
- 本轮自己的文件只剩 near-budget 预警，没有新的 hard error。

### 基于独立可维护性复核的总结

no maintainability findings

这次续改没有再扩一层功能，只是把源码模式运行时的最后一处不稳定点压掉，并补了真实在线冒烟，属于对同一能力闭环的收尾。保留的债务仍然主要在测试文件体积上；如果下一轮继续扩微信 media 变体，优先把这些测试里的 fixtures/builders 再抽出来。 
