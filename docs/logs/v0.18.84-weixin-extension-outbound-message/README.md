# v0.18.84 Weixin Extension Outbound Message

## 迭代完成说明

- 根因：Weixin 迁移到 extension 进程后，只接通了 inbound `submitMessage` 与 NCP reply event，没有在 extension manifest / service contribution / extension runtime 之间声明和桥接主动 outbound text 能力。`message` 工具仍会发布 outbound message，但 generic extension channel 缺少 `outbound` handler 时原先会静默返回，导致 AI 以为消息已发出，实际没有调用微信发送 API。
- 确认方式：沿 `message tool -> outbound bus -> ChannelManager -> ExtensionChannelAdapter -> ServiceExtensionRuntime -> WeixinExtensionRuntime -> WeixinChannelAdapter` 切链检查，并补充定向测试覆盖 core、service、Weixin runtime/adapter 三段合同。
- 修复方式：为 extension manifest 增加 `outbound.text` 声明；service 将该声明转换为 `channel.outbound.sendText` extension request；Weixin extension 注册 outbound handler 并交给 `WeixinChannelAdapter.sendOutboundText` 使用既有账号、token、contextToken 与 `sendTextMessage` 主路径发送。
- 症状表面修正：generic extension channel 没有 outbound handler 时不再静默成功，而是明确报错，避免工具结果假阳性。
- 后续根因补齐：AI 不应靠猜测或 tool schema enum 获得 channel id；新增 `nextclaw channels list --json` 作为权威 channel discovery 命令，`message` 只做精确 channel id 的 fail-fast 校验，不做 `wechat -> weixin` alias/normalize 兜底。
- 同批维护修正：Weixin/Feishu extension runtime 的多个平行 `unsubscribeXxx` 字段已收敛为统一 `cleanups` collection，并用显式 `started` 状态管理生命周期；`start` 不依赖 cleanup collection 反推状态，重复 start 不重复订阅，`stop` 统一 drain。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/channel-extension-weixin test -- src/tests/weixin-extension-runtime.test.ts`：通过，覆盖 outbound request 进入 Weixin adapter 并调用 `sendTextMessage`。
- `pnpm --filter @nextclaw/service test -- src/shared/services/extensions/service-extension-runtime.service.test.ts`：通过，覆盖 manifest `outbound.text` 到 `extension.request channel.outbound.sendText`。
- `pnpm --filter @nextclaw/core test -- src/features/channels/managers/channel.manager.test.ts`：通过，覆盖 generic extension outbound text 与缺失 handler 的显式失败。
- `pnpm --filter @nextclaw/channel-extension-weixin tsc`、`pnpm --filter @nextclaw/service tsc`、`pnpm --filter @nextclaw/core tsc`：通过。
- `pnpm --filter @nextclaw/channel-extension-weixin lint`：通过。
- `pnpm --filter @nextclaw/channel-extension-feishu test -- src/tests/feishu-extension-runtime.service.test.ts`：通过，覆盖 extension runtime cleanup drain。
- `pnpm --filter @nextclaw/channel-extension-feishu tsc`、`pnpm --filter @nextclaw/channel-extension-feishu lint`：通过。
- `pnpm --filter @nextclaw/service lint`、`pnpm --filter @nextclaw/core lint`：命令退出 0，仍有既有 warning，未由本次改动引入。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`：通过，0 error，4 warnings；已将 `channels list` 的只读构建逻辑拆入 `channel-list-view.service.ts`，避免 `commands/channel/index.ts` 越过 400 行预算。
- `pnpm --filter @nextclaw/service test -- src/commands/channel/channels.test.ts src/shared/services/extensions/service-extension-runtime.service.test.ts`：通过，覆盖 `channels list --json` JSON 输出、NextClaw extension manifest channel discovery、extension runtime manifest discovery。
- `pnpm --filter @nextclaw/core test -- src/features/agent/tools/message.tools.test.ts`：通过，覆盖未知显式 channel fail-fast、不 publish outbound、schema 不含 enum/命令耦合。
- `pnpm --filter @nextclaw/kernel tsc`、`pnpm --filter nextclaw tsc`：通过。
- `pnpm --filter nextclaw build`：通过，并同步 `packages/nextclaw/resources/USAGE.md`。
- `pnpm -C packages/nextclaw exec tsx src/cli/app/index.ts channels list --json` 与 `node packages/nextclaw/dist/cli/app/index.js channels list --json`：通过，真实输出包含 `weixin`，`enabled=true`，`outbound.text=true`，`pluginId=nextclaw-channel-extension-weixin`。
- 真实 Weixin outbound smoke：通过。使用本机 `~/.nextclaw` 中已启用的 Weixin 配置，经 `WeixinExtensionRuntime.sendOutboundText -> WeixinChannelAdapter.sendOutboundText -> sendTextMessage` 向配置中的 allowFrom 目标发送 `NextClaw Weixin outbound smoke 2026-05-19T00:55:45.840Z`，命令退出 0，返回 accepted。
- 完整 NCP message tool smoke：通过。确认 18792 端口服务进程来自当前仓库源码 `src/cli/app/index.ts serve --ui-port 18792`；运行 `pnpm --silent smoke:ncp-chat -- --session-type native --port 18792 --json`，prompt 强制调用 `message` 工具发送 Weixin 消息，断言 `message.tool-call-start=true`、`message.tool-call-result=true`、最终回复包含 `MESSAGE_TOOL_WEIXIN_SMOKE_DONE`，HTTP 200，terminal event 为 `run.finished`。

