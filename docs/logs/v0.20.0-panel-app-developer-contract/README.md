# v0.20.0 Panel App Developer Contract

## 迭代完成说明

本次迭代把 NextClaw 轻量应用能力从“能用但容易写错”收敛为明确开发者合同：

- `window.nextclaw.serviceActions.list()` 面向 Panel App 返回 action 数组，避免 AI 写成 `actions.length` 后遇到 `{ actions }` envelope。
- `window.nextclaw.serviceActions.invoke()` 面向 Panel App 返回业务 payload，隐藏常见 MCP result envelope。
- 内置 `panel-app-creator` / `service-app-creator` / `nextclaw-app-creator` skill 明确目录式 Panel App、`panel-app.json` 唯一 manifest、点号 Service action、冒号 Agent capability、AI 结构化分析走 `agent.generateObject()`。
- 新增 Panel bridge API reference 和方案文档，避免后续继续靠口头约定。
- 后续补丁补齐 Service App 依赖策略：零依赖优先，简单 tools 默认只写 `service-app.json` + `server.mjs`；仅当 `server.mjs` 确实 import 第三方包时，Service App 目录才自带 `package.json` 并安装依赖。NextClaw runtime 只负责按 manifest 启动进程，不注入自身 `node_modules`，也不在运行时隐式联网安装。

根因：运行时 SDK 返回形态、Service App MCP result 形态、skill 指引和 manifest 唯一事实源没有形成同一个开发者合同，导致 AI 容易同时踩 action 声明、返回值读取、AI/Service 边界三个坑。  
确认方式：复核真实失败应用的调用形态后，定向测试覆盖 bridge 解包和 skill 文案合同。

依赖策略补丁根因：本地已有 Service App 实际采用零依赖手写 MCP stdio / JSON-RPC server；但 `service-app-creator` 没把“零依赖优先”写成默认心智，也没说明第三方依赖的例外归属。确认方式：复核本机 `~/.nextclaw/workspace/service-apps/*`，现有 6 个 Service App 均无本地 `package.json` / `node_modules`，并复核 `McpServiceAppRuntimeService` 的启动路径，确认它只设置 Service App 目录为 `cwd` 并通过 `node server.mjs` 启动，不会注入 NextClaw 包依赖。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/kernel test -- src/managers/__tests__/panel-app.manager.test.ts`
- `pnpm --filter @nextclaw/core test -- src/features/agent/features/tests/skills.test.ts`
- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/core tsc`
- `pnpm exec eslint packages/nextclaw-kernel/src/utils/panel-app-bridge.utils.ts packages/nextclaw-kernel/src/managers/__tests__/panel-app.manager.test.ts packages/nextclaw-core/src/features/agent/features/tests/skills.test.ts`
- 依赖合同补丁：`pnpm --filter @nextclaw/core test -- src/features/agent/features/tests/skills.test.ts`
- 依赖合同补丁：`pnpm --filter @nextclaw/core tsc`
- 依赖合同补丁：`pnpm exec eslint packages/nextclaw-core/src/features/agent/features/tests/skills.test.ts --max-warnings=0`
- 依赖合同补丁：`pnpm --filter @nextclaw/core lint` 通过，仍有既有 warning 但无 error。
- 依赖合同补丁：仓库外临时目录创建独立 Node 包，安装 `@modelcontextprotocol/sdk@^1.27.1` 后执行 `node -e "import('@modelcontextprotocol/sdk/server/mcp.js')"`，输出 `mcp-sdk-import-ok`。
- 依赖合同补丁：`node scripts/governance/lint-new-code-governance.mjs -- <本补丁触达文件>` 通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `git diff --check`

依赖合同补丁已尝试运行仓库级 `pnpm lint:new-code:governance`，但当前工作区其它未完成改动 `packages/extensions/nextclaw-narp-runtime-opencode` 触发 module-structure import boundary 错误；本补丁改用触达文件范围的治理命令验证通过，并保留外部阻塞说明。

发布验证：

- `pnpm release:check`
- `pnpm release:publish`
- `pnpm release:verify:published`
- `npm view nextclaw version --json`
- `npm view nextclaw dist-tags --json`
- 临时目录 `npm install --prefix "$TMP_PREFIX" nextclaw@latest`
- 临时安装执行 `nextclaw --version`
- 校验临时安装包存在 `resources/update-bundle-public.pem`
- 校验临时安装包存在 `dist/cli/launcher/index.js` 与 `dist/cli/app/index.js`
- 隔离 `NEXTCLAW_HOME` 执行 `nextclaw update --check`

## 发布/部署方式

已通过 changeset 执行 full public workspace minor NPM release：

- `pnpm release:version`
- `pnpm release:publish`
- `pnpm release:verify:published`
- 真实临时目录安装 `nextclaw@latest` 并执行 `nextclaw --version`、`nextclaw update --check`

不涉及数据库 migration。  
不涉及远程服务部署。  
不涉及 desktop installer / DMG 发布。

## 用户/产品视角的验收步骤

