# v0.18.59 Feishu QR Extension

## 迭代完成说明

本次新增轻量级 `@nextclaw/channel-extension-feishu`，按现有 extension 机制接入 `feishu` channel，并参考 Hermes 的 Feishu/Lark scan-to-create 流程实现二维码注册自建应用、保存应用凭证、WebSocket 收消息与 NCP 回复消费。

旧 `@nextclaw/channel-plugin-feishu` 未删除，继续作为 legacy 包保留；新 extension 使用同一个 `feishu` channel id，依赖 gateway 现有 extension 优先级覆盖旧插件绑定，降低一次性迁移风险。

后续补充：为进一步避免双路径冲突，已从内置 bundled channel plugin 加载列表中注释掉 legacy `@nextclaw/channel-plugin-feishu`，由 QR-first Feishu extension 独占内置 `feishu` 运行路径。

回复链路修复补充：用户扫码接入后发送“你好”无回复，经日志与 session journal 排查，消息已进入 NCP 并生成回复，断点在回飞书投递。根因是 kernel 侧 extension registry 只继承旧 plugin registry，未合并 manifest extension 的 channel contribution，导致旧 Feishu plugin 仍可能成为 `feishu` channel 的发送 owner；同时飞书私聊入站使用 sender open_id 生成 direct session，但真正发送接口需要 chat_id，微信没有这层 ID 差异。修复后 manifest extension channel 会覆盖同 channelId 的 legacy plugin channel，Feishu 入站把 chat_id 写入 `peer_id` / `peer_kind` 供 NCP session route 使用，同时保留 sender open_id 做权限与上下文。

旧插件入口清理补充：之前只从 bundled channel plugin 列表注释掉 `@nextclaw/channel-plugin-feishu`，但 dev first-party plugin loader 仍会从 `packages/extensions` 和已安装 first-party plugin 映射中发现旧 Feishu plugin，所以启动日志仍出现 `[plugins:feishu] feishu_doc...`。本次进一步在 first-party dev load path resolver 中禁止 legacy `@nextclaw/channel-plugin-feishu` 映射进运行时 load paths，并移除 `@nextclaw/openclaw-compat` 对旧 Feishu plugin 包的 workspace dependency；旧插件源码仍保留，但运行时不再引入。

## 测试/验证/验收方式

- `pnpm -C packages/extensions/nextclaw-channel-extension-feishu tsc`
- `pnpm -C packages/extensions/nextclaw-channel-extension-feishu lint`
- `pnpm -C packages/extensions/nextclaw-channel-extension-feishu exec vitest run src/tests/feishu-extension-runtime.service.test.ts src/tests/feishu-auth-capability.service.test.ts`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-core build`
- `pnpm -C packages/nextclaw-service exec vitest run src/shared/services/gateway/tests/gateway-plugin-manager.service.test.ts`
- `pnpm -C packages/nextclaw-service exec vitest run src/commands/plugin/dev-first-party-plugin-load-paths.test.ts src/commands/plugin/dev-first-party-plugin-legacy-feishu-load-paths.test.ts src/commands/plugin/dev-first-party-plugin-load-paths.path-install.test.ts`
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-service build`
- `pnpm -C packages/nextclaw-openclaw-compat tsc`
- `pnpm -C packages/nextclaw-openclaw-compat build`
- `pnpm -C packages/extensions/nextclaw-channel-extension-feishu build`
- `node /Users/peiwang/Projects/nextbot/node_modules/.pnpm/vitest@4.1.2_@types+node@20.19.33_jsdom@25.0.1_vite@8.0.3_@emnapi+core@1.9.1_@emnapi+runtime@_nfuxdxk5fjmepweq3l55t5aqem/node_modules/vitest/vitest.mjs run src/tests`
- `pnpm -C packages/extensions/nextclaw-channel-extension-feishu build`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-openclaw-compat tsc`
- `pnpm -C packages/nextclaw-client-sdk tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui exec vitest run src/features/channels/components/config/weixin-channel-auth-section.test.tsx src/features/channels/utils/channel-form-fields.utils.test.ts`
- `pnpm -C packages/nextclaw-ui exec eslint src/features/channels/components/config/weixin-channel-auth-section.tsx src/features/channels/utils/channel-form-fields.utils.ts src/shared/lib/i18n/channel-auth.constants.ts --max-warnings=0`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- 真实外发烟测：使用本地已扫码 Feishu 账号向最近真实 chatId 发送“NextClaw 飞书通道修复冒烟测试：发送链路已连通。”，Lark SDK 返回成功。
- 本地服务重启后健康检查：`curl -fsS http://127.0.0.1:18792/api/health` 返回 `{"status":"ok","services":{"ncpAgent":"ready","cronService":"ready"}}`。
- 旧 Feishu plugin 入口清理后重启本地 dev，当前启动批次不再出现 `[plugins:feishu] feishu_doc...`，只剩新 Feishu extension 启动与重复 manifest 发现导致的 `Extension channel ignored because id already exists: feishu` 提示。

`pnpm lint:new-code:governance` 在回复链路修复后已通过。此前触达 `packages/nextclaw-core/src/features/channels/services/extension-channel.service.ts` 时暴露的 alias import 与 class field 规则问题已同步修正。

maintainability guard 无 error，仍有 11 个既有 warning；本次相关触达未新增 hard error。

## 发布/部署方式

未执行发布或部署。本次只是本地实现与验证；后续若要进入 beta/stable，需要把 `@nextclaw/channel-extension-feishu` 纳入统一 NPM 发布批次，并跟随桌面/CLI 打包链路验证内置 extension 发现。

## 用户/产品视角的验收步骤

1. 打开渠道配置页，选择 Feishu/Lark。
2. 确认首屏显示与微信一致的扫码连接卡片。
3. 根据需要选择 `feishu` 或 `lark` 域名。
4. 点击扫码连接，用飞书或 Lark 扫码完成应用创建授权。
5. 连接成功后确认配置自动出现默认账号、账号映射和启用状态。
6. 启用渠道后，用飞书私聊或群聊提及机器人，确认消息进入 NextClaw，并能收到 Agent 回复。

## 可维护性总结汇总

本次属于新增用户能力，生产代码净增长是预期结果。实现上没有继续扩写旧飞书插件，而是新增独立 extension 包，按注册、账号存储、SDK、入站 adapter、NCP 回复消费、前端扫码 UI 分 owner 拆分，避免把旧插件里的工具和历史 webhook 逻辑继续搬进新路径。

前端复用了微信扫码体验并抽成通用 QR auth section；飞书只新增差异化文案、域名选择和配置 layout。旧插件保留为 legacy，运行时通过 extension 优先级接管，避免破坏已有安装。

回复链路修复没有继续堆叠旧插件逻辑，而是收敛 owner：registry ownership 在 gateway plugin manager，飞书会话路由 ownership 在 Feishu extension runtime/adapter，通用 extension channel 无 outbound 时不再把 event-driven channel 当错误发送器。已运行定向 lint、tsc、测试、build 与治理命令；maintainability guard 仍提示既有 warning，但本次未新增 hard error。

旧插件入口清理额外收敛了 first-party plugin loading 文件命名：触达后按治理要求把 classless loader 文件改成 `.utils.ts` 后缀，并把新增 legacy Feishu 过滤用例拆到独立测试文件，避免扩大既有长测试函数。

## NPM 包发布记录

涉及新增 NPM workspace 包 `@nextclaw/channel-extension-feishu`，但本轮未发布。

状态：待统一发布。发布前需要确认包版本、内置 extension 发现、桌面打包产物与真实 Feishu/Lark 扫码链路。
