# v0.18.98 Extension Channel Controller

## 迭代完成说明

本次把微信和飞书 extension 中重复的 channel 生命周期胶水收敛到 `@nextclaw/extension-sdk` 的通用 `ExtensionChannelController` owner。controller 只负责绑定 `ExtensionChannel` 与渠道 adapter，统一处理 start/stop 幂等、cleanup、配置变更、入站消息提交、NCP event 转发和可选 outbound text；微信/飞书各自的 API、账号、auth/registration、消息解析、reaction、polling、context token 等渠道差异仍留在对应 adapter/service 内。

本轮删除 `WeixinExtensionRuntime` 与 `FeishuExtensionRuntime` 两套重复 runtime，实现时没有保留旧 alias 或兼容桥。微信和飞书分别新增纯 mapper，将渠道 inbound message 转成 NextClaw 标准提交消息，避免 controller 感知渠道 metadata 细节。

同批次后续打磨中，SDK 继续新增 `startChannelExtension` 标准接入入口，并把微信/飞书 `main.ts` 收敛成只声明 `channelId`、adapter、inbound mapper、auth capability 和 NCP event error reporter。最终没有采用 class 继承、自动扫描、二阶 registration DSL 或 outbound text 开关，而是保留一个显式函数入口；出站文本被收敛为 channel extension 默认协议能力，减少新渠道接入时的固定装配代码。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/extension-sdk tsc`：通过。
- `pnpm --filter @nextclaw/extension-sdk test -- --run`：通过，1 个测试文件、11 个测试。
- `pnpm --filter @nextclaw/extension-sdk lint`：通过。
- `pnpm --filter @nextclaw/channel-extension-weixin tsc`：通过。
- `pnpm --filter @nextclaw/channel-extension-weixin test -- --run`：通过，8 个测试文件、28 个测试。
- `pnpm --filter @nextclaw/channel-extension-weixin lint`：通过。
- `pnpm --filter @nextclaw/channel-extension-feishu tsc`：通过。
- `pnpm --filter @nextclaw/channel-extension-feishu test -- --run`：通过，4 个测试文件、10 个测试。
- `pnpm --filter @nextclaw/channel-extension-feishu lint`：通过。
- `pnpm --filter @nextclaw/extension-sdk build`、`pnpm --filter @nextclaw/channel-extension-weixin build`、`pnpm --filter @nextclaw/channel-extension-feishu build`：通过；tsdown 提示当前 Node.js `v22.16.0` 将在后续版本弃用，需要未来升级到 `22.18.0+`。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <本次 bootstrap 触达文件>`：通过，0 error，0 warning；总代码 `+208 / -74 / net +134`，非测试代码 `+102 / -56 / net +46`。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <本次源码/配置触达文件>`：通过，0 error，1 warning；warning 为 `packages/nextclaw-extension-sdk/src/extension-sdk.test.ts` 本次测试增长明显但仍低于预算。
- `git diff --check`：通过。

## 发布/部署方式

未发布、未部署。本次是本地源码重构，影响包包括 `@nextclaw/extension-sdk`、`@nextclaw/channel-extension-weixin`、`@nextclaw/channel-extension-feishu`，后续进入统一 NPM 发布批次时需要一起评估。

## 用户/产品视角的验收步骤

1. 构建 extension SDK、微信 extension、飞书 extension 均成功。
2. 启动微信或飞书 extension 后，channel controller 读取配置并启动对应 adapter。
3. 外部渠道入站消息仍提交到 NextClaw，metadata 保持既有合同。
4. NCP 回复事件仍由对应 adapter 消费并投递回微信/飞书。
5. 微信 `channel.outbound.sendText` 仍通过 adapter 主路径发送；不支持 outbound text 的 adapter 会得到明确错误。

## 可维护性总结汇总

本次是非功能性架构收敛，已按 `deletion-first` 和 `protected-variations` 执行：删除两套重复 extension runtime，把共性生命周期归入 SDK controller，把渠道差异保留在 adapter/mapper/auth owner 中。按本次源码/配置触达文件口径，maintainability guard 显示总代码 `+529 / -246 / net +283`，非测试代码 `+191 / -194 / net -3`，满足非功能改动非测试代码净增 `<= 0`。

同批次后续打磨属于面向 extension 生态的 SDK 接入能力新增，而不是继续纯删减：新增 `startChannelExtension` 后，微信入口从 `41` 行降到 `12` 行，飞书入口从 `19` 行降到 `12` 行；两个渠道接入文件合计净删 `36` 行。SDK 侧为公共 bootstrap API 增加必要类型、标准 auth/outbound 注册和 payload 校验，飞书 adapter 补齐标准 `sendOutboundText` 能力，因此本次后续 bootstrap 子 diff 非测试代码净增为正。增长被限制在 SDK owner 和飞书真实发送 owner 内，没有新增渠道特例，也没有引入平行 runtime。

正向减债动作为删除与职责收敛：删除旧微信/飞书 runtime，减少后续新增渠道时需要复制的生命周期代码；controller 的公开表面也在治理反馈后收窄，没有保留额外 `Runtime` 命名、可选 enabled hook 或独立 outbound adapter public type。`post-edit-maintainability-review` 已用于收尾判断；保留债务是 SDK 测试文件本次增长明显，后续若继续扩展 controller 行为，应把测试 fixture/builder 拆出以降低单文件增长压力。

## NPM 包发布记录

不涉及 NPM 包发布。
