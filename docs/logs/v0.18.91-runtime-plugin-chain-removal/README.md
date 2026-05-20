# v0.18.91-runtime-plugin-chain-removal

## 迭代完成说明

- 彻底删除旧的 OpenClaw plugin agent runtime 注册链路：`registerNcpAgentRuntime`、`ncpAgentRuntimes`、plugin runtime provider 同步入口、保留 kind 逻辑与相关测试入口。
- 删除旧 Codex / Claude runtime plugin package；Codex OpenAI Responses bridge 迁回 `nextclaw-ncp-runtime-codex-sdk`，NARP Codex wrapper 改为依赖真正的 runtime SDK package。
- agent runtime 来源收敛为 kernel 内置 provider（`native` / `narp-http` / `narp-stdio`）与 `agents.runtimes.entries` 配置，不再由 plugin registry 注入 runtime。
- 清理旧 Codex plugin 本地 smoke、旧 skill、根脚本、lockfile、当前架构文档与相关测试示例。
- 按治理要求顺手修复本次触达的历史命名债务，将 OpenClaw plugin loader / registry / status 等文件改成带角色后缀的文件名。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-openclaw-compat tsc`
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk tsc`
- `pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk tsc`
- `pnpm -C packages/nextclaw-openclaw-compat build`
- `pnpm -C packages/nextclaw-kernel build`
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk build`
- `pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk build`
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk test`
- `pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk test`
- `pnpm -C packages/nextclaw-kernel exec vitest run src/features/runtime-registry/services/agent-runtime-registry.service.test.ts`
- `pnpm -C packages/nextclaw-openclaw-compat exec vitest run --config ../nextclaw-core/vitest.config.ts src/plugins/status.pure-read.test.ts src/plugins/channel-runtime.test.ts src/plugins/install.test.ts src/plugins/uninstall.test.ts`
- `pnpm -C packages/nextclaw-service exec vitest run src/commands/plugin/plugin-reload.test.ts src/commands/plugin/dev-first-party-plugin-load-paths.test.ts src/commands/plugin/dev-first-party-plugin-load-paths.path-install.test.ts src/cli/commands/agent/agent-commands.test.ts src/shared/services/gateway/tests/gateway-plugin-manager.service.test.ts src/shared/services/marketplace/tests/marketplace-plugin-management.service.test.ts`
- `pnpm -C packages/nextclaw-ui exec vitest run src/features/marketplace/utils/marketplace-installed-cache.utils.test.ts src/features/marketplace/components/marketplace-page.test.tsx`
- `pnpm -C packages/nextclaw-server exec vitest run src/app/router.marketplace-content.test.ts src/app/router.marketplace-installed.test.ts`
- `node --test scripts/dev/dev-plugin-overrides-support.test.mjs`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `git diff --check`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`

补充说明：`pnpm -C packages/nextclaw-ui lint` 仍被 UI 既有 unrelated lint errors 阻塞；本次触达的 marketplace 测试文件已通过定向 ESLint。

## 发布/部署方式

本轮未执行发布或部署。涉及 workspace package 的源码与 package 拆除，后续若进入发版批次，需要统一评估受影响 package 的 NPM 发布。

## 用户/产品视角的验收步骤

1. `nextclaw agent runtimes` 只应展示配置化 runtime entry 与 builtin source，不再展示 plugin source / pluginId。
2. 配置 `agents.runtimes.entries` 后，应由 kernel 内置 provider 创建 runtime。
3. 安装或加载 OpenClaw plugin 不应再产生 NCP agent runtime。
4. 仓库搜索当前生产链路不应再出现 `registerNcpAgentRuntime` / `ncpAgentRuntimes` / 旧 runtime plugin package 引用。

## 可维护性总结汇总

- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 标准进行收尾判断。
- 本次是非功能重构，当前 diff 的非测试代码净变化为 `+263 / -3376 / net -3113`，满足 `非测试代码净增 <= 0`。
- 正向减债动作是删除与职责收敛：删除旧 plugin runtime 注册面、旧 package、旧 smoke/skill，保留 runtime SDK 与 NARP wrapper 的单一路径。
- 仍保留的主要债务：OpenClaw plugin loader/registry 仍是历史大文件；本轮已减少行数并修正命名，但未进一步拆分内部结构。

## NPM 包发布记录

- 不涉及本轮直接 NPM 包发布。
- 后续若发布，需要重点评估：
  - `@nextclaw/kernel`
  - `@nextclaw/service`
  - `@nextclaw/openclaw-compat`
  - `@nextclaw/nextclaw-ncp-runtime-codex-sdk`
  - `@nextclaw/nextclaw-narp-runtime-codex-sdk`