## 发布/部署方式

- 本次未执行发布或部署。
- 需要随下一次包含 `@nextclaw/service`、`@nextclaw/core`、`@nextclaw/channel-extension-weixin` 的统一版本发布进入用户环境。

## 用户/产品视角的验收步骤

- 配置并登录 Weixin channel。
- AI 若不知道精确 channel id，应先运行 `nextclaw channels list --json`，从 `channels[].id` 读取 `weixin`，而不是猜 `wechat`。
- 在 AI 会话中要求发送微信消息，工具参数使用 `channel: "weixin"`、目标 `to/chatId` 为微信用户 id，必要时带 `accountId`。
- 预期：`message` 工具调用不再假成功；service 发起 `channel.outbound.sendText` extension request；Weixin extension 调用 `sendTextMessage`。
- 如果 AI 调用 `message` 时传入 `channel: "wechat"`，预期工具直接返回 `unknown channel "wechat"; available channels: ...`，且不 publish outbound。
- 如果 channel 未声明 outbound 或 extension 未响应，用户侧应看到明确工具错误，而不是“Message sent”但微信无消息。
- 本轮已补真实外部发送冒烟与完整 NCP `message` 工具冒烟，覆盖模型选工具、工具执行、channel outbound bridge 与 Weixin API 发送主路径。

## 可维护性总结汇总

- 本次优先补合同而非工具层特判，保持 `message` 工具不认识微信，微信账号和 API 发送细节仍归 `WeixinChannelAdapter` owner。
- 正向维护动作：职责收敛与必要解耦抽象。service 只负责 manifest 到 extension request 的桥接；runtime 只负责 extension capability 入口与 cleanup collection；adapter 负责真正发送。
- 代码增减：总计新增 358 行、删除 33 行、净增 325 行；非测试新增 128 行、删除 33 行、净增 95 行。
- 净增原因：这是用户可见运行能力恢复，并补齐 extension channel 缺失的双向合同与覆盖测试；没有通过 NCP event 伪装 outbound，也没有在 `message` 工具中加入微信特判。
- 保留风险：`service-extension-runtime.service.ts` 已接近文件预算，后续如果继续扩展 extension request 类型，应拆出 contribution builder / request client。
- 同批追加可维护性：`channels list` 只读构建逻辑已拆入 `ChannelListViewService`，`ChannelCommands` 只保留命令编排；避免 channel command owner 文件越过预算。
- 机制改进：已补充 `nextclaw-clean-implementation` / `predictable-behavior-first`，要求生命周期 owner 遇到多个 `unsubscribeXxx` / `cleanupXxx` 字段时优先使用 cleanup/disposable collection；同时明确上游合同错误不能在下游 alias/normalize/fallback 中静默修正。
- 用户纠偏后的二次机制改进：补充“工具 schema 只表达参数合同，不承载 discovery 流程、动态运行态目录、CLI 使用步骤或产品工作流；发现流程归 skill / command / 上层 owner”的规则，防止再次把 channel discovery 之类流程耦合进 `message` schema。

## NPM 包发布记录

- 不涉及本轮 NPM 包发布。
- 待后续统一发布评估包：`@nextclaw/core`、`@nextclaw/service`、`@nextclaw/channel-extension-weixin`、`@nextclaw/channel-extension-feishu`。
