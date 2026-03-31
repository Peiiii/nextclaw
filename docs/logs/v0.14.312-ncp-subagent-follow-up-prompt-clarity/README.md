# 迭代完成说明

- 第一阶段先按最小边界修复 subagent 完成后的父 agent 续跑报错：不再把这次 follow-up 作为 hidden `system` message 直接送进 provider chat payload。
- 参考 Claude 的 worker completion 设计，把这条内部完成通知收敛成一条结构化 hidden `user` task notification，仅用于 `subagent completion -> parent resume` 这一条边界。
- 通知内容显式携带 `source`、`label`、`status`、`delegated-task`、`result` 与继续执行说明，使父 agent 能把它识别成内部任务完成信号，而不是新的终端用户输入。
- 保持其它会话消息语义不变，没有把全局 `system` 角色统一改写成 `user`；这次只做快速止血，后续仍可继续演进为 Codex 风格的独立 subagent session / resume 协议。

# 测试 / 验证 / 验收方式

- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw test -- run src/cli/commands/ncp/create-ui-ncp-agent.subagent-completion.test.ts src/cli/commands/ncp/nextclaw-ncp-context-builder.test.ts`
- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter nextclaw exec tsc -p tsconfig.json --noEmit`
- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw/src/cli/commands/ncp/ncp-subagent-completion-message.ts packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.subagent-completion.test.ts`
- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint:maintainability:guard`
  - 本次命令失败，但失败来源是仓库里已有的无关改动：`packages/extensions/nextclaw-channel-plugin-feishu/src/bot.ts` 与 `packages/extensions/nextclaw-channel-plugin-feishu/src/bot.test.ts` 超出维护性预算继续增长。
  - 本次 NCP 相关改动的定向维护性检查通过，仅保留 `packages/nextclaw/src/cli/commands/ncp` 目录级既有 warning。

# 发布 / 部署方式

- 本次未执行发布。
- 后续按既有前端 / NCP 发布流程正常发布即可，无需额外 migration。

# 用户 / 产品视角的验收步骤

1. 在 NCP chat 中触发一次 `spawn`。
2. 等待 subagent 完成，观察父 agent 是否在不刷新页面的情况下继续回复，且界面不再出现 `invalid message role: system` 的 400 报错。
3. 重点确认父 agent 的续写明显把这次结果当成“内部 worker 完成通知”，而不是把它当成终端用户又发了一条新消息。
4. 若 subagent 已经完成用户请求，父 agent 应直接给用户结论；若还没完成，应继续推进后续动作。
