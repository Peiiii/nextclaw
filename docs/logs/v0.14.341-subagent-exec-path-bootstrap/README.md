# 迭代完成说明

- 修复 subagent 通过 `exec` 执行本机已安装命令时的 PATH 继承问题，避免在开发态 / 非交互 shell 下出现 `nextclaw: command not found`。
- 把 PATH 修复下沉到共享的外部命令环境构造层，而不是单独给 subagent、主 agent 或 `nextclaw` CLI 打特判，避免维护两套以上逻辑。
- `createExternalCommandEnv(...)` 现在会统一补齐三类命令来源：
  - 当前运行 Node 的 bin 目录
  - 当前工作目录向上祖先链中的 `node_modules/.bin`
  - 常见系统 bin 目录（如 `/opt/homebrew/bin`、`/usr/local/bin`）
- `ExecTool` 改为把实际执行的 `cwd` 传入共享 env builder，使主 agent 与 subagent 通过同一套规则获得一致的外部命令可见性。

# 测试 / 验证 / 验收方式

- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/core exec vitest run src/agent/tools/shell.test.ts`
- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/core exec tsc -p tsconfig.json --noEmit`
- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-core/src/utils/child-process-env.ts packages/nextclaw-core/src/agent/tools/shell.ts packages/nextclaw-core/src/agent/tools/shell.test.ts`
- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint:maintainability:guard`
  - 本次命令仍被仓库里已有的无关脏改动阻塞：`packages/extensions/nextclaw-channel-plugin-feishu/src/bot.ts` 与 `packages/extensions/nextclaw-channel-plugin-feishu/src/bot.test.ts` 超出维护性预算继续增长。
  - 本次 core `exec` / env 相关改动的定向维护性检查通过。

# 发布 / 部署方式

- 本次未执行发布。
- 后续按既有前端 / CLI / NCP 发布流程正常发布即可，无需额外 migration。

# 用户 / 产品视角的验收步骤

1. 在开发态 NextClaw 实例里让主 agent 触发一次 `spawn`，让子 agent 使用 `exec` 调用 `nextclaw --help`、`nextclaw --version` 或其它本机已安装 CLI。
2. 确认子 agent 不再因为 PATH 过瘦而返回 `command not found: nextclaw` 一类错误。
3. 若仓库或工作目录下存在 `node_modules/.bin` 命令，确认子 agent 也能在不手工补 PATH 的情况下直接执行。
4. 再确认主 agent 与 subagent 的 `exec` 行为一致，不需要分别维护不同的 PATH 修复逻辑。
