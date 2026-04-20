# v0.16.83-nextclaw-kernel-default-manager-ownership

## 迭代完成说明

- 本次把 `@nextclaw/kernel` 从“外部注入 manager 的空装配壳”收敛成了“自己直接拥有默认子系统 owner 的 kernel skeleton”。
- 触发这次调整的根因是：[`packages/nextclaw-kernel/src/app/nextclaw-kernel.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-kernel/src/app/nextclaw-kernel.ts) 对应的 kernel owner 之前通过 `NextclawKernelDeps + constructor` 接收 `agents/tasks/sessions/context/...` 九个 manager，这使得真正的 owner 仍然是外部装配层，而不是 kernel 本体。
- 本次修复命中根因的方式不是“把 constructor 挪一下位置”，而是直接改掉 ownership 模型：
  - 删除 `NextclawKernelDeps`
  - 删除基于 constructor 的 manager 注入
  - 让 `NextclawKernel` 在 class field 初始化阶段直接实例化默认 manager
  - 把各个 manager 从 abstract contract shell 收敛成默认的内存态 owner
- 具体代码落点：
  - [`packages/nextclaw-kernel/src/app/nextclaw-kernel.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-kernel/src/app/nextclaw-kernel.ts)
  - [`packages/nextclaw-kernel/src/managers/`](/Users/peiwang/Projects/nextbot/packages/nextclaw-kernel/src/managers)
- 同批次续改进一步把这套代码收回到“纯骨架阶段”：
  - 删除了 `kernel-manager.utils.ts` 这类具体实现辅助模块
  - manager methods 不再携带真实内存存储逻辑，而是只保留职责注释 / 伪代码位置 / `Not implemented`
  - `NextclawKernel.run()` 也不再提前固化 session/task/context/provider 的具体实现步骤，只保留编排结构说明
- 同批次续改同时移除了 [`packages/nextclaw-kernel/tsconfig.json`](/Users/peiwang/Projects/nextbot/packages/nextclaw-kernel/tsconfig.json) 里的 `"types": ["node"]`，因为当前 `nextclaw-kernel` 已经没有 Node 专属 API 依赖；继续保留只会让这个纯骨架包在未单独安装 `@types/node` 的上下文里制造假报错。
- 同批次续改继续把 `kernel` 顶层 public surface 收敛成“manager 直出 + OS 级动作”：
  - 删除了 `openSession()`、`createTask()`、`prepareAgentExecution()` 这组中间态 public workflow
  - 删除了 `appendSessionMessage()`、`scheduleAutomation()`、`enableChannel()` 这组 manager 转发器方法
  - 新增 [`NextclawKernelRunInput` / `NextclawKernelRun`](/Users/peiwang/Projects/nextbot/packages/nextclaw-kernel/src/types/nextclaw-kernel.types.ts)，并把 `run(input)` 收敛成 kernel 的第一核心 public action
  - 当前 `run(input)` 的最小协议已压成 `sessionId + messages + metadata(agentId/model/skills) + extra`
  - 当前 `run()` 的最小返回值已压成 `taskId`
  - `metadata` 只保留稳定偏好字段：`agentId`、`model`、`skills`
  - 其它不稳定扩展统一进入 `extra`
  - `agent / provider / capability / task / context` 的装配关系现在只保留为结构约束和伪代码意图，不再提前落成具体行为实现
- 同批次续改继续把 `NextclawKernel` owner 落点收回 `app/`：
  - 删除根级 `packages/nextclaw-kernel/src/nextclaw-kernel.ts`
  - 新增 [`packages/nextclaw-kernel/src/app/nextclaw-kernel.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-kernel/src/app/nextclaw-kernel.ts)
  - [`packages/nextclaw-kernel/module-structure.config.json`](/Users/peiwang/Projects/nextbot/packages/nextclaw-kernel/module-structure.config.json) 也同步收回到只允许根级 `index.ts`，避免再给 L1 根层 owner 文件开口子
- 同批次续改继续把 `context manager` 概念收回 `context builder`：
  - 删除 `packages/nextclaw-kernel/src/managers/context.manager.ts`
  - 新增 [`packages/nextclaw-kernel/src/managers/context-builder.manager.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-kernel/src/managers/context-builder.manager.ts)
  - `ContextBuilder` 现在明确依赖 `SessionManager`，只负责从 `session/task/agent` 组装 `ContextRecord`，不再伪装成拥有 `get/save/patch` 状态面的 manager
- 设计文档也同步修正为“kernel 默认自带 owner，不把默认 ownership 让渡给外部装配层”，并明确当前阶段只保留骨架不写实逻辑：
  - [docs/designs/2026-04-20-nextclaw-kernel-architecture.md](/Users/peiwang/Projects/nextbot/docs/designs/2026-04-20-nextclaw-kernel-architecture.md)
- 当前这条长链路设计讨论的目标锚文件：
  - [work/goal-progress.md](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.83-nextclaw-kernel-default-manager-ownership/work/goal-progress.md)
