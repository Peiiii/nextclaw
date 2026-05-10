# v0.18.24 Extension SDK Foundation

## 迭代完成说明

本次落地 NextClaw Extension SDK 第一阶段基础骨架：新增 `@nextclaw/extension-sdk` 包，新增通用 `/webhook` server 入口，service 侧增加通用 `WebhookService`、extension channel handler、extension manifest 发现和 lifecycle 启停骨架。

本次明确修正设计边界：`/webhook` 是通用入口，不是 extension 专属 endpoint；extension 只是通用 webhook 的一种调用方和 handler 类型。Extension lifecycle 归属 NextClaw 常驻 service，不新增 extension host，不新增 kernel/runtime 分层。

本轮追加收敛 runtime 访问边界：CLI 注册层统一传入 `nextclaw` 本体，注册函数内部再访问 `nextclaw.commands`。同时修正 gateway 生命周期建模：gateway runtime 不再挂在 `NextclawServiceRuntime` 构造期半初始化，而是在具体 gateway 启动现场一次性组装为 `NextclawGatewayRuntime` 后传给 `startUiServer`，避免长期 facade 持有短生命周期运行态。

本轮追加 service 命名治理：`.service.ts` 现在只允许用于内部声明了 `class` 的服务 owner；classless 的纯函数、映射、解析、装配或导出聚合必须改用真实角色后缀。该规则已同步到 skill、工作流文档和 `file-role-boundaries` diff gate。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `node packages/nextclaw-server/node_modules/typescript/bin/tsc -p packages/nextclaw-extension-sdk/tsconfig.json`
- `pnpm -C packages/nextclaw-service exec vitest run ...` 覆盖 webhook service、extension lifecycle、extension startup、gateway startup hooks。
- `/webhook` server route 通过 `pnpm -C packages/nextclaw-server tsc` 与 targeted ESLint 验证；通用 webhook 分发行为由 service 侧 `WebhookService` 单测覆盖。
- `cd packages/nextclaw-extension-sdk && ../nextclaw-server/node_modules/.bin/vitest run src/extension-sdk.test.ts`
- `pnpm -C packages/nextclaw-service lint`
- server touched files targeted ESLint、extension SDK targeted ESLint、`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、maintainability guard、`git diff --check`
- 本轮追加验证：`pnpm --filter @nextclaw/server tsc --noEmit`、`pnpm --filter @nextclaw-service tsc --noEmit`、changed files targeted ESLint、`pnpm lint:maintainability:guard`
- service 命名治理追加验证：`node --test scripts/governance/lint-new-code-file-role-boundaries.test.mjs`、targeted ESLint、`pnpm check:governance-backlog-ratchet`、maintainability guard、`git diff --check`。
- gateway owner 追加验证：`pnpm --filter @nextclaw-service tsc --noEmit`、`pnpm --filter @nextclaw/server tsc --noEmit`、`pnpm --filter nextclaw tsc --noEmit`、`pnpm lint:new-code:governance`、gateway/plugin/NCP targeted tests。

## 发布/部署方式

未发布。当前是本地源码改造阶段，等待后续新版微信 extension 包接入和真实渠道冒烟后再进入发布判断。

## 用户/产品视角的验收步骤

1. 后续新增新版微信 extension 包，包内提供 `nextclaw.extension.json`。
2. 启动 NextClaw service 后，service 应能发现 manifest、启动 extension server，并注入 `NEXTCLAW_EXTENSION_ENDPOINT`、`NEXTCLAW_EXTENSION_TOKEN`、`NEXTCLAW_EXTENSION_ID`。
3. extension SDK 通过通用 `/webhook` 提交 channel message，通过现有 `/ws` 接收事件。

## 可维护性总结汇总

本次是新增架构能力，非测试代码净增长属于预期。实现中同步做了减债：`runtime-command.service.ts` 从 596 行降到 557 行；UI server 大类型文件拆出 `server.types.ts`；触达的旧非规范 classless `.service.ts` 已按真实角色改为 `.utils.ts` 并落入对应 `utils/` 目录。

maintainability guard 通过，剩余 warning 为既有 UI server 目录热点和 `runtime-command.service.ts` 近预算提示。已使用 `post-edit-maintainability-review` 做收尾复核。

本轮追加改造为架构收敛，新增 `runtime.commands` CLI adapter 边界，并把 UI server 所需 gateway 能力收敛为启动期 `NextclawGatewayRuntime`。`NextclawServiceRuntime` 不再持有半初始化 gateway，`startUiServer` 也不再接收散参数入口。

service 命名治理本身是非功能改动，脚本非测试代码净减 6 行：新增 AST class 检查的同时收敛重复目录规则表，并删除无实际产出的 warning 打印分支；规则更强但脚本体积没有继续膨胀。

## 红区触达与减债记录

### packages/nextclaw-server/src/ui/config.ts

- 本次是否减债：否，本轮只因 server gateway 参数收敛触达该热点文件，未继续扩张其职责。
- 说明：该文件仍属于 UI server 配置热点；本轮没有把新业务逻辑放入该文件。
- 下一步拆分缝：后续若继续治理 UI server，应把路由配置、server 启动配置和测试配置视图拆到更小 owner。

## NPM 包发布记录

不涉及 NPM 包发布。新增 `@nextclaw/extension-sdk` 包尚未发布，后续需要跟新版微信 extension 真实接入、验证和版本策略一起评估。
