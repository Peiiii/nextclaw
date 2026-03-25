# 迭代完成说明

- 移除 NCP 当前 turn 在检测到图片时自动切换视觉模型的隐式逻辑，模型选择现在始终严格跟随用户当前选中的模型。
- 补强 NCP 上下文测试，覆盖“当前消息带图”和“历史消息带图、下一轮纯文本追问”两条链路，确保历史图片仍会进入当前模型上下文。
- 升级 `apps/ncp-demo` 的 UI smoke，用真实浏览器复现“两轮对话”：第一轮验证当前图片可见，第二轮验证历史图片在纯文本追问时仍可见。

# 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/nextclaw-ncp-context-builder.test.ts src/cli/commands/ncp/nextclaw-agent-session-store.test.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/ncp-demo build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/ncp-demo lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/ncp-demo exec node scripts/smoke-ui.mjs`
- `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-current-turn.ts packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-context-builder.ts packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-context-builder.test.ts apps/ncp-demo/scripts/smoke-ui.mjs`

# 发布/部署方式

- 本次未执行正式发布。
- 若后续需要发布，按既有前端与 CLI 发布流程执行，并复跑上述 smoke，重点确认“保持当前模型不变”与“历史图片追问可见”两项行为。

# 用户/产品视角的验收步骤

1. 在 NCP 前端保持任意当前已选模型，不切换模型。
2. 粘贴或上传一张图片，并发送“如果你能看到这张图，只回复 image-received”。
3. 确认 assistant 返回 `image-received`，且输入框内图片 token 的光标行为正常。
4. 紧接着发送纯文本“如果你还能看到上一条里的图，只回复 image-still-visible”。
5. 确认 assistant 返回 `image-still-visible`，说明历史图片仍进入当前模型上下文，且系统未偷偷切换模型。
