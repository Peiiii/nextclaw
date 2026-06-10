# v0.20.62 ACP Dev Runtime Env

## 迭代完成说明

本次修复本地开发态 Codex/NARP stdio 会话经常报 `ACP connection closed` 的问题。

根因是 `pnpm dev start` 会给 dev server 注入 `NODE_OPTIONS=--conditions=development`。NARP stdio runtime 子进程继承该环境后，Node 会按依赖包的 `exports.development` 去解析全局安装包里的 `src/index.ts`，但发布包只包含 `dist`，因此触发 `ERR_MODULE_NOT_FOUND` 并导致 ACP 连接关闭。

确认方式：

- 在全局安装的 `@nextclaw/nextclaw-narp-runtime-codex-sdk` 目录中，带 `NODE_OPTIONS=--conditions=development` import `@nextclaw/nextclaw-narp-stdio-runtime-wrapper` 可稳定复现同一个 `ERR_MODULE_NOT_FOUND`。
- 不带该条件时 import 正常。
- 修复后，`buildStdioRuntimeLaunchEnv` 会把 `--conditions=development` 从外部 runtime 子进程环境中剥离。

修复方式：

- 将 `createRuntimeChildEnv` 收敛为 runtime 子进程环境的统一 owner，复用已有 `sanitizeNodeOptionsForExternalCommand`。
- NARP stdio runtime 和 extension runtime 都走同一个环境清理合同，避免重复实现。
- NARP stdio 失败事件追加子进程 stderr，让类似启动失败不再只显示泛化的 `ACP connection closed`。
- prompt 失败时优先抛出原始错误，避免被后续“无 assistant content”错误覆盖。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/core test -- src/features/agent/tools/shell.tools.test.ts`
- `pnpm --filter @nextclaw/core tsc`
- `pnpm --filter @nextclaw/core lint`
- `pnpm --filter @nextclaw/core build`
- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/kernel lint`
- `pnpm --filter @nextclaw/kernel build`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client tsc`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client lint`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client build`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- 构建产物 smoke：`NODE_OPTIONS=--conditions=development --trace-warnings` 被清理为 `--trace-warnings`；只有 `--conditions=development` 时删除 `NODE_OPTIONS`。

未完成验证：

- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client test -- src/stdio-runtime.test.ts` 未能执行测试体，原因是当前工作区已有无关导入问题：`@core/features/agent/tools/registry.tools.js` 找不到。

## 发布/部署方式

本次只提交源码与 changeset，不执行发布。后续随统一 NPM 发布流程发布。

## 用户/产品视角的验收步骤

1. 使用 `pnpm dev start` 启动本地开发态。
2. 在 UI 中打开 Codex/NARP stdio runtime 会话并发送消息。
3. 预期不会因为 dev server 的 `NODE_OPTIONS=--conditions=development` 触发全局依赖包 `src/index.ts` 缺失。
4. 若外部 runtime 子进程仍启动失败，UI 错误应包含 stderr 里的真实 Node 栈，而不是只显示 `ACP connection closed`。

## 可维护性总结汇总

已使用 maintainability guard。最终本次相关文件的非测试代码净增为 `-3`，满足非功能 bugfix 的 `非测试代码净增 <= 0` 要求。

维护性动作：

- 删除 extension runtime 中手写的 `NODE_OPTIONS` 清理逻辑。
- 将 runtime child env 清理收敛到 `createRuntimeChildEnv`。
- 保持 `stdio-runtime.service.ts` 不继续增长，但该文件仍超过预算，后续拆分方向是提取 orchestration、IO 和状态迁移。

红区触达：未触达当前 maintainability hotspot 清单中的文件。

## NPM 包发布记录

需要随下一批 NPM 发布进入 patch：

- `@nextclaw/core`：待统一发布。原因是 runtime child env 清理合同变化。
- `@nextclaw/kernel`：待统一发布。原因是 extension runtime 改用统一 runtime child env。
- `@nextclaw/nextclaw-ncp-runtime-stdio-client`：待统一发布。原因是 NARP stdio 错误透传与 dev runtime 环境修复。
