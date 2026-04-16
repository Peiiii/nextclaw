# v0.16.41-weixin-media-delivery

## 迭代完成说明

本批次把“微信附件只剩占位文本”和“AI 无法通过微信原生发图片/文件”这两个缺口一起补上了，并且继续沿用上一轮已经收好的 `Channel -> NcpReplyConsumer -> Chat` 主链，没有再长出第二套富媒体回复机制。

本次完成的核心结果：

- UI 现在会把 `NcpMessagePart.file.assetUri` 直接映射成 `/api/ncp/assets/content`，所以微信入站图片/文件在前端会显示真实资源，而不是只剩 `"[收到图片]"` 这类假文本。
- 微信入站消息在已经拿到真实附件时，不再把 `"[收到图片]"`、`"[收到文件]"` 这类合成占位文本继续发布给上游。
- 微信出站现在支持原生图片/文件发送：
  - `contentBase64`
  - `assetUri`
  - `url`
  这三类 `file part` 都能被解析成真实字节，再走微信官方 `getuploadurl -> CDN upload -> sendmessage` 链路。
- `ChatTarget` 新增了运行时级的 `resolveAssetContentPath`，平台在 reply 路由时把资产解析能力定向带给 channel，避免把这类宿主级细节硬塞进 NCP part 协议或 metadata 里。
- 微信插件内部结构也做了顺手减债：
  - `weixin-api.client.ts` 收回基础 API 职责
  - `src/media/weixin-media.client.ts` 专注上传与原生 media 发送
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

- 微信插件定向测试通过，`13` 条测试通过。
- `@nextclaw/ui` 的 `ncp-session-adapter.test.ts` 通过，`7` 条测试通过。
- `@nextclaw/ncp-toolkit` 的 `ncp-reply-consumer.test.ts` 通过，`5` 条测试通过。
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

## 发布 / 部署方式

本批次不需要单独发布脚本。

如果要让本地服务吃到这轮最新微信能力：

1. 启动或重启本地开发服务。
2. 确认微信插件按 first-party development source 模式加载源码。
3. 用真实微信会话分别验证：
   - 用户发图片到 NextClaw
   - AI 在微信里回复图片
   - AI 在微信里回复文件
4. 若本地源码模式下渠道未启用，先检查新增的 source-mode import 写法是否再次被回退成混合 `type` import。

## 用户 / 产品视角的验收步骤

1. 在微信里向 bot 发送一张图片。
2. 打开前端对应会话，确认看到的是实际图片/文件预览，而不是单独的 `"[收到图片]"` 占位文本。
3. 让 AI 回复一个图片附件，确认微信侧收到的是原生图片消息，而不是文本 fallback。
4. 让 AI 回复一个普通文件，确认微信侧收到的是原生文件消息，而不是 `[文件] xxx` 这样的文本替代。
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

### 代码增减报告

- 新增：962 行
- 删除：74 行
- 净增：+888 行

### 非测试代码增减报告

- 新增：631 行
- 删除：69 行
- 净增：+562 行

说明：

- 这次净增主要来自把“微信原生 media 发送”真正补齐所需的上传链、读取链和测试契约。
- 在接受这部分增长之前，已经先删除了微信入站 placeholder 语义，并把新增逻辑拆散到更清晰的角色边界，没有继续把复杂度堆在单一大文件里。
- 当前已经达到这轮需求的较优最小落点；如果再压缩，只会重新回到“把上传、读取、chat owner 混在一起”的坏状态。

### 删减优先 / 简化优先判断

是。

这轮没有通过新增兼容层去“补一条附件专线”，而是：

- 直接复用 `file part`
- 直接复用 `ChatTarget`
- 直接复用已有 `/api/ncp/assets/content`

新增代码主要是微信原生 media 必需的上传与读取能力，不是补丁式包装。

### 代码量 / 分支数 / 函数数 / 文件数 / 目录平铺度判断

部分改善，部分净增长经说明接受。

- 非测试代码净增长属实，而且新增了两个内部文件；这是本轮补齐真实媒体发送能力的最小必要代价。
- 但通过把 media 逻辑收进 `src/media/` 子目录，避免了继续污染微信插件顶层目录平铺度。
- `weixin-api.client.ts` 和 `weixin-chat.ts` 都被压回预算线附近，没有继续让单文件失控。

### 抽象 / 模块边界 / class / helper / service / store 等职责划分判断

更清晰。

- `weixin-api.client.ts`：基础 API / 协议入口
- `media/weixin-media.client.ts`：上传与原生 media 发送
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
