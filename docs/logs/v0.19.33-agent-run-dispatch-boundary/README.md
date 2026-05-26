# v0.19.33-agent-run-dispatch-boundary

## 迭代完成说明

本次按结构治理口径收敛 `packages/nextclaw-kernel/src/features/ncp-dispatch` 的职责边界。

- 将 `AgentRunClient` 从 `ncp-dispatch/utils/nextclaw-ncp-runner.utils.ts` 移到 `features/agent-run/services/agent-run-client.service.ts`，让 NCP run 请求/事件等待这个有状态 IO owner 回到 `agent-run` feature。
- 将纯转换能力拆到 `features/agent-run/utils/agent-run-send-payload.utils.ts` 与 `features/agent-run/utils/agent-run-metadata.utils.ts`。
- `ncp-dispatch` 保留 gateway/channel/direct prompt 入口适配职责，不再承载 agent-run client owner。
- `ncp-dispatch` 跨 feature 依赖统一走 `@kernel/features/agent-run/index.js`，满足 module-structure 边界规则。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel exec eslint ... --fix`：触达文件 targeted autofix 通过。
- `pnpm -C packages/nextclaw-kernel exec vitest run src/features/agent-run/services/agent-run-client.service.test.ts`：通过，1 个测试通过。
- `pnpm -C packages/nextclaw-kernel tsc`：通过。
- `pnpm -C packages/nextclaw-service tsc`：通过，确认 `@nextclaw/kernel` 根出口仍可被 service 消费。
- `pnpm -C packages/nextclaw-kernel lint`：通过。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：通过，非测试代码净减 4 行。

## 发布/部署方式

本次为 kernel 内部结构重构，不涉及数据库 migration、远程服务部署、桌面安装包或 runtime update manifest。

## 用户/产品视角的验收步骤

本次无新增用户可见能力。产品验收点是现有 gateway、CLI、cron 继续通过 `@nextclaw/kernel` 公共出口发起 agent run：

1. service 侧 TypeScript 编译通过，说明 `AgentRunClient` 与 payload builder 的公共导出仍可被消费。
2. `AgentRunClient` 定向测试通过，说明发送前订阅事件、防早期事件丢失的行为未变。
3. governance 通过，说明新边界符合 feature 公共入口和文件角色规范。

## 可维护性总结汇总

已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 口径复核。本次是非功能结构重构，总计新增 529 行、删除 533 行、净减 4 行；非测试代码新增 528 行、删除 532 行、净减 4 行。

正向减债动作：职责收敛 + 删除混合角色文件。`AgentRunClient` 作为有状态 service owner 回到 `agent-run/services`，纯 payload/metadata 转换回到 `agent-run/utils`，`ncp-dispatch` 不再以模糊 runner utils 承载 agent-run 主链路能力。该变化不是压缩行数，而是让 owner、角色目录和跨 feature 依赖边界更符合项目治理。

## NPM 包发布记录

不涉及 NPM 包发布。
