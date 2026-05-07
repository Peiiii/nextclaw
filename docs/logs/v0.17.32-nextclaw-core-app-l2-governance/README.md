# nextclaw-core app-l2 结构治理

## 迭代完成说明

本迭代将 `packages/nextclaw-core` 从 L1 单层角色目录治理到 `app-l2` 多业务域结构，目标是让协议等级与 core 的真实复杂度一致，并消除目录结构审计中的核心债务。

实际落地后，core 保留 package 公共入口 `src/index.ts`，业务域进入 `src/features/*`，横切工具与日志进入 `src/shared/lib/*`。`src/index.ts` 只转发 `src/app/index.ts`，同时 module structure config 明确要求 package 型 core 必须保留根 index。

## 测试/验证/验收方式

- core 目录结构全量审计：`TOTAL_FINDINGS 0`。
- `pnpm --filter @nextclaw/core tsc`：通过。
- `pnpm --filter @nextclaw/core test`：38 个测试文件、156 个测试通过。
- `pnpm --filter @nextclaw/core build`：通过，输出 `dist/index.js` 与 `dist/index.d.ts`。
- 直接依赖方 `tsc`：`@nextclaw/runtime`、`@nextclaw/mcp`、`@nextclaw/channel-runtime`、`@nextclaw/openclaw-compat`、`@nextclaw/server`、`@nextclaw/remote`、`nextclaw` 通过；`@nextclaw/desktop` 暴露既有 `@nextclaw/ncp` moduleResolution 问题，不是 core 入口问题。
- `pnpm lint:new-code:governance -- ...`：通过。
- `pnpm check:governance-backlog-ratchet`：通过，文档命名债务从 13 收敛为 0。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：通过。

## 发布/部署方式

不涉及部署。本次修改 `@nextclaw/core` package export/build 入口，后续如要发布应随统一 NPM beta/release 批次处理。

## 用户/产品视角的验收步骤

`@nextclaw/core` 仍可作为 NextClaw 运行时核心包被 CLI、server、runtime、desktop 等依赖方使用；公共入口保持可构建。

## 可维护性总结汇总

core 的结构协议与真实复杂度对齐到 `app-l2`，同时恢复 package 应有的根 `index.ts` 公共入口。治理脚本新增 `requiredRootFiles` 能力，避免后续再次误删 package 根入口。

## NPM 包发布记录

不涉及本轮直接 NPM 包发布。`@nextclaw/core` 的源码结构治理已恢复到标准根入口，后续是否发布随统一发布批次评估。
