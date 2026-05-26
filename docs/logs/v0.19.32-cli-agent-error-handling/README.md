# v0.19.32 CLI agent 错误表面收敛

## 迭代完成说明

本次修复 `nextclaw agent` 在模型 provider 返回 401 等运行错误时直接向用户暴露 Node/dist 栈的问题。

- 根因：NCP `RunError` 已经正确把 provider 失败上抛，但 CLI agent runner 没有在用户命令表面接住异常，导致交互入口和一次性消息入口都可能被底层栈击穿。
- 确认方式：用户复现栈显示错误穿过 `AgentRunObserver.waitForReply -> dispatchPromptOverNcp -> runCliInteractiveLoop` 后直接退出；本地源码 launcher 冒烟也确认 401 可以稳定复现。
- 修复方式：在 `cli-agent-runner.utils.ts` 中收敛单条 prompt 的发送与错误渲染，交互模式打印一行 `Error: ...` 后继续循环，一次性 `-m` 模式打印错误并设置 `process.exitCode = 1`。
- 顺手删除 `service-runtime.service.ts` 中已不再被 runner 使用的 `providerManager` 传参链路，避免保留空心依赖。
- 按硬切主链路要求，在 `pnpm lint:new-code:governance` 中新增 live-code 扫描：`packages/`、`apps/`、`workers/` 下不得再出现 `AgentLoop`、`NativeAgentEngine`、`runtimePool`、`GatewayAgentRuntimePool` 或 `processDirect(...)` 旧执行入口。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-service test -- src/cli/commands/agent/services/cli-agent-runner.service.test.ts`：通过。
- `pnpm -C packages/nextclaw-service tsc`：通过。
- `pnpm -C packages/nextclaw-service exec eslint src/cli/commands/agent/cli-agent-runner.utils.ts src/cli/commands/agent/services/cli-agent-runner.service.test.ts src/service-runtime.service.ts`：通过。
- `pnpm -C packages/nextclaw-service lint`：通过，保留 14 个既有 warning，无 error。
- `pnpm -C packages/nextclaw-service build`：通过。
- `pnpm lint:new-code:governance`：通过。
- `rg -n "\\bAgentLoop\\b|\\bNativeAgentEngine\\b|\\bruntimePool\\b|\\bGatewayAgentRuntimePool\\b|\\bprocessDirect\\s*\\(" packages apps workers --glob '!**/dist/**' --glob '!**/node_modules/**' --glob '!**/ui-dist/**' -S`：无 live code 命中。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node packages/nextclaw/dist/cli/launcher/index.js agent -m '你好'`：返回 exit code 1，仅输出一行 401 错误，不再输出底层栈。
- `nextclaw agent -m '你好'`：返回 exit code 1，仅输出 SQLite 实验警告和一行 401 错误，不再输出底层执行栈。

## 发布/部署方式

本次未执行 NPM 发布、远程部署或数据库 migration。若需要让其他机器或正式用户获得该修复，需要后续走 NPM 发布。

本机已执行本地安装验证：

- `pnpm local-install:nextclaw`：构建通过，但该脚本未替换当前 shell 里的旧 `/opt/homebrew/bin/nextclaw`。
- `npm link`（在 `packages/nextclaw` 下执行）：已把 `/opt/homebrew/bin/nextclaw` 链到当前工作区 `dist/cli/launcher/index.js`。

## 用户/产品视角的验收步骤

1. 使用当前工作区构建产物运行 `node packages/nextclaw/dist/cli/launcher/index.js agent -m '你好'`。
2. 在 API key 错误配置下，观察输出只包含 `Error: 401 Incorrect API key provided...`。
3. 验收标准：CLI 不再泄露 `@nextclaw/kernel/dist`、OpenAI SDK 或 Node.js 运行栈；一次性模式以非 0 退出码表示失败。
4. 本机安装后，用用户实际入口 `nextclaw agent -m '你好'` 重复同样输入，预期仍只输出一行错误，不泄露底层栈。

## 可维护性总结汇总

已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 口径复核。

- 总代码增减：新增 111 行、删除 26 行、净增 85 行。
- 非测试代码增减：新增 24 行、删除 26 行、净增 -2 行。
- 正向减债动作：删除。
- 质量与可维护性提升证明：删除未使用的 `providerManager` 传参链路，同时把 CLI prompt 错误渲染集中到单一路径，并用治理脚本确认旧 agent 直驱入口无法在 live code 中复活。
- 为何不是单纯压缩行数：删除的是已经无调用收益的空心依赖参数与局部临时状态，保留的新增代码是用户表面错误合同、对应测试和主链路硬切治理。

## NPM 包发布记录

不涉及 NPM 包发布。