- 同批次续改继续落“阶段 1：Kernel 最小闭环”的第一步，而且这次是实代码接线，不再只是讨论：
  - `nextclaw` 现在显式依赖 `@nextclaw/kernel`
  - [`packages/nextclaw/src/cli/app/runtime.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/app/runtime.ts) 现在会先实例化 `NextclawKernel`
  - `gateway / ui / start / restart / serve / stop` 这组六个产品运行控制入口，已经先通过 `kernel.control` 进入 owner 边界，再回到原有命令实现
  - 这一步只迁移了“谁拥有这组入口”的边界，没有改 `RuntimeCommandService`、没有重写 `NCP runtime`、没有改 agent 内部 tool loop
- 为了满足“纯结构治理不能让代码继续膨胀”的约束，这一批还同步做了两件收敛动作：
  - 删除了一批 `nextclaw-kernel` 骨架 manager 里低信息密度、重复性的 TODO 注释噪音
  - 把 [`packages/nextclaw/src/cli/app/runtime.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/app/runtime.ts) 里多组纯薄包装方法压成更紧凑的单行委托，使这个超预算文件本次净减少 37 行，而不是继续变大

## 测试/验证/验收方式

- 已通过：`node scripts/governance/lint-new-code-governance.mjs packages/nextclaw-kernel/module-structure.config.json packages/nextclaw-kernel/tsconfig.json packages/nextclaw-kernel/src/index.ts packages/nextclaw-kernel/src/app/nextclaw-kernel.ts packages/nextclaw-kernel/src/managers/context-builder.manager.ts packages/nextclaw-kernel/src/managers/agent.manager.ts packages/nextclaw-kernel/src/managers/automation.manager.ts packages/nextclaw-kernel/src/managers/channel.manager.ts packages/nextclaw-kernel/src/managers/llm-provider.manager.ts packages/nextclaw-kernel/src/managers/session.manager.ts packages/nextclaw-kernel/src/managers/skill.manager.ts packages/nextclaw-kernel/src/managers/task.manager.ts packages/nextclaw-kernel/src/managers/tool.manager.ts docs/designs/2026-04-20-nextclaw-kernel-architecture.md`
  - 观察点：历史这轮在引入默认 owner 结构时的增量治理已通过。
- 已通过：`node node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p packages/nextclaw-kernel/tsconfig.json`
- 已通过：`node scripts/governance/lint-new-code-governance.mjs packages/nextclaw-kernel/src/app/nextclaw-kernel.ts packages/nextclaw-kernel/src/managers/context-builder.manager.ts packages/nextclaw-kernel/src/types/nextclaw-kernel.types.ts packages/nextclaw-kernel/tsconfig.json packages/nextclaw-kernel/src/managers/agent.manager.ts packages/nextclaw-kernel/src/managers/automation.manager.ts packages/nextclaw-kernel/src/managers/channel.manager.ts packages/nextclaw-kernel/src/managers/llm-provider.manager.ts packages/nextclaw-kernel/src/managers/session.manager.ts packages/nextclaw-kernel/src/managers/skill.manager.ts packages/nextclaw-kernel/src/managers/task.manager.ts packages/nextclaw-kernel/src/managers/tool.manager.ts docs/designs/2026-04-20-nextclaw-kernel-architecture.md docs/logs/v0.16.83-nextclaw-kernel-default-manager-ownership/README.md`
  - 观察点：在删除具体实现逻辑、仅保留骨架和注释之后，增量治理依然全绿。
- 已通过：`node node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p packages/nextclaw-kernel/tsconfig.json`
  - 观察点：当前骨架代码能够通过 TypeScript 编译检查。
- 已通过：`node node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p packages/nextclaw/tsconfig.json`
  - 观察点：`nextclaw` 引入 `@nextclaw/kernel` 后，CLI 入口与内核包之间的源码依赖链可正常通过编译。
