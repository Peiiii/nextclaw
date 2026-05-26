# v0.19.35 Agent Run Legacy Removal

## 迭代完成说明

本次彻底删除 agent run 旧 direct execution 链路，只保留 `AgentRunClient / agentRun.send -> ingress -> KernelBranch -> eventBus` 单一路径。

根因：旧链路虽然已不作为主链路使用，但仍在 `NextclawKernel` 中被构造，并通过 legacy contribution、旧 root manager、旧 native runtime factory、旧测试和 public export 留在 live code 中。这会让后续排查和重构继续面对两套 agent-run owner。

确认方式：先用代码搜索确认旧链路入口、旧 owner、旧 contribution、旧 factory 的引用边界，再删除并用残留扫描、TypeScript、定向测试、lint、build 验证新链路仍然闭合。

Review 修正：删除 `SessionRepository.bindRunStatusSource` 二次绑定，让 `KernelBranch.isSessionRunning()` 直接读取 `SessionRunManager`，避免 repository 感知 live run 状态。

残留复查修正：删除旧 `utils/session-run.utils.ts` 和对应测试，把唯一仍需要的 `readMessageTask` 收回 `AgentRunRequestManager`，并将 `publishLegacyReply` 改名为 `publishChannelReply`。

Tool provider 归位：将 branch 下的 `tool-provider` contribution 目录迁移到顶层 `contributions/tool-provider`，并把旧 `ToolContribution` 拆成 `CoreToolProvider` / `MessagingToolProvider` / `SessionToolProvider` / `ExtensionToolProvider` / `AssetToolProvider` / `McpToolProvider` 后删除旧 `contributions/tool-contribution`。`KernelBranch` 不再装配 tool provider contribution，主 kernel 只保留顶层 `ToolProviderContribution` 作为唯一工具 contribution owner。

Tool provider 最终标准化修正：删除旧 `ToolManager` / `KernelToolProvider` / runtime registry 桥接层，让 `ToolProviderContribution` 直接向 `ToolProviderManager` 注册标准 provider。`ToolProviderManager.buildTools(request)` 成为 runtime tools 与 prompt catalog 的共同事实源，并负责按注册顺序去重。为避免在 kernel 复制一套 core tools，将 `@nextclaw/core` 的 `Tool.execute` 合同拓宽为 NCP 可直接调用的 `execute(args, context?)`，让已有 core tool class 直接作为 `NcpTool` 返回。

Tool call context 修正：删除 `runtime.run(options.updateToolCallResult)` 外部绑定和生产 no-op 占位函数，改为由 agent runtime 在真实 `executeToolCall` 时创建工具调用上下文。异步工具结果回写通过 `SessionRun.applyAndPublishEvents` 写入同一个 session 事件流，`sessions_request` / `sessions_spawn` 只透传真实上下文里的回调，不再自行补假函数。

