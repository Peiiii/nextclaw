# v0.17.28 QQ Channel Startup Timeout

## 迭代完成说明

- 根因：QQ 官方 SDK 的 `Bot.start()` 只有在 WebSocket ready 后才 resolve；非开发态遇到 SDK 长时间不 ready 时，原实现不等待、不超时，并且把通道乐观标记为 running，导致状态看起来启用但实际无法收发消息。
- 确认方式：检查本地非开发态日志，能看到 `✓ Channels enabled: feishu, qq, weixin`，但没有 `QQ bot connected`，也没有失败日志；源码中 `QQChannel.start()` 只触发异步 `tryConnect("startup")`，没有等待连接完成。
- 修复：QQ 启动现在等待首轮连接任务；SDK start 超时后会安全 stop 当前 bot、记录 `[qq] start failed ... retry` 并进入原有重试；`isRunning` 改为只在真实 bot 已连接时返回 true。
- 同步减债：QQ 通道文件按职责后缀重命名为 `qq.service.ts`，并删除当前 QQ 官方 Bot C2C/GROUP_AT 模式不会产生的 guild/direct 分支。

## 测试/验证/验收方式

- `pnpm -C packages/extensions/nextclaw-channel-runtime exec node --import tsx --test src/channels/qq.service.test.ts`
- `pnpm -C packages/extensions/nextclaw-channel-runtime tsc`
- `pnpm -C packages/extensions/nextclaw-channel-runtime lint`
- `pnpm -C packages/extensions/nextclaw-channel-runtime build`
- `pnpm lint:new-code:governance`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/extensions/nextclaw-channel-runtime/src/channels/qq.service.ts packages/extensions/nextclaw-channel-runtime/src/channels/qq.service.test.ts packages/extensions/nextclaw-channel-runtime/src/index.ts`
- `pnpm check:governance-backlog-ratchet`

说明：`check:governance-backlog-ratchet` 因当前仓库 doc file-name violations 为 13、高于 baseline 11 失败；本次未触达对应文档命名。maintainability guard 对未暂存重命名按新文件计数，误报非测试净增；人工按旧 `qq.ts` 删除、新 `qq.service.ts` 新增和 `index.ts` 导入变化计算，非测试代码净减少 6 行。

## 发布/部署方式

不涉及部署。涉及 `@nextclaw/channel-runtime` 源码变更，后续需要随统一 NPM beta/stable 发布批次发出。

## 用户/产品视角的验收步骤

1. 启动非开发态 NextClaw 服务。
2. 观察日志：QQ 成功时应出现 `QQ bot connected`；底层 SDK 不 ready 时，应在超时后出现 `[qq] start failed ... retry`，不再沉默。
3. 运行 `nextclaw channels status` 时，QQ 的 running 状态应只代表真实连接完成。
4. 用 QQ 私聊或群 at 发送消息，确认服务能在 QQ SDK ready 后接收并回复。

## 可维护性总结汇总

- 已使用 `post-edit-maintainability-review` 口径复核：本次是 bugfix，非测试代码净减少，符合非功能改动行数门槛。
- 正向减债动作：删除当前 QQ 官方 Bot 连接模式不会产生的 guild/direct 分支；将触达文件命名收敛到 `*.service.ts`；统一 touched class 的箭头 class field 规则。
- 保留债务：`qq.service.ts` 仍超过 400 行预算，`channels/` 目录仍处于目录预算警戒区；本次未扩大生产代码体积，但后续适合按 channel runtime 责任拆分。

## NPM 包发布记录

- 涉及包：`@nextclaw/channel-runtime`
- 本次未执行 NPM 发布。
- 发布状态：待统一发布。
