# v0.19.26 渠道 Extension 最终迁移与旧运行时清理

## 迭代完成说明

本轮完成渠道 extension 迁移计划的最后阶段：`telegram`、`discord` 已迁移到标准 `nextclaw-channel-extension-*` 包，并清理一方渠道旧路径。

核心改动：

- 新增 `nextclaw-channel-extension-telegram`、`nextclaw-channel-extension-discord`，由 extension manifest 贡献渠道。
- 将 Telegram / Discord 平台实现落入各自 extension 包，不再依赖 `@nextclaw/channel-runtime`。
- 删除旧 `nextclaw-channel-runtime` 包和剩余旧 `nextclaw-channel-plugin-telegram` / `nextclaw-channel-plugin-discord` 包。
- 追补删除整个 `packages/nextclaw-openclaw-compat` 包；第三方旧插件兼容不再作为当前主仓库主链路目标。
- 追补删除旧本地 OpenClaw plugin dev server，并清理 `nextclaw plugins *` / `channel-plugin-*` 在 active 文档和 marketplace 测试里的残留示例。
- 删除 `ChannelManager` 内的 `registration.channel.nextclaw.createChannel(...)` in-process 渠道创建分支。
- 清理 marketplace、dev runner、desktop package build/verify、tsconfig alias、lockfile 与测试中旧 channel plugin / runtime / OpenClaw compat 引用。
- 补齐 extension command ingress，用于 Telegram 文本命令与 Discord slash command；渠道包只通过通用 extension channel API 调命令，不直接依赖 kernel session/command owner。
- 将 Telegram/Discord 内部大文件继续拆分：Telegram 拆出 streaming preview controller 与 message utils；Discord 拆出 command utils、text utils、draft streaming service。

## 测试/验证/验收方式

已通过：