Extension tool 旧链路清理：确认当前 extension manifest 只产出 channel contribution，`ExtensionRegistry.tools` 没有加载来源，旧 `ExtensionToolAdapter` / `ExtensionToolProvider` / `ExtensionNcpTool` / `ExtensionToolRegistration` 均为无实际入口的历史残留，已删除；extension 当前只保留真实使用的 channel 能力。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-kernel exec vitest run src/features/agent-run/managers/agent-run-request.manager.test.ts src/features/agent-run/services/agent-run-client.service.test.ts src/features/session-request/utils/agent-runtime-session-request-dispatcher.utils.test.ts`
- `pnpm -C packages/nextclaw-server exec vitest run src/app/router.ncp-agent.test.ts src/app/router.ncp-agent-stream.test.ts`
- `pnpm -C packages/nextclaw-service exec vitest run src/cli/commands/agent/services/cli-agent-runner.service.test.ts src/shared/services/gateway/utils/cron-job-handler.utils.test.ts`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-server lint`
- `pnpm -C packages/nextclaw-service lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm -C packages/nextclaw-kernel build`
- `pnpm -C packages/nextclaw-server build`
- `pnpm -C packages/nextclaw-service build`
- Review 修正补充验证：`pnpm -C packages/nextclaw-kernel tsc`
- Review 修正补充验证：`pnpm -C packages/nextclaw-kernel exec vitest run src/features/agent-run/managers/agent-run-request.manager.test.ts src/features/agent-run/services/agent-run-client.service.test.ts`
- Review 修正补充验证：`pnpm -C packages/nextclaw-kernel lint`
- 残留复查补充验证：`pnpm -C packages/nextclaw-kernel tsc`
- 残留复查补充验证：`pnpm -C packages/nextclaw-server tsc`
- 残留复查补充验证：`pnpm -C packages/nextclaw-service tsc`
- 残留复查补充验证：`pnpm -C packages/nextclaw-kernel exec vitest run src/features/agent-run/managers/agent-run-request.manager.test.ts src/features/agent-run/services/agent-run-client.service.test.ts src/features/session-request/utils/agent-runtime-session-request-dispatcher.utils.test.ts`
- 残留复查补充验证：`pnpm -C packages/nextclaw-server exec vitest run src/app/router.ncp-agent.test.ts src/app/router.ncp-agent-stream.test.ts`
- 残留复查补充验证：`pnpm -C packages/nextclaw-service exec vitest run src/cli/commands/agent/services/cli-agent-runner.service.test.ts src/shared/services/gateway/utils/cron-job-handler.utils.test.ts`
- Tool provider 归位验证：`pnpm -C packages/nextclaw-kernel tsc`
- Tool provider 归位验证：`pnpm -C packages/nextclaw-kernel exec vitest run src/features/agent-run/managers/agent-run-request.manager.test.ts src/features/agent-run/services/agent-run-client.service.test.ts`
- Tool provider 归位验证：`pnpm -C packages/nextclaw-kernel lint`
- Tool provider 完整归位验证：`pnpm -C packages/nextclaw-kernel tsc`
- Tool provider 完整归位验证：`pnpm -C packages/nextclaw-server tsc`
- Tool provider 完整归位验证：`pnpm -C packages/nextclaw-service tsc`
- Tool provider 完整归位验证：`pnpm -C packages/nextclaw-kernel exec vitest run src/managers/__tests__/tool.manager.test.ts src/tools/session-spawn.tools.test.ts src/tools/session-history.tools.test.ts src/features/agent-run/managers/agent-run-request.manager.test.ts src/features/agent-run/services/agent-run-client.service.test.ts`
- Tool provider 完整归位验证：`pnpm -C packages/nextclaw-kernel lint`
- Tool provider 完整归位验证：`pnpm -C packages/nextclaw-kernel build`
- Tool provider 完整归位冒烟：实例化 `NextclawKernel`，启动 contribution，创建 `toolManager` runtime registry，确认 `read_file` / `exec` / `message` / `sessions_spawn` / `sessions_request` 存在；结果 `tool-provider-smoke ok: 19 tools`。
- Tool provider 完整归位验证：`pnpm check:governance-backlog-ratchet`
- Tool provider 完整归位验证：`git diff --check`
- Tool provider 完整归位验证受阻：`pnpm lint:new-code:governance` 被无关改动 `packages/nextclaw-core/src/features/config/configs/brand.ts` 的既有命名治理问题挡住。
- Tool provider 完整归位验证受阻：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs` 被无关改动 `packages/nextclaw-service/src/shared/services/workspace/workspace-manager.service.ts` 的函数预算问题挡住。
- Tool provider 最终标准化修正验证：`pnpm -C packages/nextclaw-core tsc`
- Tool provider 最终标准化修正验证：`pnpm -C packages/nextclaw-kernel tsc`
- Tool provider 最终标准化修正验证：`pnpm -C packages/nextclaw-core exec vitest run src/features/agent/tools/cron.tools.test.ts src/features/agent/tools/shell.tools.test.ts src/features/agent/tools/message.tools.test.ts src/features/agent/tools/web.tools.test.ts src/features/agent/features/tests/filesystem.tool.test.ts`
- Tool provider 最终标准化修正验证：`pnpm -C packages/nextclaw-kernel exec vitest run src/features/agent-run/managers/tool-provider.manager.test.ts src/tools/session-spawn.tools.test.ts src/tools/session-history.tools.test.ts src/features/agent-run/managers/agent-run-request.manager.test.ts src/features/agent-run/services/agent-run-client.service.test.ts`
- Tool provider 最终标准化修正验证：`pnpm -C packages/nextclaw-kernel lint`
- Tool provider 最终标准化修正验证：`pnpm -C packages/nextclaw-core lint` 通过，剩余 32 个 warning 均为本次未触达的既有 warning。
- Tool provider 最终标准化修正验证：`pnpm -C packages/nextclaw-core build`
- Tool provider 最终标准化修正验证：`pnpm -C packages/nextclaw-kernel build`
- Tool provider 最终标准化修正验证：`pnpm lint:new-code:governance`
- Tool provider 最终标准化修正验证：`pnpm check:governance-backlog-ratchet`
- Tool provider 最终标准化修正验证：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`
- Tool provider 最终标准化修正验证：`git diff --check`
- Tool call context / extension tool 清理补充验证：`pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime tsc`
- Tool call context / extension tool 清理补充验证：`pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next tsc`
- Tool call context / extension tool 清理补充验证：`pnpm -C packages/nextclaw-core tsc`
- Tool call context / extension tool 清理补充验证：`pnpm -C packages/nextclaw-kernel tsc`
- Tool call context / extension tool 清理补充验证：`pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime build`
- Tool call context / extension tool 清理补充验证：`pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next build`
- Tool call context / extension tool 清理补充验证：`pnpm -C packages/nextclaw-core build`
- Tool call context / extension tool 清理补充验证：`pnpm -C packages/nextclaw-kernel build`
- Tool call context / extension tool 清理补充验证：`pnpm -C packages/nextclaw-kernel exec vitest run src/features/agent-run/managers/agent-run-request.manager.test.ts src/tools/session-request.tools.test.ts src/tools/session-spawn.tools.test.ts src/features/agent-run/managers/tool-provider.manager.test.ts src/features/session-request/managers/session-request.manager.test.ts`
- Tool call context / extension tool 清理补充验证：`pnpm -C packages/nextclaw-core exec vitest run src/features/agent/tools/spawn.tools.test.ts`
- Tool call context / extension tool 清理补充验证：`pnpm -C packages/nextclaw-kernel exec vitest run src/services/extension-runtime.service.test.ts`
- Tool call context / extension tool 清理补充验证：`pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime lint`
- Tool call context / extension tool 清理补充验证：`pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next lint`
- Tool call context / extension tool 清理补充验证：`pnpm -C packages/nextclaw-kernel lint`
- Tool call context / extension tool 清理补充验证：`pnpm -C packages/nextclaw-core lint` 通过，剩余 32 个 warning 均为既有 warning。
- Tool call context / extension tool 清理补充验证：`pnpm lint:new-code:governance`
- Tool call context / extension tool 清理补充验证：`pnpm check:governance-backlog-ratchet`
- Tool call context / extension tool 清理补充验证：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`
- Tool call context / extension tool 清理补充验证：`git diff --check`

## 发布/部署方式

未执行发布或部署。本次是源码链路删除，后续跟随统一 NPM/runtime 发布批次。

## 用户/产品视角的验收步骤

- 前端、微信、cron、CLI 等用户消息发送入口仍应统一进入当前 agent run ingress。
- UI 侧 stream 接收仍应通过 event bus 返回 NCP 事件。
- 代码搜索不应再能找到 legacy agent-run direct entrypoint 或旧 root manager public import。

## 可维护性总结汇总

- 已删除旧链路代码、旧测试和旧 public export。
- Review 修正继续删除 repository 对 live run status 的反向绑定。
- 残留复查继续删除旧 session-run 工具文件，并清理误导性的 legacy reply 命名。
- Tool provider 完整归位删除旧 `ToolContribution`，工具注册职责拆成标准 provider，并让主 kernel 只装配顶层 `ToolProviderContribution`。
- Tool provider 完整归位范围内，旧入口删除 `209` 行，新增 provider 与装配代码以标准职责替代；本轮有额外无关工作区改动存在，完整 maintainability guard 被无关 `workspace-manager.service.ts` 改动挡住。
- Tool provider 最终标准化修正删除旧 `ToolManager` / `KernelToolProvider`，复用已有 core tool class 并移除 kernel 侧复制工具实现方案；maintainability guard 通过，非测试代码净变化为 `+639 / -656 / net -17`。
- Tool provider 最终标准化修正剩余 maintainability warning：`shell.tools.ts` 与 `web.tools.ts` 接近 400 行预算；本轮未继续拆分，因为目标是删除旧链路和统一 owner，后续若继续扩展工具能力，应优先拆这两个 core tool 文件。
- Tool call context / extension tool 清理补充删除旧 extension tool 适配链路，并避免新增 NCP public protocol 类型；maintainability guard 通过，当前工作区非测试代码净变化为 `+907 / -912 / net -5`。
- Tool call context / extension tool 清理补充剩余 maintainability warning：`shell.tools.ts` / `web.tools.ts` 接近文件预算，以及当前工作区存在其它 panel/server 相关改动触发的既有预算 warning；本次未继续扩大范围。
- 非测试代码净变化为 `+22 / -1387 / net -1365`。
- 全量变更净变化为 `+22 / -2751 / net -2729`，不含本迭代记录与方案文档。
- 残留复查补充变更净变化为 `+162 / -457 / net -295`；非测试代码为 `+162 / -406 / net -244`。
- `post-edit-maintainability-guard` 结果：Errors 0，Warnings 0。
- `legacy-agent-direct-entrypoints` 治理扫描通过，live code 中没有旧 direct entrypoint。

## NPM 包发布记录

不涉及 NPM 包发布。
