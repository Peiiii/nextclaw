# Service Runtime Component API

## 迭代完成说明

本次把 `NextclawServiceRuntime` 从大量扁平转发方法收敛为组件直接暴露的 API。`runtime.plugins`、`runtime.agents`、`runtime.config`、`runtime.mcp`、`runtime.channels` 等组件现在直接提供自身方法，不再通过 `runtime.pluginsList()` 或 `plugins.pluginsList()` 这类重复命名和 wrapper 访问。

根因：原 runtime 同时承担组合根和命令代理职责，每新增一个命令都容易多一层手写转发，导致 API 重复、职责不清、测试也跟着绑定旧命名。

确认方式：全局搜索旧 wrapper 名称已无命中，CLI 注册点已切到组件 API，类型检查、lint、治理和 smoke 均通过。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw-service tsc`
- `pnpm --filter nextclaw tsc`
- `pnpm --filter @nextclaw-service test -- src/cli/commands/config/services/config-commands.service.test.ts src/cli/commands/agent/agent-commands.test.ts src/cli/commands/logs/logs.test.ts src/commands/channel/channels.test.ts`
- `pnpm --filter @nextclaw-service lint`
- `pnpm --filter nextclaw lint`
- `pnpm lint:new-code:package-public-imports`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`
- `pnpm --filter @nextclaw-service build`
- `pnpm --filter nextclaw build`
- `node packages/nextclaw/dist/cli/app/index.js --version`
- `node packages/nextclaw/dist/cli/app/index.js plugins list --help`

## 发布/部署方式

未发布。当前只是本地源码重构与提交。

## 用户/产品视角的验收步骤

- CLI 能正常启动并输出版本。
- 插件命令 help 能正常渲染。
- 后续代码使用 `runtime.plugins.list()`、`runtime.agents.create()` 这类组件 API，不需要再新增 runtime 扁平转发方法。

## 可维护性总结汇总

本次是非功能改动，遵守先删减和职责收敛原则。最终非测试代码净减少，`NextclawServiceRuntime` 删除大量重复 wrapper，组件 owner 方法直接承载能力。

可维护性 guard 已运行，错误为 0；剩余仅为既有或临近预算 warning，包括若干 legacy CLI 目录和接近文件行数预算的文件。

## NPM 包发布记录

不涉及 NPM 包发布。
