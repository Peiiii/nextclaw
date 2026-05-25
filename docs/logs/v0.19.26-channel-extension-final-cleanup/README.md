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
- 追补彻底删除旧 plugin marketplace surface：服务端 `/api/marketplace/plugins/*`、前端 `/marketplace/plugins`、client SDK plugin content API 与 plugin install/manage 入口全部移除；当前 marketplace 只保留 skill 与 MCP。
- 删除 `config.plugins.*` 配置合同与 reload 语义；extension discovery 不再读取 `plugins.load.paths`，配置热重载计划不再存在 `reloadPlugins`。
- Bootstrap 状态命名从旧 `pluginHydration` 收敛为 `extensionLoading`，计数字段同步改为 extension 语义。
- 清理 active 文档、截图脚本、governance 脚本与本地开发 skill 中旧 plugin / OpenClaw 链路残留。

## 测试/验证/验收方式

已通过：

- `pnpm install --lockfile-only --ignore-scripts`
- `pnpm install --ignore-scripts`
- `pnpm -C packages/nextclaw-shared tsc`
- `pnpm -C packages/nextclaw-extension-sdk tsc`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-runtime tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- 此前阶段 `pnpm -C packages/nextclaw-service tsc`
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
- `pnpm -C packages/nextclaw-core test -- src/features/config/configs/reload.config.test.ts src/features/config/configs/schema.extension-channels.test.ts --run`
- `pnpm -C packages/nextclaw-kernel test -- src/services/extension-runtime.service.test.ts --run`
- `pnpm -C packages/nextclaw-service test -- src/shared/services/gateway/tests/nextclaw-app.service.test.ts src/shared/services/gateway/tests/service-bootstrap-status.service.test.ts --run`
- `pnpm -C packages/nextclaw-server test -- src/app/router.marketplace-content.test.ts src/app/router.marketplace-manage.test.ts src/app/server.cors.test.ts --run`
- `pnpm -C packages/nextclaw-ui test -- src/features/marketplace/components/marketplace-page.test.tsx src/features/marketplace/components/marketplace-page-detail.test.tsx src/features/marketplace/utils/marketplace-installed-cache.utils.test.ts src/features/system-status/managers/system-status.manager.test.ts src/features/system-status/managers/system-status.manager.bootstrap-polling.test.ts src/features/chat/managers/ncp-chat-input.manager.test.ts src/features/chat/utils/ncp-chat-runtime-availability.utils.test.ts --run`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-client-sdk tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-server build`
- `pnpm -C packages/nextclaw-core build`
- 此前阶段 `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- 此前阶段 `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`
- 旧路径扫描：确认生产源码、脚本、lockfile 中不再引用 `@nextclaw/channel-runtime`、`nextclaw-channel-plugin-*`、`builtin-channel-*` bundled plugin 路径、`channel.nextclaw`、`@nextclaw/openclaw-compat` 或 `packages/nextclaw-openclaw-compat`。
- 旧 plugin surface 扫描：确认 active 源码、脚本、active 文档与 skill 中不再引用 `config.plugins`、`plugins.load`、`plugins.entries`、`reloadPlugins`、`pluginHydration`、`marketplace/plugins`、`PluginMarketplace`、`MarketplacePlugin`、`installPlugin`、`enablePlugin`、`disablePlugin`、`uninstallPlugin`、`openclaw.plugin.json`、`packageJson.openclaw` 或 `nextclaw plugins`。
- `git diff --check`

暂未完全通过：

- `pnpm -C packages/nextclaw-service tsc`：旧 plugin/bootstrap 相关错误已清掉；当前剩余失败来自并行会话已修改的 `src/shared/services/gateway/utils/cron-job-handler.utils.test.ts`，主要是 tuple `[]` 与 possibly undefined 类型错误，不属于本轮旧 plugin surface 删除链路。
- `pnpm lint:new-code:governance`：当前完整 dirty tree 被 diff-only 角色命名规则拦截，命中项包含并行会话触达的 provider/model-config 文件，以及历史 `configs/`、`providers/`、`i18n/` 目录下的既有命名债；本轮未继续扩大到批量重命名。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`：当前完整 dirty tree 被并行会话的 `nextclaw-ncp-runner.utils.ts` 与 provider `builtin.ts` 文件预算拦截；旧 plugin surface 删除本身仍是净删除方向。

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
- 旧 plugin marketplace 与 `config.plugins.*` 作为平行旧入口被删除，extension 成为唯一扩展发现与渠道贡献主路径。
- 本轮追补清理以删除旧入口为主；当前完整工作区混有并行会话改动，精确增减口径应在提交拆分时按本轮文件单独统计。
- 已运行 `post-edit-maintainability-guard` 和 `post-edit-maintainability-review` 相关收尾检查；当前完整门禁被并行/历史触达文件拦截，本 README 同时记录红区触达和拦截原因。

## NPM 包发布记录

当前未发布，需要后续统一发布评估：

- `@nextclaw/channel-extension-telegram`
- `@nextclaw/channel-extension-discord`
- `@nextclaw/channel-extension-dingtalk`
- `@nextclaw/channel-extension-email`
- `@nextclaw/channel-extension-slack`
- `@nextclaw/channel-extension-wecom`
- `@nextclaw/channel-extension-whatsapp`
- `@nextclaw/core`
- `@nextclaw/kernel`
- `@nextclaw/server`
- `@nextclaw/client-sdk`
- `@nextclaw/ui`
- `@nextclaw/service`
- `@nextclaw/nextclaw` CLI/resource package

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
