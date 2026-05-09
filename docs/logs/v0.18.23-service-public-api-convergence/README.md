# v0.18.23 Service Public API Convergence

## 迭代完成说明

本次将 `packages/nextclaw` 对 `@nextclaw-service` 的依赖从“根入口暴露大量内部零件”收口为少量高层 public contract。

根因是上一轮为了禁止跨包深导入，先把 service 包内部类、store、utils 大量导出到根入口，虽然阻止了跨包子路径依赖，但把内部结构变成了事实 public API。本次把 CLI command 执行逻辑迁入 `packages/nextclaw-service/src/cli/commands`，并由 `NextclawServiceRuntime` 统一组装 service graph；`packages/nextclaw` 只保留 commander 声明和参数转发。

GitNexus 本轮未引入执行。判断原因：当前目标边界已经明确，使用现有 `rg`、`tsc`、lint、governance 和命令冒烟能直接验收；临时引入外部索引工具会增加变量，不利于这次一次性收口。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw tsc`
- `pnpm -C packages/nextclaw-service lint`
- `pnpm -C packages/nextclaw lint`
- `pnpm lint:new-code:package-public-imports`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm -C packages/nextclaw-service build`
- `pnpm -C packages/nextclaw build`
- `pnpm --filter nextclaw exec nextclaw --version`
- `pnpm --filter nextclaw exec nextclaw status --json`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`

硬验收：

- `rg "@nextclaw-service/" packages/nextclaw/src packages/nextclaw/tests` 无结果
- `rg "RuntimeCommandService|WorkspaceManager|RestartCoordinator|PluginCommands|ChannelCommands|ServiceCommands|managedServiceStateStore|llmUsageRecorder" packages/nextclaw/src` 无结果
- `rg "export .*\"\\./(shared|commands|launcher)/" packages/nextclaw-service/src/index.ts` 无结果

## 发布/部署方式

未执行发布或部署。本次是包边界与运行时 facade 收口，待进入统一发布批次后随包发布。

## 用户/产品视角的验收步骤

1. 运行 `nextclaw --version`，确认 CLI 入口可启动。
2. 运行 `nextclaw status --json`，确认 CLI shell 能通过 service runtime 调用诊断能力。
3. 搜索 `packages/nextclaw/src`，确认不再出现 service 内部类、store、utils 的直接依赖。

## 可维护性总结汇总

本次是非功能结构收口，总代码变更 `+218 / -356 / net -138`，非测试代码 `+215 / -353 / net -138`，满足非功能改动净减要求。

维护性收益：

- `packages/nextclaw-service/src/index.ts` 从大 barrel 收口为 facade + public registration + public types。
- `packages/nextclaw` 不再组装 service 内部对象。
- CLI command 执行逻辑归属到 service 包，CLI shell 只保留命令声明。
- 新增方案文档将预期效果和验收标准固化，降低后续漂移风险。

剩余警告：

- `service-runtime.service.ts` 接近 600 行预算，后续可继续拆 runtime 初始化子 owner。
- `packages/nextclaw-service/src/cli/commands/skills` 仍在目录文件数上限，需要后续按 marketplace / installed query 拆分。

## NPM 包发布记录

不涉及 NPM 包发布。