- `pnpm install --lockfile-only --ignore-scripts`
- `pnpm install --ignore-scripts`
- `pnpm -C packages/nextclaw-shared tsc`
- `pnpm -C packages/nextclaw-extension-sdk tsc`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-runtime tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C apps/desktop tsc`
- 所有一方 channel extension 包 `tsc`
- 所有一方 channel extension 包 `build`
- `pnpm -C packages/extensions/nextclaw-channel-extension-telegram lint`
- `pnpm -C packages/extensions/nextclaw-channel-extension-discord lint`
- `pnpm -C packages/extensions/nextclaw-channel-extension-email lint`
- `pnpm -C packages/extensions/nextclaw-channel-extension-slack lint`
- `pnpm -C packages/nextclaw-core test -- src/features/channels/managers/channel.manager.test.ts --run`
- `pnpm -C packages/nextclaw-kernel test -- src/services/extension-runtime.service.test.ts --run`
- `pnpm -C packages/nextclaw-server test -- src/app/router.marketplace-content.test.ts --run`
- `pnpm -C packages/nextclaw-ui test -- src/features/marketplace/components/marketplace-page.test.tsx src/features/marketplace/utils/marketplace-installed-cache.utils.test.ts --run`
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-server test -- src/app/router.marketplace-content.test.ts src/app/router.marketplace-manage.test.ts --run`
- `pnpm -C packages/nextclaw-ui test -- src/features/marketplace/components/marketplace-page.test.tsx src/features/marketplace/utils/marketplace-installed-cache.utils.test.ts --run`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`
- 旧路径扫描：确认生产源码、脚本、lockfile 中不再引用 `@nextclaw/channel-runtime`、`nextclaw-channel-plugin-*`、`builtin-channel-*` bundled plugin 路径、`channel.nextclaw`、`@nextclaw/openclaw-compat` 或 `packages/nextclaw-openclaw-compat`。
- `git diff --check`

## 发布/部署方式

未执行发布或部署。本轮是仓库内结构迁移和旧路径删除，需要后续进入统一 NPM release/beta 批次时评估新增 extension 包发布与旧包停止发布策略。

## 用户/产品视角的验收步骤

1. 启动 NextClaw 服务后，确认 `feishu`、`weixin`、`qq`、`dingtalk`、`wecom`、`slack`、`email`、`whatsapp`、`telegram`、`discord` 都由 extension manifest 贡献。
2. 确认日志中不再出现一方 `nextclaw-channel-plugin-*` bundled plugin 注册。
3. 确认 `ChannelManager` 只通过 extension adapter 接入渠道，不再走旧 in-process channel runtime 创建路径。
4. 有真实平台凭证时，对 Telegram/Discord 执行入站消息、outbound reply、typing/streaming 和 command/slash command 冒烟。
5. 无真实凭证时，以包级 tsc/build/lint、extension discovery 测试、command ingress 测试和旧路径扫描作为最小可信替代验收。

## 可维护性总结汇总

本轮是非功能迁移与清理，遵循 deletion-first 和 single-domain-owner。

维护性结果：

- 生产代码总体净减少，主要来自删除旧 runtime、旧 plugin wrapper、整个 OpenClaw compat 包、旧 plugin CLI/bridge/gateway manager 和 ChannelManager 旧分支。
- 新增代码集中在新的 extension 包和通用 extension command ingress，旧的一方渠道双路径被收敛为唯一 extension manifest 路径。
- Telegram/Discord 没有停留在“整文件搬家”状态：已继续拆出流式预览、文本分块、draft streaming、命令映射和消息工具，避免新增 extension 包立刻形成超长主 service。
- OpenClaw compat 不再留在主仓库；通用 channel binding/auth/config projection 合同已迁回 extension 主链路。
- 已使用 `post-edit-maintainability-guard` 和 `post-edit-maintainability-review` 规则进行收尾检查；本 README 同时记录红区触达。

## NPM 包发布记录

当前未发布，需要后续统一发布评估：

- `@nextclaw/channel-extension-telegram`
- `@nextclaw/channel-extension-discord`
- `@nextclaw/channel-extension-dingtalk`
- `@nextclaw/channel-extension-email`
- `@nextclaw/channel-extension-slack`
- `@nextclaw/channel-extension-wecom`
- `@nextclaw/channel-extension-whatsapp`

本轮删除或停止携带的旧包：

- `@nextclaw/channel-runtime`
- `@nextclaw/channel-plugin-telegram`
- `@nextclaw/channel-plugin-discord`
- 之前阶段已删除的其他一方 `@nextclaw/channel-plugin-*`
- `@nextclaw/openclaw-compat`

发布时需要确认旧包是否需要 NPM deprecate 标记，还是仅从后续 workspace 发布批次中移除。

## 红区触达与减债记录

### packages/extensions/nextclaw-channel-extension-telegram/src/services/telegram-channel.service.ts

- 本次是否减债：是
- 说明：从旧 runtime 迁入后没有保留超长单文件形态，已拆出 `telegram-stream-preview.controller.ts` 和 `telegram-message.utils.ts`；主 service 保留渠道生命周期、收发入口和平台策略。
- 下一步拆分缝：如果后续继续增长，优先拆 `resolveIncomingMediaPart` 相关媒体下载/转写 owner，以及 mention/policy resolver。

### packages/extensions/nextclaw-channel-extension-discord/src/services/discord-channel.service.ts

- 本次是否减债：是
- 说明：从旧 runtime 迁入后拆出 `discord-command.utils.ts`、`discord-text.utils.ts`、`discord-draft-streaming.service.ts`；主 service 不再承载文本分块、draft streaming 和命令 option 映射细节。
- 下一步拆分缝：如果后续继续增长，优先拆入站 attachment downloader、slash command registrar 和 mention/policy resolver。

### packages/nextclaw-server/src/features/config/stores/server-config.store.ts

- 本次是否减债：是
- 说明：本轮触达只用于移除 OpenClaw compat 投影入口，没有向 `server-config.store.ts` 继续追加配置页面业务、运行时副作用或跨页面拼装逻辑；OpenClaw plugin config projection 已迁出为 extension channel config view 合同，旧兼容链路整体删除。
- 下一步拆分缝：后续如果继续治理该热点，优先按 chat/session/provider 三个域拆分配置构建与默认值归一化。
