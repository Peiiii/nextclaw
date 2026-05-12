# v0.18.31 Kernel Runtime Feature Root

## 迭代完成说明

本批次撤销 `packages/nextclaw-kernel/src/agent-runtime` 顶层目录，将 native runtime、NARP runtime、runtime registry、NCP dispatch、MCP support 等并列职责迁移到 `src/features/*` 下的可折叠 feature root。

后续收敛继续删除过薄边界：

- `NativeAgentRuntimeFactory` 承接 native runtime 的 context builder、tool registry、LLM API 与上下文压缩预检装配，让 `AgentRuntimeManager` 回到 runtime 注册、backend 接入、事件发布和生命周期 owner。
- `ncp-event-stream.utils.ts` 合并进 `nextclaw-ncp-runner.utils.ts`，删除重复的 NCP send 循环。
- `agent-runtime-entry-resolver.utils.ts` 合并进 `agent-runtime-registry.service.ts`，让 runtime entry 解析与 registry owner 保持同一职责面。
- `builtin-narp-runtime.types.ts` 删除，两个 runtime kind 常量回到 NARP registration service。
- `session-request` 保持 classless utils 形态，避免为了很薄的 dispatcher 工厂制造 service/class。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-kernel test`
- `pnpm -C packages/nextclaw-kernel build`
- `pnpm lint:new-code:file-role-boundaries`
- `pnpm lint:new-code:file-names`
- `pnpm check:governance-backlog-ratchet`

`pnpm lint:new-code:module-structure` 已运行，但当前工作区中无关的 `packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-openai-responses-bridge*.utils.ts` 根目录新增文件仍触发 module-structure 失败。

## 发布/部署方式

不涉及发布或部署。

## 用户/产品视角的验收步骤

1. 启动 kernel runtime 链路。
2. 确认 native session 仍能创建 runtime 并执行 NCP run。
3. 确认 session request 仍通过 ingress 进入 agent runtime，并通过 NCP event 回收 accepted/completed/failed 结果。
4. 确认 runtime session type 列表仍包含 native 与配置中的 NARP runtime entries。

## 可维护性总结汇总

本轮遵循“不是越拆越好”的收敛原则：删除薄文件、合并重复 send 循环、复用已有 icon 归一化逻辑，并把常量放回真实 owner。

本轮后续收敛相对 `HEAD` 的 kernel feature/app 子集统计为 `11 files changed, 150 insertions(+), 261 deletions(-)`；排除测试后约 `+143 / -259`，非测试净减少约 `116` 行。

保留债务：

- `features/runtime-registry/services/agent-runtime-registry.service.ts` 当前约 387 行，接近 400 行预算，但本轮合并后职责更集中，暂未越界。
- `features/ncp-dispatch/utils/nextclaw-ncp-dispatch.utils.ts` 仍接近 400 行，下一步更适合按 dispatch session/run owner 继续拆。

## NPM 包发布记录

不涉及 NPM 包发布。
