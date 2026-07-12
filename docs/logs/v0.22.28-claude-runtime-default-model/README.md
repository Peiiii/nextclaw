# v0.22.28 Claude Runtime Default 模型选择

## 迭代完成说明

本次补齐 Claude Code runtime 的 `Runtime default` 模型选择能力。用户在 Claude Code 会话中可以选择由 Claude Code 自己接管模型、鉴权和默认配置；显式选择 NextClaw 模型时，仍走原有 provider route 和隔离配置目录。

核心变更：

- Claude NARP wrapper 将“无 provider route、无 model id”的请求识别为 `Runtime default`。
- Claude SDK runtime 在 `Runtime default` 路径下不覆盖 `CLAUDE_CONFIG_DIR`、API key、API base 或 model。
- Claude SDK runtime 在该路径显式启用 user/project/local setting sources，使行为与 Claude Code 自身配置一致。
- 显式 NextClaw 模型路径继续注入 NextClaw route credential/model，并保持配置隔离。
- Claude runtime skill 和 marketplace metadata 补充 Runtime default 与 NextClaw 模型选择说明。
- `smoke:ncp-chat` 会把目标 session type 写入 `agentRuntimeId`，避免命令显示在测 Claude/Codex、实际执行 Native runtime。

## 测试/验证/验收方式

已完成验证：

- `node_modules/.pnpm/node_modules/.bin/vitest run packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/src`
- `node_modules/.pnpm/node_modules/.bin/vitest run packages/extensions/nextclaw-narp-runtime-claude-code-sdk/src`
- `node_modules/.pnpm/node_modules/.bin/tsc -p packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/tsconfig.json`
- `node_modules/.pnpm/node_modules/.bin/tsc -p packages/extensions/nextclaw-narp-runtime-claude-code-sdk/tsconfig.json`
- `node_modules/.bin/eslint <touched source and test files>`
- `pnpm smoke:ncp-chat -- --session-type claude --model __nextclaw_runtime_default__ --base-url http://127.0.0.1:55667 ... --json`：返回 Runtime-default 文本 marker、非空 reasoning、`run.finished`。
- 同一 Runtime-default 会话完成 Bash 工具调用，事件包含 tool-call start/result 和最终文本 marker。
- `pnpm smoke:ncp-chat -- --session-type claude --model minimax/MiniMax-M2.7 --base-url http://127.0.0.1:55667 ... --json`：显式 NextClaw 模型回归通过。
- session journal 的 run spec 明确记录 `agentRuntimeId=claude`，排除误跑 Native runtime。
- 真实 55667 页面切换 Claude Code 后，模型入口显示“运行时默认”，展开菜单同时包含“运行时默认”和 NextClaw 模型。

验收点：

- Runtime-default 请求不会写入 NextClaw provider route、model 或隔离 Claude config。
- 显式 NextClaw provider route 仍写入 Anthropic-compatible 环境变量并使用隔离 config。
- Claude runtime skill 的安装/修复说明包含 `modelSelectionMode: optional`。
- NCP smoke 的目标 session type 与 journal 中实际 `agentRuntimeId` 一致。

## 发布/部署方式

本次变更需要进入下一次 NPM 正式版发布，因为它改变了 Claude Code runtime 的用户可见模型选择行为，并更新了已发布的 runtime 包。

桌面 installer、桌面 update manifest、GitHub desktop release 和数据库 migration 不适用。

## 用户/产品视角的验收步骤

用户升级后，在 Claude Code 会话模型选择中应同时看到：

- `Runtime default`
- NextClaw 已配置的模型

选择 `Runtime default` 时，Claude Code 使用自己的配置、鉴权和默认模型；选择其它模型时，NextClaw 继续按已配置 provider route 执行。

## 可维护性总结汇总

本次没有新增新的 runtime 类型、provider 特判或协议分支，只在 Claude runtime 的既有 owner 中区分“用户选择 Runtime default”和“用户选择显式 NextClaw 模型”两条路径。行为由请求上下文一次性决定，不做失败后的隐式回退，保持模型与鉴权来源可预测。

- 生产代码与脚本新增 75 行、删除 50 行、净增 25 行；这是新增用户能力和修正真实 smoke runtime 路由所需的最小合同增长。
- 新增 90 行定向测试，分别锁住显式 NextClaw route 隔离与 Claude Runtime-default 配置归属。
- 没有新增 service、adapter、provider 分支或文件目录；通用 UI/kernel/NARP sentinel 链路保持复用。
- maintainability guard 无阻塞项；`scripts/smoke` 维持 14 个直接文件，已有目录预算豁免且本次没有继续增加文件数量。

## NPM 包发布记录

待随下一次 NPM 正式版统一发布：

- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk`