- 已通过：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-kernel/src/app/nextclaw-kernel.ts packages/nextclaw-kernel/src/managers/agent.manager.ts packages/nextclaw-kernel/src/managers/automation.manager.ts packages/nextclaw-kernel/src/managers/channel.manager.ts packages/nextclaw-kernel/src/managers/context-builder.manager.ts packages/nextclaw-kernel/src/managers/llm-provider.manager.ts packages/nextclaw-kernel/src/managers/session.manager.ts packages/nextclaw-kernel/src/managers/skill.manager.ts packages/nextclaw-kernel/src/managers/task.manager.ts packages/nextclaw-kernel/src/managers/tool.manager.ts packages/nextclaw/package.json packages/nextclaw/tsconfig.json packages/nextclaw/src/cli/app/runtime.ts`
  - 观察点：本次非功能结构治理最终 `Non-test line changes = net -57`，且 `runtime.ts` 本次净减少 37 行；剩余只有“文件仍高于预算”的历史债务提醒，没有新增阻断。
- 已通过：`pnpm lint:new-code:governance -- packages/nextclaw-kernel/src/app/nextclaw-kernel.ts packages/nextclaw-kernel/src/managers/agent.manager.ts packages/nextclaw-kernel/src/managers/automation.manager.ts packages/nextclaw-kernel/src/managers/channel.manager.ts packages/nextclaw-kernel/src/managers/context-builder.manager.ts packages/nextclaw-kernel/src/managers/llm-provider.manager.ts packages/nextclaw-kernel/src/managers/session.manager.ts packages/nextclaw-kernel/src/managers/skill.manager.ts packages/nextclaw-kernel/src/managers/task.manager.ts packages/nextclaw-kernel/src/managers/tool.manager.ts packages/nextclaw/package.json packages/nextclaw/tsconfig.json packages/nextclaw/src/cli/app/runtime.ts`
  - 观察点：本次新增的 kernel owner 接线与同批次骨架清理没有触发任何增量治理错误。
- 已通过：`pnpm dev start`
  - 观察点：本次实测启动落到了 `http://127.0.0.1:18793/api/health` 与 `http://127.0.0.1:5175/`，其中 `/api/health` 返回 `{"ok":true,"data":{"status":"ok","services":{"ncpAgent":"ready","cronService":"ready"}}}`，前端首页返回 `200 OK`；说明 `CliRuntime -> kernel control surface -> 原运行命令` 这条链路没有打断真实启动。

## 发布/部署方式

- 本次不涉及部署。
- 合入后无需额外环境切换，`@nextclaw/kernel` 的默认实例化模型即刻生效。
- 若后续需要发包，建议在发布前额外执行一次该包的 `build + tsc + 冒烟实例化`。

## 用户/产品视角的验收步骤

1. 进入 [`packages/nextclaw-kernel`](/Users/peiwang/Projects/nextbot/packages/nextclaw-kernel)。
2. 查看 [`packages/nextclaw-kernel/src/app/nextclaw-kernel.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-kernel/src/app/nextclaw-kernel.ts)，确认 `kernel` 顶层只保留 `run()` 一个核心动作，并且 owner 已落到 `app/`。
3. 查看 [`packages/nextclaw-kernel/src/managers/context-builder.manager.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-kernel/src/managers/context-builder.manager.ts)，确认 `context` 已被收回成依赖 `SessionManager` 的 builder，而不是继续保留状态 owner 心智。
4. 查看 [`packages/nextclaw-kernel/src/managers/`](/Users/peiwang/Projects/nextbot/packages/nextclaw-kernel/src/managers)，确认剩余 manager 只表达职责边界，没有提前写入真实存储或状态迁移实现。
5. 查看 `run()` 方法体，确认当前只有结构说明 / 伪代码，而没有具体业务逻辑。
6. 查看 [`packages/nextclaw/src/cli/app/runtime.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/app/runtime.ts)，确认 `gateway / ui / start / restart / serve / stop` 这组六个 CLI 入口已经先通过 `kernel.control` 再进入原有命令实现。
7. 执行 `pnpm dev start`，确认服务可正常拉起，`/api/health` 返回 `ok=true`，前端首页可访问。

## 可维护性总结汇总

- 是否已尽最大努力优化可维护性：是。本次没有继续保留 “abstract manager shell + constructor 注入” 这层假边界，而是直接删掉了错误装配模型。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本轮不仅把控制入口先收到了 `kernel` owner 边界，还同步删除了重复 TODO 注释噪音，并把超大 `runtime.ts` 压薄到了净减少 37 行。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：有改善。本批最终 `Non-test line changes = net -57`；也就是说，这次非功能结构治理没有让代码继续长胖，而是在引入 kernel owner 接线的同时实现了净收敛。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：更清晰。`NextclawKernel` 现在除了默认 manager skeleton 之外，还真正开始拥有一层产品运行控制面的 owner；`nextclaw` 入口包仍保留原命令实现，但不再直接宣称自己拥有这组六个核心控制入口。
- 目录结构与文件组织是否满足当前项目治理要求：满足。`nextclaw-kernel` 继续遵循 `package-l1`；当前 `NextclawKernel` owner 已从根层收回 `app/`，根级只保留 `index.ts` 入口，结构与协议描述一致。
- 独立于实现阶段的可维护性复核结论：通过。第二遍复核重点检查的是“这次 owner 迁移是否只是加了一层新壳、却让 `runtime.ts` 更大、让 kernel 更噪、或偷偷改了内部执行逻辑”；结论是否定的。当前主路径已经变成 `CliRuntime -> NextclawKernel.control -> 原命令实现`，并且在真实启动链路里已验证无行为回归。
  - 当前最小 `run` 协议仍稳定为“`sessionId + messages + metadata(agentId/model/skills) + extra`”，避免这轮为了 owner 迁移又把内部装配细节泄漏到 public surface。

## NPM 包发布记录

- 本次是否需要发包：暂不需要。
- 涉及包：`@nextclaw/kernel`
- 当前状态：未发布
- 未发布原因：当前仍处于 kernel 设计与骨架快速收敛阶段，本次先完成结构与默认 ownership 模型收敛，不进入发包流程。