1. 让内置 App creator skill 创建一个 Panel + Service 应用。
2. Panel App 的 `panel-app.json.actions` 声明 `<service-app-id>.<tool-name>`。
3. Panel App 中 `const actions = await window.nextclaw.serviceActions.list()` 后可直接按数组渲染。
4. Panel App 中 `const payload = await window.nextclaw.serviceActions.invoke(...)` 后可直接读取业务字段。
5. AI 分析、总结、分类类 UI 使用 `window.nextclaw.agent.generateObject()`，不再新建 Service App 自己调用模型。
6. Service App 后端零依赖优先；如确实 import `@modelcontextprotocol/sdk` 或其它第三方包，生成物包含本地 `package.json`，创建后安装依赖，并能通过 Service Apps discovery 列出 MCP tools。

## 可维护性总结汇总

本次是新增用户能力的平台合同发布，允许必要的非测试代码增长。实现选择在宿主注入 SDK 里统一解包，避免每个 Panel App 重复处理 envelope；skill 和 reference 则把开发者路径压成唯一主合同。  
当前 maintainability guard 结果：无 errors / warnings。  
可维护性复核结论：通过。  
本次顺手减债：是。正向动作是把 Panel App 侧每个应用都可能重复处理的 Service action envelope 解包收敛到宿主注入 SDK，并把分散在口头讨论里的开发合同收敛进内置 skill/reference/测试。

依赖策略补丁可维护性结论：通过。正向动作是职责边界收敛：把零依赖 Service App 固定为默认生成心智，同时把第三方运行依赖归属固定在 Service App 目录，避免 runtime 自动安装、宿主包依赖注入、仓库根依赖污染这几条隐式路径继续膨胀；并用内置 skill 测试固定生成规则。

## NPM 包发布记录

需要发布 NPM 包，原因：Panel / Service App 生态能力属于新平台能力，应使用 minor 版本承接，而不是继续 patch。

发布范围：full public workspace batch，包含：

- `nextclaw`
- `@nextclaw/agent-chat`
- `@nextclaw/agent-chat-ui`
- `@nextclaw/app-runtime`
- `@nextclaw/app-sdk`
- `@nextclaw/client-sdk`
- `@nextclaw/core`
- `@nextclaw/extension-sdk`
- `@nextclaw/kernel`
- `@nextclaw/mcp`
- `@nextclaw/nextclaw-hermes-acp-bridge`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http`
- `@nextclaw/nextclaw-ncp-runtime-http-client`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client`
- `@nextclaw/remote`
- `@nextclaw/runtime`
- `@nextclaw/server`
- `@nextclaw/service`
- `@nextclaw/shared`
- `@nextclaw/ui`

发布结果：

- `nextclaw@0.20.0`
- `@nextclaw/agent-chat@0.2.0`
- `@nextclaw/agent-chat-ui@0.4.0`
- `@nextclaw/app-runtime@0.8.0`
- `@nextclaw/app-sdk@0.2.0`
- `@nextclaw/client-sdk@0.2.0`
- `@nextclaw/core@0.13.0`
- `@nextclaw/extension-sdk@0.2.0`
- `@nextclaw/kernel@0.2.0`
- `@nextclaw/mcp@0.2.0`
- `@nextclaw/nextclaw-hermes-acp-bridge@0.2.0`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.2.0`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.2.0`
- `@nextclaw/nextclaw-ncp-runtime-http-client@0.2.0`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.0`
- `@nextclaw/remote@0.2.0`
- `@nextclaw/runtime@0.3.0`
- `@nextclaw/server@0.13.0`
- `@nextclaw/service@0.2.0`
- `@nextclaw/shared@0.2.0`
- `@nextclaw/ui@0.13.0`

changeset 同时发布了 release check 识别出的未发布本地版本：

- `@nextclaw/companion@0.1.17`
- `@nextclaw/channel-extension-dingtalk@0.1.4`
- `@nextclaw/channel-extension-discord@0.1.4`
- `@nextclaw/channel-extension-email@0.1.4`
- `@nextclaw/channel-extension-feishu@0.1.12`
- `@nextclaw/channel-extension-qq@0.1.9`
- `@nextclaw/channel-extension-slack@0.1.4`
- `@nextclaw/channel-extension-telegram@0.1.4`
- `@nextclaw/channel-extension-wecom@0.1.4`
- `@nextclaw/channel-extension-weixin@0.1.15`
- `@nextclaw/channel-extension-whatsapp@0.1.4`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.1.18`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.1.19`
- `@nextclaw/ncp-mcp@0.1.95`

Registry verification：`release:verify:published` 确认 `35/35` 个 package versions 已发布。  
NPM dist-tag：`nextclaw@latest = 0.20.0`，`beta = 0.19.31-beta.7`。  
真实安装验证：临时安装 `nextclaw@latest` 后 `nextclaw --version` 输出 `0.20.0`，`nextclaw update --check` 输出 runtime 已是最新 `0.20.0`。

依赖合同补丁：本轮不发布 NPM 包，原因是用户明确要求 NPM 不用发布；本地内置 skill、设计文档和测试已更新，待后续统一版本发布时随 `@nextclaw/core` 带出。
