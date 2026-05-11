# v0.18.24 Extension SDK Foundation

## 迭代完成说明

本次落地 NextClaw Extension SDK 第一阶段基础骨架：新增 `@nextclaw/extension-sdk` 包，新增通用 `/webhook` server 入口，service 侧通过共享 `Ingress` 接收 extension channel config / message submit，extension manifest 发现和 lifecycle 启停骨架由常驻 service 管理。

本次明确修正设计边界：`/webhook` 是通用入口，不是 extension 专属 endpoint；extension 只是通用 webhook 的一种调用方和 handler 类型。Extension lifecycle 归属 NextClaw 常驻 service，不新增 extension host，不新增 kernel/runtime 分层。

本轮追加收敛 runtime 访问边界：CLI 注册层统一传入 `nextclaw` 本体，注册函数内部再访问 `nextclaw.commands`。同时修正 gateway 生命周期建模：gateway runtime 不再挂在 `NextclawServiceRuntime` 构造期半初始化，而是在具体 gateway 启动现场一次性组装为 `NextclawGatewayRuntime` 后传给 `startUiServer`，避免长期 facade 持有短生命周期运行态。

本轮追加 service 命名治理：`.service.ts` 现在只允许用于内部声明了 `class` 的服务 owner；classless 的纯函数、映射、解析、装配或导出聚合必须改用真实角色后缀。该规则已同步到 skill、工作流文档和 `file-role-boundaries` diff gate。

本轮追加新版微信 extension 骨架：NCP raw event 由 backend 顺手发布到 `appEventBus` 的 `ncp.event`，SDK 的 `channel.onNcpEvent` 复用现有 `/ws` eventBus；新增 `@nextclaw/channel-extension-weixin` 包，只包含 extension 进程、配置监听、入站消息提交、NCP event 接收的骨架，不平迁旧微信插件复杂实现。该包的公共 `index.ts` 保持纯导出，进程启动入口独立为 `main.ts`，避免导入包时产生启动副作用。

本轮同步修正 SDK 公开命名：根对象统一为方案文档中的 `NextClawExtension`，删除实现里漂移出来的 `NextClawExtensionService` 名称。

本轮继续收敛 SDK 公开表面：配置变化只通过通用 `config.updated` 事件失效并重新 `config.get()`，删除 extension 专属 `channelConfigChanged` 事件和公开 `*Service` 类型名。

本轮修正 `ncp.event` 语义：`ncp.event` payload 现在就是原始 `NcpEndpointEvent`，不再包装 `event/sessionId/channelId/conversationId/accountId/metadata`。channel 路由上下文不混入 NCP 协议事件本体。

本轮完成新版 Weixin extension 闭环：`@nextclaw/service` 生产依赖新版 `@nextclaw/channel-extension-weixin`，service extension discovery 能解析新版 manifest root；Weixin 登录、扫码、账号保存、旧账号替换和配置回写回到 extension 包内的 `WeixinLoginService` owner；旧版 `nextclaw-channel-plugin-weixin` 包、root 命令入口、openclaw compat 旧依赖和 lockfile workspace 链接已删除。

