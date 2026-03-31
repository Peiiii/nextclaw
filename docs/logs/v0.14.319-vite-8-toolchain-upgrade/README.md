# v0.14.319-vite-8-toolchain-upgrade

## 迭代完成说明

- 将仓库内直接使用 `vite` 的前端包统一升级到 `vite ^8.0.3`，并同步升级 `@vitejs/plugin-react ^6.0.1`、`vitest ^4.1.2`。
- 为根目录补充 `Node` 运行时约束：`^20.19.0 || >=22.12.0`，避免低版本环境触发 Vite 8 构建失败。
- 移除 `apps/platform-console`、`apps/platform-admin`、`packages/nextclaw-ui` 中已不再被 Vite 8 导出的 `splitVendorChunkPlugin`。
- 修复若干升级暴露出的测试与类型问题：
  - 将测试中的 `.at()` 改为兼容当前 `tsconfig` 的数组下标写法。
  - 为 `@nextclaw/agent-chat-ui` 补齐 `@types/node` 与 `node` types。
  - 对齐 `chat-message-list` 测试断言与当前 UI 文案。
  - 修复 `SessionManager` 忽略 `workspace`、始终写入全局 session 目录的问题，并顺带满足 class arrow-method 治理规则。
  - 为 `@nextclaw/openclaw-compat` 中真实插件加载测试补充显式超时预算，适配 Vitest 4 下更真实的执行耗时。

## 测试/验证/验收方式

- 前端构建验证：
  - `pnpm -C apps/landing build`
  - `pnpm -C apps/ncp-demo/frontend build`
  - `pnpm -C apps/platform-console build`
  - `pnpm -C apps/platform-console lint`
  - `pnpm -C apps/platform-console tsc`
  - `pnpm -C apps/platform-admin build`
  - `pnpm -C apps/platform-admin lint`
  - `pnpm -C apps/platform-admin tsc`
  - `pnpm -C packages/nextclaw-ui build`
  - `pnpm -C packages/nextclaw-ui lint`
  - `pnpm -C packages/nextclaw-ui tsc`
  - `pnpm -C packages/nextclaw-ui test`
- 测试链验证：
  - `pnpm -C packages/nextclaw-agent-chat-ui tsc`
  - `pnpm -C packages/nextclaw-agent-chat-ui test`
  - `pnpm -C packages/nextclaw-core test src/agent/loop.system-message.test.ts`
  - `pnpm -r --filter @nextclaw/core --filter @nextclaw/mcp --filter @nextclaw/server --filter @nextclaw/openclaw-compat --filter @nextclaw/ncp-toolkit --filter @nextclaw/ncp-mcp --filter @nextclaw/ncp-http-agent-client --filter @nextclaw/ncp-http-agent-server --filter @nextclaw/ncp-agent-runtime --filter @nextclaw/feishu-core --filter nextclaw test`
  - `pnpm -C packages/nextclaw-openclaw-compat test src/plugins/status.pure-read.test.ts`
  - `pnpm -C packages/nextclaw-openclaw-compat test src/plugins/loader.bundled-enable-state.test.ts`
  - `pnpm -C packages/nextclaw-openclaw-compat test src/plugins/loader.ncp-agent-runtime.test.ts`
- 规则治理验证：
  - `pnpm lint:maintainability:guard`

## 发布/部署方式

- 本次变更当前仅完成本地升级与验证，未执行发布。
- 若后续需要发布前端相关包或应用，按项目既有发布流程继续执行：
  - 前端发布前先确认受影响包版本与依赖链是否需要联动。
  - 若仅涉及前端包发布，可按需使用 `/release-frontend` 对应流程。
  - 若进入正式发布，需再次执行受影响范围验证，并按闭环要求补充发布后检查。

## 用户/产品视角的验收步骤

1. 在满足 `Node 20.19+` 或 `22.12+` 的环境中安装依赖。
2. 启动任一前端应用，例如 `pnpm -C apps/platform-console dev` 或 `pnpm -C packages/nextclaw-ui dev`，确认开发服务器可正常启动。
3. 执行对应构建命令，例如 `pnpm -C apps/platform-console build`，确认构建成功且不再报 `splitVendorChunkPlugin` 导出错误。
4. 进入聊天 UI，确认消息列表、工具卡片、代码复制等基础交互正常。
5. 执行相关测试命令，确认 Vitest 4 下核心包与 OpenClaw 兼容层测试可以通过。
