# v0.17.33 Workspace Import Alias Governance

## 迭代完成说明

本次完成 workspace import alias 治理的同批次落地，而不是只处理单个包。

根因：`@/*` 在 app 中语义清晰，但 library 被其它 workspace 包源码消费时，provider 内部的 `@/*` 容易被 consumer tsconfig 抢走解析。此前把 kernel 内部导入改成相对路径只能绕开问题，没有建立长期规则。

修复方式：

- `@nextclaw/kernel` 登记短包级 alias `@kernel/*`。
- kernel 内部跨目录引用统一改成 `@kernel/*`，局部相邻引用继续保持相对路径。
- 源码消费 kernel 的 consumer 只在配置层补 `@kernel/*` 解析，不允许业务代码跨包 import `@kernel/*`。
- `@nextclaw/agent-chat-ui` 删除未使用的 app-style `@/*` / `@` alias，避免 library 配置继续暗示可用共享 `@/*`。
- `packages/nextclaw-kernel/src/events/event.keys.ts` 重命名为 `event-keys.config.ts`，满足当前文件角色治理。
- kernel module-structure 配置登记 `events/` 稳定边界，并把 import alias prefix 从 `@/` 改为 `@kernel/`。

## 测试/验证/验收方式

已通过：

- `pnpm --filter @nextclaw/kernel test`
- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/kernel build`
- `pnpm --filter @nextclaw/agent-chat-ui tsc`
- `pnpm --filter @nextclaw/agent-chat-ui build`
- `pnpm --filter @nextclaw/client-sdk tsc`
- `pnpm --filter @nextclaw/server tsc`
- `pnpm --filter @nextclaw/remote tsc`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/ui build`
- `pnpm --filter nextclaw tsc`
- `pnpm --filter nextclaw build`
- `pnpm --dir apps/desktop tsc --noEmit`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`

静态边界验证：

- `packages/nextclaw-kernel` 和 `packages/nextclaw-agent-chat-ui` 中不再存在 `@/*`。
- `@kernel/*` 业务源码引用只存在于 `packages/nextclaw-kernel/src`。

## 发布/部署方式

本次是源码、构建配置和治理文档改动，未执行发布或部署。

## 用户/产品视角的验收步骤

开发者后续在 app / worker 中仍可使用 `@/*` 表达本应用 `src` root。

开发者后续在 `@nextclaw/kernel` 内部跨目录引用应使用 `@kernel/*`；跨包使用方继续 import `@nextclaw/kernel`，不直接 import `@kernel/*`。

开发者后续在 `@nextclaw/agent-chat-ui` 中如果确实出现大量跨目录引用，再按设计文档登记短 alias；当前保持相对路径和更少配置。

## 可维护性总结汇总

本次遵守非功能改动的删减优先原则。代码与配置总体 `+67 / -69 / net -2`，非测试 `+66 / -68 / net -2`。

正向减债动作：删除与职责收敛。删除了 `agent-chat-ui` 未使用的 app-style alias，收敛了 kernel alias 与 module-structure 合同，并修正了已触达的文件命名债务。

`post-edit-maintainability-guard --non-feature` 通过，`pnpm lint:new-code:governance` 与 backlog ratchet 均通过。

## NPM 包发布记录

不涉及 NPM 包发布。