本轮补修 service/extension 边界漂移：service 不再 import Weixin schema、常量或登录业务类；静态 channel metadata 来自 `nextclaw.extension.json`，动态 auth 通过通用 `extension.request` / `extension.response` 协议在 service 和 extension 进程之间通信。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `node packages/nextclaw-server/node_modules/typescript/bin/tsc -p packages/nextclaw-extension-sdk/tsconfig.json`
- `pnpm -C packages/nextclaw-service exec vitest run ...` 覆盖 webhook service、extension lifecycle、extension startup、gateway startup hooks。
- `/webhook` server route 通过 `pnpm -C packages/nextclaw-server tsc` 与 targeted ESLint 验证；通用入口分发行为由共享 `Ingress` 与 service 侧 extension runtime 验证覆盖。
- `cd packages/nextclaw-extension-sdk && ../nextclaw-server/node_modules/.bin/vitest run src/extension-sdk.test.ts`
- `pnpm -C packages/nextclaw-service lint`
- server touched files targeted ESLint、extension SDK targeted ESLint、`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、maintainability guard、`git diff --check`
- 本轮追加验证：`pnpm --filter @nextclaw/server tsc --noEmit`、`pnpm --filter @nextclaw-service tsc --noEmit`、changed files targeted ESLint、`pnpm lint:maintainability:guard`
- service 命名治理追加验证：`node --test scripts/governance/lint-new-code-file-role-boundaries.test.mjs`、targeted ESLint、`pnpm check:governance-backlog-ratchet`、maintainability guard、`git diff --check`。
- gateway owner 追加验证：`pnpm --filter @nextclaw-service tsc --noEmit`、`pnpm --filter @nextclaw/server tsc --noEmit`、`pnpm --filter nextclaw tsc --noEmit`、`pnpm lint:new-code:governance`、gateway/plugin/NCP targeted tests。
- extension 微信骨架追加验证：`pnpm --filter @nextclaw/shared tsc`、`pnpm --filter @nextclaw/service tsc`、`node packages/nextclaw-server/node_modules/typescript/bin/tsc -p packages/nextclaw-extension-sdk/tsconfig.json`、`pnpm --filter @nextclaw/channel-extension-weixin tsc`、`pnpm --filter @nextclaw/shared build`、`pnpm --filter @nextclaw/extension-sdk build`、`pnpm --filter @nextclaw/channel-extension-weixin build`、NCP event bridge / extension SDK / Weixin extension targeted Vitest、相关 package ESLint、`pnpm lint:maintainability:guard`、`git diff --check`。
- extension 进程级 smoke：本地启动 HTTP `/webhook` 与 `/ws`，再以 `NEXTCLAW_EXTENSION_ENDPOINT` / `NEXTCLAW_EXTENSION_TOKEN` / `NEXTCLAW_EXTENSION_ID` 启动 `packages/extensions/nextclaw-channel-extension-weixin/dist/main.js`，已验证进程能提交 `extension.channel.config.get` 并建立 `/ws` 连接。
- extension 包公共入口 smoke：`pnpm --filter @nextclaw/channel-extension-weixin exec node --input-type=module -e "import('@nextclaw/channel-extension-weixin')"` 已验证公共导入不会触发进程启动副作用。
- SDK 公开入口 smoke：`pnpm --filter @nextclaw/extension-sdk exec node --input-type=module -e "import('@nextclaw/extension-sdk')"` 已验证 `NextClawExtension` 存在且旧 `NextClawExtensionService` 不再导出。
- SDK 表面收敛验证：`rg` 已确认 `extensionEventKeys`、`channelConfigChanged`、`ChannelConfigChangedEvent`、`ExtensionChannelsService`、`ExtensionChannelConfigService` 无残留；public surface smoke 已确认旧入口不再导出。
- extension 配置变化 smoke：进程级 smoke 发送通用 `config.updated { path: "channels" }` 后，新版微信 extension 通过 `config.get()` 再次拉取配置，验证配置监听不依赖 extension 专属通道。
- NCP event 透传验证：`create-ui-ncp-agent` targeted test、extension SDK targeted test 与进程级 smoke 均已验证 `ncp.event` 使用原始 `NcpEndpointEvent` payload，不再依赖 extension 包装字段；空心 `NcpEventBridgeService` 已删除，订阅生命周期回到 NCP runtime owner。
- Weixin extension 闭环验证：`pnpm --filter @nextclaw/channel-extension-weixin tsc`、`pnpm --filter @nextclaw/channel-extension-weixin test -- --run`、`pnpm --filter @nextclaw/channel-extension-weixin lint`、`pnpm --filter @nextclaw/channel-extension-weixin build` 均通过，覆盖 7 个测试文件、24 个测试。
- service 集成验证：`pnpm --filter @nextclaw/service tsc` 通过；`pnpm --filter @nextclaw/service test -- --run src/commands/channel/channels.test.ts src/shared/services/extensions/service-extension-runtime.service.test.ts src/shared/services/gateway/tests/gateway-plugin-manager.service.test.ts` 通过，覆盖新版内置 extension 发现、CLI auth binding、gateway plugin binding 合并。
- service/extension 边界补修验证：`rg "from \"@nextclaw/channel-extension-weixin\"|from '@nextclaw/channel-extension-weixin'|WeixinLoginService|WEIXIN_" packages/nextclaw-service/src -n` 无输出；service 侧 manifest contribution 和 request/response auth targeted test 通过。
- service lint/build 验证：`pnpm --filter @nextclaw/service lint` 退出码为 0，只有既有 warning；`pnpm --filter @nextclaw/service build` 通过，build warning 来自既有第三方依赖。
- server/openclaw 验证：`pnpm --filter @nextclaw/server tsc` 与 `pnpm --filter @nextclaw/openclaw-compat tsc` 通过。
- 生产发现 smoke：基于构建后的 service dist 调用 `resolveExtensionManifestRoots`，确认返回 `packages/extensions/nextclaw-channel-extension-weixin` manifest root。
- 真实 Weixin 最终冒烟：基于新版 extension dist 的 `HttpWeixinApiClient` 和现有账号向真实微信用户发送最终闭环验证文本，返回 `messageId=958206ea-adc6-47e5-9bfd-6cbfa1f18d89`。
- 旧包残留验证：`rg "nextclaw-channel-plugin-weixin|@nextclaw/channel-plugin-weixin|packages/extensions/nextclaw-channel-plugin-weixin" package.json packages/nextclaw-openclaw-compat packages/nextclaw-service packages/nextclaw-server packages/nextclaw -n --glob '!**/CHANGELOG.md'` 无输出。
- 收尾治理验证：`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs` 通过；warning 只来自既有目录热点和 extension runtime 文件增长提示。
- 未完成项说明：`pnpm --filter @nextclaw/server test -- --run src/ui/router.weixin-channel-auth.test.ts src/ui/server.weixin-channel.test.ts src/ui/router.weixin-channel-config.test.ts` 在进入目标测试前被既有 `@core/features/agent/features/tools/registry.js` alias 解析问题阻塞；本轮用 server `tsc`、service 集成测试和真实 Weixin 冒烟作为替代闭环。

## 发布/部署方式

未发布。当前是本地源码改造阶段，等待后续新版微信 extension 包接入和真实渠道冒烟后再进入发布判断。

## 用户/产品视角的验收步骤

1. 新版微信 extension 包内提供 `nextclaw.extension.json`，构建后可由 service lifecycle 通过 `dist/main.js` 作为独立进程启动。
2. 启动 NextClaw service 后，service 能通过生产依赖发现新版 Weixin extension manifest，启动 extension 进程，并注入 `NEXTCLAW_EXTENSION_ENDPOINT`、`NEXTCLAW_EXTENSION_TOKEN`、`NEXTCLAW_EXTENSION_ID`。
3. extension SDK 通过通用 `/webhook` 提交 channel message，通过现有 `/ws` 接收 `ncp.event` 与配置变更事件。
4. 旧版 Weixin plugin 包不再被 root 命令、openclaw compat 或 service discovery 引入；存量用户的 `channels.weixin` 配置继续由新版 extension 读取。
5. UI 的 Weixin 登录通过通用 extension request/response 进入 extension 进程；service 只持有 pending request，不持有微信业务逻辑。

## 可维护性总结汇总

本次是新增架构能力，非测试代码净增长属于预期。实现中同步做了减债：`runtime-command.service.ts` 从 596 行降到 557 行；UI server 大类型文件拆出 `server.types.ts`；触达的旧非规范 classless `.service.ts` 已按真实角色改为 `.utils.ts` 并落入对应 `utils/` 目录。

maintainability guard 通过，剩余 warning 为既有 `commands/ncp/features/runtime` 目录文件数例外和 `create-ui-ncp-agent.service.ts` 近预算提示。已使用 `post-edit-maintainability-review` 做收尾复核。

本轮追加改造为架构收敛，新增 `runtime.commands` CLI adapter 边界，并把 UI server 所需 gateway 能力收敛为启动期 `NextclawGatewayRuntime`。`NextclawServiceRuntime` 不再持有半初始化 gateway，`startUiServer` 也不再接收散参数入口。

service 命名治理本身是非功能改动，脚本非测试代码净减 6 行：新增 AST class 检查的同时收敛重复目录规则表，并删除无实际产出的 warning 打印分支；规则更强但脚本体积没有继续膨胀。

新版 Weixin 闭环本轮总 diff 为 `+1654 / -4750 / net -3096`，非测试代码为 `+1177 / -3446 / net -2269`。主要减债来自删除旧版 `nextclaw-channel-plugin-weixin` 包和旧引入入口；新增部分集中在新版 extension owner、扫码登录 owner、service 生产发现和 UI/CLI binding。

service/extension 边界补修引入了通用 extension request/response 协议，因此按新增协议能力运行 maintainability guard；自动模式通过。若按纯非功能修正口径运行，当前非测试代码净增会被拦截，后续应继续把 request/response 协议拆成更小 owner 或合并到更通用的 extension transport owner。

## 红区触达与减债记录

### packages/nextclaw-server/src/ui/config.ts

- 本次是否减债：否，本轮只因 server gateway 参数收敛触达该热点文件，未继续扩张其职责。
- 说明：该文件仍属于 UI server 配置热点；本轮没有把新业务逻辑放入该文件。
- 下一步拆分缝：后续若继续治理 UI server，应把路由配置、server 启动配置和测试配置视图拆到更小 owner。

追加触达：

- 本次是否减债：是，旧版 Weixin plugin 删除时只改该文件的 import，实际把 `plugin-channel-config.projection.ts` 收敛为合法的 `plugin-channel-config-projection.utils.ts`，没有向 `config.ts` 增加业务逻辑。
- 说明：`config.ts` 仍是 UI server 配置热点；本轮只是为了保持导入路径和治理命名一致而触达。
- 下一步拆分缝：后续应继续把 schema/meta/projection 组装从该热点文件拆到配置视图 owner。

## NPM 包发布记录

不涉及 NPM 包发布。新增 `@nextclaw/extension-sdk` 包尚未发布，后续需要跟新版微信 extension 真实接入、验证和版本策略一起评估。
