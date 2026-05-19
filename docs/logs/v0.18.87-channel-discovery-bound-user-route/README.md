# v0.18.87-channel-discovery-bound-user-route

## 迭代完成说明

本次迭代修正跨渠道消息发送的 AI 引导链路：渠道命令只暴露运行时事实，通用消息 skill 负责告诉 AI 如何发现渠道、账号与绑定用户 ID。根因是旧链路把 `messageToolHints` 和渠道发送知识塞进系统提示与 tool/schema 附近，导致渠道事实、发送教学和工具合同耦合，容易在插件改造后漂移。

已移除 `messageToolHints` 注入路径，`nextclaw channels list --json` 改为输出最小必要事实：渠道 ID、启用状态、默认账号 ID、账号绑定用户 ID。微信登录写入 `accounts[].userId`，由通用 `cross-channel-messaging` skill 通过命令发现并用于 `message.to`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/service exec vitest run src/commands/channel/channels.test.ts`
- `pnpm --filter @nextclaw/channel-extension-weixin exec vitest run src/tests/weixin-login.service.test.ts`
- `pnpm --filter @nextclaw/core exec vitest run src/features/agent/features/tests/context.test.ts src/features/agent/features/tests/skills.test.ts`
- `pnpm --filter @nextclaw/service tsc`
- `pnpm --filter @nextclaw/channel-extension-weixin tsc`
- `pnpm --filter @nextclaw/core tsc`
- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/openclaw-compat tsc`
- `pnpm --filter @nextclaw/service lint`
- `pnpm --filter @nextclaw/channel-extension-weixin lint`
- `pnpm --filter @nextclaw/core lint`
- `pnpm --filter @nextclaw/kernel lint`
- `pnpm --filter @nextclaw/openclaw-compat lint`
- `pnpm --filter @nextclaw/core build && pnpm --filter @nextclaw/openclaw-compat build && pnpm --filter @nextclaw/kernel build && pnpm --filter @nextclaw/service build`
- `NEXTCLAW_HOME=<temp> pnpm --filter nextclaw exec tsx src/cli/app/index.ts channels list --json`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`

已知例外：`pnpm --filter @nextclaw/openclaw-compat exec vitest run src/plugins/channel-runtime.test.ts` 被既有别名解析问题阻塞，报错为 `Cannot find package '@core/features/agent/tools/registry.tools.js'`，目标测试尚未加载。

## 发布/部署方式

未发布 NPM 包，未做线上部署。本次只更新源码、内置 skill、使用说明资源和本地构建产物，用真实 CLI 冒烟验证命令输出合同。

## 用户/产品视角的验收步骤

1. 登录或绑定微信渠道后运行 `nextclaw channels list --json`。
2. 确认对应渠道对象包含 `id`、`enabled`、`defaultAccountId`，并在 `accounts[]` 中包含匹配账号的 `userId`。
3. AI 按 `cross-channel-messaging` skill 选择渠道 ID，把绑定用户 ID 作为 `message.to`，再调用通用 `message` 工具发送。

## 可维护性总结汇总

本次是非新增用户能力的修复与去耦合，生产代码净删为主。维护性检查通过，统计为总代码 `+58 / -267 / net -209`，非测试代码 `+38 / -208 / net -170`。主要减债动作是删除 `messageToolHints` 旁路、收窄渠道列表 JSON 合同、把发送教学沉到通用 skill，并按命名治理将 agent context 与 channel runtime 文件改为合规角色后缀。

## NPM 包发布记录

不涉及 NPM 包发布。
