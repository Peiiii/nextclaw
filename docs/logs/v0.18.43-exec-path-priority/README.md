# v0.18.43 exec path priority

## 迭代完成说明

本次修复 AI 执行命令时可能命中旧全局 CLI 的问题。根因是 `createExternalCommandEnv` 构造子进程 `PATH` 时把宿主环境放在前面，当前 Node 运行时目录、当前 CLI 脚本目录和 workspace `node_modules/.bin` 只追加在后面；当机器上 `/opt/homebrew/bin/nextclaw@0.17.5` 排在新版 nvm `nextclaw@0.19.6` 前面时，AI 命令会优先运行旧版本，导致 `nextclaw agents runtimes --json` 更慢并混入旧插件诊断输出。

修复方式是在保留宿主 `PATH` 的同时，将当前运行时、当前 CLI 脚本目录和 workspace bin 放到前面，并把触达的环境工具文件重命名为符合 `utils/*.utils.ts` 约束的文件名。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/core test -- src/features/agent/tools/shell.tools.test.ts`
- `pnpm --filter @nextclaw/core tsc`
- `pnpm --filter @nextclaw/core exec eslint src/shared/lib/core-utils/utils/child-process-env.utils.ts src/shared/lib/core-utils/index.ts src/features/agent/tools/shell.tools.test.ts`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-core/src/shared/lib/core-utils/utils/child-process-env.utils.ts packages/nextclaw-core/src/shared/lib/core-utils/index.ts packages/nextclaw-core/src/features/agent/tools/shell.tools.test.ts`
- `pnpm lint:new-code:governance -- packages/nextclaw-core/src/shared/lib/core-utils/utils/child-process-env.utils.ts packages/nextclaw-core/src/shared/lib/core-utils/index.ts packages/nextclaw-core/src/features/agent/tools/shell.tools.test.ts docs/logs/v0.18.43-exec-path-priority/README.md`
- `pnpm check:governance-backlog-ratchet`

功能验证使用旧 Homebrew 版排在前面的 `PATH` 启动当前 nvm Node 进程，再通过 `ExecTool` 执行 `which nextclaw && nextclaw --version && nextclaw agents runtimes --json 2>&1`。结果命中 `/Users/peiwang/.nvm/versions/node/v22.16.0/bin/nextclaw`，版本为 `0.19.6`，输出直接进入 JSON，不再命中 `/opt/homebrew/bin/nextclaw@0.17.5`。

## 发布/部署方式

未发布。该改动需要进入后续统一包发布流程后才会影响已安装的 NextClaw CLI/runtime。

## 用户/产品视角的验收步骤

1. 在同时存在旧 `/opt/homebrew/bin/nextclaw` 和新版 nvm `nextclaw` 的环境中启动新版 NextClaw runtime。
2. 让 AI 执行 `which nextclaw && nextclaw --version && nextclaw agents runtimes --json 2>&1`。
3. 观察命中的 `nextclaw` 优先来自当前 CLI/runtime 工具链或当前 workspace，而不是旧全局安装。

## 可维护性总结汇总

已使用 `post-edit-maintainability-guard` 和人工复核。本次非功能改动的非测试代码净增为 0；同时收敛了触达文件的命名治理债务。正向减债动作是简化环境优先级合同并修正文件角色命名，未新增平行实现或 fallback 分支。

## NPM 包发布记录

不涉及 NPM 包发布。本次仅完成源码修复与本地验证，后续如发版需包含 `@nextclaw/core` 及受影响的直接依赖包评估。
