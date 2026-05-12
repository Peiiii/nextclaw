# v0.18.31 Kernel Runtime Feature Root

## 背景

`packages/nextclaw-kernel/src/agent-runtime` 作为顶层目录承载了 native runtime、NARP runtime、runtime registry、NCP dispatch、MCP support 等并列职责，目录本身不符合当前 role-first / feature-root 结构规范。

## 目标

- 撤销 `src/agent-runtime` 顶层目录。
- 将并列职责迁移到 `src/features/*` 下的可折叠 feature root。
- 抽出 `NativeAgentRuntimeFactory`，让 `AgentRuntimeManager` 不再内联 native runtime 的 context builder、tool registry、LLM API 与上下文压缩预检装配。

## 改动

- 新增 `features/native-runtime`、`features/runtime-registry`、`features/narp-runtime`、`features/ncp-dispatch`、`features/mcp-runtime-support`。
- 为每个 feature root 增加 `index.ts`，外部导入统一走 feature 根入口。
- `AgentRuntimeManager` 收敛为 runtime 注册、backend 接入、事件发布和生命周期 owner。
- `module-structure.config.json` 移除 `agent-runtime`，允许 `features` 作为 kernel 顶层目录。
- `tsconfig.json` 增加 feature root path 映射，保证治理要求的根入口导入可被 NodeNext 解析。

## 验证

- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-kernel test`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-kernel build`
- `pnpm lint:new-code:module-structure`
- `pnpm lint:new-code:file-names`
- `pnpm lint:new-code:file-role-boundaries`
- `pnpm check:governance-backlog-ratchet`

## 可维护性

- kernel 结构迁移子集已实现 `AgentRuntimeManager` 大幅减重。
- 本次全仓 maintainability guard 受并行未完成 NARP wrapper 新增文件影响，`--non-feature` 口径仍显示全仓非测试净增长；本次 kernel 子集需要单独按 diff 复核。

## 后续

- `features/ncp-dispatch/utils/nextclaw-ncp-dispatch.utils.ts` 已接近 400 行预算，下一步可继续拆出 dispatch session/run 级 owner。
- `native-runtime` 内部还可以继续拆分 context compaction owner 与 tool registry owner，但本轮先控制在最低风险的目录解耦和 factory 抽取。
