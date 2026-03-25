# v0.14.191-feishu-image-attachment-bridge

## 迭代完成说明

- 修复 Feishu/OpenClaw 插件 runtime 通过 `MediaPath` / `MediaPaths` / `MediaUrl` / `MediaUrls` 传入的图片媒体，在进入 NextClaw direct runtime 时被丢失的问题。
- 为 `service-plugin-runtime-bridge` 增加媒体到 `InboundMessage.attachments` 的标准化映射，保留本地图片与远程图片两种形态。
- 为 `GatewayAgentRuntimePool` 增加“有附件时走 `handleInbound`、无附件仍走 `processDirect`”的桥接分流，确保 direct runtime 能消费插件桥接过来的图片附件，同时把发布范围收束在 `nextclaw` 单包。
- 补充回归测试，覆盖单图、多图、remote-only 媒体三种桥接场景。

## 测试/验证/验收方式

- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc --noEmit`
- 单元测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw exec vitest run src/cli/commands/service-plugin-runtime-bridge.test.ts src/cli/commands/agent-runtime-pool.command.test.ts`
- 可维护性检查：
  - `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw/src/cli/commands/agent-runtime-pool.ts packages/nextclaw/src/cli/commands/agent-runtime-pool.command.test.ts packages/nextclaw/src/cli/commands/service-plugin-runtime-bridge.ts packages/nextclaw/src/cli/commands/service-plugin-runtime-bridge.test.ts`

## 发布/部署方式

- 本次为 `nextclaw` CLI/runtime 修复，无独立前端发布步骤。
- 合入后按常规 NextClaw 发布链路发布 `nextclaw` 即可。
- 若线上 Feishu 机器人已在运行，发布后重启对应 NextClaw 服务进程，使新的 plugin runtime bridge 生效。

## 用户/产品视角的验收步骤

1. 在启用 Feishu channel plugin 的 NextClaw 服务上部署本次版本并重启服务。
2. 在飞书会话里发送一张图片，并附一句简单文字，例如“这张图里有什么？”。
3. 观察机器人回复是否基于图片内容作答，而不是只把图片当成普通文本占位或完全忽略。
4. 再发送仅图片、不带文字的消息，确认机器人依然能收到图片上下文并给出合理响应。
