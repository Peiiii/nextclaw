# v0.20.65 Core Maintainability Refactor

## 迭代完成说明

本次完成 `packages/nextclaw-core` 可维护性重构：按当前 role-first 与 module-structure contract 收敛 config、agent tools、llm provider、runtime-context、session-search 与 session 相关文件组织。

核心变化：

- `features/config` 不新增 `schemas/` 目录；配置 schema 合同落到 `configs/config-schema.config.ts`，schema UI help/hints/labels 落到 `utils/`。
- agent tools 按当前 module contract 保持 `tools/*.tools.ts` 直放文件，不新增 `tools/<domain>/` 子目录。
- provider、service、test 文件按角色后缀重命名，如 `openai.provider.ts`、`base.provider.ts`、`skills-loader.service.ts`、`layered-skills-loader.service.ts`。
- 保留 feature root `index.ts` 作为当前 module contract 的唯一导出入口，`app/index.ts` 收敛为 feature root re-export。
- `session.store.ts` 中的 history window 归一化逻辑抽到 `session-history-window.utils.ts`，并保持普通函数不原地修改入参。

同批次补丁：

- 修复 file-role-boundaries 治理漏检机制：触达 `configs/` 角色目录时，同步扫描该目录直接兄弟文件，避免 `brand.ts` 这类未变更但位于已触达 `configs/` 的违规文件继续漏过。
- 修复 rename 场景治理稳定性：旧路径已从工作区删除时，从 `HEAD:<old path>` 读取旧内容，避免 role-boundary 检查因 ENOENT 崩溃。
- 补齐触达 core 文件的角色后缀：`brand.config.ts`、`helpers.utils.ts`、`memory.store.ts`、`file-log-sink.service.ts`、`logging-runtime.service.ts`。
- 在 `MemoryStore` 与 logging runtime/sink 中顺手删除重复分支和重复映射，保持非功能改动的非测试代码净增长不为正。

本次属于内部结构和可维护性改进，不改变用户可见行为。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-core test -- src/features/config/configs src/features/config/utils src/features/config/services src/features/agent/tools src/features/llm-providers/providers/__tests__/openai.provider.test.ts src/features/llm-providers/utils/__tests__/chat-completions-normalizer.utils.test.ts src/features/session/services/session-project-context.service.test.ts src/features/session-search/worker/session-search-worker.controller.test.ts`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node --test scripts/governance/checks/structure/lint-new-code-file-role-boundaries.test.mjs`
- `pnpm lint:new-code:governance -- packages/nextclaw-core/src scripts/governance/checks/structure/lint-new-code-file-role-boundaries.mjs scripts/governance/checks/structure/lint-new-code-file-role-boundaries.test.mjs`
- `pnpm -C packages/nextclaw-core test src/shared/lib/logging src/features/config src/features/agent/features/memory`
- `node .agents/skills/file-organization-governance/scripts/enhanced-check-organization.js packages/nextclaw-core/src`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`

## 发布/部署方式

不涉及发布或部署。该批次是源码结构重构，后续随常规版本发布进入包产物。

## 用户/产品视角的验收步骤

用户可见行为不变。产品侧验收重点是 core 包仍能被下游包正常类型检查，并且原有 config、agent tools、provider、session-search 相关测试继续通过。

## 可维护性总结汇总

- 已按实现前删减和 role-first 文件组织原则执行。
- 非测试代码净减 2 行，总净减 5 行。
- `features/config/schemas` 这类非标准角色目录未保留。
- feature root `index.ts` 按 module contract 恢复为唯一导出入口，避免绕过模块边界 deep import。
- `session.store.ts` 从 507 行降到 411 行，仍高于 400 行预算，后续可继续拆分 session persistence / event journal 边界。
- 命名治理机制补丁后，补丁范围 maintainability guard 通过，非测试代码净减 3 行；`lint-new-code-file-role-boundaries.mjs` 当前 415 行，接近 500 行预算，后续若继续扩展 role-boundary 规则应优先拆分。
- maintainability guard 通过；保留文件预算警告，均为后续减债候选。

## NPM 包发布记录

不涉及 NPM 包发布。
